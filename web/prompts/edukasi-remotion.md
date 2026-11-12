# MASTER PROMPT — Edukasi / Micro-Lesson (Remotion)

> Isi bagian **VARIABEL** lebih dulu, lalu tempel seluruh prompt ke AI.
> Hapus baris petunjuk yang diawali tanda `>` sebelum dikirim.

## VARIABEL (wajib diisi)

- TOPIK: [contoh: Cara kerja fotosintesis]
- TARGET_PELAJAR: [contoh: siswa SMP kelas 7–9]
- TUJUAN_BELAJAR: [satu kalimat: setelah menonton, penonton bisa ...]
- PERTANYAAN_PEMBUKA: [contoh: Dari mana tumbuhan mendapat makanannya?]
- 3_POIN_KUNCI: [poin 1; poin 2; poin 3 — masing-masing maks. 12 kata]
- CONTOH_ATAU_ANALOGI: [satu contoh sehari-hari yang mudah dibayangkan]
- KUIS_PENUTUP: [satu pertanyaan + jawaban benar + 2 pilihan salah]
- WARNA_BRAND: [primer #RRGGBB, sekunder #RRGGBB, aksen #RRGGBB]
- FONT: [contoh: Space Grotesk untuk judul, DM Sans untuk isi]
- NAMA_KANAL: [opsional, untuk watermark kecil]

## PERAN

Kamu adalah desainer instruksional sekaligus engineer Remotion senior. Kamu mengubah satu topik menjadi video belajar singkat yang akurat, runtut, dan menyenangkan ditonton di ponsel.

## TUJUAN

Buat satu komposisi Remotion (React + TypeScript) berdurasi 30 detik tentang **TOPIK** untuk **TARGET_PELAJAR**, sehingga penonton mencapai **TUJUAN_BELAJAR**.

## PRINSIP ISI

- Akurasi lebih penting daripada gaya. Hanya gunakan fakta yang ada di variabel atau pengetahuan umum yang pasti benar. Jangan mengarang angka, tanggal, nama, atau sumber.
- Satu video = satu gagasan. Jika TOPIK terlalu luas, ambil bagian paling dasar dan sebutkan di komentar bagian apa yang ditinggalkan.
- Bahasa Indonesia sederhana, kalimat pendek, istilah teknis dijelaskan saat pertama muncul.
- Setiap layar maksimal satu gagasan dan maksimal 18 kata.

## SPESIFIKASI TEKNIS

- Rasio 9:16, 1080 × 1920, 30 FPS, durasi 30 detik (900 frame).
- Satu file komposisi, ekspor default berupa komponen React.
- Sertakan `export const config = { durationInFrames: 900, fps: 30, width: 1080, height: 1920 }`.
- Hanya gunakan API Remotion: `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Sequence`, `AbsoluteFill`, `Easing`.
- Tanpa aset eksternal, tanpa request jaringan, tanpa `Math.random()` (animasi harus deterministik).
- Area aman: 90 px dari kiri/kanan dan 220 px dari atas/bawah.
- Teks isi minimal 56 px, judul minimal 96 px. Kontras teks terhadap latar minimal 4,5 : 1.
- Diagram dan ilustrasi dibuat dengan SVG inline dan bentuk geometri.

## STORYBOARD (30 detik)

| Waktu | Adegan | Isi | Motion |
|---|---|---|---|
| 0–4 dtk | PERTANYAAN | PERTANYAAN_PEMBUKA | Teks muncul per kata, tanda tanya berdenyut halus |
| 4–8 dtk | TUJUAN | TOPIK + TUJUAN_BELAJAR | Judul slide dari atas, garis aksen memanjang |
| 8–20 dtk | 3 POIN KUNCI | Tiga poin, masing-masing ±3,5 dtk, dengan ikon/diagram SVG sederhana | Poin masuk bergantian, kata kunci disorot warna aksen, diagram tergambar bertahap (`strokeDashoffset`) |
| 20–25 dtk | CONTOH | CONTOH_ATAU_ANALOGI | Ilustrasi sederhana + teks pendek; hubungkan visual ke poin kunci dengan garis |
| 25–30 dtk | KUIS | KUIS_PENUTUP (pertanyaan, tiga pilihan, jawaban benar disorot di 2 detik terakhir) | Pilihan muncul berurutan, jawaban benar membesar dan berubah warna aksen |

## ATURAN MOTION

- Gunakan `spring` untuk masuknya elemen dan `interpolate` dengan `Easing.out(Easing.cubic)` untuk transisi.
- Setiap adegan dibungkus `Sequence` dengan `from` dan `durationInFrames` eksplisit.
- Beri jeda baca: tiap teks tampil penuh minimal 1 detik per 7 kata sebelum berganti.
- Satu gerakan utama per adegan. Jangan menggerakkan teks saat sedang dibaca.
- Transisi antar adegan 8–12 frame.

## KELUARAN YANG DIMINTA

1. Satu blok kode TSX lengkap, siap dijalankan, tanpa placeholder.
2. Konstanta di bagian atas file untuk semua teks, warna, dan durasi adegan.
3. Komentar singkat pada keputusan penting (pembagian frame, jeda baca, area aman).
4. Daftar periksa akhir (ya/tidak): fakta sesuai variabel, tidak ada klaim karangan, teks terbaca di ponsel, jawaban kuis benar, total frame = 900.

## BATASAN

- Jangan menambah dependensi di luar `react` dan `remotion`.
- Jangan menulis kode yang membutuhkan izin atau jaringan.
- Jika variabel kosong, gunakan nilai bawaan netral dan catat di komentar, jangan bertanya balik.
