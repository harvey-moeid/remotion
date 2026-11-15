const $ = (selector) => document.querySelector(selector);
const MAX_BYTES = {image: 5 * 1024 * 1024, audio: 15 * 1024 * 1024, font: 2 * 1024 * 1024};
const MIME_TYPE = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image',
  'audio/mpeg': 'audio', 'audio/mp3': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio', 'audio/ogg': 'audio', 'audio/aac': 'audio',
  'font/woff2': 'font', 'font/woff': 'font', 'font/ttf': 'font', 'font/otf': 'font',
  'application/font-woff': 'font', 'application/x-font-ttf': 'font', 'application/vnd.ms-opentype': 'font',
};
const formatBytes = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function createAssetLibrary(apiBase) {
  const input = $('#assetAccessCode');
  const fileInput = $('#assetFile');
  const uploadButton = $('#assetUpload');
  const refreshButton = $('#assetRefresh');
  const list = $('#assetList');
  const status = $('#assetStatus');
  const state = {assets: [], selected: new Set(), busy: false};

  const getAccessCode = () => input.value.trim();
  function setAccessCode(value) {
    input.value = value || '';
    try {
      if (value) sessionStorage.setItem('remotion.accessCode', value);
      else sessionStorage.removeItem('remotion.accessCode');
    } catch {}
  }
  function message(text, kind = '') {
    status.textContent = text;
    status.className = 'asset-status' + (kind ? ' ' + kind : '');
  }

  function render() {
    list.replaceChildren();
    if (!state.assets.length) {
      const empty = document.createElement('li');
      empty.className = 'asset-empty';
      empty.textContent = 'Belum ada aset. Masukkan kode akses lalu tekan Muat aset.';
      list.append(empty);
      return;
    }
    for (const asset of state.assets) {
      const item = document.createElement('li');
      item.className = 'asset-item';
      const select = document.createElement('input');
      select.type = 'checkbox';
      select.checked = state.selected.has(asset.path);
      select.setAttribute('aria-label', 'Sertakan ' + asset.name saat render);
      select.addEventListener('change', () => {
        if (select.checked) state.selected.add(asset.path);
        else state.selected.delete(asset.path);
        message(`${state.selected.size} aset dipilih untuk render.`);
      });
      const preview = document.createElement('div');
      preview.className = 'asset-preview';
      if (asset.type === 'image') {
        const img = document.createElement('img');
        img.src = asset.previewUrl;
        img.alt = asset.name;
        img.loading = 'lazy';
        preview.append(img);
      } else if (asset.type === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = asset.previewUrl;
        preview.append(audio);
      } else {
        preview.textContent = 'Aa';
        preview.classList.add('font-preview');
      }
      const details = document.createElement('div');
      details.className = 'asset-details';
      const name = document.createElement('strong');
      name.textContent = asset.name;
      const meta = document.createElement('small');
      meta.textContent = `${asset.type.toUpperCase()} · ${formatBytes(asset.size)} · ${new Date(asset.uploadedAt).toLocaleDateString('id-ID')}`;
      const path = document.createElement('code');
      path.textContent = asset.staticPath;
      const actions = document.createElement('div');
      actions.className = 'asset-actions';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn small';
      copy.textContent = 'Salin path';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(asset.staticPath);
          message('Path aset disalin: ' + asset.staticPath, 'success');
        } catch {
          message('Clipboard tidak tersedia. Salin path yang tampil di kartu aset.');
        }
      });
      actions.append(copy);
      details.append(name, meta, path, actions);
      item.append(select, preview, details);
      list.append(item);
    }
  }

  async function refresh() {
    if (!getAccessCode()) return message('Masukkan kode akses pemilik terlebih dahulu.', 'error');
    refreshButton.disabled = true;
    try {
      const response = await fetch(`${apiBase}/api/assets`, {headers: {'X-Access-Code': getAccessCode()}});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      state.assets = Array.isArray(data.assets) ? data.assets : [];
      const valid = new Set(state.assets.map((asset) => asset.path));
      state.selected = new Set([...state.selected].filter((path) => valid.has(path)));
      render();
      message(`${state.assets.length} aset tersedia · pilih aset yang ingin disertakan pada render. Batas 10 upload/hari; file tersimpan ${data.retentionDays || 7} hari.`, 'success');
    } catch (error) {
      state.assets = [];
      render();
      message(error.message, 'error');
    } finally {
      refreshButton.disabled = false;
    }
  }

  async function upload() {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return message('Pilih satu file terlebih dahulu.', 'error');
    if (!getAccessCode()) return message('Masukkan kode akses pemilik terlebih dahulu.', 'error');
    const type = MIME_TYPE[file.type.toLowerCase()];
    if (!type) return message('Format tidak didukung. Pilih gambar PNG/JPEG/WebP, audio MP3/WAV/OGG/AAC, atau font WOFF/WOFF2/TTF/OTF.', 'error');
    if (file.size <= 0 || file.size > MAX_BYTES[type]) return message(`Ukuran maksimum ${type}: ${formatBytes(MAX_BYTES[type])}.`, 'error');
    if (state.busy) return;
    state.busy = true;
    uploadButton.disabled = true;
    message('Mengunggah ' + file.name + '…');
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await fetch(`${apiBase}/api/assets`, {
        method: 'POST',
        headers: {'X-Access-Code': getAccessCode()},
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      state.selected.add(data.path);
      fileInput.value = '';
      await refresh();
      message(`Berhasil mengunggah ${data.name}. Path: ${data.path}`, 'success');
    } catch (error) {
      message(error.message, 'error');
    } finally {
      state.busy = false;
      uploadButton.disabled = false;
    }
  }

  input.addEventListener('input', () => {
    try {
      if (input.value) sessionStorage.setItem('remotion.accessCode', input.value);
      else sessionStorage.removeItem('remotion.accessCode');
    } catch {}
  });
  uploadButton.addEventListener('click', upload);
  refreshButton.addEventListener('click', refresh);

  return {
    getSelectedPaths: () => [...state.selected],
    getAccessCode,
    setAccessCode,
    refresh,
  };
}
