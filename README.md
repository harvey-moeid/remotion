# Remotion Studio

Platform video motion berbasis [Remotion](https://www.remotion.dev) yang berjalan di tier gratis Cloudflare + GitHub Actions. Rendering HANYA di GitHub Actions (tanpa Remotion Lambda, tanpa Workers Paid).

```
Browser (Cloudflare Pages)
   | POST /api/render            | POST /api/jobs/:id/cancel
   v                             v
Worker (Hono) --workflow_dispatch--> GitHub Actions (render.yml)
   |  KV: status job                       | npx remotion still  -> thumbnail JPEG
   |                                       | npx remotion render -> MP4
   +<-- PUT /upload-thumb, PUT /upload ----+  (Bearer UPLOAD_TOKEN)
   v
R2: thumbs/<jobId>.jpg  --> GET /thumbs/<jobId>.jpg (thumbnail riwayat + poster pemutar)
R2: renders/<jobId>.mp4 --> GET /files/<jobId>.mp4 (pemutar + unduh)
```

UI melakukan polling `GET /api/jobs/:id` sampai status `done`, lalu menampilkan pemutar dan link unduh.

## Thumbnail, unduh di riwayat, dan batal render

**Thumbnail.** `render.yml` merender satu frame diam (`remotion still`, frame 30, cadangan frame 0, skala 0.4, JPEG) lalu mengunggahnya ke `PUT /upload-thumb` SEBELUM video, jadi thumbnail sudah ada saat status berubah menjadi `done`. Langkah ini tidak fatal: kalau gagal, video tetap dirender dan riwayat memakai kotak placeholder. Thumbnail ditampilkan di riwayat dan jadi `poster` pemutar. Field `thumbUrl` ada di respons `GET /api/jobs/:id` (null bila belum ada). Batas ukuran thumbnail 2 MB; dibersihkan cron bersama MP4 (prefix `thumbs/`).

**Unduh langsung di riwayat.** Item riwayat berstatus `done` punya tombol **Unduh** yang membuka `/files/<id>.mp4?download=1` (header `Content-Disposition: attachment`), jadi tidak perlu membuka job dulu. Status tiap item diambil saat halaman dimuat (`refreshHistory`); status akhir (`done`, `failed`, `cancelled`, `expired`) di-cache dan tidak diambil ulang.

**Batal render.** Tombol **Batal render** muncul di panel Render selama job `queued`/`rendering`, dan tombol **Batal** ada di item riwayat yang masih berjalan. Alurnya:

1. UI memanggil `POST /api/jobs/:id/cancel`.
2. Worker menandai job `cancelled` di KV lebih dulu (supaya `/upload` dan `/upload-thumb` menolak hasil yang terlambat dengan HTTP 409), menghapus kode kustom dari KV, lalu memanggil GitHub `POST /actions/runs/{run_id}/cancel` bila run sudah melapor (`runUrl` tersimpan).
3. Bila job dibatalkan saat masih antre (run belum melapor), langkah "Lapor status rendering" mendapat HTTP 409 dari Worker dan run berhenti sendiri.
4. Job yang sudah `done`/`failed`/`cancelled` tidak bisa dibatalkan (HTTP 409). Kuota harian tidak dikembalikan saat dibatalkan.

Catatan: `DISPATCH_TOKEN` sudah punya izin **Actions: Read and write**, cukup untuk membatalkan run.

### Endpoint Worker

| Endpoint | Auth | Fungsi |
| --- | --- | --- |
| `POST /api/render` | publik (kode akses untuk CustomCode) | Buat job + picu workflow |
| `GET /api/jobs/:id` | publik | Status job (`videoUrl`, `thumbUrl`) |
| `POST /api/jobs/:id/cancel` | publik (id UUID tak bisa ditebak) | Batalkan job antre/berjalan |
| `POST /api/jobs/:id/status` | Bearer `UPLOAD_TOKEN` | Workflow lapor `rendering`/`failed` (409 bila dibatalkan) |
| `PUT /upload` | Bearer `UPLOAD_TOKEN` | Unggah MP4 |
| `PUT /upload-thumb` | Bearer `UPLOAD_TOKEN` | Unggah thumbnail JPEG |
| `GET /files/:id.mp4` | publik | Sajikan MP4 (Range, `?download=1`) |
| `GET /thumbs/:id.jpg` | publik | Sajikan thumbnail |

## Editor kode dan pengecekan sebelum render

Template **Kode kustom** memakai editor buatan sendiri (tanpa dependensi, tanpa CDN, tanpa build step; `web/` tetap statis murni).

| File | Peran |
| --- | --- |
| `web/lexer.js` | Lexer ringan TS/TSX (komentar, string, template, regex, angka, keyword, tag JSX). Bukan parser penuh. Dipakai bersama oleh editor dan pengecekan |
| `web/editor.js` | Editor: `<textarea>` transparan di atas `<pre>` berwarna + gutter nomor baris. Tab/Shift+Tab (indentasi, juga multi-baris), Enter mempertahankan indentasi, Esc lalu Tab untuk keluar (aksesibilitas) |
| `web/code-check.js` | `checkCode()` untuk kode kustom dan `checkBuiltin()` untuk form template bawaan |

**Cara kerja editor.** Pengguna mengetik di textarea (caret, seleksi, undo, IME, dan mobile tetap bawaan browser); warna datang dari `<pre>` di bawahnya dengan font/padding identik. Satu kontainer (`.ed-scroll`) yang digulir, jadi gutter dan pewarnaan tidak perlu disinkronkan lewat JS (gutter `position: sticky`). Konstanta `LINE_H`, `PAD_Y`, `PAD_X` di `editor.js` harus sama dengan CSS `.ed-*` di `styles.css`. Tanpa JS / bila editor gagal dimuat, textarea tetap bisa dipakai biasa.

**Pengecekan dasar (di browser, sebelum render).** Berjalan otomatis 300 ms setelah berhenti mengetik dan tepat saat tombol Render ditekan. Nomor baris bermasalah diberi warna di gutter, daftar isu di bawah editor bisa diklik untuk melompat ke baris.

| Level | Pengecekan |
| --- | --- |
| error (memblokir render) | kode kosong; lebih dari 100.000 karakter; tidak ada / lebih dari satu `export default`; kurung `() [] {}` tidak seimbang; komentar `/* */` atau template literal yang tidak ditutup; impor selain `react` / `remotion` atau impor relatif |
| warn | `Math.random()`, `Date.now()`, `new Date()`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch` (tidak deterministik / tidak sinkron dengan frame); nilai `config` di luar batas (1-1800 frame, 1-60 fps, 16-3840 px); JSX tanpa `import React`; string yang tidak ditutup |
| info | `useCurrentFrame()` tidak dipakai (video statis) |

Untuk template bawaan, `checkBuiltin()` memblokir render bila angka di luar rentang, warna tidak valid, konten (judul / slide pertama) kosong, atau props melebihi 20.000 karakter; lebih dari 12 slide hanya jadi peringatan.

**Batasan.** Pengecekan bersifat heuristik dan tidak menggantikan compiler: kode yang lolos masih bisa gagal di Remotion (tipe, runtime). Sebaliknya, lexer bisa salah membaca teks JSX tertentu (mis. apostrof atau `/` di dalam teks), sehingga warna kadang meleset; karena itu string tak tertutup hanya peringatan, bukan error. Batas 100.000 karakter dan keharusan `export default` juga dicek ulang oleh Worker (`worker/src/index.ts`).

## PWA (pasang sebagai aplikasi + offline)

Frontend bisa dipasang di layar utama / desktop dan kerangkanya tetap terbuka saat offline. Tetap statis murni (tanpa build step, tanpa dependensi).

| File | Peran |
| --- | --- |
| `web/manifest.webmanifest` | Nama, ikon, warna, `display: standalone`, shortcut "Prompt Library" |
| `web/sw.js` | Service worker: pra-cache kerangka + semua master prompt, strategi cache, update terkontrol |
| `web/pwa.js` + `web/pwa.css` | Registrasi SW, toast "Versi baru tersedia", penanda offline, tombol **Pasang aplikasi** (di iOS: petunjuk manual) |
| `web/offline.html` | Cadangan bila kerangka belum tersimpan dan perangkat offline |
| `web/icons/` | `icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon` (dibuat otomatis) |
| `scripts/make-pwa-icons.py` | Membuat ulang ikon dari logo Byga di `web/brand.css` (`pip install pillow`, lalu `python3 scripts/make-pwa-icons.py`) |

**Strategi cache (`sw.js`).**

- **Navigasi dan aset sama-origin** (HTML, JS, CSS, ikon, prompt): *network-first*. Saat online selalu versi terbaru, jadi modul JS tidak pernah tercampur versi lama dan baru. Bila jaringan lambat (>6 detik) atau mati, dipakai salinan cache. Server error 5xx juga jatuh ke cache.
- **Google Fonts**: *stale-while-revalidate* di cache terpisah. Tanpa jaringan dan belum pernah dimuat, tampilan memakai font sistem (sudah ada di `font-family`).
- **Tidak pernah disentuh**: API Worker, video, thumbnail (lintas origin), metode non-GET, permintaan `Range`, dan `?download=1`. Render, polling status, pemutar, dan unduhan berjalan persis seperti sebelumnya. Render video tetap butuh internet; saat offline muncul penanda di bawah layar.
- **Master prompt** dibaca dari `prompts/index.json` saat install, jadi menambah prompt baru tidak perlu mengubah `sw.js`.

**Update versi.** `deploy.yml` mengganti `__BUILD_ID__` di `sw.js` dengan 12 karakter SHA commit sebelum deploy Pages, sehingga tiap deploy mengubah `sw.js` dan memicu update. Versi baru *menunggu* (tidak aktif otomatis) sampai pengguna menekan **Muat ulang** di toast. Bila editor kode kustom berisi teks, diminta konfirmasi dulu karena kode tidak disimpan otomatis. Cache versi lama dihapus saat versi baru aktif. Cek versi baru juga berjalan tiap 30 menit dan saat tab kembali aktif.

**Menambah file baru di `web/`** yang dimuat halaman (JS, CSS, ikon): tambahkan ke `CORE_ASSETS` di `sw.js`. File yang lupa didaftarkan tetap bekerja online dan ter-cache otomatis setelah dibuka sekali, tapi belum tentu tersedia offline pada kunjungan pertama.

**Menguji.** Jalankan server statis (`python3 -m http.server -d web 8080`), buka `http://localhost:8080`, lalu di Chrome DevTools: *Application > Manifest* (tanpa error, ada tombol Install), *Application > Service Workers* (status *activated*), lalu centang *Offline* dan muat ulang. Di Pages, `/offline.html` dialihkan ke `/offline`; `sw.js` sudah menangani ini.

**Catatan.** Pemasangan butuh HTTPS (Pages sudah HTTPS) atau `localhost`. iOS tidak punya dialog pasang otomatis: pakai Bagikan > Tambahkan ke Layar Utama. Setelah `sw.js` pertama kali ter-deploy, kunjungan berikutnya sudah bisa offline.

## Struktur

| Folder | Isi |
| --- | --- |
| `remotion/` | Komposisi Remotion (`KineticTitle`, `TikTokSlides`), 1080x1920 dan 1920x1080 |
| `worker/` | Cloudflare Worker (Hono): API, upload, penyajian MP4 + thumbnail, pembatalan, cron pembersihan |
| `web/` | Frontend statis (HTML + JS murni) untuk Cloudflare Pages: `app.js`, `editor.js`, `lexer.js`, `code-check.js`, `templates.js`, plus berkas PWA (`sw.js`, `pwa.js`, `manifest.webmanifest`, `icons/`) |
| `scripts/` | Skrip bantu (pembuat ikon PWA) |
| `.github/workflows/` | `render.yml` (render video + thumbnail) dan `deploy.yml` (deploy Worker + Pages) |

## Secret yang wajib diisi

GitHub repo > Settings > Secrets and variables > Actions > New repository secret.

| Nama | Isi |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token Cloudflare: template **Edit Cloudflare Workers** + tambahan **Account > Cloudflare Pages > Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare (Dashboard > Workers & Pages > kanan) |
| `DISPATCH_TOKEN` | Fine-grained PAT GitHub, repo `remotion` saja, izin **Actions: Read and write**. Dipakai Worker untuk workflow_dispatch dan membatalkan run |
| `UPLOAD_TOKEN` | String acak panjang (mis. `openssl rand -hex 32`). Dipakai bersama oleh Worker dan render.yml untuk /upload |

`deploy.yml` otomatis menyalin `UPLOAD_TOKEN` dan `DISPATCH_TOKEN` ke secret Worker, jadi tidak ada secret di repo.

## Menambah template baru

1. Buat komposisi di `remotion/src/compositions/NamaTemplate.tsx` (props bertipe, ada fungsi normalize dan default).
2. Daftarkan di `remotion/src/Root.tsx` dengan `<Composition id='NamaTemplate' ... calculateMetadata={...} />` (dimensi dari `ratio`).
3. Tambahkan entri di `web/templates.js`: `id` (sama dengan id komposisi), `fields`, `preview`, dan opsional `toProps`.
4. Push ke `main`. Pages ikut ter-deploy otomatis; render berikutnya langsung memakai komposisi baru.

Worker tidak perlu diubah (hanya memvalidasi format id template). Thumbnail otomatis dibuat dari frame 30 komposisi; pastikan ada konten terlihat di sekitar detik pertama. `checkBuiltin()` ikut mengecek field baru (angka dalam `min`/`max`, warna `#rrggbb`) dan memakai `preview()` untuk mendeteksi konten kosong.

## Pengembangan lokal

```bash
cd remotion && npm install && npm run studio   # pratinjau komposisi
cd worker && npm install && npx wrangler dev   # Worker lokal (butuh .dev.vars)
```

## Batas free tier yang perlu diwaspadai

- **GitHub Actions**: repo private dapat 2.000 menit/bulan (Linux). Satu render 5-10 detik makan sekitar 2-4 menit, jadi kira-kira 500-1.000 render/bulan. Repo public tidak dibatasi menit. Thumbnail menambah beberapa detik per render. Pengecekan di browser mencegah menit terbuang untuk kode yang pasti gagal.
- **Workers Free**: 100.000 request/hari, CPU 10 ms/request, body request maks 100 MB (upload dibatasi 90 MB).
- **KV Free**: 1.000 write/hari. Satu render memakai sekitar 5-6 write (thumbnail menambah satu, pembatalan satu), jadi batas praktis sekitar 170 render/hari. Worker membatasi `MAX_RENDERS_PER_DAY` (default 50).
- **R2 Free**: 10 GB penyimpanan, 1 juta operasi kelas A dan 10 juta kelas B per bulan. Cron harian menghapus MP4 dan thumbnail yang lebih tua dari `RETENTION_DAYS` (default 7 hari).
- **Pages Free**: 500 build/bulan (di sini deploy lewat wrangler dari Actions, jadi tidak memakai build Pages).
- Endpoint /api/render dan /api/jobs/:id/cancel bersifat publik. Siapa pun yang tahu URL-nya bisa memicu render; kuota harian adalah pengamannya. Tambahkan Cloudflare Access atau kode akses jika perlu.

## Lisensi

Remotion gratis untuk individu dan tim kecil; cek ketentuan terbaru di https://www.remotion.dev/license sebelum dipakai komersial.
