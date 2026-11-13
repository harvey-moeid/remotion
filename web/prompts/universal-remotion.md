# MASTER PROMPT — Universal Video (Remotion)

> Isi bagian **VARIABEL** lebih dulu, lalu tempel seluruh prompt ke AI.
> Hapus baris petunjuk yang diawali tanda `>` sebelum dikirim.

## VARIABEL (wajib diisi)

- TOPIK_VIDEO: [apa yang ingin disampaikan, dalam satu-dua kalimat]
- RATIO: [9:16 (TikTok/Reels/Shorts) atau 16:9 (YouTube/landscape)]
- DURASI_DETIK: [angka, 1–60 — pada 30 FPS ini jadi 1–1800 frame]
- TARGET_PENONTON: [contoh: pekerja kantoran 22–35 tahun]
- PESAN_UTAMA: [inti yang harus diingat penonton setelah video selesai]
- POIN_PENDUKUNG: [1–3 poin; kosongkan bila video hanya satu adegan]
- CTA: [opsional — tindakan yang diminta di akhir; kosongkan bila tidak ada]
- WARNA_BRAND: [primer #RRGGBB, sekunder #RRGGBB, aksen #RRGGBB]
- FONT: [contoh: Space Grotesk untuk judul, DM Sans untuk isi — maks. 2 font]
- ASET_TERSEDIA: [logo / foto / tidak ada — jika tidak ada, gunakan bentuk geometri dan teks]

## PERAN

Kamu adalah motion designer sekaligus engineer Remotion senior. Kamu menulis kode React + TypeScript yang **lolos pengecekan otomatis** platform ini pada percobaan pertama, bukan sekadar terlihat benar.

## TUJUAN

Buat satu komposisi Remotion untuk video tentang **TOPIK_VIDEO** yang menyampaikan **PESAN_UTAMA** ke **TARGET_PENONTON** dalam **DURASI_DETIK** detik, lalu (bila CTA diisi) mengarahkan ke **CTA**.

## KONTRAK FILE (wajib — ini yang diperiksa otomatis sebelum render)

Kode ini akan menimpa satu file `.tsx` tunggal yang dijalankan sebagai komponen `CustomCode` di Remotion Studio. Aturan di bawah **memblokir render** bila dilanggar:

1. **Tepat satu** `export default`, berupa komponen React (function atau arrow function). Tidak nol, tidak lebih dari satu.
2. **Hanya** boleh `import` dari dua paket: `react` dan `remotion` (bare specifier, bukan sub-path seperti `@remotion/transitions` atau `remotion/paths` — itu tidak tersedia di runner ini). **Dilarang** import relatif (`./`, `../`) atau paket lain apa pun — kode harus satu file mandiri.
3. Semua kurung `() [] {}` harus seimbang dan tertutup.
4. Semua komentar `/* ... */` dan template literal (backtick `` ` ``) harus ditutup di baris yang sama atau baris berikutnya — jangan biarkan menggantung.
5. Kode tidak boleh kosong, dan maksimal 100.000 karakter.
6. Opsional: `export const config = { durationInFrames, fps, width, height }`. Bila diisi, nilainya harus masuk rentang berikut — di luar itu akan **dibatasi diam-diam** (bukan error, tapi hasil jadi tidak sesuai rencana):
   - `durationInFrames`: 1–1800
   - `fps`: 1–60
   - `width` / `height`: 16–3840

**Hitung nilai config dari variabel:**
- `durationInFrames` = DURASI_DETIK × 30
- `fps` = 30
- `width`, `height` = sesuai RATIO → `9:16` → 1080 × 1920, `16:9` → 1920 × 1080

## ATURAN RUNTIME (sangat disarankan — tidak memblokir, tapi bikin video tidak konsisten bila dilanggar)

Remotion merender setiap frame secara terpisah (bisa paralel), jadi kode harus **deterministik**:

- Jangan pakai `Math.random()` → pakai `random('seed-string')` dari paket `remotion` (deterministik per seed).
- Jangan pakai `Date.now()` atau `new Date()` tanpa argumen → pakai `useCurrentFrame()` untuk apa pun yang berubah seiring waktu.
- Jangan pakai `setTimeout`, `setInterval`, `requestAnimationFrame` → animasikan lewat `useCurrentFrame()` / `<Sequence>`, bukan timer.
- Jangan `fetch` data saat render (tidak ada jaringan yang andal di runner) — semua konten harus sudah ada di dalam kode/variabel.
- Jika ada JSX, wajib `import React from 'react';` di baris pertama.
- Pakai `useCurrentFrame()` minimal sekali — tanpa itu video akan statis (tidak beranimasi), cuma info tapi biasanya bukan itu yang diinginkan.

**API yang tersedia dari paket `remotion`:** `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Easing`, `Sequence`, `AbsoluteFill`, `random`. Tetap cukup untuk hampir semua video motion-graphics teks + bentuk geometri.

## ART DIRECTION

- Satu ide visual per adegan. Hierarki jelas: elemen utama besar, pendukung kecil.
- Gunakan WARNA_BRAND secara konsisten: latar primer, teks kontras, aksen untuk angka/CTA/penekanan.
- Maksimal dua font (FONT). Jangan mengarang klaim, angka, atau testimoni yang tidak ada di variabel.
- Jika ASET_TERSEDIA kosong, bangun visual dari bentuk geometri, gradien lembut, dan SVG inline sederhana.
- **Area aman teks** (penting bila RATIO = 9:16, karena UI TikTok/Reels/Shorts menutupi tepi layar): jaga semua teks minimal 90 px dari tepi kiri/kanan dan 220 px dari atas/bawah. Untuk 16:9, cukup beri margin wajar (≥ 60 px) karena tidak ada overlay UI platform.
- Ukuran teks minimal ±56 px untuk isi dan ±96 px untuk judul pada kanvas 1080×1920 (sesuaikan proporsional bila 16:9), agar terbaca di layar kecil.

## STORYBOARD (bagi total frame secara proporsional)

Hitung `totalFrames = DURASI_DETIK × 30`, lalu bagi menjadi adegan berurutan dengan `<Sequence from={...} durationInFrames={...}>` eksplisit yang **jumlahnya tepat sama dengan `totalFrames`** (tidak kurang, tidak lebih):

| Porsi | Adegan | Isi |
|---|---|---|
| ±15% | HOOK | Tangkap perhatian terkait TOPIK_VIDEO / masalah TARGET_PENONTON |
| ±60% | ISI | PESAN_UTAMA dan POIN_PENDUKUNG (bila ≤1 poin, perpanjang adegan ini; bila 2–3 poin, bagi rata) |
| ±25% | PENUTUP | Ringkasan PESAN_UTAMA, lalu CTA bila diisi (tahan di layar minimal 2 detik / 60 frame) |

Bila CTA kosong, hilangkan adegan CTA dan alihkan porsinya ke adegan ISI.

## ATURAN MOTION

- `spring` untuk elemen masuk, `interpolate` dengan `Easing.out(Easing.cubic)` untuk transisi/keluar.
- Setiap adegan dibungkus `Sequence` dengan `from` dan `durationInFrames` eksplisit — jangan andalkan offset implisit.
- Transisi antar adegan 8–12 frame saja (fade/wipe singkat), elemen keluar harus selesai sebelum elemen berikutnya mencapai posisi akhir.
- Satu gerakan utama per adegan; hindari banyak elemen bergerak bersamaan tanpa tujuan jelas.

## KELUARAN YANG DIMINTA

1. Satu blok kode `.tsx` lengkap, siap tempel ke editor, **tanpa placeholder** (`TODO`, `...`, dsb).
2. `export default function` + `export const config` dengan nilai yang sudah dihitung dari variabel (lihat bagian KONTRAK FILE).
3. Konstanta di bagian atas file untuk semua teks, warna, dan durasi per adegan — agar mudah diedit tanpa menyentuh logika animasi.
4. Komentar singkat pada keputusan penting: pembagian frame, alasan easing, batas area aman.
5. Checklist akhir (AI isi ya/tidak, di bawah kode, bukan di dalam kode):
   - [ ] Tepat satu `export default`
   - [ ] Hanya import dari `react`/`remotion`, tanpa import relatif atau paket lain
   - [ ] Semua kurung, string, komentar, template literal tertutup
   - [ ] Tidak ada `Math.random()` / `Date.now()` / `new Date()` tanpa argumen / `setTimeout` / `setInterval` / `requestAnimationFrame` / `fetch`
   - [ ] `import React from 'react'` ada (karena memakai JSX)
   - [ ] `useCurrentFrame()` dipakai minimal sekali
   - [ ] Total frame seluruh `Sequence` = `durationInFrames` = DURASI_DETIK × 30, dan berada di rentang 1–1800
   - [ ] Teks berada di dalam area aman (90 px kiri/kanan, 220 px atas/bawah bila 9:16)
   - [ ] Tidak ada klaim/angka yang dikarang di luar variabel

## BATASAN

- Jangan menambah dependensi di luar `react` dan `remotion`, walau "hanya untuk tipe data" atau "hanya dipakai saat development".
- Jangan menulis kode yang butuh izin, penyimpanan browser, atau jaringan — runner tidak menyediakannya.
- Bila ada variabel yang kosong (selain CTA/POIN_PENDUKUNG yang memang opsional), pakai nilai bawaan netral dan sebutkan di komentar — jangan bertanya balik.
