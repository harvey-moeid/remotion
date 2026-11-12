const PROMPT_URL = './prompts/cinematic-tarot-remotion.md';
const $ = (selector) => document.querySelector(selector);
let promptText = '';

async function loadPrompt() {
  const status = $('#prompt-status');
  try {
    const response = await fetch(PROMPT_URL, {cache: 'no-cache'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    promptText = await response.text();
    $('#prompt-content').textContent = promptText;
    status.textContent = 'Master prompt siap digunakan.';
    $('#prompt-copy').disabled = false;
    $('#prompt-download').disabled = false;
  } catch (error) {
    status.textContent = 'Master prompt gagal dimuat. Muat ulang halaman atau periksa koneksi.';
    $('#prompt-copy').disabled = true;
    $('#prompt-download').disabled = true;
  }
}

$('#prompt-toggle').addEventListener('click', () => {
  const preview = $('#prompt-preview');
  const expanded = !preview.hidden;
  preview.hidden = expanded;
  $('#prompt-toggle').setAttribute('aria-expanded', String(!expanded));
  $('#prompt-toggle').textContent = expanded ? 'Lihat isi' : 'Tutup isi';
});

$('#prompt-copy').addEventListener('click', async () => {
  if (!promptText) return;
  const status = $('#prompt-status');
  try {
    await navigator.clipboard.writeText(promptText);
    status.textContent = 'Prompt berhasil disalin. Tempelkan ke AI atau workflow yang Anda gunakan.';
  } catch {
    const field = document.createElement('textarea');
    field.value = promptText;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    status.textContent = copied
      ? 'Prompt berhasil disalin.'
      : 'Penyalinan otomatis tidak didukung browser ini. Buka isi prompt lalu salin secara manual.';
  }
});

$('#prompt-download').addEventListener('click', () => {
  if (!promptText) return;
  const blob = new Blob([promptText], {type: 'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'MASTER-PROMPT-CINEMATIC-TAROT-REMOTION.md';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  $('#prompt-status').textContent = 'File Markdown disiapkan untuk diunduh.';
});

$('#prompt-copy').disabled = true;
$('#prompt-download').disabled = true;
loadPrompt();
