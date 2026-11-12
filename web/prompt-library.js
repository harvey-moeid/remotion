/**
 * Prompt Workspace — daftar master prompt berbasis manifest.
 *
 * Alur: baca ./prompts/index.json -> buat satu kartu per prompt -> isi prompt (.md)
 * baru diunduh saat dibutuhkan (lihat/salin/unduh) dan di-cache per id.
 * Menambah prompt cukup mengedit index.json (lihat web/prompts/README.md).
 */
const MANIFEST_URL = './prompts/index.json';
const PROMPT_DIR = './prompts/';
const $ = (selector) => document.querySelector(selector);

// Cache isi prompt per id agar tidak fetch berulang.
const cache = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // textContent (bukan innerHTML) sengaja dipakai agar isi manifest tidak bisa menyisipkan HTML.
  if (text !== undefined) node.textContent = text;
  return node;
}

async function getPromptText(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  // Nama file dibatasi ke folder prompts/ agar manifest tidak bisa menunjuk path lain.
  if (!/^[\w.-]+\.md$/.test(item.file)) throw new Error('Nama file prompt tidak valid');
  const response = await fetch(PROMPT_DIR + item.file, {cache: 'no-cache'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  cache.set(item.id, text);
  return text;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Cadangan untuk browser tanpa Clipboard API / konteks non-HTTPS.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}

function downloadText(text, filename) {
  const blob = new Blob([text], {type: 'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCard(item) {
  const card = el('article', 'prompt-card');
  card.dataset.promptId = item.id;
  card.append(el('div', 'prompt-card-icon', item.icon || '✧'));
  card.firstChild.setAttribute('aria-hidden', 'true');

  const main = el('div', 'prompt-card-main');
  const meta = el('div', 'prompt-card-meta');
  (item.tags || []).forEach((tag) => meta.append(el('span', '', tag)));
  main.append(meta, el('h3', '', item.title));
  if (item.description) main.append(el('p', '', item.description));

  if (item.specs && item.specs.length) {
    const specs = el('div', 'prompt-specs');
    item.specs.forEach((spec) => specs.append(el('span', '', spec)));
    main.append(specs);
  }

  const actions = el('div', 'prompt-card-actions');
  const copyBtn = el('button', 'btn prompt-primary', 'Salin prompt');
  const downloadBtn = el('button', 'btn', 'Unduh .md');
  const toggleBtn = el('button', 'btn', 'Lihat isi');
  [copyBtn, downloadBtn, toggleBtn].forEach((b) => { b.type = 'button'; });
  const previewId = `prompt-preview-${item.id}`;
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', previewId);
  actions.append(copyBtn, downloadBtn, toggleBtn);

  const status = el('p', 'prompt-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const preview = el('div', 'prompt-preview');
  preview.id = previewId;
  preview.hidden = true;
  const pre = el('pre', '', 'Memuat master prompt…');
  preview.append(pre);

  main.append(actions, status, preview);
  card.append(main);

  // Muat isi prompt; tampilkan pesan galat yang sama untuk semua aksi.
  const withText = async (onReady) => {
    try {
      const text = await getPromptText(item);
      await onReady(text);
    } catch {
      status.textContent = 'Master prompt gagal dimuat. Muat ulang halaman atau periksa koneksi.';
    }
  };

  copyBtn.addEventListener('click', () => withText(async (text) => {
    const ok = await copyText(text);
    status.textContent = ok
      ? 'Prompt berhasil disalin. Tempelkan ke AI atau workflow yang Anda gunakan.'
      : 'Penyalinan otomatis tidak didukung browser ini. Buka isi prompt lalu salin secara manual.';
  }));

  downloadBtn.addEventListener('click', () => withText((text) => {
    downloadText(text, item.download || item.file);
    status.textContent = 'File Markdown disiapkan untuk diunduh.';
  }));

  toggleBtn.addEventListener('click', () => {
    const open = preview.hidden; // hidden=true berarti akan dibuka
    preview.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
    toggleBtn.textContent = open ? 'Tutup isi' : 'Lihat isi';
    if (open) withText((text) => { pre.textContent = text; });
  });

  return card;
}

async function init() {
  const list = $('#prompt-list');
  const count = $('#prompt-count');
  if (!list) return;
  try {
    const response = await fetch(MANIFEST_URL, {cache: 'no-cache'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    const items = (manifest.prompts || []).filter((p) => p && p.id && p.file && p.title);
    list.replaceChildren(...items.map(buildCard));
    if (count) count.textContent = `${items.length} MASTER PROMPT`;
    if (!items.length) list.append(el('p', 'prompt-status', 'Belum ada prompt.'));
  } catch {
    list.replaceChildren(el('p', 'prompt-status', 'Daftar prompt gagal dimuat. Muat ulang halaman atau periksa koneksi.'));
    if (count) count.textContent = '—';
  }
}

init();
