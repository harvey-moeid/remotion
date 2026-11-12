/**
 * Service worker Byga — Remotion Studio.
 *
 * Tujuan: aplikasi bisa dipasang (PWA) dan kerangkanya (HTML, CSS, JS, ikon,
 * master prompt) tetap terbuka saat offline. Render video tetap butuh koneksi.
 *
 * Strategi:
 *  - Install   : pra-cache kerangka aplikasi + semua master prompt di prompts/index.json.
 *  - Navigasi  : network-first; offline / server error -> kerangka tersimpan -> offline.html.
 *  - Aset sama-origin (JS, CSS, ikon, prompt): network-first (selalu terbaru saat online,
 *    jadi modul JS tidak pernah tercampur versi lama dan baru); batas tunggu 6 dtk bila
 *    salinan cache ada, lalu pakai cache.
 *  - Google Fonts: stale-while-revalidate (cache terpisah, bertahan antar versi).
 *  - TIDAK PERNAH disentuh: API Worker / video / thumbnail (lintas origin), metode non-GET,
 *    permintaan Range, dan unduhan (?download=1). Semuanya langsung ke jaringan.
 *  - Update: versi baru menunggu (tidak skipWaiting otomatis) sampai halaman mengirim
 *    {type: 'SKIP_WAITING'} dari tombol "Muat ulang" di pwa.js, supaya pengguna yang sedang
 *    mengetik kode komposisi tidak kehilangan pekerjaan karena reload mendadak.
 *
 * BUILD diganti dengan SHA commit oleh deploy.yml (lihat README) agar tiap deploy
 * mengubah byte sw.js dan memicu update. Tanpa penggantian (mis. server lokal) tetap berfungsi.
 */
const BUILD = '__BUILD_ID__';
const PRECACHE = `byga-precache-${BUILD}`;
const FONT_CACHE = 'byga-fonts-v1';
const NETWORK_TIMEOUT_MS = 6000;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const SCOPE = self.registration.scope; // selalu diakhiri '/'
const ROOT_URL = SCOPE;
const OFFLINE_URL = new URL('offline.html', SCOPE).href;
const PROMPT_INDEX = 'prompts/index.json';

// Kerangka aplikasi. Semua file di web/ yang dimuat halaman harus terdaftar di sini.
const CORE_ASSETS = [
  './',
  'offline.html',
  'manifest.webmanifest',
  'styles.css',
  'prompt-library.css',
  'brand.css',
  'pwa.css',
  'app.js',
  'config.js',
  'templates.js',
  'editor.js',
  'lexer.js',
  'code-check.js',
  'prompt-library.js',
  'pwa.js',
  PROMPT_INDEX,
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

const absolute = (path) => new URL(path, SCOPE).href;

/**
 * Salin respons tanpa penanda "redirected". Cloudflare Pages mengalihkan /offline.html ke
 * /offline; respons hasil redirect ditolak browser bila dipakai menjawab navigasi.
 */
async function cleanResponse(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
}

async function precacheOne(cache, path) {
  const request = new Request(absolute(path), {cache: 'reload'});
  const response = await fetch(request);
  if (!response.ok) throw new Error(`Pra-cache gagal: ${path} (HTTP ${response.status})`);
  await cache.put(request.url, await cleanResponse(response));
}

/** Master prompt (.md) dibaca dari manifest, jadi menambah prompt tidak perlu mengubah file ini. */
async function precachePrompts(cache) {
  try {
    const stored = await cache.match(absolute(PROMPT_INDEX), {ignoreVary: true});
    if (!stored) return;
    const manifest = await stored.json();
    const files = (manifest.prompts || [])
      .map((item) => item && item.file)
      .filter((file) => typeof file === 'string' && /^[\w.-]+\.md$/.test(file));
    await Promise.allSettled(files.map((file) => precacheOne(cache, `prompts/${file}`)));
  } catch {
    /* tidak fatal: prompt tetap ter-cache saat dibuka pertama kali (runtime) */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    // Atomik: bila satu file inti gagal diunduh, install dibatalkan dan dicoba ulang nanti.
    await Promise.all(CORE_ASSETS.map((path) => precacheOne(cache, path)));
    await precachePrompts(cache);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith('byga-precache-') && name !== PRECACHE)
        .map((name) => caches.delete(name)),
    );
    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.enable();
      } catch {
        /* tidak didukung: abaikan */
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const isCacheable = (response) => response.ok && response.status === 200 && response.type === 'basic';

function putSafely(event, cache, request, response) {
  const job = cache.put(request, response).catch(() => {});
  try {
    event.waitUntil(job);
  } catch {
    /* event sudah selesai (respons datang terlambat): penyimpanan tetap berjalan */
  }
}

function isRootNavigation(url) {
  const scopePath = new URL(SCOPE).pathname;
  return url.pathname === scopePath || url.pathname === `${scopePath}index.html`;
}

async function handleNavigation(event) {
  const url = new URL(event.request.url);
  let response = null;
  try {
    const preloaded = event.preloadResponse ? await event.preloadResponse : undefined;
    response = preloaded || await fetch(event.request);
  } catch {
    response = null; // offline / jaringan gagal
  }

  if (response && response.status < 500) {
    if (response.ok && response.type === 'basic' && isRootNavigation(url)) {
      // Simpan kerangka terbaru untuk dipakai offline (tanpa query string).
      const copy = response.clone();
      event.waitUntil((async () => {
        try {
          const cache = await caches.open(PRECACHE);
          await cache.put(ROOT_URL, await cleanResponse(copy));
        } catch {
          /* abaikan */
        }
      })());
    }
    return response;
  }

  // Offline atau server error (5xx): pakai kerangka tersimpan, lalu halaman offline.
  const cache = await caches.open(PRECACHE);
  return (await cache.match(ROOT_URL, {ignoreSearch: true, ignoreVary: true}))
    || (await cache.match(OFFLINE_URL, {ignoreVary: true}))
    || response
    || Response.error();
}

async function networkFirst(event) {
  const request = event.request;
  const cache = await caches.open(PRECACHE);
  const cached = await cache.match(request, {ignoreVary: true});

  const network = fetch(request).then((response) => {
    if (isCacheable(response) && !new URL(request.url).search) {
      putSafely(event, cache, request, response.clone());
    }
    return response;
  });

  if (!cached) return network;
  network.catch(() => {}); // pemenang balapan adalah cache: cegah "unhandled rejection"
  try {
    const response = await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    return response.status >= 500 ? cached : response;
  } catch {
    return cached;
  }
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request, {ignoreVary: true});
  const refresh = fetch(request).then((response) => {
    // Respons "opaque" (stylesheet tanpa CORS) tidak bisa diperiksa, tapi aman disimpan.
    if (response && (response.ok || response.type === 'opaque')) putSafely(event, cache, request, response.clone());
    return response;
  });
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  if (request.headers.has('range')) return;

  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // Lintas origin lain (API Worker, video, thumbnail, GitHub) tidak disentuh.
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('download')) return;
  if (url.pathname === new URL('sw.js', SCOPE).pathname) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  event.respondWith(networkFirst(event));
});
