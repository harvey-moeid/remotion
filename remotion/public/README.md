# Aset statis Remotion

Letakkan aset yang dipakai saat render di folder ini.

- `logo/` — logo dan gambar SVG/PNG/WebP/JPEG.
- `audio/` — musik, voice-over, dan efek suara (MP3/WAV/AAC yang didukung renderer).
- `fonts/` — font WOFF/WOFF2/TTF/OTF dengan lisensi penggunaan yang sesuai.

Gunakan nama file huruf kecil, angka, tanda hubung, dan ekstensi yang jelas. Di kode kustom, panggil melalui `staticFile('logo/nama-file.svg')`; path dihitung relatif dari folder `public/`. Jangan menebak path yang tidak ada. Periksa lisensi aset sebelum dipakai pada video komersial.
