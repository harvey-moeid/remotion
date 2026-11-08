// Menambahkan alpha ke warna hex (#rgb atau #rrggbb). Warna lain dikembalikan apa adanya.
export const withAlpha = (color: string, alpha: number): string => {
  const hex = String(color).trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return color;
  }
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${full}${a}`;
};
