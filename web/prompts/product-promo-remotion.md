# MASTER PROMPT — Product Promo Video (Remotion)

> Isi bagian **VARIABEL** lebih dulu, lalu tempel seluruh prompt ke AI.
> Hapus baris petunjuk yang diawali tanda `>` sebelum dikirim.

## VARIABEL (wajib diisi)

- NAMA_PRODUK: [contoh: Kopi Susu Aren Harian]
- TAGLINE: [satu kalimat, maks. 8 kata]
- TARGET_AUDIENS: [contoh: pekerja kantoran 22–35 tahun]
- 3_MANFAAT_UTAMA: [manfaat 1; manfaat 2; manfaat 3]
- BUKTI_SOSIAL: [contoh: 4,9/5 dari 1.200 ulasan — kosongkan jika tidak ada]
- HARGA_ATAU_PROMO: [contoh: Rp18.000 — gratis ongkir minggu ini]
- CTA: [contoh: Pesan lewat link di bio]
- WARNA_BRAND: [primer #RRGGBB, sekunder #RRGGBB, aksen #RRGGBB]
- FONT: [contoh: Space Grotesk untuk judul, DM Sans untuk isi]
- ASET_TERSEDIA: [logo / foto produk / tidak ada — jika tidak ada, gunakan bentuk geometri dan teks]

## PERAN

Kamu adalah motion designer sekaligus engineer Remotion senior. Kamu membuat video promosi pendek yang jelas, cepat dipahami, dan terasa premium tanpa bergantung pada footage eksternal.

## TUJUAN

Buat satu komposisi Remotion (React + TypeScript) untuk video promosi **NAMA_PRODUK** yang membuat **TARGET_AUDIENS** berhenti scroll, memahami manfaatnya, dan melakukan **CTA**.

## SPESIFIKASI TEKNIS

- Rasio 9:16, resolusi 1080 × 1920, 30 FPS, durasi 20 detik (600 frame).
- Satu file komposisi, ekspor default berupa komponen React.
- Sertakan `export const config = { durationInFrames: 600, fps: 30, width: 1080, height: 1920 }`.
- Hanya gunakan API Remotion: `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Sequence`, `AbsoluteFill`, `Easing`.
- Tanpa aset eksternal, tanpa request jaringan, tanpa `Math.random()` (animasi harus deterministik; jika perlu variasi, gunakan nilai dari frame).
- Semua teks aman dari pemotongan: simpan teks dalam area aman 90 px dari tepi kiri/kanan dan 220 px dari atas/bawah (area UI TikTok/Reels).
- Ukuran teks minimal 56 px untuk isi dan 96 px untuk judul agar terbaca di ponsel.

## ART DIRECTION

- Gaya: bersih, kontras tinggi, modern. Satu ide visual per adegan.
- Gunakan WARNA_BRAND secara konsisten: latar primer, teks kontras, aksen untuk angka dan CTA.
- Maksimal dua font (lihat FONT). Hierarki jelas: judul besar, subteks kecil.
- Jika ASET_TERSEDIA kosong, buat visual dari bentuk geometri, gradien lembut, dan ikon sederhana berbasis SVG.
- Jangan gunakan klaim yang tidak ada di variabel. Jangan mengarang angka, ulasan, atau testimoni.

## STORYBOARD (20 detik)

| Waktu | Adegan | Isi | Motion |
|---|---|---|---|
| 0–3 dtk | HOOK | Pertanyaan atau pernyataan yang menyentuh masalah TARGET_AUDIENS | Teks masuk cepat, scale 0.9 → 1 dengan spring |
| 3–6 dtk | PRODUK | NAMA_PRODUK + TAGLINE | Wipe horizontal, logo atau bentuk produk muncul bertahap |
| 6–14 dtk | 3 MANFAAT | Tiga manfaat, masing-masing ±2,5 dtk, satu per layar | Slide dari kanan, ikon pop dengan spring, angka/kata kunci diberi warna aksen |
| 14–17 dtk | BUKTI | BUKTI_SOSIAL (lewati adegan ini bila kosong, perpanjang adegan manfaat) | Angka naik (count-up) dengan `interpolate` |
| 17–20 dtk | CTA | HARGA_ATAU_PROMO + CTA | Tombol berdenyut halus, teks CTA tahan layar minimal 2 detik |

## ATURAN MOTION

- Gunakan `spring` untuk masuknya elemen dan `interpolate` dengan `Easing.out(Easing.cubic)` untuk transisi.
- Setiap adegan dibungkus `Sequence` dengan `from` dan `durationInFrames` eksplisit.
- Transisi antar adegan 8–12 frame (fade atau wipe), tidak lebih.
- Satu gerakan utama per adegan; hindari elemen bergerak bersamaan tanpa tujuan.
- Elemen yang keluar harus selesai sebelum elemen berikutnya mencapai posisi akhir.

## KELUARAN YANG DIMINTA

1. Satu blok kode TSX lengkap, siap dijalankan, tanpa placeholder.
2. Komentar singkat pada keputusan penting (pembagian frame, pilihan easing, area aman).
3. Konstanta di bagian atas file untuk semua teks dan warna, agar mudah diganti.
4. Daftar periksa akhir (ya/tidak): teks terbaca di ponsel, tidak ada klaim karangan, CTA tampil ≥ 2 detik, total frame = 600.

## BATASAN

- Jangan menambah dependensi di luar `react` dan `remotion`.
- Jangan menulis kode yang membutuhkan izin atau jaringan.
- Jika ada variabel yang kosong, gunakan nilai bawaan netral dan sebutkan di komentar, jangan bertanya balik.
