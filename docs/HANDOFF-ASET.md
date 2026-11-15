# Handoff: Fitur Aset untuk Remotion Studio

Repo: `harvey-moeid/remotion` (branch `main`). Salin bagian "Prompt" di bawah ke sesi/agen berikutnya.

---

## Prompt

Kamu bekerja di repo `harvey-moeid/remotion` ("Remotion Studio"): platform video motion berbasis Remotion 4.0.250 yang rendernya HANYA di GitHub Actions, dengan Cloudflare Worker (Hono), KV, R2, dan frontend statis di Cloudflare Pages. Tugasmu: menambahkan dukungan **aset** (gambar, audio, font, dan jika memungkinkan video) agar komposisi bisa memakainya, **dan memperbarui Prompt Workspace (`web/prompts/`) di setiap tahap** supaya AI yang menulis kode kustom tahu cara memakai aset tersebut.

### Kondisi saat ini (sudah diverifikasi dari kode)

- Tidak ada folder `remotion/public/`, jadi `staticFile()` belum punya file.
- Props hanya JSON teks lewat `remotion/scripts/prepare-props.mjs` (menulis `props.json`). Batas props 20.000 karakter (`MAX_PROPS_CHARS`), jadi base64 tidak layak.
- Kode kustom (`web/code-check.js`) hanya mengizinkan impor `react` dan `remotion`; impor relatif dan paket lain = error yang memblokir render. `fetch` hanya peringatan.
- `PUT /upload` dan `PUT /upload-thumb` di Worker hanya untuk workflow (Bearer `UPLOAD_TOKEN`). Belum ada endpoint upload dari pengguna.
- Template bawaan (`KineticTitle`, `TikTokSlides`) hanya punya field teks, angka, warna.
- `remotion/package.json` hanya berisi `@remotion/cli`, `remotion`, `react`, `react-dom`.
- `render.yml` punya prinsip keamanan: `UPLOAD_TOKEN` HANYA diberikan ke langkah yang membutuhkannya, bukan ke seluruh job, supaya kode kustom tidak bisa membacanya. Jangan langgar ini.

**Prompt Workspace saat ini (`web/prompts/`):**

- `index.json` = manifest; `web/prompt-library.js` membuat satu kartu per prompt. Field per prompt: `id`, `file`, `download`, `icon`, `tags`, `title`, `description`, `specs`, `choices`. Kunci `choices` harus sama persis dengan nama variabel di bagian `## VARIABEL` file `.md`.
- File: `universal-remotion.md`, `product-promo-remotion.md`, `edukasi-remotion.md`, `cinematic-tarot-remotion.md` (tanpa variabel), plus `README.md`.
- `universal-remotion.md` menjelaskan kontrak CustomCode + pengecekan `code-check.js`. Di dalamnya: variabel `ASET_TERSEDIA` ("logo / foto / tidak ada"), daftar "API yang tersedia dari paket `remotion`" (hanya `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Easing`, `Sequence`, `AbsoluteFill`, `random`), larangan `fetch`, aturan "bila ASET_TERSEDIA kosong, bangun dari bentuk geometri", checklist akhir, dan bagian BATASAN.
- `product-promo-remotion.md` dan `edukasi-remotion.md` punya pilihan cepat (`choices`) terkait aset.
- `sw.js` membaca `prompts/index.json` saat install, jadi prompt baru tidak perlu mengubah `sw.js`. `index.html`, `prompt-library.js`, dan CSS tidak perlu diubah untuk menambah/mengedit prompt.

### Yang BELUM dibaca (baca dulu sebelum mengubah)

`worker/src/index.ts`, `web/app.js`, `web/templates.js`, `web/sw.js`, `remotion/src/Root.tsx`, kedua file di `remotion/src/compositions/`, `.github/workflows/deploy.yml`, `worker/wrangler.toml`, serta isi `product-promo-remotion.md`, `edukasi-remotion.md`, dan `index.json`.

### Aturan lintas tahap: prompt dan `code-check.js` harus selalu sejalan

Setiap tahap di bawah mengubah apa yang boleh dilakukan kode kustom. Maka di tahap yang sama, perbarui **keduanya**: `web/code-check.js` (aturan yang memblokir/memperingatkan) dan master prompt (aturan yang diberikan ke AI). Jangan biarkan prompt mengizinkan sesuatu yang diblokir `code-check.js`, atau sebaliknya. Perbarui juga `web/prompts/README.md` bagian "Prompt tersedia" bila deskripsinya berubah.

### Rencana bertahap (satu PR per tahap)

**Tahap 1: aset tetap di repo (PR kecil)**

1. Buat `remotion/public/` (mis. `logo/`, `audio/`, `fonts/`) dengan satu aset contoh kecil + `README` singkat aturan penamaan.
2. Beri contoh pemakaian `staticFile()` di salah satu komposisi (opsional lewat prop, jangan merusak default).
3. Pastikan `render.yml` tidak perlu diubah (Remotion membaca `public/` otomatis dari folder `remotion/`); konfirmasi lewat render lokal atau log Actions.
4. Pastikan kode kustom boleh memakai `Img`, `Audio`, `staticFile` dari paket `remotion` (bare specifier `remotion`, tetap sesuai aturan impor). Cek apakah `code-check.js` perlu diubah; kemungkinan tidak.
5. **Prompt:** di `universal-remotion.md`, tambahkan `Img`, `Audio`, `staticFile` (dan `OffthreadVideo` bila dipakai) ke daftar API yang tersedia. Ubah variabel `ASET_TERSEDIA` agar menerima nama file di `public/` (mis. `logo/logo.png`), dan ubah aturan "bila kosong, pakai geometri" jadi "bila kosong atau file tidak ada di daftar, pakai geometri". Larang menebak nama file yang tidak tercantum. Tambahkan butir checklist: aset hanya diacu lewat `staticFile()` dengan nama dari daftar. Sesuaikan `choices` aset di `index.json` untuk `product-promo` dan `edukasi`.
6. Update `README.md` utama (Struktur dan "Menambah template baru") dan `web/prompts/README.md`.

**Tahap 2: aset dari URL**

1. Tambah tipe field baru (mis. `image`/`audio` berisi URL) di `web/templates.js` dan prop bertipe di komposisi (dengan fungsi normalize + default).
2. Worker memvalidasi URL: hanya `https`, daftar domain yang diizinkan (konfigurasi di `wrangler.toml` atau var), panjang maksimum. Tolak IP/localhost/skema lain.
3. `checkBuiltin()` ikut memeriksa field baru.
4. Komposisi memakai `<Img>`/`<Audio>` dengan fallback bila gagal; bungkus pemuatan jaringan dengan `delayRender`/`continueRender` bila perlu.
5. **Prompt:** karena aturan "jangan `fetch`/jaringan" di prompt dan peringatan `fetch` di `code-check.js` mengatur akses jaringan, tentukan dengan jelas apakah `<Img src="https://...">` boleh di kode kustom. Jika boleh: nyatakan hanya untuk domain yang diizinkan, wajib fallback, dan sinkronkan peringatan di `code-check.js`. Jika tidak: tegaskan di prompt bahwa URL hanya lewat field template bawaan, bukan kode kustom. Ubah `ASET_TERSEDIA` sesuai keputusan itu.

**Tahap 3: upload dari pengguna ke R2**

1. Worker: `POST /api/assets` publik tetapi dibatasi (tipe MIME whitelist, ukuran maks, kuota harian seperti `MAX_RENDERS_PER_DAY`, nama file di-generate UUID). Simpan di R2 prefix `assets/`. Hitung biaya KV write (batas 1.000/hari) dan R2.
2. Cron pembersihan yang sudah ada harus ikut menghapus prefix `assets/` setelah `RETENTION_DAYS`.
3. Frontend: tombol upload + pratinjau, tanpa dependensi dan tanpa build step (`web/` tetap statis murni). Daftarkan file baru di `CORE_ASSETS` di `sw.js`.
4. `render.yml`: langkah baru yang mengunduh aset job ke `remotion/public/` SEBELUM render. Langkah ini tidak boleh menerima `UPLOAD_TOKEN` kecuali benar-benar perlu; lebih baik Worker menyajikan aset lewat URL bertanda tangan/ber-TTL atau endpoint baca khusus per job.
5. Tentukan bagaimana kode kustom mengacu ke aset hasil upload (mis. `staticFile('assets/<id>.png')`) dan bagaimana pengguna tahu nama/ID-nya.
6. **Prompt:** perbarui `ASET_TERSEDIA` agar mendeskripsikan aset hasil upload (nama/ID dan tipe), perbarui aturan dan checklist, dan pastikan Prompt Workspace dapat menyisipkan daftar aset pengguna bila UI-nya memungkinkan (ubah `prompt-library.js` hanya bila benar-benar perlu).

### Aturan wajib

- Frontend tetap statis murni. Jangan menambah bundler/framework.
- Jangan menaruh secret di repo. Jangan melonggarkan pembatasan impor kode kustom tanpa alasan kuat.
- Jaga batas free tier (Actions, Workers CPU 10 ms/request, body 100 MB, KV, R2) dan sebutkan dampaknya di README.
- Perubahan Worker yang menyentuh `/upload*` atau token harus dijelaskan di deskripsi PR.
- Gunakan Bahasa Indonesia untuk komentar dan dokumentasi, mengikuti gaya repo.
- Kerjakan di branch `feat/assets-...`, buka PR ke `main`, jangan push langsung. Jangan mulai Tahap 2/3 sebelum tahap sebelumnya disetujui.

### Pertanyaan yang harus dijawab pemilik sebelum Tahap 2/3

1. Jenis aset yang paling dibutuhkan: logo, gambar latar, musik, font, video?
2. Siapa yang boleh upload: hanya pemilik, atau publik (perlu kode akses/kuota)?
3. Batas ukuran per file dan per hari yang diinginkan?
4. Untuk Tahap 2: apakah kode kustom boleh memuat gambar dari URL, atau hanya template bawaan?

### Definisi selesai (per tahap)

- Render contoh memakai aset berhasil di GitHub Actions; thumbnail dan MP4 terunggah normal.
- `checkCode()`/`checkBuiltin()` tidak memberi error palsu untuk pemakaian aset yang sah, dan tidak meloloskan yang dilarang.
- Prompt di `web/prompts/` konsisten dengan `code-check.js`: kode yang dihasilkan dari prompt lolos pengecekan pada percobaan pertama.
- README (utama dan `web/prompts/`) diperbarui; offline PWA tidak rusak (`sw.js` konsisten).
