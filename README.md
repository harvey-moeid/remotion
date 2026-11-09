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

## Struktur

| Folder | Isi |
| --- | --- |
| `remotion/` | Komposisi Remotion (`KineticTitle`, `TikTokSlides`), 1080x1920 dan 1920x1080 |
| `worker/` | Cloudflare Worker (Hono): API, upload, penyajian MP4 + thumbnail, pembatalan, cron pembersihan |
| `web/` | Frontend statis (HTML + JS murni) untuk Cloudflare Pages |
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

Worker tidak perlu diubah (hanya memvalidasi format id template). Thumbnail otomatis dibuat dari frame 30 komposisi; pastikan ada konten terlihat di sekitar detik pertama.

## Pengembangan lokal

```bash
cd remotion && npm install && npm run studio   # pratinjau komposisi
cd worker && npm install && npx wrangler dev   # Worker lokal (butuh .dev.vars)
```

## Batas free tier yang perlu diwaspadai

- **GitHub Actions**: repo private dapat 2.000 menit/bulan (Linux). Satu render 5-10 detik makan sekitar 2-4 menit, jadi kira-kira 500-1.000 render/bulan. Repo public tidak dibatasi menit. Thumbnail menambah beberapa detik per render.
- **Workers Free**: 100.000 request/hari, CPU 10 ms/request, body request maks 100 MB (upload dibatasi 90 MB).
- **KV Free**: 1.000 write/hari. Satu render memakai sekitar 5-6 write (thumbnail menambah satu, pembatalan satu), jadi batas praktis sekitar 170 render/hari. Worker membatasi `MAX_RENDERS_PER_DAY` (default 50).
- **R2 Free**: 10 GB penyimpanan, 1 juta operasi kelas A dan 10 juta kelas B per bulan. Cron harian menghapus MP4 dan thumbnail yang lebih tua dari `RETENTION_DAYS` (default 7 hari).
- **Pages Free**: 500 build/bulan (di sini deploy lewat wrangler dari Actions, jadi tidak memakai build Pages).
- Endpoint /api/render dan /api/jobs/:id/cancel bersifat publik. Siapa pun yang tahu URL-nya bisa memicu render; kuota harian adalah pengamannya. Tambahkan Cloudflare Access atau kode akses jika perlu.

## Lisensi

Remotion gratis untuk individu dan tim kecil; cek ketentuan terbaru di https://www.remotion.dev/license sebelum dipakai komersial.
