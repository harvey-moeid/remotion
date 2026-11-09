import {API_BASE} from './config.js';
import {CUSTOM_EXAMPLE, TEMPLATES} from './templates.js';

const $ = (selector) => document.querySelector(selector);
const HISTORY_KEY = 'remotion.history';
const ACCESS_KEY = 'remotion.accessCode';
const STEPS = ['queued', 'rendering', 'done'];
const POLL_MS = 4000;
const GIVE_UP_MS = 20 * 60 * 1000;
const MAX_CODE_CHARS = 100000;

// Status akhir tidak akan berubah lagi, jadi tidak perlu di-polling ulang.
const TERMINAL = ['done', 'failed', 'cancelled', 'expired'];
const IN_PROGRESS = ['queued', 'rendering'];
const STATUS_LABEL = {
  queued: 'Antre',
  rendering: 'Merender',
  done: 'Selesai',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

// jobs = cache status job per id (dipakai riwayat); currentId = job yang sedang dipantau di panel Render.
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
  for (const f of t.fields) {
    props[f.key] = f.type === 'number' ? Number(state.values[f.key]) : state.values[f.key];
  }
  return props;
}

/* ---------- template & form ---------- */

function renderTemplates() {
  const box = $('#templates');
  box.replaceChildren();
  for (const t of TEMPLATES) {
    box.append(
      el(
        'button',
        {
          type: 'button',
          className: 'card' + (t === state.template ? ' active' : ''),
          onclick: () => selectTemplate(t),
        },
        [el('strong', {textContent: t.name}), el('span', {textContent: t.description})],
      ),
    );
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
}

function renderForm() {
  const box = $('#form');
  box.replaceChildren();
  for (const f of state.template.fields) {
    const id = `f-${f.key}`;
    const input =
      f.type === 'textarea' ? el('textarea', {id, rows: 6}) : el('input', {id, type: f.type});
    if (f.type === 'number') {
      input.min = f.min;
      input.max = f.max;
      input.step = f.step;
    }
    input.value = state.values[f.key];
    input.oninput = () => {
      state.values[f.key] = input.value;
      updatePreview();
    };
    box.append(
      el('label', {htmlFor: id, className: 'field'}, [el('span', {textContent: f.label}), input]),
    );
  }
}

function updatePreview() {
  if (state.template.custom) return;
  const box = $('#preview');
  const v = state.values;
  box.style.aspectRatio = state.ratio === '16:9' ? '16 / 9' : '9 / 16';
  box.style.background = v.backgroundColor || '';
  box.style.color = v.textColor || '';
  box.style.borderColor = v.accentColor || '';
  $('#preview-text').textContent = state.template.preview(v) || '';
}

document.querySelectorAll('#ratio button').forEach((button) => {
  button.onclick = () => {
    state.ratio = button.dataset.ratio;
    document
      .querySelectorAll('#ratio button')
      .forEach((b) => b.classList.toggle('active', b === button));
    updatePreview();
  };
});

/* ---------- editor kode (template Kode kustom) ---------- */

function updateCounter() {
  const n = $('#code').value.length;
  const counter = $('#counter');
  counter.textContent = `${n.toLocaleString('id-ID')} / ${MAX_CODE_CHARS.toLocaleString('id-ID')} karakter`;
  counter.classList.toggle('over', n > MAX_CODE_CHARS);
}

async function loadFile(file) {
  if (!file) return;
  try {
    $('#code').value = await file.text();
    updateCounter();
    showMessage(`File ${file.name} dimuat.`);
  } catch {
    showMessage('File tidak bisa dibaca.');
  }
}

$('#code').oninput = updateCounter;
$('#pick').onclick = () => $('#file').click();
$('#file').onchange = (event) => {
  loadFile(event.target.files[0]);
  event.target.value = '';
};
$('#example').onclick = () => {
  $('#code').value = CUSTOM_EXAMPLE;
  updateCounter();
};
$('#clear').onclick = () => {
  $('#code').value = '';
  updateCounter();
};
$('#code').ondragover = (event) => {
  event.preventDefault();
  event.currentTarget.classList.add('dropping');
};
$('#code').ondragleave = (event) => event.currentTarget.classList.remove('dropping');
$('#code').ondrop = (event) => {
  event.preventDefault();
  event.currentTarget.classList.remove('dropping');
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
    /* abaikan */
  }
};
updateCounter();

/* ---------- render & polling ---------- */

function showMessage(text, runUrl) {
  const box = $('#message');
  box.textContent = text;
  if (runUrl && runUrl.startsWith('https://github.com/')) {
    box.append(' ', el('a', {href: runUrl, target: '_blank', rel: 'noopener', textContent: 'Lihat log'}));
  }
}

function setStatus(job) {
  $('#steps').hidden = false;
  const idx = job.status === 'done' ? STEPS.length : STEPS.indexOf(job.status);
  document.querySelectorAll('#steps li').forEach((li, i) => {
    li.className = i < idx ? 'complete' : i === idx ? 'active' : '';
  });
  $('#steps').classList.toggle('failed', job.status === 'failed' || job.status === 'cancelled');

  // Tombol Batal hanya relevan selama job masih antre/merender.
  $('#cancel').hidden = !IN_PROGRESS.includes(job.status);
  $('#cancel').disabled = false;

  if (job.status === 'queued') showMessage('Menunggu runner GitHub Actions (biasanya 10-30 detik)...');
  if (job.status === 'rendering') showMessage('Sedang merender, biasanya 1-3 menit...', job.runUrl);
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
    src: job.videoUrl,
    // Thumbnail dipakai sebagai poster supaya pemutar tidak hitam sebelum diputar.
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
  $('#cancel').hidden = true;
}

// Simpan status job ke cache; true bila ada perubahan yang perlu digambar ulang di riwayat.
function rememberJob(job) {
  const prev = state.jobs[job.id];
  state.jobs[job.id] = job;
  return !prev || prev.status !== job.status || prev.thumbUrl !== job.thumbUrl;
}

function track(jobId) {
  stopPolling();
  clearResult();
  state.currentId = jobId;
  const startedAt = Date.now();
  const tick = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      if (res.status === 404) {
        showMessage('Job tidak ditemukan (mungkin sudah kedaluwarsa).');
        state.jobs[jobId] = {id: jobId, status: 'expired'};
        renderHistory();
        return finish();
      }
      const job = await res.json();
      setStatus(job);
      if (rememberJob(job)) renderHistory();
      if (job.status === 'done') {
        showResult(job);
        finish();
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        finish();
      } else if (Date.now() - startedAt > GIVE_UP_MS) {
        showMessage('Waktu tunggu habis. Cek tab Actions di repo GitHub.');
        finish();
      }
    } catch {
      /* koneksi putus sesaat: coba lagi pada putaran berikutnya */
    }
  };
  tick();
  state.timer = setInterval(tick, POLL_MS);
}

// Batalkan job (dipakai tombol di panel Render dan di riwayat).
// Worker menandai job 'cancelled' lalu menghentikan run GitHub Actions bila sudah berjalan.
async function cancelJob(jobId) {
  if (state.currentId === jobId) $('#cancel').disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${jobId}/cancel`, {method: 'POST'});
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      // Sudah selesai/gagal/dibatalkan: tidak bisa dibatalkan, tampilkan status sebenarnya.
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
    if (code.length > MAX_CODE_CHARS) return showMessage('Kode terlalu panjang (maks 100.000 karakter).');
    if (!accessCode) return showMessage('Isi kode akses dulu.');
    body.code = code;
    body.accessCode = accessCode;
  }

  button.disabled = true;
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
  }
}

$('#render').onclick = startRender;

/* ---------- riwayat (localStorage, per browser) ---------- */

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
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

// Ambil status terbaru semua item riwayat (thumbnail, selesai/gagal/batal).
// Item berstatus akhir dilewati karena tidak akan berubah lagi.
async function refreshHistory() {
  await Promise.all(
    loadHistory().map(async (item) => {
      const known = state.jobs[item.id];
      if (known && TERMINAL.includes(known.status)) return;
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${item.id}`);
        if (res.status === 404) state.jobs[item.id] = {id: item.id, status: 'expired'};
        else if (res.ok) state.jobs[item.id] = await res.json();
      } catch {
        /* offline: biarkan status lama */
      }
    }),
  );
  renderHistory();
}

function renderHistory() {
  const list = $('#history');
  list.replaceChildren();
  const items = loadHistory();
  if (items.length === 0) {
    list.append(el('li', {textContent: 'Belum ada render.'}));
    return;
  }
  for (const item of items) {
    const job = state.jobs[item.id];
    const status = job ? job.status : '';

    // Thumbnail; job lama / belum ada thumbnail memakai kotak placeholder.
    const thumb = job && job.thumbUrl
      ? el('img', {className: 'thumb', src: job.thumbUrl, alt: `Thumbnail ${item.template}`, loading: 'lazy'})
      : el('div', {className: 'thumb', textContent: status === 'done' ? 'MP4' : '...'});

    const info = el('div', {className: 'info'}, [
      el('button', {
        type: 'button',
        className: 'open',
        textContent: `${item.template} - ${item.ratio}`,
        onclick: () => {
          $('#render').disabled = true;
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
      // Unduh langsung: Content-Disposition dari ?download=1 memaksa simpan file.
      actions.append(
        el('a', {
          className: 'btn small',
          href: `${API_BASE}/files/${item.id}.mp4?download=1`,
          textContent: 'Unduh',
        }),
      );
    }
    if (IN_PROGRESS.includes(status)) {
      actions.append(
        el('button', {
          type: 'button',
          className: 'btn small cancel',
          textContent: 'Batal',
          onclick: () => cancelJob(item.id),
        }),
      );
    }

    list.append(el('li', {}, [thumb, info, actions]));
  }
}

selectTemplate(TEMPLATES[0]);
renderHistory();
refreshHistory();
