// Editor kode ringan: penomoran baris + penyorotan sintaks tanpa dependensi.
//
// Teknik overlay: <textarea> transparan di atas <pre> berwarna, dengan font dan padding identik.
// Pengguna mengetik di textarea (caret, seleksi, undo, IME, mobile tetap bawaan browser),
// sedangkan warna datang dari <pre> di bawahnya.
//
// Keputusan desain:
// - Textarea tidak punya scroll sendiri; ukurannya mengikuti <pre>, dan SATU kontainer (.ed-scroll)
//   yang digulir. Dengan begitu pewarnaan, gutter, dan textarea tidak perlu disinkronkan lewat JS.
// - Gutter memakai position: sticky supaya nomor baris tetap terlihat saat menggulir ke kanan.
// - Konstanta LINE_H / PAD_Y / PAD_X di bawah HARUS sama dengan styles.css (.ed-*).

import {tokenize} from './lexer.js';

const NL = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const INDENT = '  ';
const LINE_H = 20;
const PAD_Y = 10;
const PAD_X = 12;

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function h(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// Kode -> HTML berwarna. Teks selalu di-escape sehingga aman dipasang lewat innerHTML.
export function highlight(code) {
  let html = '';
  for (const t of tokenize(code)) {
    const text = escapeHtml(code.slice(t.start, t.end));
    html += t.type === 'space' || t.type === 'punct' || t.type === 'ident' ? text : `<span class="tk-${t.type}">${text}</span>`;
  }
  // Baris tambahan di akhir: <pre> membuang newline terakhir, textarea tidak.
  return html + NL + ' ';
}

function leadingIndent(line) {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === TAB)) i++;
  return line.slice(0, i);
}

/**
 * Membungkus <textarea> yang sudah ada menjadi editor.
 * @param {HTMLTextAreaElement} textarea
 * @param {{onInput?: () => void}} [options] onInput dipanggil setelah pengguna mengubah teks.
 * @returns {{root, refresh, setIssues, goToLine, focus}}
 *   refresh()   : gambar ulang setelah textarea.value diubah lewat kode (mis. unggah file)
 *   setIssues() : tandai nomor baris bermasalah (isu dari code-check.js)
 *   goToLine()  : pindahkan caret + gulir ke baris/kolom tertentu
 */
export function createEditor(textarea, options = {}) {
  const {onInput} = options;
  const root = h('div', 'ed');
  const scroller = h('div', 'ed-scroll');
  const gutter = h('div', 'ed-gutter');
  gutter.setAttribute('aria-hidden', 'true');
  const body = h('div', 'ed-body');
  const pre = h('pre', 'ed-hl');
  pre.setAttribute('aria-hidden', 'true');
  const codeEl = document.createElement('code');
  pre.append(codeEl);

  textarea.parentNode.insertBefore(root, textarea);
  body.append(pre, textarea);
  scroller.append(gutter, body);
  root.append(scroller);
  textarea.classList.add('ed-input');
  textarea.setAttribute('wrap', 'off');

  let marks = new Map(); // nomor baris -> isu terparah
  let lineCount = 0;
  let charW = 0;

  function renderGutter() {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= lineCount; i++) {
      const span = h('span', 'ln');
      span.textContent = String(i);
      const issue = marks.get(i);
      if (issue) {
        span.classList.add(issue.level);
        span.title = issue.message;
      }
      frag.append(span);
    }
    gutter.replaceChildren(frag);
  }

  function update() {
    const code = textarea.value;
    codeEl.innerHTML = highlight(code);
    const count = code.split(NL).length;
    if (count !== lineCount) {
      lineCount = count;
      renderGutter();
    }
  }

  function setIssues(issues) {
    const rank = {error: 3, warn: 2, info: 1};
    marks = new Map();
    for (const issue of issues) {
      const current = marks.get(issue.line);
      if (!current || rank[issue.level] > rank[current.level]) marks.set(issue.line, issue);
    }
    renderGutter();
  }

  // Lebar satu karakter monospace, diukur sekali (dan hanya bila editor sedang terlihat).
  function charWidth() {
    if (!charW) {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      probe.textContent = 'M'.repeat(10);
      pre.append(probe);
      const width = probe.getBoundingClientRect().width / 10;
      probe.remove();
      if (width > 0) charW = width;
    }
    return charW || 8;
  }

  // Karena textarea tidak menggulir sendiri, caret digulirkan ke dalam pandangan secara manual.
  function ensureCaretVisible() {
    const pos = textarea.selectionEnd;
    const before = textarea.value.slice(0, pos);
    const line = before.split(NL).length - 1;
    const col = pos - (before.lastIndexOf(NL) + 1);
    const top = PAD_Y + line * LINE_H;
    const bottom = top + LINE_H;
    if (top - LINE_H < scroller.scrollTop) {
      scroller.scrollTop = Math.max(0, top - LINE_H);
    } else if (bottom + LINE_H > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom + LINE_H - scroller.clientHeight;
    }
    const gutterW = gutter.offsetWidth;
    const x = gutterW + PAD_X + col * charWidth();
    if (x - 8 < scroller.scrollLeft + gutterW) {
      scroller.scrollLeft = Math.max(0, x - gutterW - 24);
    } else if (x + 16 > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = x + 24 - scroller.clientWidth;
    }
  }

  function goToLine(line, col = 1) {
    const lines = textarea.value.split(NL);
    const target = Math.max(1, Math.min(line, lines.length));
    let index = 0;
    for (let i = 0; i < target - 1; i++) index += lines[i].length + 1;
    index += Math.max(0, Math.min(col - 1, lines[target - 1].length));
    textarea.focus({preventScroll: true});
    textarea.setSelectionRange(index, index);
    scroller.scrollTop = Math.max(0, PAD_Y + (target - 1) * LINE_H - scroller.clientHeight / 2);
    ensureCaretVisible();
    root.scrollIntoView({block: 'nearest'});
  }

  // Mengganti seleksi lewat execCommand supaya riwayat undo (Ctrl+Z) tetap bekerja.
  // Fallback setRangeText untuk browser yang tidak mendukungnya (undo tidak tercatat).
  function replaceSelection(text) {
    textarea.focus();
    let done = false;
    try {
      done = document.execCommand('insertText', false, text);
    } catch {
      done = false;
    }
    if (!done) {
      textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }

  // Tab / Shift+Tab: indentasi atau kurangi indentasi baris (atau seluruh baris yang terseleksi).
  function shiftIndent(outdent) {
    const v = textarea.value;
    const s = textarea.selectionStart;
    const e = textarea.selectionEnd;
    const blockStart = s === 0 ? 0 : v.lastIndexOf(NL, s - 1) + 1;
    let blockEnd = e;
    if (s === e) {
      const nl = v.indexOf(NL, e);
      blockEnd = nl < 0 ? v.length : nl;
    }
    const block = v.slice(blockStart, blockEnd);
    const next = block
      .split(NL)
      .map((line) => {
        if (outdent) return line.startsWith(INDENT) ? line.slice(2) : line.startsWith(' ') ? line.slice(1) : line;
        return line === '' ? line : INDENT + line;
      })
      .join(NL);
    textarea.setSelectionRange(blockStart, blockEnd);
    replaceSelection(next);
    if (s === e) {
      const caret = Math.max(blockStart, e + (next.length - block.length));
      textarea.setSelectionRange(caret, caret);
    } else {
      textarea.setSelectionRange(blockStart, blockStart + next.length);
    }
  }

  // Enter: pertahankan indentasi baris sebelumnya; tambah satu level setelah { ( [.
  // Bila caret tepat di antara pasangan seperti {|}, penutup dipindah ke baris sendiri.
  function autoIndent() {
    const v = textarea.value;
    const s = textarea.selectionStart;
    const lineStart = s === 0 ? 0 : v.lastIndexOf(NL, s - 1) + 1;
    const line = v.slice(lineStart, s);
    const indent = leadingIndent(line);
    const trimmed = line.trimEnd();
    const opens = trimmed !== '' && '{(['.includes(trimmed[trimmed.length - 1]);
    const nextChar = v[textarea.selectionEnd];
    if (opens && nextChar !== undefined && '})]'.includes(nextChar)) {
      replaceSelection(NL + indent + INDENT + NL + indent);
      const caret = s + 1 + indent.length + INDENT.length;
      textarea.setSelectionRange(caret, caret);
    } else {
      replaceSelection(NL + indent + (opens ? INDENT : ''));
    }
  }

  // Aksesibilitas: Tab dipakai untuk indentasi, jadi tersedia jalan keluar (Esc lalu Tab) agar tidak
  // menjadi jebakan keyboard. Perangkap aktif lagi saat editor difokuskan ulang.
  let trapTab = true;
  textarea.addEventListener('focus', () => {
    trapTab = true;
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      trapTab = false;
      return;
    }
    if (event.key === 'Tab' && trapTab && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const multiLine = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).includes(NL);
      if (event.shiftKey || multiLine) shiftIndent(event.shiftKey);
      else replaceSelection(INDENT);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      autoIndent();
    }
  });

  textarea.addEventListener('input', () => {
    update();
    ensureCaretVisible();
    if (onInput) onInput();
  });
  textarea.addEventListener('keyup', ensureCaretVisible);
  textarea.addEventListener('click', ensureCaretVisible);

  update();
  return {root, refresh: update, setIssues, goToLine, focus: () => textarea.focus()};
}
