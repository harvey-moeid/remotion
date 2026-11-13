# Prompt Workspace

Folder ini berisi master prompt yang tampil di bagian **Prompt Workspace** pada halaman utama Remotion Studio.

## Cara kerja

- `index.json` adalah manifest. `web/prompt-library.js` membaca file ini lalu membuat satu kartu per prompt.
- Isi prompt (`.md`) hanya diunduh saat pengguna menekan **Edit prompt**, **Salin prompt**, atau **Unduh .md**, lalu disimpan di memori selama halaman terbuka.
- Semua teks dirender dengan `textContent`, bukan `innerHTML`, jadi isi manifest/prompt tidak dieksekusi sebagai HTML.

## Mengedit prompt di halaman

Tombol **Edit prompt** pada kartu membuka panel editor:

1. **Isi variabel.** Baris `- NAMA: [petunjuk]` di bagian `## VARIABEL` pada file `.md` otomatis menjadi kolom isian. Mengetik di kolom langsung mengganti baris itu di teks prompt; mengosongkan kolom mengembalikan `[petunjuk]`.
2. **Pilihan cepat.** Bila variabel punya `choices` di `index.json`, muncul tombol pilihan di bawah kolomnya. Klik untuk mengisi, klik lagi untuk mengosongkan.
3. **Edit bebas.** Seluruh teks prompt ada di satu textarea dan bisa diubah sesuka hati. Form dan textarea saling sinkron.
4. **Salin / Unduh** selalu memakai teks terbaru. Jika masih ada variabel kosong, pesan status memberi tahu jumlahnya.
5. **Reset ke bawaan** mengembalikan teks asli dari file `.md` (klik dua kali bila ada perubahan yang akan hilang).
6. **Prompt sendiri.** **＋ Prompt sendiri** membuat kartu kosong; **Duplikat sebagai prompt baru** menyalin prompt yang sedang diedit. Judul bisa diganti, dan kartu sendiri bisa dihapus.

**Tidak ada penyimpanan.** Semua perubahan dan prompt sendiri hanya ada di memori halaman dan hilang saat dimuat ulang. Gunakan **Salin** atau **Unduh .md** untuk menyimpan hasilnya. Prompt tanpa bagian `## VARIABEL` (mis. Cinematic Tarot) tetap bisa diedit lewat textarea, hanya tanpa form isian.

## Menambah prompt baru

1. Buat file `.md` di folder ini. Agar muncul form isian, beri bagian `## VARIABEL` berisi baris `- NAMA_HURUF_BESAR: [petunjuk atau contoh]`. Petunjuk yang mengandung `;` atau lebih dari 70 karakter menjadi kolom multibaris.
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
| `choices` | tidak | Pilihan cepat per variabel, mis. `{"CTA": ["Pesan lewat link di bio", "Chat WhatsApp sekarang"]}`. Kunci harus sama persis dengan nama variabel |

Tidak perlu mengubah `index.html`, `prompt-library.js`, atau CSS.

## Prompt tersedia

- `cinematic-tarot-remotion.md` — video tarot 30 detik (9:16). Tanpa variabel; edit lewat textarea.
- `product-promo-remotion.md` — promosi produk/jasa 20 detik (9:16), umum dan tidak terkait tarot. Pilihan cepat: audiens, CTA, warna, font, aset.
- `edukasi-remotion.md` — micro-lesson edukasi 30 detik (9:16): pertanyaan, 3 poin kunci, contoh, kuis. Pilihan cepat: target pelajar, warna, font.
- `universal-remotion.md` — topik bebas, durasi (1–60 detik) dan rasio (9:16/16:9) fleksibel. Menjelaskan persis kontrak file CustomCode dan pengecekan otomatis (error vs peringatan) agar kode yang dihasilkan AI lolos pada percobaan pertama. Pilihan cepat: rasio, warna, font, aset.
