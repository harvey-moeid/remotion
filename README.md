# Remotion Studio

Platform video motion berbasis [Remotion](https://www.remotion.dev) yang berjalan di tier gratis Cloudflare + GitHub Actions. Rendering HANYA di GitHub Actions (tanpa Remotion Lambda, tanpa Workers Paid).

```
Browser (Cloudflare Pages)
   | POST /api/render
   v
Worker (Hono) --workflow_dispatch--> GitHub Actions (render.yml)
   |  KV: status job                       | npx remotion render
   |                                       v
   +<-- PUT /upload (Bearer UPLOAD_TOKEN) -+
   v
R2: renders/<jobId>.mp4  --> GET /files/<jobId>.mp4 (pemutar + unduh)
```

UI melakukan polling `GET /api/jobs/:id` sampai status `done`, lalu menampilkan pemutar dan link unduh.

## Struktur

| Folder | Isi |
| --- | --- |
| `remotion/` | Komposisi Remotion (`KineticTitle`, `TikTokSlides`), 1080x1920 dan 1920x1080 |
| `worker/` | Cloudflare Worker (Hono): API, upload, penyajian MP4, cron pembersihan |
| `web/` | Frontend statis (HTML + JS murni) untuk Cloudflare Pages |
| `.github/workflows/` | `render.yml` (render video) dan `deploy.yml` (deploy Worker + Pages) |

## Secret yang wajib diisi

GitHub repo > Settings > Secrets and variables > Actions > New repository secret.

| Nama | Isi |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token Cloudflare: template **Edit Cloudflare Workers** + tambahan **Account > Cloudflare Pages > Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare (Dashboard > Workers & Pages > kanan) |
| `DISPATCH_TOKEN` | Fine-grained PAT GitHub, repo `remotion` saja, izin **Actions: Read and write**. Dipakai Worker untuk workflow_dispatch |
| `UPLOAD_TOKEN` | String acak panjang (mis. `openssl rand -hex 32`). Dipakai bersama oleh Worker dan render.yml untuk /upload |

`deploy.yml` otomatis menyalin `UPLOAD_TOKEN` dan `DISPATCH_TOKEN` ke secret Worker, jadi tidak ada secret di repo.

## Menambah template baru

1. Buat komposisi di `remotion/src/compositions/NamaTemplate.tsx` (props bertipe, ada fungsi normalize dan default).
2. Daftarkan di `remotion/src/Root.tsx` dengan `<Composition id='NamaTemplate' ... calculateMetadata={...} />` (dimensi dari `ratio`).
3. Tambahkan entri di `web/templates.js`: `id` (sama dengan id komposisi), `fields`, `preview`, dan opsional `toProps`.
4. Push ke `main`. Pages ikut ter-deploy otomatis; render berikutnya langsung memakai komposisi baru.

Worker tidak perlu diubah (hanya memvalidasi format id template).

## Pengembangan lokal

```bash
cd remotion && npm install && npm run studio   # pratinjau komposisi
cd worker && npm install && npx wrangler dev   # Worker lokal (butuh .dev.vars)
```

## Batas free tier yang perlu diwaspadai

- **GitHub Actions**: repo private dapat 2.000 menit/bulan (Linux). Satu render 5-10 detik makan sekitar 2-4 menit, jadi kira-kira 500-1.000 render/bulan. Repo public tidak dibatasi menit.
- **Workers Free**: 100.000 request/hari, CPU 10 ms/request, body request maks 100 MB (upload dibatasi 90 MB).
- **KV Free**: 1.000 write/hari. Satu render memakai sekitar 4-5 write, jadi batas praktis di bawah 200 render/hari. Worker membatasi `MAX_RENDERS_PER_DAY` (default 50).
- **R2 Free**: 10 GB penyimpanan, 1 juta operasi kelas A dan 10 juta kelas B per bulan. Cron harian menghapus MP4 yang lebih tua dari `RETENTION_DAYS` (default 7 hari).
- **Pages Free**: 500 build/bulan (di sini deploy lewat wrangler dari Actions, jadi tidak memakai build Pages).
- Endpoint /api/render bersifat publik. Siapa pun yang tahu URL-nya bisa memicu render; kuota harian adalah pengamannya. Tambahkan Cloudflare Access atau kode akses jika perlu.

## Lisensi

Remotion gratis untuk individu dan tim kecil; cek ketentuan terbaru di https://www.remotion.dev/license sebelum dipakai komersial.
