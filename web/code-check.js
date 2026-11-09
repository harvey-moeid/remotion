// Pengecekan dasar SEBELUM render, dijalankan di browser (tanpa menunggu GitHub Actions 2-4 menit).
// Bersifat heuristik: menangkap kesalahan yang paling sering terjadi, bukan pengganti compiler.
//
// Level isu:
//   error = memblokir render (pasti gagal di Worker atau di Remotion)
//   warn  = render tetap boleh, tetapi hasilnya kemungkinan tidak sesuai harapan
//   info  = catatan saja

import {lineIndexer, tokenize} from './lexer.js';

// Harus sama dengan batas di worker/src/index.ts.
export const MAX_CODE_CHARS = 100000;
export const MAX_PROPS_CHARS = 20000;

// Hanya paket ini yang terpasang di runner render (lihat README, bagian Kode kustom).
const ALLOWED_PACKAGES = new Set(['react', 'remotion']);
const MAX_ISSUES = 50;
const OPEN = '([{';
const CLOSE = ')]}';
const PAIR = {')': '(', ']': '[', '}': '{'};
// Sama dengan clamp di remotion/src/Root.tsx (customMeta): nilai di luar rentang dibatasi diam-diam.
const CONFIG_LIMITS = {
  durationInFrames: [1, 1800],
  fps: [1, 60],
  width: [16, 3840],
  height: [16, 3840],
};

function summarize(issues) {
  issues.sort((a, b) => a.index - b.index);
  return {
    issues,
    errors: issues.filter((i) => i.level === 'error'),
    warnings: issues.filter((i) => i.level === 'warn'),
    infos: issues.filter((i) => i.level === 'info'),
  };
}

export function checkCode(code) {
  const issues = [];
  const where = lineIndexer(code);
  const add = (level, message, index) => {
    if (issues.length >= MAX_ISSUES) return;
    const at = where(Math.max(0, Math.min(index, code.length)));
    issues.push({level, message, line: at.line, col: at.col, index});
  };

  if (code.trim() === '') {
    add('error', 'Kode kosong.', 0);
    return summarize(issues);
  }
  if (code.length > MAX_CODE_CHARS) {
    add('error', `Kode terlalu panjang (${code.length} dari maksimal ${MAX_CODE_CHARS} karakter).`, 0);
  }

  const tokens = tokenize(code);
  const text = (t) => code.slice(t.start, t.end);
  const sig = tokens.filter((t) => t.type !== 'space' && t.type !== 'comment');
  const isPunct = (t, ch) => Boolean(t) && t.type === 'punct' && code[t.start] === ch;
  const isWord = (t, word) => Boolean(t) && text(t) === word;

  // 1) Komentar / template yang tidak ditutup = error. String biasa yang tidak ditutup hanya peringatan,
  //    karena apostrof di teks JSX (mis. Don't) terbaca lexer sebagai awal string padahal kode valid.
  for (const t of tokens) {
    if (!t.unterminated) continue;
    if (t.type === 'comment') add('error', 'Komentar /* tidak ditutup dengan */.', t.start);
    else if (t.type === 'template') add('error', 'Template literal (tanda `) tidak ditutup.', t.start);
    else if (t.type === 'string') {
      add('warn', 'String tidak ditutup di baris ini (abaikan bila itu apostrof di teks JSX).', t.start);
    }
  }

  // 2) Kurung () [] {} harus seimbang. Isi string/komentar/template sudah dilewati lexer.
  const stack = [];
  let bracketIssues = 0;
  for (const t of sig) {
    if (t.type !== 'punct') continue;
    const ch = code[t.start];
    if (OPEN.includes(ch)) {
      stack.push({ch, index: t.start});
    } else if (CLOSE.includes(ch)) {
      const top = stack[stack.length - 1];
      if (!top) {
        if (bracketIssues++ < 5) add('error', `Kurung penutup '${ch}' tidak punya pembuka.`, t.start);
      } else if (top.ch !== PAIR[ch]) {
        if (bracketIssues++ < 5) {
          add('error', `Kurung '${ch}' tidak cocok dengan '${top.ch}' di baris ${where(top.index).line}.`, t.start);
        }
        stack.pop();
      } else {
        stack.pop();
      }
    }
  }
  for (const open of stack.slice(-3)) add('error', `Kurung '${open.ch}' tidak ditutup.`, open.index);

  // 3) Impor: hanya react dan remotion; tidak ada impor relatif (kode dijalankan sebagai satu file).
  const checkSpecifier = (spec, index) => {
    if (spec.startsWith('.') || spec.startsWith('/')) {
      add('error', `Impor '${spec}' tidak bisa dipakai: kode harus satu file, hanya paket react dan remotion.`, index);
      return;
    }
    const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!ALLOWED_PACKAGES.has(root)) {
      add('error', `Paket '${spec}' tidak tersedia. Hanya react dan remotion yang bisa diimpor.`, index);
    }
  };
  for (let k = 0; k < sig.length; k++) {
    const t = sig[k];
    const next = sig[k + 1];
    let spec = null;
    if (t.type === 'keyword' && text(t) === 'import') {
      if (next && next.type === 'string') spec = next; // import 'x'
      else if (isPunct(next, '(') && sig[k + 2] && sig[k + 2].type === 'string') spec = sig[k + 2]; // import('x')
    } else if (t.type === 'keyword' && text(t) === 'from' && next && next.type === 'string') {
      spec = next; // import ... from 'x' dan export ... from 'x'
    } else if ((t.type === 'func' || t.type === 'ident') && text(t) === 'require') {
      if (isPunct(next, '(') && sig[k + 2] && sig[k + 2].type === 'string') spec = sig[k + 2];
    }
    if (spec && !spec.unterminated) checkSpecifier(text(spec).slice(1, -1), spec.start);
  }

  // 4) Wajib tepat satu export default (Worker hanya mengecek lewat regex, jadi yang ada di komentar lolos di sana).
  let defaults = 0;
  for (let k = 0; k < sig.length - 1; k++) {
    if (isWord(sig[k], 'export') && isWord(sig[k + 1], 'default')) {
      defaults++;
      if (defaults === 2) add('error', "Ada lebih dari satu 'export default'.", sig[k].start);
    }
  }
  if (defaults === 0) {
    add('error', "Tidak ada 'export default'. Ekspor komponen React, mis. export default function MyVideo() {...}", 0);
  }

  // 5) export const config = {...}: nilai di luar batas akan dibatasi otomatis oleh Root.tsx.
  const checkConfig = (from) => {
    let depth = 0;
    let started = false;
    for (let k = from; k < sig.length; k++) {
      const t = sig[k];
      if (isPunct(t, '{')) {
        depth++;
        started = true;
        continue;
      }
      if (isPunct(t, '}')) {
        depth--;
        if (started && depth === 0) return;
        continue;
      }
      if (depth === 1 && t.type !== 'punct' && isPunct(sig[k + 1], ':') && sig[k + 2] && sig[k + 2].type === 'number') {
        const key = text(t);
        const limits = CONFIG_LIMITS[key];
        const value = Number(text(sig[k + 2]).replace(/_/g, ''));
        if (limits && Number.isFinite(value) && (value < limits[0] || value > limits[1])) {
          add('warn', `config.${key} = ${value} di luar batas ${limits[0]}-${limits[1]}; nilainya akan dibatasi otomatis.`, t.start);
        }
      }
    }
  };
  for (let k = 0; k < sig.length - 3; k++) {
    if (isWord(sig[k], 'export') && isWord(sig[k + 1], 'const') && isWord(sig[k + 2], 'config')) {
      checkConfig(k + 3);
      break;
    }
  }

  // 6) Peringatan perilaku saat render: Remotion merender frame satu per satu (bisa paralel),
  //    jadi apa pun yang bergantung pada waktu nyata atau acak membuat video berkedip/tidak konsisten.
  for (let k = 0; k < sig.length; k++) {
    const t = sig[k];
    const word = text(t);
    const afterDot = k > 0 && isPunct(sig[k - 1], '.');
    if (word === 'Math' && isPunct(sig[k + 1], '.') && isWord(sig[k + 2], 'random')) {
      add('warn', "Math.random() berbeda di tiap frame (video berkedip). Pakai random('seed') dari 'remotion'.", t.start);
    } else if (word === 'Date' && isPunct(sig[k + 1], '.') && isWord(sig[k + 2], 'now')) {
      add('warn', 'Date.now() tidak deterministik saat render. Gunakan useCurrentFrame().', t.start);
    } else if (word === 'Date' && isWord(sig[k - 1], 'new') && isPunct(sig[k + 1], '(') && isPunct(sig[k + 2], ')')) {
      add('warn', 'new Date() tanpa argumen tidak deterministik saat render. Gunakan useCurrentFrame().', t.start);
    } else if (!afterDot && (word === 'setTimeout' || word === 'setInterval' || word === 'requestAnimationFrame')) {
      add('warn', `${word} tidak sinkron dengan frame video. Gunakan useCurrentFrame() atau <Sequence>.`, t.start);
    } else if (!afterDot && word === 'fetch' && isPunct(sig[k + 1], '(')) {
      add('warn', 'Permintaan jaringan saat render bisa gagal atau lambat; bungkus dengan delayRender/continueRender.', t.start);
    }
  }

  // 7) Heuristik JSX/React: bergantung pada konfigurasi transform runner, jadi hanya peringatan.
  const firstTag = sig.find((t) => t.type === 'tag');
  if (firstTag && !sig.some((t) => isWord(t, 'React'))) {
    add('warn', "Ada JSX tetapi 'React' tidak diimpor. Bila render gagal, tambahkan: import React from 'react';", firstTag.start);
  }
  if (!sig.some((t) => isWord(t, 'useCurrentFrame'))) {
    add('info', 'useCurrentFrame() tidak dipakai, jadi video akan statis (tidak beranimasi).', 0);
  }

  return summarize(issues);
}

// Pengecekan untuk template bawaan (form): dijalankan sebelum permintaan dikirim ke Worker.
// Mengembalikan daftar isu bentuk {level, message}; hanya level 'error' yang memblokir.
export function checkBuiltin(template, values, props) {
  const issues = [];
  const error = (message) => issues.push({level: 'error', message});
  const warn = (message) => issues.push({level: 'warn', message});

  for (const field of template.fields) {
    const value = values[field.key];
    if (field.type === 'number') {
      const num = Number(value);
      if (value === '' || value === null || value === undefined || !Number.isFinite(num)) {
        error(`${field.label} harus berupa angka.`);
      } else if ((field.min !== undefined && num < field.min) || (field.max !== undefined && num > field.max)) {
        error(`${field.label} harus antara ${field.min} dan ${field.max}.`);
      }
    } else if (field.type === 'color') {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(value))) error(`${field.label} bukan warna yang valid.`);
    }
  }

  // preview() mengembalikan judul / slide pertama; kosong berarti konten belum diisi.
  if (!String(template.preview(values) || '').trim()) {
    error('Konten masih kosong (judul atau slide pertama belum diisi).');
  }

  if (template.id === 'TikTokSlides') {
    const lines = String(values.slidesText || '')
      .split(String.fromCharCode(10))
      .filter((line) => line.trim() !== '').length;
    if (lines > 12) warn(`Ada ${lines} slide; hanya 12 pertama yang dipakai.`);
  }

  if (JSON.stringify(props).length > MAX_PROPS_CHARS) {
    error(`Konten terlalu besar (maks ${MAX_PROPS_CHARS} karakter).`);
  }
  return issues;
}
