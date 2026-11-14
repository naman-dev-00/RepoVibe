#!/usr/bin/env python3
"""Eternal Moon (preset-22): a monochrome moonlit forest, painted from scratch at 3840×2160 (original work; no external assets).

  far.webp    night sky, ~4200 stars, an enormous full moon (albedo noise, maria, ~900 craters with lit rims and floors, ray craters, limb
              darkening) and its halo
  mid.webp    the far tree line: spruces with drooping boughs and needle tufts, a few bare trees, standing in pale fog
  near.webp   the nearer, darker trees on the shore and the lake: mirrored forest and moon, broken by ripples, with the moon's glitter path
  front.webp  black framing trees at both edges and the near bank
  rays.webp   the moon's bloom and its light pooling in the fog
  t-cloud / t-fogA / t-fogB / t-fogC + t-mask-*   seamless drifting cloud and three fog planes, each confined to its own band of the scene
  s-sparkle, s-halo, s-glitter                     twinkling stars, the breathing halo, glints on the water
Silhouettes are rasterised at 2× and downsampled, so branches and needles stay crisp.     python3 -I scripts/wallpapers/eternal-moon.py"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/eternal-moon')
W, H, S = 3840, 2160, 2
MOON = (0.56 * W, 0.385 * H, 0.31 * H)        # centre x, y, radius
SHORE = int(0.77 * H)                         # waterline

def save(im, name, q=92):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')
def fft_noise(w, h, beta, seed):
    r = np.random.default_rng(seed); fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1
    spec = (r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta; spec[0, 0] = 0
    n = np.fft.ifft2(spec).real; return ((n - n.min()) / (n.max() - n.min())).astype(np.float32)
TINT = np.array([0.965, 0.985, 1.03], np.float32)   # silver: a breath of blue in the greys
def grey_rgb(g): return np.clip(g[..., None] * TINT, 0, 255)
def rgba(g, a): return Image.fromarray(np.concatenate([grey_rgb(g), np.clip(a, 0, 255)[..., None]], -1).astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------- moon
def moon_disc():
    mx, my, mr = MOON; n = int(mr * 2 + 8); c = n / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); dx, dy = (xx - c) / mr, (yy - c) / mr; rr = np.sqrt(dx * dx + dy * dy)
    alb = 0.74 + 0.16 * (fft_noise(n, n, 1.6, 3) - 0.5) + 0.07 * (fft_noise(n, n, 0.9, 4) - 0.5)       # highland mottling, coarse + fine
    mare = fft_noise(n, n, 2.6, 5); mare2 = fft_noise(n, n, 2.2, 6)
    seas = np.clip((0.5 * mare + 0.5 * mare2 - 0.46) * 5, 0, 1) * np.clip(1.25 - rr, 0, 1)
    alb -= seas * (0.34 + 0.08 * (fft_noise(n, n, 1.4, 8) - 0.5))                                                                                  # maria: broad darker plains
    r = np.random.default_rng(9)
    for i in range(1500):                                                                              # craters: almost all small, a handful large
        cr = (1.4 + 13 * r.random() ** 14 + 3.6 * r.random() ** 3) * mr / 670; ang = r.random() * 6.283; rad = math.sqrt(r.random()) * 0.97
        cx, cy = c + math.cos(ang) * rad * mr, c + math.sin(ang) * rad * mr
        x0, x1, y0, y1 = int(max(0, cx - cr * 2.6)), int(min(n, cx + cr * 2.6)), int(max(0, cy - cr * 2.6)), int(min(n, cy + cr * 2.6))
        if x1 <= x0 or y1 <= y0: continue
        lx, ly = xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy; d = np.sqrt(lx * lx + ly * ly) / cr
        floor = np.exp(-(d / 0.62) ** 4) * 0.05                                                         # darker floor
        rim = np.exp(-((d - 1.0) / 0.17) ** 2)
        shade = (lx * -0.6 + ly * -0.8) / (cr * np.maximum(d, 0.2))                                    # rim lit from the upper left, shadowed opposite
        alb[y0:y1, x0:x1] += -floor + rim * (0.02 + 0.05 * shade) * (0.5 + 0.5 * r.random())
        if cr > 9 * mr / 670 and r.random() < 0.35:                                                    # a young crater: bright ejecta rays
            a2 = np.arctan2(ly, lx); rays = (0.5 + 0.5 * np.sin(a2 * (9 + int(r.integers(0, 8))) + r.random() * 6)) ** 6
            alb[y0:y1, x0:x1] += rays * np.exp(-d / 2.4) * 0.035 * (d > 1) + np.exp(-(d / 0.9) ** 2) * 0.07   # bright floor and faint rays
    limb = np.sqrt(np.clip(1 - rr * rr, 0, 1)); alb *= 0.74 + 0.26 * limb ** 0.6                        # limb darkening
    a = np.clip((1 - rr) * mr / 1.6, 0, 1)
    return np.clip(alb, 0, 1) * 246, a, n

def far_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    mx, my, mr = MOON; dist = np.sqrt((x * W - mx) ** 2 + (y * H - my) ** 2)
    g = 5 + 16 * np.clip(y / 0.8, 0, 1) ** 1.6 + np.zeros((H, W), np.float32)
    g += 74 * np.exp(-(dist / (mr * 1.55)) ** 2) + 30 * np.exp(-(dist / (mr * 3.2)) ** 2)              # halo
    n = np.tile(fft_noise(1920, 1080, 2.2, 21), (2, 2)); g *= 0.9 + 0.2 * n                             # faint sky structure
    stars = Image.new('L', (W, H), 0); d = ImageDraw.Draw(stars); r = np.random.default_rng(17)
    for _ in range(4200):
        sx, sy = r.random() * W, r.random() ** 1.1 * H * 0.78; b = r.random() ** 3.2
        if math.hypot(sx - mx, sy - my) < mr * 1.12: continue
        rad = 0.9 + b * 3.4; v = int(110 + 145 * min(1, b * 2.6 + 0.12))
        d.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=v)
        if b > 0.975: ln = 10 + b * 14; d.line([(sx - ln, sy), (sx + ln, sy)], fill=170, width=1); d.line([(sx, sy - ln), (sx, sy + ln)], fill=170, width=1)
    sa = np.asarray(stars, np.float32); sb = np.asarray(stars.filter(ImageFilter.GaussianBlur(4)), np.float32)
    fade = np.clip((dist - mr * 1.1) / (mr * 0.9), 0.25, 1)                                             # the halo washes out the faintest stars near the moon
    g = g + (sa + sb * 0.9) * fade
    disc, a, n_ = moon_disc(); x0, y0 = int(mx - n_ / 2), int(my - n_ / 2)
    g[y0:y0 + n_, x0:x0 + n_] = g[y0:y0 + n_, x0:x0 + n_] * (1 - a) + disc * a
    return Image.fromarray(grey_rgb(g).astype(np.uint8), 'RGB')

# ---------------------------------------------------------------- trees (drawn into an 'L' mask at 2×)
def spruce(d, x, base, h, r, lean=0.0):
    top = base - h; tw = max(2.0, h * 0.02)
    d.polygon([((x - tw) * S, base * S), ((x + lean * h) * S, top * S), ((x + tw) * S, base * S)], fill=255)
    n = int(max(16, h / 13))
    for i in range(n):
        t = (i + r.random() * 0.6) / n; yb = top + h * (0.035 + 0.85 * t)
        ln = h * (0.028 + 0.2 * t ** 0.85) * (0.55 + 0.75 * r.random())
        xc = x + lean * h * (1 - t)
        for sgn in (-1, 1):
            if r.random() < 0.07: continue                                                            # a missing bough
            l2 = ln * (0.7 + 0.5 * r.random()); droop = 0.26 + 0.42 * t + 0.2 * r.random(); pts = []; k = 7
            for j in range(k + 1):
                u = j / k; pts.append((xc + sgn * l2 * u, yb + l2 * droop * (u ** 1.5) - l2 * 0.1 * math.sin(u * math.pi)))   # sags, then lifts at the tip
            # the bough is one solid shape: its spine on top, a ragged hem of hanging needle clumps underneath
            thick = l2 * 0.2; teeth = max(6, int(l2 / max(3.0, h * 0.011))); upper, lower = [], []
            for q in range(teeth + 1):
                u = q / teeth; f = u * k; j0 = min(k - 1, int(f)); w2 = f - j0
                px = pts[j0][0] * (1 - w2) + pts[j0 + 1][0] * w2; py = pts[j0][1] * (1 - w2) + pts[j0 + 1][1] * w2
                upper.append((px, py - thick * 0.1 * (1 - u)))
                hang = thick * (1 - 0.8 * u) * ((0.95 + 0.75 * r.random()) if q % 2 else (0.3 + 0.25 * r.random()))
                lower.append((px + sgn * hang * 0.22 * r.random(), py + hang))
            d.polygon([(px * S, py * S) for px, py in upper + lower[::-1]], fill=255)
            if r.random() < 0.55:   # a twig tip beyond the foliage
                tx, ty = pts[-1]; d.line([(tx * S, ty * S), ((tx + sgn * l2 * 0.07) * S, (ty - l2 * 0.03) * S)], fill=255, width=max(1, int(h * 0.003 * S)))

def bare(d, x, y, ang, ln, wd, r, depth=0):
    if ln < 7 or depth > 10: return
    x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
    d.line([(x * S, y * S), (x2 * S, y2 * S)], fill=255, width=max(1, int(wd * S)))
    for _ in range(2 if r.random() < 0.8 else 3): bare(d, x2, y2, ang + r.uniform(-0.62, 0.62) * (1 if depth else 0.5), ln * r.uniform(0.62, 0.8), wd * 0.66, r, depth + 1)

def tree_mask(seed, base, count, hmin, hmax, ground, x_range=(0, 1), bare_p=0.08, avoid=None):
    m = Image.new('L', (W * S, H * S), 0); d = ImageDraw.Draw(m); r = np.random.default_rng(seed)
    xs = np.sort(r.uniform(x_range[0] * W, x_range[1] * W, count))
    for x in xs:
        if avoid and avoid[0] * W < x < avoid[1] * W and r.random() < avoid[2]: continue
        h = r.uniform(hmin, hmax) * (0.75 + 0.5 * r.random()); b = base + r.uniform(-0.004, 0.006) * H
        if r.random() < bare_p: bare(d, x, b, -math.pi / 2 + r.uniform(-0.1, 0.1), h * 0.2, h * 0.016, r)
        else: spruce(d, x, b, h, r, lean=r.uniform(-0.02, 0.02))
    if ground:   # a rolling bank the trees stand on
        pts = [(xx * S, (base + math.sin(xx / 310 + seed) * 0.006 * H + math.sin(xx / 97 + seed * 2) * 0.002 * H) * S) for xx in range(-20, W + 40, 20)]
        d.polygon(pts + [(W * S + 40, H * S), (-20, H * S)], fill=255)
    return np.asarray(m.resize((W, H), Image.LANCZOS), np.float32) / 255

def mid_layer():
    """far tree line, pale in the fog, and a second, darker rank in front of it"""
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    m1 = tree_mask(31, 0.735 * H, 150, 0.14 * H, 0.26 * H, True)
    fogv = np.clip((y - 0.6) / 0.14, 0, 1) ** 1.3                                    # trunks dissolve into fog
    g1 = 34 + 44 * fogv + np.zeros((H, W), np.float32)
    m2 = tree_mask(32, 0.755 * H, 95, 0.2 * H, 0.36 * H, True, avoid=(0.46, 0.66, 0.5))   # thinner under the moon, so the disc reads
    g2 = 16 + 30 * np.clip((y - 0.64) / 0.12, 0, 1) ** 1.4 + np.zeros((H, W), np.float32)
    g = g1 * (1 - m2) + g2 * m2; a = np.maximum(m1, m2) * 255
    return rgba(g, a), m1, m2

def near_layer(far_img, mid_img):
    m = tree_mask(33, SHORE / H * H, 46, 0.3 * H, 0.52 * H, True, avoid=(0.42, 0.7, 0.75), bare_p=0.14)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    g = 5 + 9 * np.clip((y - 0.7) / 0.07, 0, 1) + np.zeros((H, W), np.float32)
    trees = rgba(g, m * 255)
    # the lake mirrors everything above the waterline
    above = far_img.convert('RGBA'); above.alpha_composite(mid_img); above.alpha_composite(trees)
    hgt = H - SHORE; src = above.crop((0, SHORE - int(hgt * 1.25), W, SHORE)).transpose(Image.FLIP_TOP_BOTTOM).resize((W, hgt), Image.BILINEAR)
    arr = np.asarray(src.convert('L'), np.float32)
    wy = np.linspace(0, 1, hgt, dtype=np.float32)[:, None]
    for row in range(hgt):                                                             # ripples displace the mirror image more toward the viewer
        sh = int(math.sin(row * 0.11) * (1 + 9 * (row / hgt)) + math.sin(row * 0.037 + 1.3) * 7 * (row / hgt)); arr[row] = np.roll(arr[row], sh)
    arr = np.asarray(Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), np.float32)
    water = arr * (0.5 - 0.26 * wy) + 3
    x = np.linspace(0, 1, W, dtype=np.float32)[None, :]; mxn = MOON[0] / W
    band = np.clip(np.sin(wy * 190 + np.tile(fft_noise(960, 540, 1.0, 45), (1, 4))[:hgt, :W] * 9) * 2.2, 0, 1)   # straight dashes, broken up by noise        # glitter path: broken horizontal dashes under the moon
    water += np.exp(-((x - mxn) / (0.03 + 0.1 * wy)) ** 2) * band * (150 - 70 * wy) * (0.5 + 0.5 * np.tile(fft_noise(960, 540, 1.2, 44), (1, 4))[:hgt, :W])
    r = np.random.default_rng(51); wi = Image.fromarray(np.clip(water, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(wi)
    for _ in range(420):                                                               # fine ripple strokes, sparse and faint
        rx, ry = r.random() * W, r.random() ** 1.5 * hgt; ln = 20 + ry * 0.4
        d.line([(rx, ry), (rx + ln, ry)], fill=int(30 + 50 * r.random()), width=1)
    water = np.asarray(wi, np.float32)
    out = np.asarray(trees, np.float32).copy()
    out[SHORE:, :, :3] = grey_rgb(water); out[SHORE:, :, 3] = 255
    # a thin bright fog line where water meets the bank
    line = np.exp(-((np.arange(H, dtype=np.float32)[:, None] - SHORE) / 7) ** 2) * 60
    out[..., :3] = np.clip(out[..., :3] + line[..., None] * (out[..., 3:4] > 0), 0, 255)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def front_layer():
    m = Image.new('L', (W * S, H * S), 0); d = ImageDraw.Draw(m); r = np.random.default_rng(61)
    for (x, base, h, lean) in [(0.035, 1.04, 1.02, 0.012), (0.125, 1.03, 0.78, -0.01), (-0.01, 1.05, 0.7, 0.02), (0.965, 1.04, 1.0, -0.012), (0.885, 1.03, 0.72, 0.01), (1.01, 1.05, 0.66, -0.02)]:
        spruce(d, x * W, base * H, h * H, r, lean)
    bare(d, 0.2 * W, 1.0 * H, -math.pi / 2 - 0.12, 0.085 * H, 0.008 * H, r); bare(d, 0.815 * W, 1.0 * H, -math.pi / 2 + 0.1, 0.075 * H, 0.007 * H, r)
    pts = [(xx * S, (0.955 * H + 0.04 * H * (abs(xx / W - 0.5) * 2) ** 2 * -1 + math.sin(xx / 260) * 0.006 * H + 0.03 * H) * S) for xx in range(-20, W + 40, 20)]   # the near bank, higher at the sides
    d.polygon(pts + [(W * S + 40, H * S), (-20, H * S)], fill=255)
    for _ in range(900):                                                               # grass and reeds along the bank
        gx = r.random() * W; edge = abs(gx / W - 0.5) * 2; gy = 0.985 * H - 0.04 * H * edge ** 2 + math.sin(gx / 260) * 0.006 * H
        gl = r.uniform(0.012, 0.045) * H * (0.6 + edge); a = -math.pi / 2 + r.uniform(-0.35, 0.35)
        d.line([(gx * S, gy * S), ((gx + math.cos(a) * gl) * S, (gy + math.sin(a) * gl) * S)], fill=255, width=S)
    mask = np.asarray(m.resize((W, H), Image.LANCZOS), np.float32) / 255
    g = np.full((H, W), 3, np.float32)
    rim = np.clip(mask - np.roll(mask, 3, axis=1), 0, 1) * (np.linspace(0, 1, W)[None, :] < 0.5) + np.clip(mask - np.roll(mask, -3, axis=1), 0, 1) * (np.linspace(0, 1, W)[None, :] >= 0.5)
    g += rim * 46                                                                       # a hair of moonlight on the edges that face the moon
    return rgba(g, mask * 255)

def rays_layer():
    y = np.arange(H, dtype=np.float32)[:, None]; x = np.arange(W, dtype=np.float32)[None, :]; mx, my, mr = MOON
    dist = np.sqrt((x - mx) ** 2 + (y - my) ** 2)
    a = np.exp(-(dist / (mr * 1.9)) ** 2) * 46 * np.clip((dist - mr * 0.96) / (mr * 0.3), 0, 1)
    a += np.exp(-(((x - mx) / (W * 0.3)) ** 2 + ((y - 0.7 * H) / (H * 0.07)) ** 2)) * 40    # light pooled in the fog under the moon
    return rgba(np.full((H, W), 236, np.float32), a)

# ---------------------------------------------------------------- moving planes
def fog_tile(seed, w, h, thr, gain, peak, beta=2.3, grey=206):
    n = fft_noise(w, h, beta, seed); y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    den = np.clip((n - thr) * gain, 0, 1) * np.clip(np.sin(y * math.pi), 0, 1) ** 0.7
    return rgba(np.full((h, w), grey, np.float32), den * peak)
def band_mask(y0, y1, y2, y3):
    yy = np.linspace(0, 1, 360, dtype=np.float32)[:, None]; al = np.clip((yy - y0) / max(1e-3, y1 - y0), 0, 1) * np.clip((y3 - yy) / max(1e-3, y3 - y2), 0, 1)
    return rgba(np.full((360, 640), 255, np.float32), np.broadcast_to(al * 255, (360, 640)))
def sparkle():
    s = 160; yy, xx = np.mgrid[0:s, 0:s].astype(np.float32) - s / 2
    al = np.exp(-(xx ** 2 + yy ** 2) / 60) + np.exp(-(np.abs(xx) / 40 + (yy / 2.2) ** 2)) * 0.9 + np.exp(-(np.abs(yy) / 40 + (xx / 2.2) ** 2)) * 0.9 + np.exp(-(xx ** 2 + yy ** 2) / 900) * 0.25
    return rgba(np.full((s, s), 250, np.float32), np.clip(al, 0, 1) * 255)
def halo():
    s = 1024; yy, xx = np.mgrid[0:s, 0:s].astype(np.float32); r = np.sqrt((xx - s / 2) ** 2 + (yy - s / 2) ** 2) / (s / 2)
    al = (np.exp(-((r - 0.56) / 0.2) ** 2) * 0.3 + np.exp(-(r / 0.8) ** 2) * 0.1) * np.clip((1 - r) * 5, 0, 1) * np.clip((r - 0.44) / 0.06, 0, 1)
    return rgba(np.full((s, s), 240, np.float32), al * 255)
def glitter():
    w, h = 700, 420; im = Image.new('L', (w, h), 0); d = ImageDraw.Draw(im); r = np.random.default_rng(81)
    for _ in range(90):
        y = r.random() ** 0.8 * h; half = (0.06 + 0.4 * y / h) * w; x = w / 2 + r.uniform(-1, 1) * half; ln = r.uniform(10, 46) * (0.5 + y / h)
        d.line([(x, y), (x + ln, y)], fill=int(r.uniform(130, 255)), width=2)
    return rgba(np.full((h, w), 248, np.float32), np.asarray(im, np.float32))

def main():
    os.makedirs(OUT, exist_ok=True)
    far = far_layer(); save(far, 'far.webp', 93)
    mid, _, _ = mid_layer(); save(mid, 'mid.webp', 93)
    near = near_layer(far, mid); save(near, 'near.webp', 93)
    front = front_layer(); save(front, 'front.webp', 93)
    rays = rays_layer(); save(rays, 'rays.webp', 80)
    cloud = fog_tile(71, 2048, 1024, 0.5, 3.4, 78, 2.0, 222); save(cloud, 't-cloud.webp', 80)
    fa = fog_tile(72, 2048, 512, 0.36, 2.8, 170); fb = fog_tile(73, 2048, 512, 0.36, 3.2, 215, 2.1, 200); fc = fog_tile(74, 2048, 512, 0.4, 3.0, 140, 2.2, 214)
    save(fa, 't-fogA.webp', 80); save(fb, 't-fogB.webp', 80); save(fc, 't-fogC.webp', 80)
    save(band_mask(0.02, 0.2, 0.52, 0.66), 't-mask-sky.webp'); save(band_mask(0.5, 0.62, 0.72, 0.8), 't-mask-far.webp')
    save(band_mask(0.58, 0.68, 0.76, 0.82), 't-mask-mid.webp'); save(band_mask(0.7, 0.78, 0.9, 1.0), 't-mask-water.webp')
    save(sparkle(), 's-sparkle.webp'); save(halo(), 's-halo.webp'); save(glitter(), 's-glitter.webp')
    flat = far.convert('RGBA')
    def band(tile, mask, rel):
        tw = int(W * rel); th = int(tw * tile.height / tile.width); t = tile.resize((tw, th), Image.BILINEAR); pl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for yy in range(0, H, th):
            for xx in range(0, W, tw): pl.alpha_composite(t, (xx, yy))
        mk = np.asarray(mask.resize((W, H), Image.BILINEAR), np.float32)[..., 3] / 255; arr = np.asarray(pl, np.float32).copy(); arr[..., 3] *= mk
        return Image.fromarray(arr.astype(np.uint8), 'RGBA')
    masks = {k: Image.open(os.path.join(OUT, f't-mask-{k}.webp')) for k in ('sky', 'far', 'mid', 'water')}
    flat.alpha_composite(band(cloud, masks['sky'], 0.9)); flat.alpha_composite(band(fa, masks['far'], 1.0)); flat.alpha_composite(mid)
    flat.alpha_composite(band(fb, masks['mid'], 1.0)); flat.alpha_composite(near); flat.alpha_composite(rays); flat.alpha_composite(front)
    p = os.path.join(ROOT, 'wallpapers/eternal-moon.webp'); flat.convert('RGB').save(p, 'WEBP', quality=92, method=6); print('flat', os.path.getsize(p) // 1024, 'KB')
    flat.convert('RGB').resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/eternal-moon.webp'), 'WEBP', quality=84, method=6)

if __name__ == '__main__':
    main()
