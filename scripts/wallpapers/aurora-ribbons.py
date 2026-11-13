#!/usr/bin/env python3
"""Aurora ribbons for the Aurora theme (original). Each ribbon is a horizontally seamless strip holding exactly two periods side by side:
the page shows one period through a clipping wrapper and slides the image by half its width in a loop, so the rays stream along the ribbon
forever without a seam. Every periodic term uses an integer frequency over the period.

Look: a bright sharp lower hem (green-white), tall vertical rays rising from it that fade upward and shift green → teal → violet/magenta,
fine ray texture, a second fainter fold behind, soft glow. Straight alpha.
Writes wallpapers/depth/aurora-borealis/s-ribbonA.webp, s-ribbonB.webp, s-ribbonC.webp.
  python3 -I scripts/wallpapers/aurora-ribbons.py"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/aurora-borealis')
P, H = 1600, 640            # one period; the file is 2P wide

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255
def periodic_noise(x, seed, terms, fmin, fmax):
    r = np.random.default_rng(int(seed * 7)); out = np.zeros_like(x)
    for _ in range(terms):
        f = r.integers(fmin, fmax + 1); out += np.sin(2 * np.pi * f * x + r.random() * 6.283) / np.sqrt(f)
    return out / (np.abs(out).max() + 1e-6)

def ribbon(seed, hem_y, amp, c_hem, c_mid, c_top, ray_h, strength):
    x = np.arange(P, dtype=np.float32) / P                                   # 0..1 over one period
    hem = hem_y + amp * (0.62 * np.sin(2 * np.pi * (1 * x) + seed) + 0.28 * np.sin(2 * np.pi * (3 * x) + seed * 2.1) + 0.1 * np.sin(2 * np.pi * (7 * x) + seed * 0.7))
    fold = 0.5 + 0.5 * np.sin(2 * np.pi * 2 * x + seed * 1.3)               # where the curtain folds toward us (brighter)
    fine = (0.5 + 0.5 * periodic_noise(x, seed + 1, 40, 30, 160)) ** 2.0     # fine vertical rays
    broad = (0.5 + 0.5 * periodic_noise(x, seed + 5, 14, 5, 28)) ** 1.4     # broad bright curtains of light
    rays = 0.6 * broad + 0.4 * fine
    tall = 0.55 + 0.45 * (0.5 + 0.5 * periodic_noise(x, seed + 2, 10, 3, 14))   # ray height varies along the ribbon
    yy = np.arange(H, dtype=np.float32)[:, None] / H                          # 0 top → 1 bottom
    above = (hem[None, :] - yy) / (ray_h * tall[None, :])                     # 0 at the hem, 1 at the ray tops
    body = np.where(above >= 0, np.exp(-above * 1.5) * (0.25 + 0.75 * rays[None, :]) * np.clip(1.15 - above, 0, 1), 0.0)
    hemline = np.exp(-((yy - hem[None, :]) / 0.028) ** 2) * (0.5 + 0.5 * fold[None, :]) * (0.6 + 0.4 * broad[None, :])
    below = np.where(above < 0, np.exp(above * 14.0), 0.0) * 0.5              # a soft glow just under the hem
    a = np.clip((body * (0.6 + 0.4 * fold[None, :]) * 1.35 + hemline * 0.55 + below * 0.3) * strength, 0, 1)
    t = np.clip(above, 0, 1)[..., None]
    col = np.where(t < 0.35, c_hem * (1 - t / 0.35) + c_mid * (t / 0.35), c_mid * (1 - (t - 0.35) / 0.65) + c_top * ((t - 0.35) / 0.65))
    col = np.clip(col + hemline[..., None] * 0.12, 0, 1)                     # the hem burns brighter green
    img = np.concatenate([col, a[..., None]], -1)
    # soften vertically (aurora rays are smooth along their length), keep them crisp across
    pil = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    pil = pil.resize((P, H // 4), Image.BILINEAR).resize((P, H), Image.BICUBIC)
    a2 = np.asarray(pil, np.float32) / 255
    # edge fade top/bottom of the strip
    v = np.clip(np.minimum(yy / 0.05, (1 - yy) / 0.05), 0, 1)
    a2[..., 3] *= v[:, 0][:, None] if v.ndim == 2 else v
    return np.concatenate([a2, a2], 1)                                         # two periods: seamless loop

def main():
    os.makedirs(OUT, exist_ok=True)
    defs = [
        ('ribbonA', 1.0, 0.72, 0.1, hexc('#b8ffd8'), hexc('#3df0a0'), hexc('#8a5cff'), 0.62, 1.15),
        ('ribbonB', 4.0, 0.7, 0.13, hexc('#c8fff0'), hexc('#36e0c8'), hexc('#c050f0'), 0.55, 0.9),
        ('ribbonC', 9.0, 0.66, 0.08, hexc('#d8ffc8'), hexc('#7af07a'), hexc('#5c7cff'), 0.5, 0.7),
    ]
    for name, seed, hy, amp, ch, cm, ct, rh, st in defs:
        img = ribbon(seed, hy, amp, ch, cm, ct, rh, st)
        p = os.path.join(OUT, f's-{name}.webp')
        Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(p, 'WEBP', quality=88, method=6)
        print(name, img.shape[1], 'x', img.shape[0], f'{os.path.getsize(p) / 1024:.0f}KB')

if __name__ == '__main__':
    main()
