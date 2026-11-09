import React from 'react';
import {AbsoluteFill} from 'remotion';

// File ini DITIMPA oleh workflow render.yml saat template "CustomCode" dirender.
// Isi di bawah hanyalah placeholder agar proyek tetap bisa di-bundle dan dipratinjau di Studio.
//
// Kontrak kode kustom:
// - Wajib `export default` berupa komponen React.
// - Opsional `export const config = {durationInFrames, fps, width, height}`.
// - Hanya paket `remotion` dan `react` yang tersedia.

export const config = {durationInFrames: 90, fps: 30};

export default function UserCode() {
  return (
    <AbsoluteFill
      style={{
        background: '#101826',
        color: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'sans-serif',
        fontSize: 72,
      }}
    >
      Kode kustom
    </AbsoluteFill>
  );
}
