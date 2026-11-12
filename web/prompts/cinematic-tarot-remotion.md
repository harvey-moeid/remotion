# MASTER PROMPT — CINEMATIC TAROT VIDEO REMOTION

Bertindak sebagai Creative Director, Senior Motion Designer, dan Senior Remotion React/TypeScript Engineer.

Buat sebuah video TikTok bertema **PESAN SEMESTA HARI INI — PICK A CARD** dengan kualitas visual premium, cinematic, mystical, dan profesional.

Jangan hanya membuat slideshow biasa. Buat pengalaman visual yang terasa seperti trailer film supernatural modern.

## 1. Tujuan video

- Platform: TikTok, Instagram Reels, YouTube Shorts.
- Rasio: 9:16.
- Resolusi: 1080 × 1920.
- Durasi: 30 detik.
- Frame rate: 30 FPS.
- Bahasa seluruh teks: Bahasa Indonesia modern, mudah dipahami.
- Target penonton: Penggemar tarot dan konten spiritual.
- Branding: @jalurtarot.

## 2. Art direction

Gunakan gaya visual:

- Dark mystical cinematic.
- Latar midnight navy hampir hitam.
- Cahaya emas yang elegan.
- Aksen electric blue dan violet.
- Partikel cahaya melayang.
- Simbol astrologi dan ornamen geometris.
- Lingkaran energi bercahaya.
- Kartu tarot dengan bingkai emas.
- Kedalaman visual menggunakan beberapa layer.
- Dramatic lighting dan cinematic contrast.

Hasil harus terasa eksklusif, bukan seperti template video gratis.

Hindari visual yang terlalu ramai, efek berlebihan, dan penggunaan ornamen tanpa tujuan.

## 3. Storyboard dan timeline

**SCENE 1 — THE HOOK (0–3 detik)**

Layar dimulai gelap.

Sebuah cahaya emas muncul dari tengah layar, kemudian partikel energi menyebar perlahan.

Tampilkan tulisan:

"PESAN SEMESTA HARI INI"

Lanjutkan dengan:

"Ada sesuatu yang perlu kamu ketahui..."

Gunakan animasi cinematic typography, scale reveal, dan light sweep.

**SCENE 2 — THREE DESTINY CARDS (3–8 detik)**

Tampilkan tiga kartu tarot berjajar secara vertikal atau horizontal sesuai komposisi yang paling baik.

Kartu diberi nomor:

- PILIHAN 1
- PILIHAN 2
- PILIHAN 3

Setiap kartu memiliki:

- Bingkai emas.
- Ornamen mistis.
- Cahaya berbeda.
- Animasi floating yang halus.
- Efek glow saat mendapat sorotan.

Kartu harus memiliki bentuk dan ukuran konsisten.

**SCENE 3 — MAKE YOUR CHOICE (8–11 detik)**

Tampilkan tulisan besar:

"PILIH SATU KARTU"

Subteks:

"Ikuti intuisi pertamamu."

Berikan sorotan bergantian pada ketiga kartu.

**SCENE 4 — CARD REVEAL (11–17 detik)**

Kartu pertama terbuka dengan animasi flip atau reveal menggunakan transformasi visual yang meyakinkan.

Nama kartu:

THE MAGICIAN

Tampilkan pesan:

"Kamu memiliki kemampuan untuk menciptakan peluang baru. Jangan menunggu keadaan berubah, mulailah mengambil tindakan."

**SCENE 5 — CARD REVEAL (17–22 detik)**

Kartu kedua terbuka dengan animasi cinematic.

Nama kartu:

PAGE OF PENTACLES

Tampilkan pesan:

"Peluang baru mulai mendekat. Fokus pada proses, belajar sesuatu yang baru, dan jangan meremehkan langkah kecil."

**SCENE 6 — CARD REVEAL (22–26 detik)**

Kartu ketiga terbuka dengan efek dramatis.

Nama kartu:

FIVE OF SWORDS

Tampilkan pesan:

"Tidak semua pertarungan harus kamu menangkan. Pilih ketenangan daripada terus mempertahankan sesuatu yang menguras energi."

**SCENE 7 — FINAL CTA (26–30 detik)**

Ketiga kartu kembali muncul secara bersamaan.

Tampilkan:

"SEMOGA PESAN INI MENJADI PENERANG JALANMU"

Kemudian:

"Follow @jalurtarot untuk pesan semesta berikutnya."

Akhiri dengan logo teks JALUR TAROT dan efek cahaya emas.

## 4. Motion design

Gunakan animasi yang terencana:

- Smooth entrance dan exit.
- Spring animation dengan damping yang tepat.
- Cinematic zoom.
- Parallax antar-layer.
- Particle movement.
- Light sweep.
- Glow pulse.
- Card reveal.
- Depth dan perspective.
- Transisi antar-scene yang halus.

Jangan menggunakan animasi yang sama secara monoton pada semua elemen.

Setiap scene harus memiliki karakter gerakan tersendiri.

## 5. Typography

Gunakan maksimal dua keluarga font sistem.

Hierarki:

- Judul: besar, bold, elegan.
- Nama kartu: tegas dan premium.
- Interpretasi: mudah dibaca di layar ponsel.
- CTA: jelas dan menonjol.

Pastikan tidak ada teks terpotong, bertumpuk, atau keluar dari safe area.

Pertahankan margin aman di bagian atas dan bawah untuk UI TikTok.

## 6. Aturan teknis Remotion

WAJIB mengikuti batasan editor Kode Kustom repository harvey-moeid/remotion:

1. Gunakan React dan Remotion.
2. Impor hanya dari 'react' dan 'remotion'.
3. Gunakan import React.
4. Hanya satu export default.
5. Gunakan useCurrentFrame() untuk semua animasi.
6. Gunakan useVideoConfig() untuk FPS dan dimensi.
7. Gunakan interpolate() dan spring() jika diperlukan.
8. Semua animasi harus deterministik.
9. Jangan menggunakan Math.random(), Date.now(), new Date(), fetch, setTimeout, setInterval, atau requestAnimationFrame.
10. Jangan menggunakan CSS transition atau CSS animation.
11. Jangan menggunakan gambar, video, audio, font eksternal, CDN, atau import tambahan.
12. Buat seluruh elemen visual menggunakan React JSX, CSS inline, SVG inline, dan geometri.
13. Gunakan SVG secukupnya untuk ornamen tarot dan simbol mistis.
14. Hindari efek blur dan shadow yang terlalu berat.
15. Gunakan Sequence untuk pengaturan waktu scene.
16. Pastikan koordinat frame dalam Sequence benar.
17. Jangan membuat scene yang kosong tanpa tujuan.
18. Pastikan visual sudah terlihat jelas pada frame 30 untuk thumbnail.

Konfigurasi:

\`\`\`js
export const config = {
  durationInFrames: 900,
  fps: 30,
  width: 1080,
  height: 1920
};
\`\`\`

## 7. Quality control

Sebelum memberikan kode:

- Periksa keseimbangan seluruh kurung.
- Pastikan seluruh import valid.
- Pastikan hanya ada satu export default.
- Pastikan tidak ada API terlarang.
- Pastikan durasi seluruh scene tepat 900 frame.
- Pastikan tidak ada frame kosong yang tidak disengaja.
- Pastikan seluruh teks menggunakan bahasa Indonesia yang benar.
- Pastikan komposisi nyaman dilihat pada layar smartphone.
- Pastikan animasi tidak bergantung pada waktu nyata.
- Pastikan kode di bawah 100.000 karakter.

## 8. Output wajib

Berikan:

1. Konsep visual singkat.
2. Timeline setiap scene.
3. Satu file TSX lengkap.
4. Tidak boleh ada kode terpotong.
5. Tidak boleh menggunakan placeholder kode seperti "…lanjutkan sendiri".
6. Kode harus siap ditempel langsung ke template Kode Kustom Remotion Studio.

Jangan memberikan tutorial panjang sebelum kode.

Prioritas utama adalah menghasilkan video yang mempunyai storytelling kuat, desain premium, animasi halus, tipografi profesional, dan pengalaman menonton yang membuat orang ingin menyelesaikan video sampai akhir.
