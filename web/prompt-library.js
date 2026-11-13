/**
 * Prompt Workspace — daftar master prompt berbasis manifest, bisa diedit di halaman.
 *
 * Alur: baca ./prompts/index.json -> buat satu kartu per prompt -> isi prompt (.md)
 * baru diunduh saat dibutuhkan dan di-cache per id.
 *
 * Mengedit prompt (semua hanya di memori halaman, TIDAK disimpan):
 *  1. Isi variabel: baris "- NAMA: [petunjuk]" di bagian "## VARIABEL" pada file .md otomatis
 *     jadi form. Opsi cepat (chip) berasal dari field "choices" di index.json.
 *  2. Edit bebas: textarea berisi seluruh teks prompt. Form dan textarea saling sinkron:
 *     mengisi form hanya mengganti baris variabelnya, jadi edit manual di bagian lain tetap utuh.
 *  3. Salin / unduh selalu memakai teks terbaru di textarea. "Reset ke bawaan" mengembalikan teks asli.
 *  4. Prompt sendiri: tombol "+ Prompt sendiri" atau "Duplikat" membuat kartu baru (juga tidak disimpan).
 * Menambah prompt master cukup mengedit index.json (lihat web/prompts/README.md).
 */
const MANIFEST_URL = './prompts/index.json';
const PROMPT_DIR = './prompts/';
const $ = (selector) => document.querySelector(selector);

const CUSTOM_NOTE = 'Prompt buatan sendiri. Tidak tersimpan: hilang saat halaman dimuat ulang. Gunakan Unduh .md atau Salin untuk menyimpannya.';
const CUSTOM_PLACEHOLDER = 'Tulis atau tempel prompt di sini.\n\nTip: tambahkan bagian "## VARIABEL" berisi baris seperti\n- TOPIK: [contoh: Cara kerja fotosintesis]\nagar muncul form isian di atas kolom ini.';

// Cache isi prompt per id agar tidak fetch berulang.
const cache = new Map();
let customSeq = 0;
let standardCount = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // textContent (bukan innerHTML) sengaja dipakai agar isi manifest/prompt tidak bisa menyisipkan HTML.
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className) {
  const node = el('button', className ? `btn ${className}` : 'btn', label);
  node.type = 'button';
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

function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || 'prompt';
}

function humanize(name) {
  const text = name.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const smoothBehavior = () => (
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
);

/* ------------------------------------------------------------------ */
/* Variabel: baris "- NAMA: [petunjuk]" di bagian "## VARIABEL"        */
/* ------------------------------------------------------------------ */

const VAR_LINE = /^- ([A-Z0-9_]+): ?(.*)$/;

/** Rentang teks bagian "## VARIABEL" (setelah baris judul sampai judul "## " berikutnya). */
function findSection(text) {
  const head = /^##[ \t]+VARIABEL\b.*$/m.exec(text);
  if (!head) return null;
  const start = head.index + head[0].length;
  const next = /^##[ \t]/m.exec(text.slice(start));
  return {start, end: next ? start + next.index : text.length};
}

/** Daftar variabel: {name, hint, value}. value kosong bila masih berupa placeholder [petunjuk]. */
function parseVars(text) {
  const section = findSection(text);
  if (!section) return [];
  const vars = [];
  for (const line of text.slice(section.start, section.end).split('\n')) {
    const match = VAR_LINE.exec(line.replace(/\r$/, ''));
    if (!match) continue;
    const raw = match[2].trim();
    const placeholder = /^\[(.*)\]$/.exec(raw);
    vars.push({name: match[1], hint: placeholder ? placeholder[1] : '', value: placeholder ? '' : raw});
  }
  return vars;
}

/** Ganti nilai satu variabel; nilai kosong mengembalikan placeholder [petunjuk]. */
function setVar(text, name, value, hint) {
  const section = findSection(text);
  if (!section) return text;
  const body = text.slice(section.start, section.end);
  const pattern = new RegExp(`^- ${name}: ?.*$`, 'm');
  if (!pattern.test(body)) return text;
  const clean = value.replace(/\s*\n\s*/g, ' ').trim();
  const line = `- ${name}: ${clean || `[${hint || 'isi di sini'}]`}`;
  // Fungsi pengganti dipakai agar "$" di dalam nilai tidak ditafsirkan sebagai pola replace.
  return text.slice(0, section.start) + body.replace(pattern, () => line) + text.slice(section.end);
}

/** Jalankan aksi pada klik kedua (dalam 4 detik) bila perubahan akan hilang. */
function armable(btn, idleText, armedText, action, needsConfirm = () => true) {
  let timer = null;
  const disarm = () => {
    clearTimeout(timer);
    timer = null;
    btn.textContent = idleText;
  };
  btn.addEventListener('click', () => {
    if (timer !== null) {
      disarm();
      action();
      return;
    }
    if (!needsConfirm()) {
      action();
      return;
    }
    btn.textContent = armedText;
    timer = setTimeout(disarm, 4000);
  });
}

/* ------------------------------------------------------------------ */
/* Kartu prompt                                                        */
/* ------------------------------------------------------------------ */

function buildCard(item) {
  const isCustom = Boolean(item.custom);
  const choices = item.choices && typeof item.choices === 'object' ? item.choices : {};
  const state = {loaded: false, original: '', hints: {}, signature: null};
  const fields = new Map();

  const card = el('article', 'prompt-card');
  card.dataset.promptId = item.id;
  if (isCustom) card.dataset.custom = 'true';
  const icon = el('div', 'prompt-card-icon', item.icon || '✧');
  icon.setAttribute('aria-hidden', 'true');
  card.append(icon);

  const main = el('div', 'prompt-card-main');
  const meta = el('div', 'prompt-card-meta');
  (item.tags || []).forEach((tag) => meta.append(el('span', '', tag)));
  const heading = el('h3', '', item.title);
  main.append(meta, heading);
  if (item.description) main.append(el('p', '', item.description));

  if (item.specs && item.specs.length) {
    const specs = el('div', 'prompt-specs');
    item.specs.forEach((spec) => specs.append(el('span', '', spec)));
    main.append(specs);
  }

  const editorId = `prompt-editor-${item.id}`;
  const copyBtn = button('Salin prompt', 'prompt-primary');
  const editBtn = button('Edit prompt');
  const downloadBtn = button('Unduh .md');
  editBtn.setAttribute('aria-expanded', 'false');
  editBtn.setAttribute('aria-controls', editorId);
  const actions = el('div', 'prompt-card-actions');
  actions.append(copyBtn, editBtn, downloadBtn);

  const status = el('p', 'prompt-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const say = (message) => { status.textContent = message; };

  /* --- panel editor --- */
  const editor = el('div', 'prompt-editor');
  editor.id = editorId;
  editor.hidden = true;

  let titleInput = null;
  if (isCustom) {
    const titleWrap = el('div', 'pv-field');
    const titleLabel = el('label', 'pv-label', 'Judul prompt');
    titleInput = el('input', 'pv-input pv-title-input');
    titleInput.type = 'text';
    titleInput.id = `${editorId}-title`;
    titleInput.value = item.title;
    titleInput.maxLength = 80;
    titleInput.autocomplete = 'off';
    titleLabel.htmlFor = titleInput.id;
    titleInput.addEventListener('input', () => {
      heading.textContent = titleInput.value.trim() || 'Prompt tanpa judul';
    });
    titleWrap.append(titleLabel, titleInput);
    editor.append(titleWrap);
  }

  const varsSection = el('section', 'pv-section');
  varsSection.hidden = true;
  const varsHead = el('div', 'pv-head');
  const varsTitle = el('h4', 'pv-title', 'Isi variabel');
  const varsCount = el('span', 'pv-count');
  varsHead.append(varsTitle, varsCount);
  const varsGrid = el('div', 'pv-vars');
  varsSection.append(varsHead, varsGrid);

  const textWrap = el('div', 'pv-section');
  const textLabel = el('label', 'pv-title', 'Teks prompt (bisa diedit bebas)');
  const textarea = el('textarea', 'pv-input pv-text');
  textarea.id = `${editorId}-text`;
  textarea.rows = 18;
  textarea.spellcheck = false;
  textarea.autocomplete = 'off';
  textLabel.htmlFor = textarea.id;
  textWrap.append(textLabel, textarea);

  const resetBtn = button('Reset ke bawaan');
  const dupBtn = button('Duplikat sebagai prompt baru');
  const delBtn = isCustom ? button('Hapus prompt', 'prompt-danger') : null;
  const toolbar = el('div', 'prompt-editor-actions');
  toolbar.append(resetBtn, dupBtn);
  if (delBtn) toolbar.append(delBtn);

  editor.append(varsSection, textWrap, toolbar);
  main.append(actions, status, editor);
  card.append(main);

  /* --- form variabel --- */
  const refreshChips = (name) => {
    const field = fields.get(name);
    if (!field) return;
    const current = field.input.value.trim();
    field.chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.value === current)));
  };

  const refreshCount = () => {
    const vars = parseVars(textarea.value);
    varsCount.textContent = `${vars.filter((v) => v.value).length} dari ${vars.length} terisi`;
  };

  function buildField(v) {
    const wrap = el('div', 'pv-field');
    const id = `${editorId}-var-${v.name}`;
    const label = el('label', 'pv-label', humanize(v.name));
    label.htmlFor = id;
    const multiline = v.hint.includes(';') || v.hint.length > 70;
    const input = multiline ? el('textarea', 'pv-input') : el('input', 'pv-input');
    if (multiline) input.rows = 2;
    else input.type = 'text';
    input.id = id;
    input.value = v.value;
    input.placeholder = v.hint;
    input.autocomplete = 'off';
    wrap.append(label, input);

    const chips = [];
    const options = Array.isArray(choices[v.name]) ? choices[v.name].filter((o) => typeof o === 'string' && o) : [];
    if (options.length) {
      const row = el('div', 'pv-chips');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', `Pilihan ${humanize(v.name)}`);
      options.forEach((option) => {
        const chip = el('button', 'pv-chip', option);
        chip.type = 'button';
        chip.dataset.value = option;
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', () => {
          // Klik chip yang sedang aktif = kosongkan; selain itu = isi dengan opsi tersebut.
          input.value = input.value.trim() === option ? '' : option;
          input.dispatchEvent(new Event('input', {bubbles: true}));
        });
        chips.push(chip);
        row.append(chip);
      });
      wrap.append(row);
    }

    input.addEventListener('input', () => {
      textarea.value = setVar(textarea.value, v.name, input.value, state.hints[v.name]);
      refreshChips(v.name);
      refreshCount();
    });

    fields.set(v.name, {input, chips});
    return wrap;
  }

  /** Bangun ulang form bila daftar variabel berubah; selain itu cukup sinkronkan nilainya. */
  function renderFields() {
    const vars = parseVars(textarea.value);
    vars.forEach((v) => { if (v.hint) state.hints[v.name] = v.hint; });
    const signature = vars.map((v) => v.name).join('|');
    if (signature !== state.signature) {
      state.signature = signature;
      fields.clear();
      varsGrid.replaceChildren(...vars.map(buildField));
      varsSection.hidden = vars.length === 0;
    } else {
      vars.forEach((v) => {
        const field = fields.get(v.name);
        if (field && field.input.value.trim() !== v.value) field.input.value = v.value;
        refreshChips(v.name);
      });
    }
    refreshCount();
  }

  textarea.addEventListener('input', renderFields);

  /* --- memuat isi --- */
  async function load() {
    if (state.loaded) return;
    const text = isCustom ? (item.text || '') : await getPromptText(item);
    state.original = text;
    textarea.value = text;
    textarea.disabled = false;
    textarea.placeholder = isCustom ? CUSTOM_PLACEHOLDER : '';
    state.loaded = true;
    renderFields();
  }

  // Muat isi lalu jalankan aksi; pesan galat yang sama untuk semua aksi.
  const withText = async (onReady) => {
    try {
      await load();
      await onReady(textarea.value);
    } catch {
      say('Master prompt gagal dimuat. Muat ulang halaman atau periksa koneksi.');
    }
  };

  if (isCustom) {
    textarea.placeholder = CUSTOM_PLACEHOLDER;
    load();
  } else {
    textarea.disabled = true;
    textarea.placeholder = 'Memuat master prompt…';
  }

  const setOpen = (open) => {
    editor.hidden = !open;
    editBtn.setAttribute('aria-expanded', String(open));
    editBtn.textContent = open ? 'Tutup editor' : 'Edit prompt';
    if (open) withText(() => {});
  };

  /* --- aksi --- */
  copyBtn.addEventListener('click', () => withText(async (text) => {
    if (!text.trim()) {
      say('Prompt masih kosong. Buka Edit prompt untuk menulis isinya.');
      return;
    }
    const ok = await copyText(text);
    const empty = parseVars(text).filter((v) => !v.value).length;
    if (!ok) {
      say('Penyalinan otomatis tidak didukung browser ini. Buka Edit prompt lalu salin teksnya secara manual.');
    } else if (empty) {
      say(`Prompt disalin, tapi masih ada ${empty} variabel kosong (tanda [ ]). Isi dulu lewat Edit prompt agar hasil AI sesuai.`);
    } else {
      say('Prompt berhasil disalin. Tempelkan ke AI atau workflow yang Anda gunakan.');
    }
  }));

  downloadBtn.addEventListener('click', () => withText((text) => {
    const filename = isCustom ? `${slugify(heading.textContent)}.md` : (item.download || item.file);
    downloadText(text, filename);
    say('File Markdown disiapkan untuk diunduh.');
  }));

  editBtn.addEventListener('click', () => setOpen(editor.hidden));

  armable(
    resetBtn,
    'Reset ke bawaan',
    'Yakin? Klik lagi untuk reset',
    () => {
      textarea.value = state.original;
      renderFields();
      say('Prompt dikembalikan ke versi bawaan.');
    },
    () => state.loaded && textarea.value !== state.original,
  );

  dupBtn.addEventListener('click', () => {
    if (!state.loaded) return;
    addCustom({
      title: `${heading.textContent} (salinan)`,
      text: textarea.value,
      tags: ['PROMPT SENDIRI'],
      icon: '✦',
      description: CUSTOM_NOTE,
      choices,
    }, card);
    say('Salinan dibuat tepat di bawah kartu ini.');
  });

  if (delBtn) {
    armable(
      delBtn,
      'Hapus prompt',
      'Yakin? Klik lagi untuk hapus',
      () => {
        card.remove();
        updateCount();
        const add = $('#prompt-add');
        if (add) add.focus();
      },
      () => textarea.value.trim() !== '',
    );
    setOpen(true);
  }

  return card;
}

function updateCount() {
  const count = $('#prompt-count');
  if (!count) return;
  const custom = document.querySelectorAll('#prompt-list [data-custom]').length;
  count.textContent = `${standardCount} MASTER PROMPT${custom ? ` + ${custom} SENDIRI` : ''}`;
}

function addCustom(data, afterNode) {
  const list = $('#prompt-list');
  if (!list) return null;
  const card = buildCard({...data, id: `custom-${++customSeq}`, custom: true});
  if (afterNode) afterNode.after(card);
  else list.prepend(card);
  updateCount();
  card.scrollIntoView({behavior: smoothBehavior(), block: 'nearest'});
  const title = card.querySelector('.pv-title-input');
  if (title) title.focus();
  return card;
}

function addToolbar(list) {
  const bar = el('div', 'prompt-toolbar');
  const add = button('＋ Prompt sendiri', 'prompt-primary');
  add.id = 'prompt-add';
  add.addEventListener('click', () => addCustom({
    title: 'Prompt baru',
    text: '',
    tags: ['PROMPT SENDIRI'],
    icon: '✦',
    description: CUSTOM_NOTE,
  }));
  bar.append(
    add,
    el('p', 'prompt-note', 'Klik Edit prompt di kartu untuk mengisi variabel, memilih opsi, atau mengubah teks. Perubahan dan prompt sendiri tidak disimpan dan hilang saat halaman dimuat ulang; gunakan Salin atau Unduh .md untuk menyimpan hasilnya.'),
  );
  list.before(bar);
}

async function init() {
  const list = $('#prompt-list');
  const count = $('#prompt-count');
  if (!list) return;
  addToolbar(list);
  try {
    const response = await fetch(MANIFEST_URL, {cache: 'no-cache'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    const items = (manifest.prompts || []).filter((p) => p && p.id && p.file && p.title);
    standardCount = items.length;
    list.replaceChildren(...items.map(buildCard));
    updateCount();
    if (!items.length) list.append(el('p', 'prompt-status', 'Belum ada prompt.'));
  } catch {
    list.replaceChildren(el('p', 'prompt-status', 'Daftar prompt gagal dimuat. Muat ulang halaman atau periksa koneksi.'));
    if (count) count.textContent = '—';
  }
}

init();
