import {API_BASE} from './config.js';
import {CUSTOM_EXAMPLE, TEMPLATES} from './templates.js';
import {createEditor} from './editor.js';
import {MAX_CODE_CHARS, checkBuiltin, checkCode} from './code-check.js';

const $ = (selector) => document.querySelector(selector);
const HISTORY_KEY = 'remotion.history';
const ACCESS_KEY = 'remotion.accessCode';
const STEPS = ['queued', 'rendering', 'done'];
const POLL_MS = 4000;
const GIVE_UP_MS = 20 * 60 * 1000;
const CHECK_DELAY_MS = 300;
const MAX_ISSUES_SHOWN = 30;
const TERMINAL = ['done', 'failed', 'cancelled', 'expired'];
const IN_PROGRESS = ['queued', 'rendering'];
const STATUS_LABEL = {queued: 'Antre', rendering: 'Merender', done: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan', expired: 'Kedaluwarsa'};
const TEMPLATE_META = {
  KineticTitle: {icon: 'Aa', category: 'TYPOGRAPHY', note: 'Motion typography'},
  TikTokSlides: {icon: '▤', category: 'SOCIAL VIDEO', note: 'Vertical storytelling'},
  CustomCode: {icon: '</>', category: 'DEVELOPER', note: 'Build your own motion'},
};
const state = {template: TEMPLATES[0], ratio: '9:16', values: {}, timer: null, currentId: null, jobs: {}};

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function buildProps() {
  const t = state.template;
  if (t.custom) return {};
  if (t.toProps) return t.toProps(state.values);
  const props = {};
  for (const f of t.fields) props[f.key] = f.type === 'number' ? Number(state.values[f.key]) : state.values[f.key];
  return props;
}

/* ---------- template & form ---------- */
function renderTemplates() {
  const box = $('#templates');
  box.replaceChildren();
  for (const t of TEMPLATES) {
    const meta = TEMPLATE_META[t.id] || {icon: '✳', category: 'TEMPLATE', note: 'Video composition'};
    const selected = t.id === state.template.id;
    const button = el('button', {
      type: 'button',
      className: 'card' + (selected ? ' active' : ''),
      'aria-pressed': String(selected),
      onclick: () => selectTemplate(t),
    }, [
      el('span', {className: 'template-icon', 'aria-hidden': 'true', textContent: meta.icon}),
      el('span', {className: 'card-content'}, [
        el('span', {className: 'card-meta', textContent: meta.category}),
        el('strong', {textContent: t.name}),
        el('span', {textContent: t.description}),
      ]),
    ]);
    button.title = meta.note;
    box.append(button);
  }
}

function selectTemplate(t) {
  state.template = t;
  state.values = Object.fromEntries(t.fields.map((f) => [f.key, f.default]));
  $('#builtin').hidden = Boolean(t.custom);
  $('#custom').hidden = !t.custom;
  renderTemplates();
  renderForm();
  updatePreview();
  if (t.custom) updateCounter();
}

function renderForm() {
  const box = $('#form');
  box.replaceChildren();
  for (const f of state.template.fields) {
    const id = `f-${f.key}`;
    const input = f.type === 'textarea' ? el('textarea', {id, rows: 6}) : el('input', {id, type: f.type});
    if (f.type === 'number') {
      input.min = f.min;
      input.max = f.max;
      input.step = f.step;
      input.inputMode = 'decimal';
    }
    input.value = state.values[f.key];
    input.oninput = () => {
      state.values[f.key] = input.value;
      updatePreview();
    };
    box.append(el('label', {htmlFor: id, className: 'field'}, [el('span', {textContent: f.label}), input]));
  }
}

function updatePreview() {
  if (state.template.custom) return;
  const box = $('#preview');
  const v = state.values;
  box.style.aspectRatio = state.ratio === '16:9' ? '16 / 9' : '9 / 16';
  box.style.background = v.backgroundColor || '#101826';
  box.style.color = v.textColor || '#ffffff';
  box.style.borderColor = v.accentColor || 'var(--accent)';
  $('#preview-text').textContent = state.template.preview(v) || '';
  box.dataset.ratio = state.ratio;
}

document.querySelectorAll('#ratio button').forEach((button) => {
  button.onclick = () => {
    state.ratio = button.dataset.ratio;
    document.querySelectorAll('#ratio button').forEach((b) => {
      const active = b === button;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    updatePreview();
  };
});

/* ---------- custom code editor ---------- */
let checkTimer = null;
function updateCounter() {
  const n = $('#code').value.length;
  const counter = $('#counter');
  counter.textContent = `${n.toLocaleString('id-ID')} / ${MAX_CODE_CHARS.toLocaleString('id-ID')} karakter`;
  counter.classList.toggle('over', n > MAX_CODE_CHARS);
}

function renderCheck(result) {
  const box = $('#check');
  if (!$('#code').value.trim()) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const {errors, warnings} = result;
  const summary = $('#check-summary');
  summary.className = 'check-summary ' + (errors.length ? 'bad' : warnings.length ? 'warn' : 'ok');
  summary.textContent = errors.length ? `${errors.length} error, ${warnings.length} peringatan` : warnings.length ? `Lolos, ${warnings.length} peringatan` : 'Lolos pengecekan dasar';
  const list = $('#check-list');
  list.replaceChildren();
  for (const issue of result.issues.slice(0, MAX_ISSUES_SHOWN)) {
    list.append(el('li', {className: issue.level}, [
      el('button', {type: 'button', className: 'jump', textContent: `Baris ${issue.line}`, onclick: () => editor.goToLine(issue.line, issue.col)}),
      ` ${issue.message}`,
    ]));
  }
}

function runCheck() {
  clearTimeout(checkTimer);
  const result = checkCode($('#code').value);
  editor.setIssues(result.issues);
  renderCheck(result);
  return result;
}

function afterEdit() {
  updateCounter();
  clearTimeout(checkTimer);
  checkTimer = setTimeout(runCheck, CHECK_DELAY_MS);
}

const editor = createEditor($('#code'), {onInput: afterEdit});

function setCode(value) {
  $('#code').value = value;
  editor.refresh();
  afterEdit();
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > MAX_CODE_CHARS * 4) {
    showMessage('File terlalu besar untuk dimuat sebagai kode komposisi.');
    return;
  }
  try {
    setCode(await file.text());
    showMessage(`File ${file.name} dimuat.`);
  } catch {
    showMessage('File tidak bisa dibaca.');
  }
}

$('#pick').onclick = () => $('#file').click();
$('#file').onchange = (event) => {
  loadFile(event.target.files[0]);
  event.target.value = '';
};
$('#example').onclick = () => setCode(CUSTOM_EXAMPLE);
$('#clear').onclick = () => setCode('');
$('#code').ondragover = (event) => {
  event.preventDefault();
  editor.root.classList.add('dropping');
};
$('#code').ondragleave = () => editor.root.classList.remove('dropping');
$('#code').ondrop = (event) => {
  event.preventDefault();
  editor.root.classList.remove('dropping');
  loadFile(event.dataTransfer.files[0]);
};

try {
  $('#accessCode').value = sessionStorage.getItem(ACCESS_KEY) || '';
} catch {
  /* storage tidak tersedia: abaikan */
}
$('#accessCode').oninput = (event) => {
  try {
    sessionStorage.setItem(ACCESS_KEY, event.target.value);
  } catch {
    /* storage tidak tersedia: abaikan */
  }
};
updateCounter();

/* ---------- render & polling ---------- */
function showMessage(message, runUrl) {
  const box = $('#message');
  box.replaceChildren(document.createTextNode(message));
  if (runUrl && runUrl.startsWith('https://github.com/')) {
    box.append(' ', el('a', {href: runUrl, target: '_blank', rel: 'noopener noreferrer', textContent: 'Lihat log'}));
  }
}

function setStatus(job) {
  $('#steps').hidden = false;
  const idx = job.status === 'done' ? STEPS.length : STEPS.indexOf(job.status);
  document.querySelectorAll('#steps li').forEach((li, i) => {
    li.className = i < idx ? 'complete' : i === idx ? 'active' : '';
  });
  $('#steps').classList.toggle('failed', job.status === 'failed' || job.status === 'cancelled');
  $('#cancel').hidden = !IN_PROGRESS.includes(job.status);
  $('#cancel').disabled = false;
  if (job.status === 'queued') showMessage('Menunggu runner GitHub Actions (biasanya 10–30 detik)...');
  if (job.status === 'rendering') showMessage('Sedang merender, biasanya 1–3 menit...', job.runUrl);
  if (job.status === 'done') showMessage('Video siap.');
  if (job.status === 'failed') showMessage(job.message || 'Render gagal.', job.runUrl);
  if (job.status === 'cancelled') showMessage('Render dibatalkan.');
}

function clearResult() {
  $('#result').replaceChildren();
  $('#message').textContent = '';
}

function showResult(job) {
  const video = el('video', {
    controls: true,
    playsInline: true,
    preload: 'metadata',
    src: job.videoUrl,
    poster: job.thumbUrl || '',
    className: job.ratio === '16:9' ? 'wide' : 'tall',
  });
  const link = el('a', {className: 'download', href: `${job.videoUrl}?download=1`, textContent: 'Unduh MP4'});
  $('#result').replaceChildren(video, link);
}

function stopPolling() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

function finish() {
  stopPolling();
  $('#render').disabled = false;
  $('#render').removeAttribute('aria-busy');
  $('#render').querySelector('span').textContent = 'Render video';
  $('#cancel').hidden = true;
}

function rememberJob(job) {
  if (!job || !job.id) return false;
  const prev = state.jobs[job.id];
  state.jobs[job.id] = job;
  return !prev || prev.status !== job.status || prev.thumbUrl !== job.thumbUrl;
}

function track(jobId) {
  stopPolling();
  clearResult();
  state.currentId = jobId;
  const startedAt = Date.now();
  let polling = false;
  const tick = async () => {
    if (polling) return;
    polling = true;
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}`);
      if (res.status === 404) {
        showMessage('Job tidak ditemukan (mungkin sudah kedaluwarsa).');
        state.jobs[jobId] = {id: jobId, status: 'expired'};
        renderHistory();
        finish();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const job = await res.json();
      setStatus(job);
      if (rememberJob(job)) renderHistory();
      if (job.status === 'done') {
        showResult(job);
        finish();
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        finish();
      } else if (Date.now() - startedAt > GIVE_UP_MS) {
        showMessage('Waktu tunggu habis. Cek tab Actions di repository GitHub.');
        finish();
      }
    } catch (error) {
      showMessage(`Koneksi status terganggu (${error.message}). Mencoba kembali...`);
    } finally {
      polling = false;
    }
  };
  tick();
  state.timer = setInterval(tick, POLL_MS);
}

async function cancelJob(jobId) {
  if (state.currentId === jobId) $('#cancel').disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/cancel`, {method: 'POST'});
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      showMessage(data.error || 'Job tidak bisa dibatalkan.');
      if (state.currentId === jobId) track(jobId);
    } else if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    } else {
      rememberJob(data);
      if (state.currentId === jobId) {
        setStatus(data);
        finish();
      }
    }
  } catch (error) {
    showMessage(`Gagal membatalkan: ${error.message}`);
    if (state.currentId === jobId) $('#cancel').disabled = false;
  }
  renderHistory();
}

$('#cancel').onclick = () => {
  if (state.currentId) cancelJob(state.currentId);
};

async function startRender() {
  const button = $('#render');
  const body = {template: state.template.id, ratio: state.ratio, props: buildProps()};
  if (state.template.custom) {
    const code = $('#code').value;
    const accessCode = $('#accessCode').value;
    if (!code.trim()) return showMessage('Tempel atau unggah kode dulu.');
    const result = runCheck();
    if (result.errors.length > 0) {
      const first = result.errors[0];
      editor.goToLine(first.line, first.col);
      return showMessage(`Perbaiki ${result.errors.length} error dulu sebelum render (pertama: baris ${first.line}, ${first.message})`);
    }
    if (!accessCode) return showMessage('Isi kode akses dulu.');
    body.code = code;
    body.accessCode = accessCode;
  } else {
    const errors = checkBuiltin(state.template, state.values, body.props).filter((i) => i.level === 'error');
    if (errors.length > 0) return showMessage(errors.map((i) => i.message).join(' '));
  }

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.querySelector('span').textContent = 'Menyiapkan render...';
  clearResult();
  try {
    const res = await fetch(`${API_BASE}/api/render`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    state.jobs[data.jobId] = {id: data.jobId, status: 'queued'};
    saveHistory({id: data.jobId, template: state.template.name, ratio: state.ratio, at: Date.now()});
    setStatus({status: 'queued'});
    track(data.jobId);
  } catch (error) {
    $('#steps').hidden = true;
    showMessage(`Gagal memulai render: ${error.message}`);
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.querySelector('span').textContent = 'Render video';
  }
}

$('#render').onclick = startRender;

/* ---------- history (localStorage, per browser) ---------- */
function loadHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...loadHistory()].slice(0, 8)));
  } catch {
    /* storage tidak tersedia: abaikan */
  }
  renderHistory();
}

async function refreshHistory() {
  await Promise.all(loadHistory().map(async (item) => {
    const known = state.jobs[item.id];
    if (known && TERMINAL.includes(known.status)) return;
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(item.id)}`);
      if (res.status === 404) state.jobs[item.id] = {id: item.id, status: 'expired'};
      else if (res.ok) state.jobs[item.id] = await res.json();
    } catch {
      /* offline: biarkan status lama */
    }
  }));
  renderHistory();
}

function renderHistory() {
  const list = $('#history');
  list.replaceChildren();
  const items = loadHistory();
  if (items.length === 0) {
    list.append(el('li', {textContent: 'Belum ada render. Video yang selesai akan muncul di sini.'}));
    return;
  }
  for (const item of items) {
    const job = state.jobs[item.id];
    const status = job ? job.status : '';
    const thumb = job && job.thumbUrl
      ? el('img', {className: 'thumb', src: job.thumbUrl, alt: `Thumbnail ${item.template}`, loading: 'lazy'})
      : el('div', {className: 'thumb', textContent: status === 'done' ? 'MP4' : '▶'});

    const info = el('div', {className: 'info'}, [
      el('button', {
        type: 'button',
        className: 'open',
        textContent: `${item.template} · ${item.ratio}`,
        onclick: () => {
          $('#render').disabled = true;
          $('#render').setAttribute('aria-busy', 'true');
          $('#render').querySelector('span').textContent = 'Memuat job...';
          track(item.id);
        },
      }),
      el('span', {className: 'meta'}, [
        new Date(item.at).toLocaleString('id-ID'),
        ' ',
        ...(status ? [el('span', {className: `badge ${status}`, textContent: STATUS_LABEL[status] || status})] : []),
      ]),
    ]);

    const actions = el('div', {className: 'item-actions'});
    if (status === 'done') {
      actions.append(el('a', {className: 'btn small', href: `${API_BASE}/files/${encodeURIComponent(item.id)}.mp4?download=1`, textContent: 'Unduh'}));
    }
    if (IN_PROGRESS.includes(status)) {
      actions.append(el('button', {type: 'button', className: 'btn small cancel', textContent: 'Batal', onclick: () => cancelJob(item.id)}));
    }
    list.append(el('li', {}, [thumb, info, actions]));
  }
}

selectTemplate(TEMPLATES[0]);
renderHistory();
refreshHistory();