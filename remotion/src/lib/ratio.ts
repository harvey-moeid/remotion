export type Ratio = '9:16' | '16:9';

export const FPS = 30;

export const FONT_STACK = 'Helvetica Neue, Helvetica, Arial, Liberation Sans, sans-serif';

export const safeRatio = (value: unknown): Ratio => (value === '16:9' ? '16:9' : '9:16');

export const dimensions = (ratio: Ratio) =>
  ratio === '16:9' ? {width: 1920, height: 1080} : {width: 1080, height: 1920};

export const clamp = (value: number, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};
