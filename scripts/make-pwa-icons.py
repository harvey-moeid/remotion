#!/usr/bin/env python3
"""Buat ikon PWA di web/icons/ dari logo Byga yang tertanam di web/brand.css.

Logo asli hanya 56x56 px (pixel art), jadi diperbesar dengan pengali bilangan
bulat + NEAREST supaya piksel tetap tajam (tanpa blur). Latar hitam mengikuti
latar logo itu sendiri.

Pemakaian (dari root repo):  python3 scripts/make-pwa-icons.py
Butuh Pillow:                pip install pillow
"""
import base64
import math
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND_CSS = ROOT / 'web' / 'brand.css'
OUT_DIR = ROOT / 'web' / 'icons'
BACKGROUND = (0, 0, 0)

# (nama file, ukuran kanvas, maskable)
# "any": logo boleh memenuhi kanvas. "maskable": seluruh piksel logo harus berada
# di dalam lingkaran safe zone (radius 40% dari sisi) supaya tidak terpotong mask OS.
ICONS = [
    ('icon-192.png', 192, False),
    ('icon-512.png', 512, False),
    ('icon-maskable-512.png', 512, True),
    ('apple-touch-icon.png', 180, False),
]


def load_logo() -> Image.Image:
    css = BRAND_CSS.read_text(encoding='utf-8')
    match = re.search(r'url\(data:image/png;base64,([A-Za-z0-9+/=]+)\)', css)
    if not match:
        raise SystemExit('Logo data URI tidak ditemukan di web/brand.css')
    import io
    return Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert('RGB')


def content_pixels(logo: Image.Image):
    """Koordinat piksel yang bukan latar (hampir hitam)."""
    px = logo.load()
    return [(x, y) for y in range(logo.height) for x in range(logo.width) if max(px[x, y]) >= 14]


def pick_scale(logo: Image.Image, size: int, maskable: bool) -> int:
    """Pengali bilangan bulat terbesar yang masih muat."""
    w, h = logo.size
    cx, cy = w / 2, h / 2
    reach = max(math.hypot(x + 0.5 - cx, y + 0.5 - cy) for x, y in content_pixels(logo))
    limit = size * 0.40 if maskable else size / 2
    best = 1
    scale = 1
    while w * scale <= size:
        fits = reach * scale <= limit
        if fits:
            best = scale
        scale += 1
    return best


def render(logo: Image.Image, size: int, maskable: bool) -> Image.Image:
    scale = pick_scale(logo, size, maskable)
    scaled = logo.resize((logo.width * scale, logo.height * scale), Image.NEAREST)
    canvas = Image.new('RGB', (size, size), BACKGROUND)
    canvas.paste(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


def main() -> None:
    logo = load_logo()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, size, maskable in ICONS:
        image = render(logo, size, maskable)
        image.save(OUT_DIR / name, format='PNG', optimize=True)
        print(f'{name}: {size}x{size}, pengali {pick_scale(logo, size, maskable)}x, maskable={maskable}')


if __name__ == '__main__':
    main()
