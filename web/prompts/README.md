# Prompt Workspace

Folder ini berisi master prompt yang tampil di bagian **Prompt Workspace** pada halaman utama Remotion Studio.

## Cara kerja

- `index.json` adalah manifest. `web/prompt-library.js` membaca file ini lalu membuat satu kartu per prompt.
- Isi prompt (`.md`) hanya diunduh saat pengguna menekan **Lihat isi**, **Salin prompt**, atau **Unduh .md**, lalu disimpan di memori selama halaman terbuka.
- Semua teks dirender dengan `textContent`, bukan `innerHTML`, jadi isi manifest/prompt tidak dieksekusi sebagai HTML.

## Menambah prompt baru

1. Buat file `.md` di folder ini.
2. Tambahkan satu objek ke `prompts` di `index.json`:

| Field | Wajib | Keterangan |
|---|---|---|
| `id` | ya | Unik, huruf kecil dan tanda hubung |
| `file` | ya | Nama file `.md` di folder ini |
| `download` | tidak | Nama file saat diunduh (bawaan: nama `file`) |
| `icon` | tidak | Satu karakter/emoji (bawaan: ✧) |
| `tags` | tidak | Label kecil di atas judul |
| `title` | ya | Judul kartu |
| `description` | tidak | Ringkasan satu paragraf |
| `specs` | tidak | Chip spesifikasi, mis. `["9:16", "20 detik"]` |

Tidak perlu mengubah `index.html`, `prompt-library.js`, atau CSS.

## Prompt tersedia

- `cinematic-tarot-remotion.md` — video tarot 30 detik (9:16).
- `product-promo-remotion.md` — promosi produk/jasa 20 detik (9:16), umum dan tidak terkait tarot.
