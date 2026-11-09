// Lexer ringan untuk TS/TSX. Dipakai bersama oleh editor (pewarnaan) dan code-check (kurung, impor)
// supaya keduanya selalu konsisten. Ini BUKAN parser penuh: cukup untuk menyorot dan mendeteksi
// kesalahan dasar tanpa dependensi tambahan (tanpa CDN, tanpa build step; web/ tetap statis murni).

// Karakter khusus dibuat lewat fromCharCode supaya file ini bebas dari escape yang rawan salah.
const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const BS = String.fromCharCode(92); // backslash
const SQ = String.fromCharCode(39); // '
const DQ = String.fromCharCode(34); // "
const BT = String.fromCharCode(96); // `

export const KEYWORDS = new Set([
  'import', 'export', 'default', 'from', 'as', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'typeof',
  'instanceof', 'in', 'of', 'class', 'extends', 'interface', 'type', 'enum', 'async', 'await',
  'try', 'catch', 'finally', 'throw', 'void', 'delete', 'yield', 'static', 'readonly',
  'implements', 'public', 'private', 'protected', 'abstract', 'declare', 'namespace',
  'satisfies', 'keyof',
]);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'this', 'NaN', 'Infinity']);
// Setelah keyword ini, tanda / dibaca sebagai awal regex (bukan pembagian).
const REGEX_AFTER_KEYWORD = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'yield', 'await',
]);

const NUMBER_RE =
  /(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9][0-9_]*(?:[.][0-9][0-9_]*)?(?:[eE][+-]?[0-9]+)?|[.][0-9][0-9_]*(?:[eE][+-]?[0-9]+)?)n?/y;
const IDENT_RE = /[A-Za-z_$][A-Za-z0-9_$]*/y;
const TAG_RE = /<[/]?(?:[A-Za-z][A-Za-z0-9_.:-]*)?/y;

const isSpace = (ch) => ch === ' ' || ch === TAB || ch === NL || ch === CR;
const isDigit = (ch) => ch >= '0' && ch <= '9'; // undefined >= '0' => false
const isLetter = (ch) => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
const isIdentStart = (ch) => isLetter(ch) || ch === '_' || ch === '$';

// Lewati isi ${...} di dalam template literal sampai } yang cocok (string dan template bersarang ikut dilewati).
function skipExpression(code, from) {
  const n = code.length;
  let depth = 1;
  let j = from;
  while (j < n && depth > 0) {
    const ch = code[j];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === DQ || ch === SQ) {
      j++;
      while (j < n && code[j] !== ch && code[j] !== NL) {
        if (code[j] === BS) j++;
        j++;
      }
    } else if (ch === BT) {
      j = scanTemplate(code, j).index;
      continue;
    }
    j++;
  }
  return Math.min(j, n);
}

function scanTemplate(code, start) {
  const n = code.length;
  let j = start + 1;
  while (j < n) {
    const ch = code[j];
    if (ch === BS) {
      j += 2;
      continue;
    }
    if (ch === BT) return {index: j + 1, closed: true};
    if (ch === '$' && code[j + 1] === '{') {
      j = skipExpression(code, j + 2);
      continue;
    }
    j++;
  }
  return {index: n, closed: false};
}

function regexAllowed(code, prev) {
  if (!prev) return true;
  if (prev.type === 'punct') {
    const ch = code[prev.start];
    return !(ch === ')' || ch === ']' || ch === '}');
  }
  if (prev.type === 'keyword') return REGEX_AFTER_KEYWORD.has(code.slice(prev.start, prev.end));
  return false;
}

// Apakah '<' di posisi i adalah awal tag JSX (bukan operator pembanding atau generic TS)?
// Generic/pembanding selalu didahului identifier, angka, ) atau ]. Penutup </x> selalu dianggap tag.
function tagAllowed(code, i, prev) {
  const d = code[i + 1];
  const e = code[i + 2];
  if (d === '/') return isLetter(e) || e === '>';
  if (!(isLetter(d) || d === '>')) return false;
  if (!prev) return true;
  if (['ident', 'func', 'class', 'literal', 'number'].includes(prev.type)) return false;
  if (prev.type === 'punct') {
    const ch = code[prev.start];
    if (ch === ')' || ch === ']') return false;
  }
  return true;
}

// Memecah kode menjadi token yang berurutan dan menutupi SELURUH teks (tiap karakter masuk satu token).
// Tipe: space, comment, string, template, regex, number, keyword, literal, func, class, ident, tag, punct.
// Token string/komentar/template yang tidak ditutup diberi flag `unterminated`.
export function tokenize(code) {
  const n = code.length;
  const tokens = [];
  let prev = null; // token signifikan terakhir (bukan spasi/komentar)
  let i = 0;

  const push = (type, start, end, unterminated) => {
    const token = {type, start, end};
    if (unterminated) token.unterminated = true;
    tokens.push(token);
    if (type !== 'space' && type !== 'comment') prev = token;
  };

  while (i < n) {
    const c = code[i];
    const d = code[i + 1];

    if (isSpace(c)) {
      let j = i + 1;
      while (j < n && isSpace(code[j])) j++;
      push('space', i, j);
      i = j;
      continue;
    }

    if (c === '/' && d === '/') {
      let j = code.indexOf(NL, i);
      if (j < 0) j = n;
      push('comment', i, j);
      i = j;
      continue;
    }
    if (c === '/' && d === '*') {
      const j = code.indexOf('*/', i + 2);
      if (j < 0) {
        push('comment', i, n, true);
        i = n;
      } else {
        push('comment', i, j + 2);
        i = j + 2;
      }
      continue;
    }

    if (c === DQ || c === SQ) {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        const ch = code[j];
        if (ch === BS) {
          j += 2;
          continue;
        }
        if (ch === c) {
          j++;
          closed = true;
          break;
        }
        if (ch === NL) break; // string biasa tidak boleh melewati baris
        j++;
      }
      j = Math.min(j, n);
      push('string', i, j, !closed);
      i = j;
      continue;
    }

    if (c === BT) {
      const scan = scanTemplate(code, i);
      push('template', i, scan.index, !scan.closed);
      i = scan.index;
      continue;
    }

    if (c === '<' && tagAllowed(code, i, prev)) {
      TAG_RE.lastIndex = i;
      const m = TAG_RE.exec(code);
      push('tag', i, i + m[0].length);
      i += m[0].length;
      continue;
    }

    if (c === '/' && regexAllowed(code, prev)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const ch = code[j];
        if (ch === NL) break;
        if (ch === BS) {
          j += 2;
          continue;
        }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      if (closed) {
        while (j < n && isLetter(code[j])) j++; // flag regex (g, i, m, ...)
        push('regex', i, j);
        i = j;
        continue;
      }
    }

    if (isDigit(c) || (c === '.' && isDigit(d))) {
      NUMBER_RE.lastIndex = i;
      const m = NUMBER_RE.exec(code);
      if (m) {
        push('number', i, i + m[0].length);
        i += m[0].length;
        continue;
      }
    }

    if (isIdentStart(c)) {
      IDENT_RE.lastIndex = i;
      const m = IDENT_RE.exec(code);
      const end = i + m[0].length;
      const word = m[0];
      const afterDot = prev !== null && prev.type === 'punct' && code[prev.start] === '.';
      let type;
      if (!afterDot && KEYWORDS.has(word)) type = 'keyword';
      else if (!afterDot && LITERALS.has(word)) type = 'literal';
      else {
        let j = end;
        while (j < n && (code[j] === ' ' || code[j] === TAB)) j++;
        if (code[j] === '(') type = 'func';
        else if (word[0] >= 'A' && word[0] <= 'Z') type = 'class';
        else type = 'ident';
      }
      push(type, i, end);
      i = end;
      continue;
    }

    push('punct', i, i + 1);
    i++;
  }
  return tokens;
}

// Pengubah indeks karakter -> {line, col} (basis 1) dengan pencarian biner; dibuat sekali per kode.
export function lineIndexer(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === NL) starts.push(i + 1);
  }
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return {line: lo + 1, col: index - starts[lo] + 1};
  };
}
