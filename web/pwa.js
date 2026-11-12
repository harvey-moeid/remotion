/**
 * PWA — registrasi service worker, notifikasi versi baru, status offline, dan tombol "Pasang aplikasi".
 *
 * Berdiri sendiri (tidak mengimpor / diimpor modul lain) dan semua teks disisipkan lewat
 * textContent. Bila service worker tidak didukung, aplikasi tetap berjalan seperti biasa.
 */
const $ = (selector) => document.querySelector(selector);
const UPDATE_CHECK_MS = 30 * 60 * 1000; // cek versi baru tiap 30 menit selama halaman terbuka
const FOCUS_CHECK_MIN_MS = 10 * 60 * 1000; // dan saat tab kembali aktif, paling cepat tiap 10 menit

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- toast ---------- */
let toastBox = null;
const toasts = new Map(); // id -> {node, timer}

function ensureToastBox() {
  if (toastBox) return toastBox;
  toastBox = el('div', 'pwa-toasts');
  toastBox.setAttribute('role', 'status');
  toastBox.setAttribute('aria-live', 'polite');
  document.body.append(toastBox);
  return toastBox;
}

function removeToast(id) {
  const entry = toasts.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.node.remove();
  toasts.delete(id);
}

/** Satu toast per id: memanggil lagi dengan id yang sama menggantikan isinya. */
function showToast({id, message, kind = '', actions = [], timeout = 0}) {
  removeToast(id);
  const node = el('div', `pwa-toast ${kind}`.trim());
  node.append(el('p', '', message));
  if (actions.length) {
    const box = el('div', 'pwa-actions');
    for (const action of actions) {
      const button = el('button', action.primary ? 'btn pwa-primary' : 'btn', action.label);
      button.type = 'button';
      button.addEventListener('click', action.onClick);
      box.append(button);
    }
    node.append(box);
  }
  ensureToastBox().append(node);
  const timer = timeout ? setTimeout(() => removeToast(id), timeout) : 0;
  toasts.set(id, {node, timer});
}

/* ---------- status offline ---------- */
let wasOffline = false;
function syncOnlineState() {
  if (navigator.onLine) {
    removeToast('offline');
    if (wasOffline) showToast({id: 'online', message: 'Kembali online.', timeout: 3000});
    wasOffline = false;
  } else {
    wasOffline = true;
    removeToast('online');
    showToast({id: 'offline', kind: 'offline', message: 'Anda sedang offline. Render video dan status job butuh koneksi internet.'});
  }
}
window.addEventListener('online', syncOnlineState);
window.addEventListener('offline', syncOnlineState);
if (!navigator.onLine) syncOnlineState();

/* ---------- tombol pasang aplikasi ---------- */
let installPrompt = null;
let installButton = null;

function showInstallButton() {
  if (isStandalone()) return;
  if (!installButton) {
    const host = $('.topbar-right');
    if (!host) return;
    installButton = el('button', 'btn small pwa-install');
    installButton.type = 'button';
    installButton.append(el('span', '', 'Pasang'), el('span', 'pwa-long', 'aplikasi'));
    installButton.setAttribute('aria-label', 'Pasang aplikasi Byga');
    installButton.addEventListener('click', onInstallClick);
    host.prepend(installButton);
  }
  installButton.hidden = false;
}

function hideInstallButton() {
  if (installButton) installButton.hidden = true;
}

async function onInstallClick() {
  if (installPrompt) {
    const promptEvent = installPrompt;
    installPrompt = null; // event hanya bisa dipakai sekali
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      /* dibatalkan / tidak didukung: abaikan */
    }
    hideInstallButton();
  } else if (isIos()) {
    showToast({
      id: 'ios-install',
      message: 'Di iPhone/iPad: ketuk tombol Bagikan di browser, lalu pilih "Tambahkan ke Layar Utama".',
      actions: [{label: 'Tutup', onClick: () => removeToast('ios-install')}],
    });
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // tahan banner bawaan; pemasangan dipicu dari tombol kita
  installPrompt = event;
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  hideInstallButton();
  showToast({id: 'installed', message: 'Byga sudah terpasang di perangkat Anda.', timeout: 4000});
});

// iOS Safari tidak punya beforeinstallprompt: tampilkan tombol yang membuka petunjuk manual.
if (isIos() && !isStandalone()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showInstallButton, {once: true});
  else showInstallButton();
}

/* ---------- service worker & pembaruan ---------- */
function hasUnsavedCode() {
  const field = $('#code');
  return Boolean(field && field.value.trim());
}

function promptUpdate(registration) {
  const apply = () => {
    const worker = registration.waiting;
    if (worker) worker.postMessage({type: 'SKIP_WAITING'});
  };
  const later = () => removeToast('update');
  const confirmReload = () => {
    // Kode di editor tidak disimpan otomatis: minta konfirmasi kedua sebelum memuat ulang.
    showToast({
      id: 'update',
      message: 'Kode di editor belum dirender dan akan hilang saat dimuat ulang. Lanjutkan?',
      actions: [{label: 'Ya, muat ulang', primary: true, onClick: apply}, {label: 'Batal', onClick: later}],
    });
  };
  showToast({
    id: 'update',
    message: 'Versi baru Byga tersedia.',
    actions: [
      {label: 'Muat ulang', primary: true, onClick: () => (hasUnsavedCode() ? confirmReload() : apply())},
      {label: 'Nanti', onClick: later},
    ],
  });
}

async function registerServiceWorker() {
  let registration;
  try {
    registration = await navigator.serviceWorker.register('sw.js', {scope: './', updateViaCache: 'none'});
  } catch (error) {
    console.warn('Service worker gagal didaftarkan:', error);
    return;
  }

  if (registration.waiting && navigator.serviceWorker.controller) promptUpdate(registration);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // "installed" + sudah ada controller = versi baru siap dan menunggu persetujuan.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(registration);
    });
  });

  let lastCheck = Date.now();
  const check = () => {
    lastCheck = Date.now();
    registration.update().catch(() => { /* offline: coba lagi nanti */ });
  };
  setInterval(check, UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > FOCUS_CHECK_MIN_MS) check();
  });
}

if ('serviceWorker' in navigator) {
  // Pemasangan pertama (belum ada controller) mengambil alih halaman tanpa reload.
  // Reload hanya untuk pergantian versi yang disetujui pengguna.
  let hasController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, {once: true});
}
