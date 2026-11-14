#!/usr/bin/env python3
"""Aurora (preset-17): an anime-style frozen fjord valley under the northern lights. Painted from scratch (original work, no external
assets); the art direction follows the owner's reference picture (jagged snow-streaked peaks lit cyan from the left and pink from the
right, a teal → deep blue → violet sky with soft aurora veils, a glowing frozen lake, dark foreground rocks) without copying it.

Every mountain is a stack of crags. Each crag is shaded procedurally: a spine splits a lit face from a shadow face, snow streaks follow the
slope (ridged noise sampled along the fall line), tones are posterised into four flat cel colours, a rim light runs along the lit edge and
distance fades the crag into the sky colour.

Layers (wallpapers/depth/aurora-borealis/), 2560×1440:
  far.webp    sky: teal / blue / violet fields, painterly cloud, a baked soft aurora swirl, ~2600 crisp stars
  mid.webp    the distant pink-lit range and the frozen lake (glow, cracks, snow patches, shore mist)
  near.webp   the middle ranges left and right (the spire)
  front.webp  the great left massif, the dark left cliff and the snow-capped rocks at the right
  rays.webp   aurora light pooled over the valley
  t-mist      seamless drifting ground mist;  t-mask-low  where it shows
  s-veilA / s-veilB   soft aurora plumes that breathe and drift behind the flowing ribbons (aurora-ribbons.py)
  s-sparkle, s-iceGlow, s-shimmer, s-shrub   twinkling stars, the lake's glow, glints on the ice, frosted shrubs that sway
Also the flat wallpaper and its thumbnail.     python3 -I scripts/wallpapers/aurora-paint.py"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/aurora-borealis')
W, H = 2560, 1440
LAKE = int(0.735 * H)

def hexf(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
def save(im, name, q=90):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')
def fft_noise(w, h, beta, seed):
    r = np.random.default_rng(seed); fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1
    spec = (r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta; spec[0, 0] = 0
    n = np.fft.ifft2(spec).real; return ((n - n.min()) / (n.max() - n.min())).astype(np.float32)
NA = fft_noise(1024, 1024, 1.5, 101); NB = fft_noise(1024, 1024, 2.2, 102)
def to_img(arr, a=None):
    arr = np.clip(arr, 0, 255)
    if a is None: return Image.fromarray(arr.astype(np.uint8), 'RGB')
    return Image.fromarray(np.concatenate([arr, np.clip(a, 0, 255)[..., None]], -1).astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------- sky
SKY_TEAL, SKY_BLUE, SKY_VIOLET, SKY_PINK, SKY_TOP = hexf('#12c4ae'), hexf('#14348c'), hexf('#3c2290'), hexf('#b44aa8'), hexf('#141046')
def sky_field():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    g = lambda cx, cy, sx, sy: np.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))
    wt = {'teal': g(0.1, 0.5, 0.34, 0.42) * 1.25, 'blue': g(0.5, 0.42, 0.34, 0.5) * 1.0, 'violet': g(0.78, 0.18, 0.36, 0.4) * 0.9, 'pink': g(1.02, 0.62, 0.26, 0.34) * 1.15, 'top': g(0.45, -0.1, 0.8, 0.3) * 0.8}
    cols = {'teal': SKY_TEAL, 'blue': SKY_BLUE, 'violet': SKY_VIOLET, 'pink': SKY_PINK, 'top': SKY_TOP}
    tot = sum(wt.values()) + 1e-3
    sky = sum(wt[k][..., None] * cols[k] for k in wt) / tot[..., None]
    n = np.tile(NB, (2, 3))[:H, :W]; n2 = np.tile(NA, (2, 3))[:H, :W]
    sky *= (0.86 + 0.3 * n)[..., None]                                                    # painterly light/dark cloud
    sky += ((n2 - 0.5) * 16)[..., None]
    return sky, x, y

def aurora_swirl(x, y):
    """the baked, soft part of the aurora: veils that sweep diagonally, with a fine ray texture"""
    out = np.zeros((H, W, 3), np.float32)
    for (x0, y0, x1, y1, wid, col, k, ph) in [(0.2, 0.62, 0.62, 0.06, 0.1, hexf('#38f0c8'), 0.62, 0.0), (0.44, 0.6, 0.86, 0.12, 0.075, hexf('#58c8ff'), 0.4, 1.7), (0.02, 0.4, 0.3, 0.02, 0.07, hexf('#5af0d0'), 0.42, 3.1),
                                              (0.66, 0.5, 1.0, 0.2, 0.06, hexf('#a070ff'), 0.34, 4.4)]:
        dx, dy = x1 - x0, y1 - y0; ln = math.hypot(dx, dy); ux, uy = dx / ln, dy / ln
        t = ((x - x0) * ux + (y - y0) * uy) / ln                                         # along the veil 0..1
        d = (x - x0) * (-uy) + (y - y0) * ux                                             # across it
        bend = 0.05 * np.sin(t * 5.2 + ph) + 0.025 * np.sin(t * 11 + ph * 2)
        core = np.exp(-((d - bend) / (wid * (0.5 + 0.8 * np.clip(t, 0, 1)))) ** 2) * np.clip(t * 4, 0, 1) * np.clip((1.05 - t) * 3, 0, 1)
        rays = 0.6 + 0.4 * np.sin((x * 240 + y * 60) + 4 * np.sin(x * 23 + ph))        # fine curtain texture
        out += (core * (0.55 + 0.45 * rays) * k)[..., None] * col
    return out

def far_layer():
    sky, x, y = sky_field()
    sky += aurora_swirl(x, y) * 0.9
    img = to_img(sky).convert('RGBA')
    st = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(st); r = np.random.default_rng(17)
    cols = [(255, 255, 255), (220, 240, 255), (255, 236, 250), (200, 255, 244)]
    for _ in range(2600):
        sx, sy = r.random() * W, r.random() ** 1.15 * H * 0.7; b = r.random() ** 3.0; c = cols[r.integers(len(cols))]
        rad = 0.75 + b * 2.4
        d.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=c + (int(110 + 145 * min(1, b * 2.4 + 0.15)),))
        if b > 0.9:
            ln = 7 + b * 13
            d.line([(sx - ln, sy), (sx + ln, sy)], fill=c + (190,), width=1); d.line([(sx, sy - ln), (sx, sy + ln)], fill=c + (190,), width=1)
    img.alpha_composite(st); img.alpha_composite(st.filter(ImageFilter.GaussianBlur(2.5)))
    return img.convert('RGB')

# ---------------------------------------------------------------- mountains
PAL_L = [hexf('#241f6c'), hexf('#5448b4'), hexf('#8fb2ee'), hexf('#e6f8ff')]        # deep, shadow, mid, snow light: cyan key light from the left
PAL_R = [hexf('#34207a'), hexf('#7446b4'), hexf('#d88cd8'), hexf('#ffd6ee')]        # pink key light from the right
PAL_FG = [hexf('#0c0a2c'), hexf('#1c1856'), hexf('#3c3294'), hexf('#7868dc')]       # dark foreground rock, violet highlights

def crag_poly(px, py, wl, wr, base, seed, rough=1.0):
    r = np.random.default_rng(seed); pts = []
    for side, wdt in ((-1, wl), (1, wr)):
        n = 13; edge = []
        for i in range(n + 1):
            t = i / n                                                                  # 0 at the base, 1 at the summit
            ledge = 0.5 * (1 - math.cos(t * math.pi * 3.0)) * 0.08 * rough
            prof = 0.55 * (1 - t) ** (0.72 + 0.2 * r.random()) + 0.45 * (1 - t ** (1.5 + r.random()))          # bulky shoulders, not a needle
            xx = px + side * wdt * (prof + ledge * (1 - t)) + r.uniform(-1, 1) * wdt * 0.045 * rough * (1 - t)
            yy = base - (base - py) * (t ** (0.92 + 0.2 * r.random())) + r.uniform(-1, 1) * (base - py) * 0.012 * rough
            edge.append((xx, yy))
        pts.append(edge)
    left, right = pts[0], pts[1]
    return left + right[::-1][1:]                                                       # base-left → summit → base-right

def paint_crag(canvas, alpha, px, py, wl, wr, base, pal, lit_left, seed, haze=0.0, haze_col=None, snow_base=0.0, scale=1.0, rough=1.0):
    poly = crag_poly(px, py, wl, wr, base, seed, rough)
    x0 = int(max(0, min(p[0] for p in poly) - 4)); x1 = int(min(W, max(p[0] for p in poly) + 4)); y0 = int(max(0, py - 6)); y1 = int(min(H, base + 2))
    if x1 <= x0 or y1 <= y0: return
    m = Image.new('L', ((x1 - x0) * 2, (y1 - y0) * 2), 0); ImageDraw.Draw(m).polygon([((x - x0) * 2, (y - y0) * 2) for x, y in poly], fill=255)
    mask = np.asarray(m.resize((x1 - x0, y1 - y0), Image.LANCZOS), np.float32) / 255
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    e = np.clip((base - yy) / max(1.0, base - py), 0, 1)                                 # elevation 0..1
    spine = px + (yy - py) * (0.1 if lit_left else -0.1) + (NB[(yy.astype(int) * 3) % 1024, (int(seed) * 37) % 1024] - 0.5) * 120 * scale
    wob = (NA[(yy.astype(int) * 2) % 1024, (xx.astype(int) * 2) % 1024] - 0.5) * 70 * scale
    left_face = (xx + wob) < spine
    lit = left_face if lit_left else ~left_face
    # snow streaks along the fall line of each face
    ang = np.where(left_face, math.radians(112), math.radians(68))
    a = xx * np.cos(ang) + yy * np.sin(ang); b = -xx * np.sin(ang) + yy * np.cos(ang)
    f = 1.0 / scale
    n1 = NA[(a * 0.42 * f).astype(int) % 1024, (b * 3.1 * f).astype(int) % 1024]; n2 = NB[(a * 0.18 * f).astype(int) % 1024, (b * 1.3 * f).astype(int) % 1024]
    rid = 1 - np.abs(2 * (0.62 * n1 + 0.38 * n2) - 1)                                    # ridged: bright along thin lines
    rid = np.clip((rid - 0.45) * 2.2, 0, 1)
    t = np.where(lit, 0.6 + 0.55 * (rid - 0.5) + 0.16 * e, 0.2 + 0.5 * (rid - 0.5) + 0.1 * e)
    lvl = (t > 0.2).astype(int) + (t > 0.43) + (t > 0.69)
    col = np.stack(pal)[lvl]
    # rim light on the lit silhouette edge
    sh = 5 if lit_left else -5
    rim = np.clip(mask - np.roll(mask, sh, axis=1), 0, 1) * (e > 0.08)
    col = col * (1 - rim[..., None] * 0.8) + pal[3] * rim[..., None] * 0.8
    if snow_base > 0:   # snow drifts and mist pile up against the foot
        sb = np.clip((snow_base - e) / snow_base, 0, 1) ** 1.6
        col = col * (1 - sb[..., None]) + (pal[3] * 0.82 + pal[2] * 0.18) * sb[..., None]
    if haze > 0: col = col * (1 - haze) + haze_col * haze
    canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - mask[..., None]) + col * mask[..., None]
    alpha[y0:y1, x0:x1] = np.maximum(alpha[y0:y1, x0:x1], mask * 255)

def blank(): return np.zeros((H, W, 3), np.float32), np.zeros((H, W), np.float32)

def mid_layer():
    """distant range + the frozen lake"""
    c, a = blank(); hz = hexf('#7a86e0'); r = np.random.default_rng(5)
    for i, (px, py, wl, wr) in enumerate([(0.4, 0.62, 0.05, 0.06), (0.47, 0.565, 0.06, 0.07), (0.535, 0.6, 0.05, 0.05), (0.59, 0.54, 0.07, 0.07), (0.66, 0.59, 0.06, 0.06), (0.44, 0.64, 0.04, 0.05), (0.62, 0.635, 0.05, 0.05)]):
        paint_crag(c, a, px * W, py * H, wl * W, wr * W, LAKE + 4, PAL_R, px < 0.47, 200 + i, haze=0.42, haze_col=hz, snow_base=0.3, scale=0.5, rough=1.1)
    # the lake: ice plain
    y = np.linspace(0, 1, H - LAKE, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    ice = hexf('#9fe8f4') * (1 - y[..., None]) ** 2.2 + hexf('#2a6ad0') * (1 - (1 - y[..., None]) ** 2.2) * (1 - y[..., None] ** 1.5) + hexf('#161c72') * y[..., None] ** 1.5
    ice = np.broadcast_to(ice, (H - LAKE, W, 3)).copy()
    ice += (np.exp(-(((x - 0.42) / 0.2) ** 2 + ((y - 0.3) / 0.34) ** 2)) * 150)[..., None] * (hexf('#40f0e0') / 255)      # the aurora mirrored in the ice
    ice += (np.exp(-(((x - 0.8) / 0.2) ** 2 + ((y - 0.25) / 0.3) ** 2)) * 80)[..., None] * (hexf('#c060e0') / 255)
    n = np.tile(NB, (1, 3))[:H - LAKE, :W]; ice *= (0.86 + 0.28 * n)[..., None]
    ice_img = to_img(ice).convert('RGBA'); d = ImageDraw.Draw(ice_img)
    for _ in range(46):                                                                    # cracks: a dark line with a bright lip
        cx, cy = r.random() * W, r.random() ** 0.8 * (H - LAKE); ang = r.uniform(-0.5, 0.5); pts = [(cx, cy)]
        for _s in range(int(r.integers(4, 11))):
            ang += r.uniform(-0.6, 0.6); stp = r.uniform(30, 110) * (0.4 + cy / (H - LAKE)); cx += math.cos(ang) * stp; cy += math.sin(ang) * stp * 0.32; pts.append((cx, cy))
        wdt = 1 + int(2 * pts[0][1] / (H - LAKE))
        d.line(pts, fill=(20, 40, 130, 190), width=wdt + 1); d.line([(qx, qy - wdt - 1) for qx, qy in pts], fill=(190, 250, 255, 190), width=wdt)
    sn = Image.new('RGBA', ice_img.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sn)
    for _ in range(34):                                                                    # wind-packed snow streaks: long, thin, soft
        cx, cy = r.random() * W, r.random() ** 0.7 * (H - LAKE); rw = r.uniform(80, 300) * (0.4 + cy / (H - LAKE)); rh = rw * r.uniform(0.035, 0.07)
        sd.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(232, 246, 255, 120))
    ice_img.alpha_composite(sn.filter(ImageFilter.GaussianBlur(5)))
    lay = to_img(c, a); lay.alpha_composite(ice_img.filter(ImageFilter.GaussianBlur(0.6)), (0, LAKE))
    # shore mist
    my = np.arange(H, dtype=np.float32)[:, None]; al = np.exp(-((my - LAKE) / 34) ** 2) * 190 * (0.6 + 0.4 * np.tile(NB, (2, 3))[:H, :W])
    lay.alpha_composite(to_img(np.broadcast_to(hexf('#d8f4ff'), (H, W, 3)), al))
    return lay

def near_layer():
    c, a = blank(); hz = hexf('#5a64cc')
    specs = [  # px, py, wl, wr, palette, lit from the left?, haze
        (0.3, 0.5, 0.075, 0.08, PAL_L, True, 0.2), (0.255, 0.47, 0.06, 0.07, PAL_L, True, 0.14), (0.345, 0.54, 0.05, 0.06, PAL_L, True, 0.24),
        (0.88, 0.43, 0.09, 0.1, PAL_R, False, 0.18), (0.95, 0.38, 0.08, 0.09, PAL_R, False, 0.12), (0.8, 0.345, 0.05, 0.062, PAL_R, False, 0.1),   # the spire
        (0.755, 0.5, 0.045, 0.05, PAL_R, False, 0.22), (0.835, 0.47, 0.05, 0.05, PAL_R, False, 0.14), (1.01, 0.46, 0.07, 0.06, PAL_R, False, 0.06)]
    for i, (px, py, wl, wr, pal, ll, hzv) in enumerate(specs):
        paint_crag(c, a, px * W, py * H, wl * W, wr * W, LAKE + 26, pal, ll, 300 + i, haze=hzv, haze_col=hz, snow_base=0.26, scale=0.8)
    lay = to_img(c, a)
    my = np.arange(H, dtype=np.float32)[:, None]; al = np.exp(-((my - LAKE - 20) / 30) ** 2) * 150 * (a > 0)
    lay.alpha_composite(to_img(np.broadcast_to(hexf('#e2f6ff'), (H, W, 3)), al))
    return lay

def snow_cap(c, a, col_hi, col_sh, depth=30):
    """snow lying on the upper edges of whatever is painted in (c, a)"""
    m = a / 255; top = np.clip(m - np.roll(m, depth, axis=0), 0, 1); top[:depth] = 0
    lower = np.clip(m - np.roll(m, depth // 3, axis=0), 0, 1); lower[:depth] = 0
    c[:] = c * (1 - top[..., None]) + col_sh * top[..., None]
    c[:] = c * (1 - lower[..., None]) + col_hi * lower[..., None]

def front_layer():
    c, a = blank()
    # the great massif (left): overlapping crags, back to front
    for i, (px, py, wl, wr) in enumerate([(0.2, 0.25, 0.1, 0.12), (0.075, 0.3, 0.1, 0.09), (0.135, 0.105, 0.12, 0.15), (0.245, 0.4, 0.08, 0.1), (0.04, 0.44, 0.08, 0.1), (0.17, 0.36, 0.09, 0.1)]):
        paint_crag(c, a, px * W, py * H, wl * W, wr * W, 0.8 * H, PAL_L, True, 400 + i, snow_base=0.2, scale=1.25)
    # snow apron at its foot, sweeping to the lake
    edge = [(0.52 * W - 0.2 * W * (t ** 1.4) - 40 * math.sin(t * 9), (0.775 + 0.225 * t) * H) for t in np.linspace(0, 1, 40)]   # a curving snow bank
    ap = Image.new('L', (W, H), 0); ImageDraw.Draw(ap).polygon([(0, 0.69 * H), (0.2 * W, 0.725 * H), (0.4 * W, 0.755 * H)] + edge + [(0, H)], fill=255)
    apm = np.asarray(ap.filter(ImageFilter.GaussianBlur(7)), np.float32) / 255
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    apc = hexf('#e4f6ff') * (1 - np.clip((yy - 0.7) / 0.3, 0, 1)[..., None]) + hexf('#6a7ee0') * np.clip((yy - 0.7) / 0.3, 0, 1)[..., None]
    apc = apc * (0.86 + 0.24 * np.tile(NB, (2, 3))[:H, :W])[..., None]
    c[:] = c * (1 - apm[..., None]) + apc * apm[..., None]; a[:] = np.maximum(a, apm * 255)
    # dark cliff at the far left and dark rocks at the right, capped with snow
    fc, fa = blank()
    for i, (px, py, wl, wr, base) in enumerate([(-0.01, 0.16, 0.05, 0.07, 1.02), (0.035, 0.6, 0.07, 0.09, 1.02), (0.95, 0.56, 0.13, 0.1, 1.02), (1.0, 0.44, 0.07, 0.07, 1.02), (0.86, 0.78, 0.13, 0.14, 1.04)]):
        paint_crag(fc, fa, px * W, py * H, wl * W, wr * W, base * H, PAL_FG, px > 0.5, 500 + i, scale=1.5, rough=1.6)
    snow_cap(fc, fa, hexf('#eaf6ff'), hexf('#8ea4ee'), 20)
    m = fa[..., None] / 255
    c[:] = c * (1 - m) + fc * m; a[:] = np.maximum(a, fa)
    return to_img(c, a)

def rays_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    al = np.exp(-(((x - 0.36) / 0.3) ** 2 + ((y - 0.52) / 0.2) ** 2)) * 62
    return to_img(np.broadcast_to(hexf('#60ffe0'), (H, W, 3)), al)

# ---------------------------------------------------------------- tiles and sprites
def mist_tile():
    w, h = 2048, 512; n = fft_noise(w, h, 2.3, 61); y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    den = np.clip((n - 0.38) * 2.6, 0, 1) * np.clip(np.sin(y * math.pi), 0, 1) ** 0.8
    return to_img(np.broadcast_to(hexf('#dcf4ff'), (h, w, 3)), den * 120)

def veil(col_a, col_b, seed):
    s = 900; yy, xx = np.mgrid[0:s, 0:s].astype(np.float32) / s
    t = (xx * 0.62 + (1 - yy) * 0.78)                                                    # along a diagonal sweep, bottom-left → top-right
    d = (xx * 0.78 - (1 - yy) * 0.62) + 0.1 * np.sin(t * 6 + seed) + 0.04 * np.sin(t * 15 + seed * 2)
    core = np.exp(-((d - 0.05) / (0.07 + 0.12 * t)) ** 2) * np.clip(t * 3.2, 0, 1) * np.clip((1.3 - t) * 2.4, 0, 1)
    rays = 0.62 + 0.38 * np.sin(xx * 150 + yy * 46 + 3 * np.sin(xx * 17 + seed))
    edge = np.clip(np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy)) * 7, 0, 1)
    al = np.clip(core * (0.5 + 0.5 * rays), 0, 1) * edge * 0.62
    col = col_a[None, None] * (1 - np.clip(t, 0, 1)[..., None]) + col_b[None, None] * np.clip(t, 0, 1)[..., None]
    return to_img(col, al * 255).filter(ImageFilter.GaussianBlur(3))

def sparkle():
    s = 160; yy, xx = np.mgrid[0:s, 0:s].astype(np.float32) - s / 2
    al = np.exp(-(xx ** 2 + yy ** 2) / 60) + np.exp(-(np.abs(xx) / 40 + (yy / 2.2) ** 2)) * 0.9 + np.exp(-(np.abs(yy) / 40 + (xx / 2.2) ** 2)) * 0.9 + np.exp(-(xx ** 2 + yy ** 2) / 900) * 0.25
    return to_img(np.broadcast_to(np.array([236, 250, 255], np.float32), (s, s, 3)), np.clip(al, 0, 1) * 255)

def ice_glow():
    w, h = 900, 300; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    return to_img(np.broadcast_to(hexf('#58fff0'), (h, w, 3)), np.exp(-(r / 0.5) ** 2) * 150 * np.clip((1 - r) * 4, 0, 1))

def shimmer():
    w, h = 900, 220; im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = np.random.default_rng(81)
    for _ in range(70):
        x, y = r.random() * w, r.random() * h; ln = r.uniform(14, 60) * (0.4 + y / h)
        d.line([(x, y), (x + ln, y)], fill=(210, 255, 250, int(r.uniform(120, 230))), width=2)
    arr = np.asarray(im, np.float32).copy(); xx = np.linspace(0, 1, w)[None, :]; yy = np.linspace(0, 1, h)[:, None]
    arr[..., 3] *= np.clip(np.minimum(xx, 1 - xx) * 6, 0, 1) * np.clip(np.minimum(yy, 1 - yy) * 5, 0, 1)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')

def shrub():
    w, h = 520, 520; im = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = np.random.default_rng(91)
    def tw(x, y, ang, ln, wd, depth):
        if ln < 14 or depth > 7: return
        x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
        d.line([(x * 2, y * 2), (x2 * 2, y2 * 2)], fill=(22, 18, 70, 255), width=max(2, int(wd * 2)))
        if depth > 2: d.line([(x * 2 - 2, y * 2 - 3), (x2 * 2 - 2, y2 * 2 - 3)], fill=(226, 244, 255, 230), width=max(1, int(wd)))   # frost on the upper side
        for _ in range(2 if r.random() < 0.75 else 3): tw(x2, y2, ang + r.uniform(-0.7, 0.7), ln * r.uniform(0.62, 0.8), wd * 0.68, depth + 1)
    for a0 in (-1.9, -1.57, -1.2): tw(w / 2, h - 6, a0, 120, 9, 0)
    return im.resize((w, h), Image.LANCZOS)

def main():
    os.makedirs(OUT, exist_ok=True)
    far = far_layer(); save(far, 'far.webp', 92)
    mid = mid_layer(); save(mid, 'mid.webp', 92)
    near = near_layer(); save(near, 'near.webp', 92)
    front = front_layer(); save(front, 'front.webp', 92)
    rays = rays_layer(); save(rays, 'rays.webp', 80)
    save(mist_tile(), 't-mist.webp', 82)
    yy = np.linspace(0, 1, 360, dtype=np.float32)[:, None]; al = np.clip((yy - 0.62) / 0.1, 0, 1) * np.clip((0.98 - yy) / 0.14, 0, 1)
    save(to_img(np.full((360, 640, 3), 255, np.float32), np.broadcast_to(al * 255, (360, 640))), 't-mask-low.webp')
    va = veil(hexf('#30f0c8'), hexf('#58b4ff'), 1.0); vb = veil(hexf('#60c0ff'), hexf('#b070ff'), 4.0); save(va, 's-veilA.webp'); save(vb, 's-veilB.webp')
    save(sparkle(), 's-sparkle.webp'); save(ice_glow(), 's-iceGlow.webp'); save(shimmer(), 's-shimmer.webp'); save(shrub(), 's-shrub.webp')
    flat = far.convert('RGBA')
    for name, (px, py, pw) in {'ribbonA': (0.02, 0.28, 0.74), 'ribbonB': (-0.38, 0.25, 0.6), 'ribbonC': (0.42, 0.33, 0.52)}.items():   # one period of each live ribbon, where the page hangs it
        fp = os.path.join(OUT, f's-{name}.webp')
        if not os.path.exists(fp): continue
        rb = Image.open(fp).convert('RGBA').crop((0, 0, 1600, 640)); hh = int(pw * H); ww = int(hh * 2.5)
        rb = rb.resize((ww, hh), Image.BILINEAR); ra = np.asarray(rb, np.float32).copy(); fx_ = np.linspace(0, 1, ww)[None, :]; ra[..., 3] *= np.clip(np.minimum(fx_, 1 - fx_) / 0.14, 0, 1) * 0.8
        flat.alpha_composite(Image.fromarray(ra.astype(np.uint8), 'RGBA'), (int(W / 2 + px * H - ww / 2), int(H / 2 - py * H - hh / 2)))
    for l in (mid, near, rays, front): flat.alpha_composite(l)
    p = os.path.join(ROOT, 'wallpapers/aurora-borealis.webp'); flat.convert('RGB').save(p, 'WEBP', quality=90, method=6); print('flat', os.path.getsize(p) // 1024, 'KB')
    flat.convert('RGB').resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/aurora-borealis.webp'), 'WEBP', quality=82, method=6)

if __name__ == '__main__':
    main()
