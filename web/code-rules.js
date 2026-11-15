// Aturan aset dan jaringan untuk kode kustom: SATU sumber untuk dua pemakai.
//   - worker/src/index.ts : penjaga akhir (permintaan render ditolak bila ada isu)
//   - web/code-check.js   : umpan balik cepat di browser sebelum permintaan dikirim
// Dengan begitu daftar host, batas ukuran, dan aturan <Img>/<Audio>/URL tidak bisa berbeda antara
// browser dan Worker. File ini murni JS tanpa dependensi (web/ statis, tanpa build step); Worker
// mengimpornya lewat bundler bawaan Wrangler.
//
// Catatan: ini pagar pengaman berbasis pola teks, BUKAN sandbox. Pembatas sebenarnya adalah
// ACCESS_CODE dan UPLOAD_TOKEN yang tidak diberikan ke langkah render (lihat render.yml).

export const MAX_CODE_CHARS = 100000;
export const MAX_PROPS_CHARS = 20000;
export const MAX_IMAGE_URL_LENGTH = 2048;
// Host gambar eksternal yang boleh dipakai. Ubah di sini saja; prompt di web/prompts/ ikut diperbarui manual.
export const ALLOWED_IMAGE_HOSTS = ['images.unsplash.com', 'images.pexels.com', 'cdn.pixabay.com'];

// Namespace XML pada atribut xmlns (mis. <svg xmlns="http://www.w3.org/2000/svg">) hanya pengenal,
// bukan permintaan jaringan, jadi tidak dihitung sebagai URL eksternal.
const XML_NAMESPACES = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAllowedImageUrl(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_IMAGE_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host === 'localhost' || host.endsWith('.localhost');
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !isIp && ALLOWED_IMAGE_HOSTS.includes(host);
  } catch {
    return false;
  }
}

// ---- Pemindai tag JSX ------------------------------------------------------------------------
// Regex /<Img\b([^>]*)>/ berhenti di '>' pertama, termasuk '>' pada "=>" di dalam onError={() => ...}.
// Pemindai ini menghitung kurung kurawal seimbang dan melewati string/template di dalamnya,
// sehingga atribut sesudah onError tetap terbaca. Tag yang tidak bisa dibaca dianggap error (fail-closed).

// Lewati string yang dibuka di indeks i; kembalikan indeks setelah tanda kutip penutup.
// Di dalam {...} string tidak boleh melewati baris; nilai atribut JSX boleh (allowNewline).
function skipQuoted(code, i, allowNewline) {
  const quote = code[i];
  let j = i + 1;
  while (j < code.length && code[j] !== quote) {
    if (!allowNewline && code[j] === '\n') return j;
    if (code[j] === '\\') j++;
    j++;
  }
  return Math.min(j + 1, code.length);
}

function skipTemplate(code, i) {
  let j = i + 1;
  while (j < code.length) {
    const ch = code[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === '`') return j + 1;
    if (ch === '$' && code[j + 1] === '{') {
      j = skipBraces(code, j + 1);
      continue;
    }
    j++;
  }
  return code.length;
}

// i menunjuk '{'; kembalikan indeks setelah '}' pasangannya (atau code.length bila tidak ditemukan).
function skipBraces(code, i) {
  let depth = 0;
  let j = i;
  while (j < code.length) {
    const ch = code[j];
    if (ch === '"' || ch === "'") {
      j = skipQuoted(code, j, false);
      continue;
    }
    if (ch === '`') {
      j = skipTemplate(code, j);
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  return code.length;
}

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
const ATTR_NAME_RE = /[A-Za-z_$][\w$:.-]*/y;

/**
 * Baca atribut tingkat atas sebuah tag. `from` = indeks tepat setelah nama tag.
 * Mengembalikan null bila tag tidak lengkap atau bentuknya tidak didukung.
 * @param {string} code
 * @param {number} from
 * @returns {{attrs: Array<{name: string, kind: string, value: string, valueStart: number, valueEnd: number}>, end: number} | null}
 */
function readAttributes(code, from) {
  const n = code.length;
  const attrs = [];
  let i = from;
  while (i < n) {
    while (i < n && isSpace(code[i])) i++;
    const ch = code[i];
    if (ch === undefined) return null;
    if (ch === '>') return {attrs, end: i + 1};
    if (ch === '/' && code[i + 1] === '>') return {attrs, end: i + 2};
    if (ch === '{') {
      const close = skipBraces(code, i);
      if (code[close - 1] !== '}') return null;
      attrs.push({name: '...', kind: 'spread', value: code.slice(i + 1, close - 1), valueStart: i + 1, valueEnd: close - 1});
      i = close;
      continue;
    }
    ATTR_NAME_RE.lastIndex = i;
    const nameMatch = ATTR_NAME_RE.exec(code);
    if (!nameMatch) return null;
    const name = nameMatch[0];
    i += name.length;
    while (i < n && isSpace(code[i])) i++;
    if (code[i] !== '=') {
      attrs.push({name, kind: 'bool', value: '', valueStart: i, valueEnd: i});
      continue;
    }
    i++;
    while (i < n && isSpace(code[i])) i++;
    const v = code[i];
    if (v === '"' || v === "'") {
      const end = skipQuoted(code, i, true);
      if (end - 1 <= i || code[end - 1] !== v) return null;
      attrs.push({name, kind: 'string', value: code.slice(i + 1, end - 1), valueStart: i + 1, valueEnd: end - 1});
      i = end;
    } else if (v === '{') {
      const end = skipBraces(code, i);
      if (code[end - 1] !== '}') return null;
      attrs.push({name, kind: 'expr', value: code.slice(i + 1, end - 1), valueStart: i + 1, valueEnd: end - 1});
      i = end;
    } else {
      return null;
    }
  }
  return null;
}

const STATIC_FILE_RE = /^\s*staticFile\(\s*(['"])(.*?)\1\s*\)\s*$/s;
const isLocalPathOk = (path) => Boolean(path) && !path.startsWith('/') && !path.includes('..');

/**
 * Semua isu aset/jaringan pada kode kustom, berurutan sesuai kemunculan aturan.
 * Setiap isu bertingkat error (memblokir render). Worker memakai isu pertama; klien menampilkan semuanya.
 * @param {string} code
 * @returns {Array<{message: string, index: number}>}
 */
export function findCustomCodeIssues(code) {
  const issues = [];
  const add = (message, index) => issues.push({message, index});

  const fetchCall = /\bfetch\s*\(/.exec(code);
  if (fetchCall) add('fetch() tidak diizinkan; gunakan <Img> dengan URL gambar allowlist.', fetchCall.index);
  const rawImg = /<img\b/.exec(code);
  if (rawImg) add('Gunakan komponen <Img> dari remotion, bukan elemen <img>.', rawImg.index);
  const video = /<(?:OffthreadVideo|video)\b/i.exec(code);
  if (video) add('Video tidak termasuk jenis aset yang diaktifkan.', video.index);
  const altNetwork = /\b(?:XMLHttpRequest|WebSocket|EventSource)\b|new\s+Image\s*\(/.exec(code);
  if (altNetwork) add('API jaringan alternatif tidak diizinkan; URL eksternal hanya melalui <Img>.', altNetwork.index);

  // Rentang [mulai, akhir) yang boleh memuat URL http(s).
  const allowedUrlRanges = [];

  for (const match of code.matchAll(/<(Img|Audio)(?![\w$:.-])/g)) {
    const tagName = match[1];
    const tagStart = match.index ?? 0;
    const tag = readAttributes(code, tagStart + match[0].length);
    if (!tag) {
      add(`Tag <${tagName}> tidak lengkap atau terlalu rumit untuk diperiksa; tulis atributnya sederhana dan tutup dengan > atau />.`, tagStart);
      continue;
    }
    const src = tag.attrs.find((attr) => attr.name === 'src');
    const staticPath = src && src.kind === 'expr' ? STATIC_FILE_RE.exec(src.value) : null;

    if (tagName === 'Audio') {
      if (!staticPath || !isLocalPathOk(staticPath[2])) add('<Audio> wajib memakai staticFile() dengan path lokal literal.', tagStart);
      continue;
    }

    if (!src || (src.kind !== 'string' && !staticPath)) {
      add('<Img> wajib memakai URL literal allowlist atau staticFile() dengan path literal.', tagStart);
    } else if (src.kind === 'string' && /^https?:\/\//i.test(src.value)) {
      if (!isAllowedImageUrl(src.value)) {
        add(`URL gambar harus HTTPS dari domain allowlist (${ALLOWED_IMAGE_HOSTS.join(', ')}).`, tagStart);
      }
      if (!tag.attrs.some((attr) => attr.name === 'onError' && attr.kind === 'expr')) {
        add('Setiap <Img> dari URL wajib memiliki onError dan fallback visual.', tagStart);
      }
      allowedUrlRanges.push([src.valueStart, src.valueEnd]);
    } else if (!staticPath || !isLocalPathOk(staticPath[2])) {
      add('Aset lokal <Img> wajib memakai staticFile() dengan path relatif tanpa .. .', tagStart);
    }
  }

  for (const match of code.matchAll(/\bxmlns(?::[A-Za-z][\w-]*)?\s*=\s*(["'])(https?:\/\/[^"']*)\1/g)) {
    if (!XML_NAMESPACES.has(match[2])) continue;
    const valueStart = (match.index ?? 0) + match[0].lastIndexOf(match[2]);
    allowedUrlRanges.push([valueStart, valueStart + match[2].length]);
  }

  for (const match of code.matchAll(/https?:\/\/[^\s"'\x60<>]+/g)) {
    const position = match.index ?? 0;
    if (!allowedUrlRanges.some(([from, to]) => position >= from && position < to)) {
      add('URL jaringan hanya boleh berada di src <Img> dan memakai domain allowlist. URL di komentar atau string lain juga ikut diperiksa.', position);
    }
  }
  return issues;
}
