import {Hono} from 'hono';
import type {Context} from 'hono';

type Bindings = {
  JOBS: KVNamespace;
  RENDERS: R2Bucket;
  UPLOAD_TOKEN: string;
  DISPATCH_TOKEN: string;
  ACCESS_CODE?: string;
  GH_OWNER: string;
  GH_REPO: string;
  GH_REF: string;
  WORKFLOW_FILE: string;
  ALLOWED_ORIGINS: string;
  MAX_RENDERS_PER_DAY: string;
  RETENTION_DAYS: string;
  ALLOWED_IMAGE_HOSTS: string;
};

type Ctx = Context<{Bindings: Bindings}>;
// 'cancelled' = dibatalkan pengguna lewat POST /api/jobs/:id/cancel (status akhir, sama seperti done/failed).
type JobStatus = 'queued' | 'rendering' | 'done' | 'failed' | 'cancelled';

type Job = {
  id: string;
  status: JobStatus;
  template: string;
  ratio: string;
  createdAt: string;
  updatedAt: string;
  message?: string;
  runUrl?: string;
  size?: number;
  // true bila thumbnail JPEG sudah diunggah ke R2 (thumbs/<id>.jpg).
  thumb?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TEMPLATE_RE = /^[A-Za-z0-9_-]{1,40}$/;
const RATIOS = ['9:16', '16:9'];
const MAX_PROPS_CHARS = 20_000;
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_ASSET_SELECTIONS = 20;
const ASSET_RETENTION_PREFIXES = ['renders/', 'thumbs/', 'assets/', 'asset-quota/'];
const JOB_TTL_SECONDS = 7 * 24 * 3600;

// Template kode kustom: kode pengguna disimpan sementara di KV, lalu diambil oleh GitHub Actions.
const CUSTOM_TEMPLATE = 'CustomCode';
const MAX_CODE_CHARS = 100_000;
const CODE_TTL_SECONDS = 24 * 3600;

function isAllowedImageUrl(value: unknown, env: Bindings): boolean {
  if (typeof value !== 'string' || !value || value.length > MAX_IMAGE_URL_LENGTH) return false;
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    const allowed = (env.ALLOWED_IMAGE_HOSTS ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
    const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host === 'localhost' || host.endsWith('.localhost');
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !isIp && allowed.includes(host);
  } catch { return false; }
}
function validateCustomImageSources(code: string, env: Bindings): string | null {
  if (/\bfetch\s*\(/.test(code)) return 'fetch() tidak diizinkan; gunakan <Img> dengan URL gambar allowlist.';
  if (/<img\b/.test(code)) return 'Gunakan komponen <Img> dari remotion, bukan elemen <img>.';
  for (const match of code.matchAll(/<Img\b([^>]*)>/gs)) {
    const attrs = match[1];
    const src = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*staticFile\(\s*(['"])(.*?)\3\s*\)\s*\})/.exec(attrs);
    if (!src) return '<Img> wajib memakai URL literal allowlist atau staticFile() dengan path literal.';
    const value = src[1] ?? src[2] ?? src[4] ?? '';
    if (/^https?:\/\//i.test(value)) {
      if (!isAllowedImageUrl(value, env)) return 'URL gambar harus HTTPS dan host-nya ada di ALLOWED_IMAGE_HOSTS.';
      if (!/\bonError\s*=/.test(attrs)) return 'Setiap <Img> dari URL wajib memiliki onError dan fallback visual.';
    } else if (src[4] === undefined || !value || value.startsWith('/') || value.includes('..')) {
      return 'Aset lokal <Img> wajib memakai staticFile() dengan path relatif tanpa .. .';
    }
  }
  if (/<Audio\b[^>]*src\s*=\s*["']https?:\/\//i.test(code)) return 'Audio eksternal tidak diizinkan; gunakan staticFile() untuk audio lokal.';
  return null;
}
type AssetRule = {type: 'image' | 'audio' | 'font'; extension: string; maxBytes: number; mime: string};
const ASSET_RULES: Record<string, AssetRule> = {
  'image/png': {type: 'image', extension: 'png', maxBytes: 5 * 1024 * 1024, mime: 'image/png'},
  'image/jpeg': {type: 'image', extension: 'jpg', maxBytes: 5 * 1024 * 1024, mime: 'image/jpeg'},
  'image/webp': {type: 'image', extension: 'webp', maxBytes: 5 * 1024 * 1024, mime: 'image/webp'},
  'audio/mpeg': {type: 'audio', extension: 'mp3', maxBytes: 15 * 1024 * 1024, mime: 'audio/mpeg'},
  'audio/mp3': {type: 'audio', extension: 'mp3', maxBytes: 15 * 1024 * 1024, mime: 'audio/mpeg'},
  'audio/wav': {type: 'audio', extension: 'wav', maxBytes: 15 * 1024 * 1024, mime: 'audio/wav'},
  'audio/x-wav': {type: 'audio', extension: 'wav', maxBytes: 15 * 1024 * 1024, mime: 'audio/wav'},
  'audio/ogg': {type: 'audio', extension: 'ogg', maxBytes: 15 * 1024 * 1024, mime: 'audio/ogg'},
  'audio/aac': {type: 'audio', extension: 'aac', maxBytes: 15 * 1024 * 1024, mime: 'audio/aac'},
  'font/woff2': {type: 'font', extension: 'woff2', maxBytes: 2 * 1024 * 1024, mime: 'font/woff2'},
  'font/woff': {type: 'font', extension: 'woff', maxBytes: 2 * 1024 * 1024, mime: 'font/woff'},
  'font/ttf': {type: 'font', extension: 'ttf', maxBytes: 2 * 1024 * 1024, mime: 'font/ttf'},
  'font/otf': {type: 'font', extension: 'otf', maxBytes: 2 * 1024 * 1024, mime: 'font/otf'},
  'application/font-woff': {type: 'font', extension: 'woff', maxBytes: 2 * 1024 * 1024, mime: 'font/woff'},
  'application/x-font-ttf': {type: 'font', extension: 'ttf', maxBytes: 2 * 1024 * 1024, mime: 'font/ttf'},
  'application/vnd.ms-opentype': {type: 'font', extension: 'otf', maxBytes: 2 * 1024 * 1024, mime: 'font/otf'},
};
const ASSET_KEY_RE = /^assets\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp|mp3|wav|ogg|aac|woff2|woff|ttf|otf)$/;

function jakartaDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return get('year') + '-' + get('month') + '-' + get('day');
}

async function requireAccessCode(c: Ctx): Promise<boolean> {
  return Boolean(c.env.ACCESS_CODE) && safeEqual(c.req.header('x-access-code') ?? '', c.env.ACCESS_CODE ?? '');
}

function hasSignature(bytes: Uint8Array, mime: string): boolean {
  const ascii = (offset: number, value: string) => value.split('').every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));
  if (mime === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 'PNG') && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/webp') return bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP');
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WAVE');
  if (mime === 'audio/ogg') return bytes.length >= 4 && ascii(0, 'OggS');
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return bytes.length >= 3 && (ascii(0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (mime === 'audio/aac') return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
  if (mime === 'font/woff2') return bytes.length >= 4 && ascii(0, 'wOF2');
  if (mime === 'font/woff' || mime === 'application/font-woff') return bytes.length >= 4 && ascii(0, 'wOFF');
  if (mime === 'font/ttf' || mime === 'application/x-font-ttf') return bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0;
  if (mime === 'font/otf' || mime === 'application/vnd.ms-opentype') return bytes.length >= 4 && ascii(0, 'OTTO');
  return false;
}

function assetSignature(env: Bindings, key: string, expires: string): Promise<string> {
  const enc = new TextEncoder();
  return (async () => {
    const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(env.ACCESS_CODE ?? ''), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
    const signed = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(key + '\n' + expires)));
    return Array.from(signed, (byte) => byte.toString(16).padStart(2, '0')).join('');
  })();
}

async function signedAssetUrl(env: Bindings, origin: string, key: string): Promise<{path: string; url: string}> {
  const expires = String(Math.floor(Date.now() / 1000) + 6 * 3600);
  const signature = await assetSignature(env, key, expires);
  const encodedPath = key.slice('assets/'.length);
  return {path: encodedPath, url: origin + '/assets/' + encodedPath + '?expires=' + expires + '&signature=' + signature};
}

const app = new Hono<{Bindings: Bindings}>();

// CORS: hanya origin yang terdaftar di ALLOWED_ORIGINS.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  const allowed = (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code');
  }
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

const objectKey = (id: string) => `renders/${id}.mp4`;
const thumbKey = (id: string) => `thumbs/${id}.jpg`;
const codeKey = (id: string) => `code:${id}`;
const nowIso = () => new Date().toISOString();

async function getJob(env: Bindings, id: string): Promise<Job | null> {
  return env.JOBS.get<Job>(`job:${id}`, 'json');
}

async function saveJob(env: Bindings, job: Job): Promise<Job> {
  const next: Job = {...job, updatedAt: nowIso()};
  await env.JOBS.put(`job:${job.id}`, JSON.stringify(next), {expirationTtl: JOB_TTL_SECONDS});
  return next;
}

// Bandingkan dua string lewat hash SHA-256 agar waktu pembandingan konstan.
async function safeEqual(a: string, b: string): Promise<boolean> {
  if (!a || !b) {
    return false;
  }
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(x, y);
}

// Token Bearer dari GitHub Actions (UPLOAD_TOKEN).
async function authorized(c: Ctx): Promise<boolean> {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return safeEqual(token, c.env.UPLOAD_TOKEN ?? '');
}

app.get('/', (c) => c.json({name: 'remotion-api', ok: true}));

// 1) UI meminta render: buat job di KV lalu picu GitHub Actions.
app.post('/api/render', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    template?: unknown;
    ratio?: unknown;
    props?: unknown;
    code?: unknown;
    accessCode?: unknown;
    assets?: unknown;
  } | null;

  if (!body || typeof body.template !== 'string' || !TEMPLATE_RE.test(body.template)) {
    return c.json({error: 'template tidak valid'}, 400);
  }
  const ratio = body.ratio ?? '9:16';
  if (typeof ratio !== 'string' || !RATIOS.includes(ratio)) {
    return c.json({error: 'ratio harus 9:16 atau 16:9'}, 400);
  }
  const props = (body.props ?? {}) as Record<string, unknown>;
  if (typeof props !== 'object' || props === null || Array.isArray(props)) {
    return c.json({error: 'props harus berupa object'}, 400);
  }
  if (Object.prototype.hasOwnProperty.call(props, 'imageUrl') && props.imageUrl !== '' && !isAllowedImageUrl(props.imageUrl, c.env)) return c.json({error: 'URL gambar harus HTTPS dan berasal dari domain yang diizinkan'}, 400);
  const assetKeys = Array.isArray(body.assets) ? body.assets : [];
  if (assetKeys.length > MAX_ASSET_SELECTIONS || assetKeys.some((key) => typeof key !== 'string' || !ASSET_KEY_RE.test(key))) return c.json({error: 'Daftar aset tidak valid (maksimal 20 file)'}, 400);
  if (assetKeys.length > 0 && !(await requireAccessCode(c))) return c.json({error: 'Kode akses diperlukan untuk memakai aset pribadi'}, 401);
  const uniqueAssetKeys = [...new Set(assetKeys as string[])];
  const assetObjects = await Promise.all(uniqueAssetKeys.map((key) => c.env.RENDERS.head(key)));
  if (assetObjects.some((obj) => !obj || !obj.customMetadata?.assetType)) return c.json({error: 'Satu atau lebih aset tidak ditemukan atau tidak valid'}, 400);
  const origin = new URL(c.req.url).origin;
  const signedAssets = await Promise.all(uniqueAssetKeys.map((key) => signedAssetUrl(c.env, origin, key)));
  const propsJson = JSON.stringify(props);
  if (propsJson.length > MAX_PROPS_CHARS) {
    return c.json({error: 'props terlalu besar'}, 413);
  }

  // Kode kustom = eksekusi kode di GitHub Actions, jadi wajib kode akses (fail-closed bila belum diset).
  let code: string | undefined;
  if (body.template === CUSTOM_TEMPLATE) {
    if (!c.env.ACCESS_CODE) {
      return c.json({error: 'Fitur kode kustom belum aktif (secret ACCESS_CODE belum diisi)'}, 403);
    }
    if (typeof body.accessCode !== 'string' || !(await safeEqual(body.accessCode, c.env.ACCESS_CODE))) {
      return c.json({error: 'Kode akses salah'}, 401);
    }
    if (typeof body.code !== 'string' || body.code.trim() === '') {
      return c.json({error: 'kode kosong'}, 400);
    }
    if (body.code.length > MAX_CODE_CHARS) {
      return c.json({error: 'kode terlalu panjang (maks 100.000 karakter)'}, 413);
    }
    if (!/export\s+default\b/.test(body.code)) {
      return c.json({error: 'kode harus punya export default (komponen React)'}, 400);
    }
    const assetError = validateCustomImageSources(body.code, c.env);
    if (assetError) return c.json({error: assetError}, 400);
    code = body.code;
  }

  const limit = Number(c.env.MAX_RENDERS_PER_DAY || 50);
  const quotaKey = `quota:${new Date().toISOString().slice(0, 10)}`;
  const used = Number((await c.env.JOBS.get(quotaKey)) ?? 0);
  if (used >= limit) {
    return c.json({error: 'Kuota render harian habis, coba lagi besok'}, 429);
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  let job = await saveJob(c.env, {
    id,
    status: 'queued',
    template: body.template,
    ratio,
    createdAt,
    updatedAt: createdAt,
  });
  if (code !== undefined) {
    await c.env.JOBS.put(codeKey(id), code, {expirationTtl: CODE_TTL_SECONDS});
  }

  const dispatchUrl = `https://api.github.com/repos/${c.env.GH_OWNER}/${c.env.GH_REPO}/actions/workflows/${c.env.WORKFLOW_FILE}/dispatches`;
  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'remotion-api-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: c.env.GH_REF,
      inputs: {jobId: id, template: body.template, ratio, props: propsJson, assets: JSON.stringify(signedAssets)},
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error('dispatch gagal', res.status, detail);
    if (code !== undefined) {
      await c.env.JOBS.delete(codeKey(id));
    }
    job = await saveJob(c.env, {
      ...job,
      status: 'failed',
      message: `Gagal memicu GitHub Actions (HTTP ${res.status})`,
    });
    return c.json({error: job.message, jobId: id}, 502);
  }

  await c.env.JOBS.put(quotaKey, String(used + 1), {expirationTtl: 172800});
  return c.json({jobId: id}, 202);
});

// 2) UI polling status job.
app.get('/api/jobs/:id', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({error: 'id tidak valid'}, 400);
  }
  const job = await getJob(c.env, id);
  if (!job) {
    return c.json({error: 'job tidak ditemukan'}, 404);
  }
  const origin = new URL(c.req.url).origin;
  return c.json({
    ...job,
    videoUrl: job.status === 'done' ? `${origin}/files/${job.id}.mp4` : null,
    // Thumbnail tersedia begitu diunggah (bisa lebih dulu dari video).
    thumbUrl: job.thumb ? `${origin}/thumbs/${job.id}.jpg` : null,
  });
});

// 2a) UI membatalkan render yang masih antre/berjalan.
// Urutan penting: tandai 'cancelled' di KV DULU (supaya /upload menolak hasil render yang terlambat),
// baru minta GitHub menghentikan run. Bila run belum melapor (masih antre), workflow akan
// mendapat HTTP 409 saat melapor status dan berhenti sendiri.
app.post('/api/jobs/:id/cancel', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({error: 'id tidak valid'}, 400);
  }
  const job = await getJob(c.env, id);
  if (!job) {
    return c.json({error: 'job tidak ditemukan'}, 404);
  }
  if (job.status !== 'queued' && job.status !== 'rendering') {
    return c.json({error: `job sudah ${job.status}, tidak bisa dibatalkan`, status: job.status}, 409);
  }

  const saved = await saveJob(c.env, {...job, status: 'cancelled', message: 'Dibatalkan oleh pengguna'});
  await c.env.JOBS.delete(codeKey(id));

  const runId = /\/actions\/runs\/(\d+)/.exec(job.runUrl ?? '')?.[1];
  if (runId) {
    const res = await fetch(
      `https://api.github.com/repos/${c.env.GH_OWNER}/${c.env.GH_REPO}/actions/runs/${runId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'remotion-api-worker',
        },
      },
    );
    // Gagal membatalkan run bukan masalah fatal: job sudah 'cancelled', hasil upload akan ditolak.
    if (!res.ok) {
      console.error('cancel run gagal', res.status, (await res.text()).slice(0, 300));
    }
  }
  return c.json(saved);
});

// 2b) GitHub Actions mengambil kode kustom milik job (dilindungi token).
app.get('/api/jobs/:id/code', async (c) => {
  if (!(await authorized(c))) {
    return c.json({error: 'unauthorized'}, 401);
  }
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({error: 'id tidak valid'}, 400);
  }
  const code = await c.env.JOBS.get(codeKey(id));
  if (code === null) {
    return c.json({error: 'kode tidak ditemukan'}, 404);
  }
  return c.text(code);
});

// 3) GitHub Actions melaporkan status (rendering / failed).
app.post('/api/jobs/:id/status', async (c) => {
  if (!(await authorized(c))) {
    return c.json({error: 'unauthorized'}, 401);
  }
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({error: 'id tidak valid'}, 400);
  }
  const job = await getJob(c.env, id);
  if (!job) {
    return c.json({error: 'job tidak ditemukan'}, 404);
  }
  const body = (await c.req.json().catch(() => null)) as {
    status?: unknown;
    message?: unknown;
    runUrl?: unknown;
  } | null;
  if (!body || (body.status !== 'rendering' && body.status !== 'failed')) {
    return c.json({error: 'status harus rendering atau failed'}, 400);
  }
  if (job.status === 'done') {
    return c.json(job);
  }
  // 409 = sinyal ke workflow bahwa job sudah dibatalkan dan run harus berhenti.
  if (job.status === 'cancelled') {
    return c.json(job, 409);
  }
  const runUrl =
    typeof body.runUrl === 'string' && body.runUrl.startsWith('https://github.com/')
      ? body.runUrl
      : job.runUrl;
  const message = typeof body.message === 'string' ? body.message.slice(0, 500) : job.message;
  return c.json(await saveJob(c.env, {...job, status: body.status, runUrl, message}));
});

// 4) GitHub Actions mengunggah MP4 (dilindungi token) -> disimpan di R2.
app.on(['POST', 'PUT'], '/upload', async (c) => {
  if (!(await authorized(c))) {
    return c.json({error: 'unauthorized'}, 401);
  }
  const jobId = c.req.query('jobId') ?? '';
  if (!UUID_RE.test(jobId)) {
    return c.json({error: 'jobId tidak valid'}, 400);
  }
  const job = await getJob(c.env, jobId);
  if (!job) {
    return c.json({error: 'job tidak ditemukan'}, 404);
  }
  if (job.status === 'cancelled') {
    return c.json({error: 'job dibatalkan'}, 409);
  }
  const length = Number(c.req.header('content-length') ?? 0);
  if (!length || !c.req.raw.body) {
    return c.json({error: 'body kosong atau Content-Length tidak ada'}, 411);
  }
  if (length > MAX_UPLOAD_BYTES) {
    return c.json({error: 'file terlalu besar (maks 90 MB)'}, 413);
  }

  await c.env.RENDERS.put(objectKey(jobId), c.req.raw.body, {
    httpMetadata: {contentType: 'video/mp4'},
  });
  // Baca ulang job: thumbnail mungkin baru saja menambah field `thumb`.
  const fresh = (await getJob(c.env, jobId)) ?? job;
  await saveJob(c.env, {...fresh, status: 'done', size: length, message: undefined});
  return c.json({ok: true, url: `/files/${jobId}.mp4`, size: length});
});

// 4b) GitHub Actions mengunggah thumbnail JPEG (dilindungi token) -> thumbs/<id>.jpg di R2.
app.on(['POST', 'PUT'], '/upload-thumb', async (c) => {
  if (!(await authorized(c))) {
    return c.json({error: 'unauthorized'}, 401);
  }
  const jobId = c.req.query('jobId') ?? '';
  if (!UUID_RE.test(jobId)) {
    return c.json({error: 'jobId tidak valid'}, 400);
  }
  const job = await getJob(c.env, jobId);
  if (!job) {
    return c.json({error: 'job tidak ditemukan'}, 404);
  }
  if (job.status === 'cancelled') {
    return c.json({error: 'job dibatalkan'}, 409);
  }
  const length = Number(c.req.header('content-length') ?? 0);
  if (!length || !c.req.raw.body) {
    return c.json({error: 'body kosong atau Content-Length tidak ada'}, 411);
  }
  if (length > MAX_THUMB_BYTES) {
    return c.json({error: 'thumbnail terlalu besar (maks 2 MB)'}, 413);
  }

  await c.env.RENDERS.put(thumbKey(jobId), c.req.raw.body, {
    httpMetadata: {contentType: 'image/jpeg'},
  });
  await saveJob(c.env, {...job, thumb: true});
  return c.json({ok: true, url: `/thumbs/${jobId}.jpg`, size: length});
});

// Upload aset pribadi: hanya pemilik dengan ACCESS_CODE; kuota 10 slot/hari dijaga atomik di R2.
app.post('/api/assets', async (c) => {
  if (!(await requireAccessCode(c))) return c.json({error: 'Kode akses salah atau belum dikonfigurasi'}, 401);
  const length = Number(c.req.header('content-length') ?? 0);
  if (length > 16 * 1024 * 1024) return c.json({error: 'Request terlalu besar'}, 413);
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return c.json({error: 'Pilih satu file aset'}, 400);
  const rule = ASSET_RULES[file.type.toLowerCase()];
  if (!rule) return c.json({error: 'Format tidak didukung. Gunakan PNG/JPEG/WebP, MP3/WAV/OGG/AAC, atau WOFF/WOFF2/TTF/OTF.'}, 415);
  if (file.size <= 0 || file.size > rule.maxBytes) return c.json({error: 'Ukuran file melewati batas untuk jenis aset ini'}, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasSignature(bytes, file.type.toLowerCase())) return c.json({error: 'Isi file tidak cocok dengan MIME type yang dikirim'}, 415);

  const date = jakartaDate();
  let slotKey = '';
  for (let slot = 1; slot <= 10; slot++) {
    const candidate = 'asset-quota/' + date + '/' + String(slot).padStart(2, '0');
    const reserved = await c.env.RENDERS.put(candidate, crypto.randomUUID(), {onlyIf: {etagDoesNotMatch: '*'}, httpMetadata: {contentType: 'text/plain'}});
    if (reserved) { slotKey = candidate; break; }
  }
  if (!slotKey) return c.json({error: 'Kuota upload hari ini habis (maksimal 10 file)'}, 429);

  const id = crypto.randomUUID();
  const key = 'assets/' + date + '/' + id + '.' + rule.extension;
  const originalName = file.name.replace(/[\/\u0000-\u001f]/g, '_').slice(0, 120) || 'asset.' + rule.extension;
  try {
    await c.env.RENDERS.put(key, bytes, {
      httpMetadata: {contentType: rule.mime, cacheControl: 'private, max-age=3600'},
      customMetadata: {assetId: id, assetType: rule.type, originalName, uploadedAt: nowIso()},
    });
  } catch (error) {
    await c.env.RENDERS.delete(slotKey);
    throw error;
  }
  return c.json({ok: true, id, path: key, type: rule.type, name: originalName, contentType: rule.mime, size: file.size, uploadedAt: nowIso()}, 201);
});

// Daftar aset pribadi beserta URL pratinjau sementara; daftar dan metadata tidak publik.
app.get('/api/assets', async (c) => {
  if (!(await requireAccessCode(c))) return c.json({error: 'Kode akses salah atau belum dikonfigurasi'}, 401);
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await c.env.RENDERS.list({prefix: 'assets/', cursor, limit: 100, include: ['httpMetadata', 'customMetadata']});
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && objects.length < 200);
  const origin = new URL(c.req.url).origin;
  const assets = await Promise.all(objects.map(async (obj) => {
    const signed = await signedAssetUrl(c.env, origin, obj.key);
    return {path: obj.key, staticPath: signed.path, name: obj.customMetadata?.originalName ?? obj.key.split('/').pop(), type: obj.customMetadata?.assetType ?? 'unknown', contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream', size: obj.size, uploadedAt: obj.customMetadata?.uploadedAt ?? obj.uploaded.toISOString(), previewUrl: signed.url};
  }));
  assets.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return c.json({assets, uploadLimit: 10, retentionDays: Number(c.env.RETENTION_DAYS || 7)});
});

// URL baca bertanda tangan HMAC, berlaku maksimal 6 jam; tidak memakai UPLOAD_TOKEN.
app.get('/assets/:date/:name', async (c) => {
  const date = c.req.param('date'), name = c.req.param('name');
  const key = 'assets/' + date + '/' + name;
  const expires = c.req.query('expires') ?? '', signature = c.req.query('signature') ?? '';
  const exp = Number(expires), now = Math.floor(Date.now() / 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[0-9a-f-]{36}\.(?:png|jpg|webp|mp3|wav|ogg|aac|woff2|woff|ttf|otf)$/.test(name) || !Number.isInteger(exp) || exp < now || exp > now + 6 * 3600 || !c.env.ACCESS_CODE) return c.json({error: 'link aset tidak valid atau kedaluwarsa'}, 403);
  if (!(await safeEqual(signature, await assetSignature(c.env, key, expires)))) return c.json({error: 'signature tidak valid'}, 403);
  const obj = await c.env.RENDERS.get(key);
  if (!obj) return c.json({error: 'aset tidak ditemukan'}, 404);
  const headers = new Headers({'Cache-Control': 'private, max-age=300', ETag: obj.httpEtag, 'X-Content-Type-Options': 'nosniff'});
  obj.writeHttpMetadata(headers);
  headers.set('Content-Disposition', 'inline');
  return new Response(obj.body, {headers});
});

// 5) Sajikan MP4 dari R2 (mendukung Range agar bisa di-seek di pemutar).
app.get('/files/:name', async (c) => {
  const match = /^([0-9a-f-]{36})[.]mp4$/.exec(c.req.param('name'));
  if (!match || !UUID_RE.test(match[1])) {
    return c.json({error: 'tidak ditemukan'}, 404);
  }
  const id = match[1];
  const key = objectKey(id);
  const head = await c.env.RENDERS.head(key);
  if (!head) {
    return c.json({error: 'tidak ditemukan'}, 404);
  }
  const size = head.size;
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    ETag: head.httpEtag,
  });
  if (c.req.query('download')) {
    headers.set('Content-Disposition', `attachment; filename=video-${id.slice(0, 8)}.mp4`);
  }

  const range = c.req.header('range');
  if (range) {
    const m = /^bytes=([0-9]*)-([0-9]*)$/.exec(range);
    if (!m || (m[1] === '' && m[2] === '')) {
      return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
    }
    let start: number;
    let end: number;
    if (m[1] === '') {
      start = Math.max(size - Number(m[2]), 0);
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
    }
    const part = await c.env.RENDERS.get(key, {range: {offset: start, length: end - start + 1}});
    if (!part) {
      return c.json({error: 'tidak ditemukan'}, 404);
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(part.body, {status: 206, headers});
  }

  const obj = await c.env.RENDERS.get(key);
  if (!obj) {
    return c.json({error: 'tidak ditemukan'}, 404);
  }
  headers.set('Content-Length', String(size));
  return new Response(obj.body, {headers});
});

// 5b) Sajikan thumbnail JPEG dari R2.
app.get('/thumbs/:name', async (c) => {
  const match = /^([0-9a-f-]{36})[.]jpg$/.exec(c.req.param('name'));
  if (!match || !UUID_RE.test(match[1])) {
    return c.json({error: 'tidak ditemukan'}, 404);
  }
  const obj = await c.env.RENDERS.get(thumbKey(match[1]));
  if (!obj) {
    return c.json({error: 'tidak ditemukan'}, 404);
  }
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      ETag: obj.httpEtag,
    },
  });
});

app.notFound((c) => c.json({error: 'tidak ditemukan'}, 404));
app.onError((err, c) => {
  console.error('error tak tertangani', err);
  return c.json({error: 'kesalahan internal'}, 500);
});

// Cron harian: hapus MP4 dan thumbnail yang melewati masa simpan agar R2 tetap di bawah kuota gratis.
async function cleanup(env: Bindings): Promise<void> {
  const days = Number(env.RETENTION_DAYS || 7);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  for (const prefix of ASSET_RETENTION_PREFIXES) {
    let cursor: string | undefined;
    do {
      const list = await env.RENDERS.list({prefix, cursor, limit: 500});
      const old = list.objects.filter((o) => o.uploaded.getTime() < cutoff).map((o) => o.key);
      if (old.length > 0) {
        await env.RENDERS.delete(old);
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
  }
}

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(cleanup(env));
  },
};