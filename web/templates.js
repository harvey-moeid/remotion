const NEWLINE = String.fromCharCode(10);

// Satu baris = satu slide. Format: Judul | isi tambahan (opsional).
function parseSlides(text) {
  return String(text || '')
    .split(NEWLINE)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const i = line.indexOf('|');
      return i < 0
        ? {title: line, body: ''}
        : {title: line.slice(0, i).trim(), body: line.slice(i + 1).trim()};
    })
    .filter((slide) => slide.title);
}

// Contoh kode untuk template Kode kustom (tombol "Isi contoh").
export const CUSTOM_EXAMPLE = [
  "import React from 'react';",
  "import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';",
  '',
  '// Opsional: durasi dan ukuran. Tanpa ini: 150 frame, 30 fps, ukuran mengikuti rasio.',
  'export const config = {durationInFrames: 120, fps: 30};',
  '',
  'export default function MyVideo() {',
  '  const frame = useCurrentFrame();',
  '  const {fps} = useVideoConfig();',
  '  const pop = spring({frame, fps, config: {damping: 12}});',
  "  const fade = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp'});",
  '  return (',
  "    <AbsoluteFill style={{background: '#101826', justifyContent: 'center', alignItems: 'center'}}>",
  "      <h1 style={{color: '#ffd400', fontSize: 120, opacity: fade, transform: 'scale(' + pop + ')'}}>",
  '        Halo Remotion',
  '      </h1>',
  '    </AbsoluteFill>',
  '  );',
  '}',
  '',
].join(NEWLINE);

// Cara menambah template: tambahkan entri di sini. `id` harus sama dengan id <Composition> di remotion/src/Root.tsx.
// fields : kolom form (type: text | textarea | color | number)
// toProps: (opsional) ubah nilai form menjadi props komposisi; bila kosong, key field dipakai apa adanya
// preview: teks untuk kotak pratinjau
// custom : (opsional) true = tampilkan editor kode (tempel/unggah) sebagai pengganti form
export const TEMPLATES = [
  {
    id: 'KineticTitle',
    name: 'Judul Kinetik',
    description: 'Teks muncul kata demi kata dengan gerak dinamis.',
    fields: [
      {key: 'title', label: 'Judul', type: 'text', default: 'Ide besar dimulai dari langkah kecil'},
      {key: 'subtitle', label: 'Subjudul', type: 'text', default: 'Remotion di Cloudflare + GitHub Actions'},
      {key: 'textColor', label: 'Warna teks', type: 'color', default: '#ffffff'},
      {key: 'accentColor', label: 'Warna aksen', type: 'color', default: '#ffd400'},
      {key: 'backgroundColor', label: 'Warna latar', type: 'color', default: '#101826'},
      {key: 'durationSeconds', label: 'Durasi (detik)', type: 'number', default: 5, min: 2, max: 20, step: 1},
    ],
    preview: (v) => v.title,
  },
  {
    id: 'TikTokSlides',
    name: 'Slide ala TikTok',
    description: 'Slide pendek dengan teks sorot, bar progres, dan handle akun.',
    fields: [
      {
        key: 'slidesText',
        label: 'Slide (satu per baris: Judul | isi)',
        type: 'textarea',
        default: [
          'Stop scroll! | 3 tips video cepat',
          '1. Hook kuat | Tiga detik pertama menentukan',
          '2. Teks besar | Mudah dibaca di layar kecil',
          '3. Ajak aksi | Follow untuk tips berikutnya',
        ].join(NEWLINE),
      },
      {key: 'handle', label: 'Handle akun', type: 'text', default: '@username'},
      {key: 'textColor', label: 'Warna teks', type: 'color', default: '#ffffff'},
      {key: 'accentColor', label: 'Warna aksen', type: 'color', default: '#ff3b6b'},
      {key: 'backgroundColor', label: 'Warna latar', type: 'color', default: '#0b0b12'},
      {key: 'secondsPerSlide', label: 'Detik per slide', type: 'number', default: 2.5, min: 1, max: 8, step: 0.5},
    ],
    toProps: (v) => ({
      slides: parseSlides(v.slidesText),
      handle: v.handle,
      textColor: v.textColor,
      accentColor: v.accentColor,
      backgroundColor: v.backgroundColor,
      secondsPerSlide: Number(v.secondsPerSlide) || 2.5,
    }),
    preview: (v) => (parseSlides(v.slidesText)[0] || {}).title || '',
  },
  {
    id: 'CustomCode',
    name: 'Kode kustom',
    description: 'Tempel atau unggah kode komposisi Remotion (TSX) milik Anda sendiri.',
    custom: true,
    fields: [],
    preview: () => '',
  },
];
