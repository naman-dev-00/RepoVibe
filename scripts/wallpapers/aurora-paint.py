#!/usr/bin/env python3
"""Aurora (preset-17): an anime-style northern-lights fjord, painted from scratch (original work; no external assets).
Cel shading throughout: two-tone snow peaks with zig-zag shadow faces, tiered pines with snow caps, flat reflections with ripple bands.
The flowing aurora itself stays the three ribbon sprites (scripts/wallpapers/aurora-ribbons.py); this script paints the world they hang over.

Layers (wallpapers/depth/aurora-borealis/), 2560×1440, drawn at 2× and downsampled:
  far.webp    deep night sky: gradient, a Milky Way band, ~1400 crisp stars in four sizes with cross sparkles, a soft aurora wash near the horizon
  mid.webp    three ranges of snow peaks, forested lower slopes, the fjord with mirrored peaks, aurora streaks and ripple bands
  near.webp   the snowy shores: drifts, rows of pines, a cabin with lit windows and a jetty with a lantern and a rowing boat
  front.webp  snow banks and rocks in the bottom corners
  rays.webp   aurora light on the horizon and the cabin's warmth
  s-pineL / s-pineR / s-bough   foreground pines (sway on the shared gust), s-sparkle (twinkling star), s-cabinGlow, s-smoke, s-shimmer (water glints)
Also the flat wallpaper wallpapers/aurora-borealis.webp.     python3 -I scripts/wallpapers/aurora-paint.py"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/aurora-borealis')
W, H, S = 2560, 1440, 2
INK = (10, 22, 48, 255)
HZ = 0.6 * H                 # waterline of the far shore

def hexc(h, a=255): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def P(pts): return [(x * S, y * S) for x, y in pts]
def new(w=W, h=H): return Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
def down(im, w=W, h=H): return im.resize((w, h), Image.LANCZOS)
def save(im, name, q=90):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')
def fft_noise(w, h, beta, seed):
    r = np.random.default_rng(seed); fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1
    spec = (r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta; spec[0, 0] = 0
    n = np.fft.ifft2(spec).real; return ((n - n.min()) / (n.max() - n.min())).astype(np.float32)

# ---------------------------------------------------------------- far: the sky
def far_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    c0, c1, c2, c3 = np.array([4, 7, 30.]), np.array([10, 26, 78.]), np.array([18, 70, 112.]), np.array([40, 128, 132.])
    t = np.clip(y / 0.62, 0, 1)
    sky = np.where(t < 0.45, c0 + (c1 - c0) * (t / 0.45), np.where(t < 0.8, c1 + (c2 - c1) * ((t - 0.45) / 0.35), c2 + (c3 - c2) * ((t - 0.8) / 0.2)))
    sky = np.broadcast_to(sky, (H, W, 3)).copy()
    # Milky Way: a diagonal band of mottled light
    band = np.exp(-(((y - 0.1) - (x - 0.5) * 0.42) / 0.11) ** 2)[..., 0]
    n = fft_noise(W, H, 1.7, 5); n2 = fft_noise(W, H, 2.4, 6)
    mw = band * np.clip(n * 1.5 - 0.35, 0, 1) * (0.6 + 0.4 * n2)
    sky += mw[..., None] * np.array([70, 80, 150.]) + (band * np.clip(n2 - 0.55, 0, 1) * 2)[..., None] * np.array([70, 30, 90.])
    # aurora wash: broad green/violet light low in the sky (the live ribbons hang in front of it)
    wash = np.exp(-((y - 0.5) / 0.14) ** 2)[..., 0] * (0.55 + 0.45 * np.sin(x[..., 0] * 9 + 1.3))
    sky += wash[..., None] * np.array([10, 74, 50.]) + (np.exp(-((y - 0.3) / 0.16) ** 2)[..., 0] * (0.5 + 0.5 * np.sin(x[..., 0] * 5 + 4)))[..., None] * np.array([26, 8, 52.])
    img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    big = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(big); r = np.random.default_rng(17)
    cols = [(255, 255, 255), (214, 232, 255), (255, 244, 214), (190, 255, 232), (232, 210, 255)]
    for _ in range(2200):
        sx, sy = r.random() * W, r.random() ** 1.25 * H * 0.62; b = r.random() ** 3.2; c = cols[r.integers(len(cols))]
        rad = 0.7 + b * 2.6
        d.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=c + (int(120 + 135 * min(1, b * 2 + 0.2)),))
        if b > 0.72:   # anime cross sparkle
            ln = 6 + b * 16
            d.line([(sx - ln, sy), (sx + ln, sy)], fill=c + (200,), width=1); d.line([(sx, sy - ln), (sx, sy + ln)], fill=c + (200,), width=1)
            d.line([(sx - ln * 0.35, sy - ln * 0.35), (sx + ln * 0.35, sy + ln * 0.35)], fill=c + (110,), width=1); d.line([(sx - ln * 0.35, sy + ln * 0.35), (sx + ln * 0.35, sy - ln * 0.35)], fill=c + (110,), width=1)
    img.alpha_composite(big); img.alpha_composite(big.filter(ImageFilter.GaussianBlur(3)))   # crisp cores + a small bloom
    return img.convert('RGB')

# ---------------------------------------------------------------- mid: peaks and fjord
def peaks(seed, n, x0, x1, base, hmin, hmax, jag):
    """a ridge as a polyline of (x, y): sharp alpine peaks with small shoulders"""
    r = np.random.default_rng(seed); xs = np.sort(r.uniform(x0, x1, n)); pts = [(x0 - 80, base)]
    for i, px in enumerate(xs):
        h = r.uniform(hmin, hmax); wl = r.uniform(0.5, 0.9) * (x1 - x0) / n; wr = r.uniform(0.5, 0.9) * (x1 - x0) / n
        pts += [(px - wl, base - h * r.uniform(0.25, 0.45)), (px - wl * 0.45, base - h * r.uniform(0.6, 0.72)), (px, base - h),
                (px + wr * 0.4, base - h * r.uniform(0.62, 0.76)), (px + wr, base - h * r.uniform(0.25, 0.42))]
    pts.append((x1 + 80, base)); pts.sort(key=lambda p: p[0])
    return pts

def draw_range(d, pts, base, light, shade, rock, outline=True):
    d.polygon(P(pts + [(pts[-1][0], base), (pts[0][0], base)]), fill=light)
    r = np.random.default_rng(int(pts[3][1]))
    for i in range(1, len(pts) - 1):
        (xa, ya), (xb, yb), (xc, yc) = pts[i - 1], pts[i], pts[i + 1]
        if yb < ya and yb < yc:   # a summit: shadow face on the right, with a zig-zag terminator down the middle
            zz = [(xb, yb)]; steps = 7
            for s in range(1, steps + 1):
                t = s / steps; zz.append((xb + (r.uniform(-0.1, 0.22) if s % 2 else r.uniform(0.18, 0.5)) * (base - yb) * t * 0.5, yb + (base - yb) * t))
            right = [p for p in pts[i + 1:] if p[0] <= xb + (base - yb) * 1.2][:3]
            d.polygon(P([(xb, yb)] + right + [(right[-1][0] if right else xb, base)] + zz[::-1]), fill=shade)
            # rock bands on the lit face
            for k in range(3):
                t = r.uniform(0.25, 0.8); bx = xb - (xb - xa) * t * 0.8; by = yb + (base - yb) * t
                d.polygon(P([(bx, by), (bx + 26 + 30 * t, by + 10), (bx + 10, by + 26 + 20 * t), (bx - 18, by + 12)]), fill=rock)
    if outline: d.line(P(pts), fill=INK, width=S * 2, joint='curve')

def pine(d, cx, base, h, w, pal, snow=True, tiers=6, lean=0.0, seed=0):
    """cel-shaded tiered pine: dark body, lighter left half, snow caps on each tier"""
    r = np.random.default_rng(abs(int(seed))); body, lit, snowc, snows = pal
    d.rectangle([(cx - w * 0.05) * S, (base - h * 0.14) * S, (cx + w * 0.05) * S, base * S], fill=hexc('#3a2a2a'))
    for i in range(tiers):
        t0 = i / tiers; t1 = (i + 1.55) / tiers
        yt = base - h + h * 0.86 * t0; yb_ = min(base - h * 0.08, base - h + h * 0.86 * t1); hw = w * 0.5 * (0.2 + 0.8 * (i + 1) / tiers)
        xc = cx + lean * (base - yt)
        jag = [(xc - hw, yb_)]
        for k in range(1, 6): jag.append((xc - hw + 2 * hw * k / 6, yb_ + (r.uniform(4, 12) * h / 400 if k % 2 else -r.uniform(0, 5) * h / 400)))
        jag.append((xc + hw, yb_))
        d.polygon(P([(xc, yt)] + jag[::-1]), fill=body, outline=INK, width=max(1, int(S * h / 500)))
        d.polygon(P([(xc, yt), (xc - hw, yb_), (xc - hw * 0.3, yb_ - 2), (xc - hw * 0.1, yt + (yb_ - yt) * 0.5)]), fill=lit)
        if snow:
            d.polygon(P([(xc, yt - 1), (xc - hw * 0.62, yt + (yb_ - yt) * 0.66), (xc - hw * 0.3, yt + (yb_ - yt) * 0.5), (xc - hw * 0.08, yt + (yb_ - yt) * 0.7), (xc + hw * 0.16, yt + (yb_ - yt) * 0.46),
                         (xc + hw * 0.4, yt + (yb_ - yt) * 0.68), (xc + hw * 0.52, yt + (yb_ - yt) * 0.6)]), fill=snowc)
            d.polygon(P([(xc, yt - 1), (xc + hw * 0.16, yt + (yb_ - yt) * 0.46), (xc + hw * 0.4, yt + (yb_ - yt) * 0.68), (xc + hw * 0.52, yt + (yb_ - yt) * 0.6)]), fill=snows)

PAL_FAR = (hexc('#123a4a'), hexc('#1c5a5e'), hexc('#bfe6ee'), hexc('#7fb0d2'))
PAL_NEAR = (hexc('#0c2c36'), hexc('#14524e'), hexc('#eaf8ff'), hexc('#8cb8e6'))
PAL_FRONT = (hexc('#081e2a'), hexc('#0f4444'), hexc('#f2fbff'), hexc('#8cb4e8'))

def mid_layer():
    big = new(); d = ImageDraw.Draw(big)
    r1 = peaks(3, 7, 0, W, HZ, 250, 470, 1); r2 = peaks(4, 6, -100, W + 100, HZ, 170, 330, 1); r3 = peaks(8, 5, -200, W + 200, HZ, 100, 210, 1)
    draw_range(d, r1, HZ, hexc('#7fa6d6'), hexc('#3f5f9e'), hexc('#5a7fb8'))                      # far range, hazy blue
    draw_range(d, r2, HZ, hexc('#bfe0f2'), hexc('#4f78b4'), hexc('#6f93c6'))
    draw_range(d, r3, HZ, hexc('#eaf8ff'), hexc('#6a94cc'), hexc('#7fa2d2'))                      # near range: bright snow with an aurora-green rim below
    # forested lower slopes: a dark band with pine tips
    d.polygon(P([(0, HZ - 44), (W, HZ - 44), (W, HZ), (0, HZ)]), fill=hexc('#123a4a'))
    r = np.random.default_rng(12)
    for x in np.arange(-10, W + 20, 13):
        h = r.uniform(26, 62); pine(d, x + r.uniform(-4, 4), HZ - 2, h, h * 0.5, PAL_FAR, snow=h > 40, tiers=4, seed=int(x) + 5)
    lay = down(big)
    # fjord: mirrored peaks, darker and bluer, broken by ripple bands; aurora streaks on the water
    top = lay.crop((0, int(HZ) - 520, W, int(HZ))).transpose(Image.FLIP_TOP_BOTTOM).resize((W, 420), Image.BILINEAR)
    arr = np.asarray(top, np.float32); arr[..., :3] = arr[..., :3] * 0.5 + np.array([8, 34, 62]) * 0.5
    yy = np.arange(420, dtype=np.float32)[:, None]
    shift = (np.sin(yy * 0.22) * 4 * (yy / 420 + 0.2)).astype(int)[:, 0]                          # horizontal ripple displacement, row by row
    for row in range(420): arr[row] = np.roll(arr[row], shift[row], axis=0)
    water = np.zeros((H - int(HZ), W, 4), np.float32); wy = np.linspace(0, 1, H - int(HZ), dtype=np.float32)[:, None]
    water[..., :3] = np.array([10, 44, 76]) * (1 - wy[..., None]) + np.array([6, 20, 48]) * wy[..., None]; water[..., 3] = 255
    a = arr[..., 3:4] / 255 * np.clip(1 - yy[..., None] / 420, 0, 1) ** 0.6
    water[:420, :, :3] = water[:420, :, :3] * (1 - a) + arr[..., :3] * a
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    for (cx, wd, col, k) in [(0.36, 0.2, (70, 255, 170), 0.5), (0.62, 0.14, (120, 110, 255), 0.34), (0.2, 0.1, (60, 230, 200), 0.3)]:   # aurora reflected: vertical glows cut by ripple bands
        g = np.exp(-((xx - cx) / wd) ** 2) * np.clip(1 - wy * 1.3, 0, 1) * (0.72 + 0.28 * np.sin(wy * 150 + xx * 30))
        water[..., :3] += g[..., None] * np.array(col) * k
    wimg = Image.fromarray(np.clip(water, 0, 255).astype(np.uint8), 'RGBA'); wd_ = ImageDraw.Draw(wimg); r = np.random.default_rng(9)
    for _ in range(260):                                                                          # cel ripple dashes
        rx, ry = r.random() * W, r.random() ** 1.6 * (H - HZ); ln = 20 + ry * 0.35
        wd_.line([(rx, ry), (rx + ln, ry)], fill=(190, 240, 255, int(60 + 90 * r.random())), width=2 if ry > 200 else 1)
    lay.alpha_composite(wimg, (0, int(HZ)))
    ImageDraw.Draw(lay).line([(0, HZ), (W, HZ)], fill=(200, 255, 236, 150), width=2)                 # bright shoreline
    return lay

def snow_drift(d, pts, light, shade, base=H):
    d.polygon(P(pts + [(pts[-1][0], base), (pts[0][0], base)]), fill=light)
    sh = [(x, y + 26 + 18 * math.sin(x / 90)) for x, y in pts]
    d.polygon(P(sh + [(pts[-1][0], base), (pts[0][0], base)]), fill=shade)
    d.line(P(pts), fill=(255, 255, 255, 255), width=S * 3, joint='curve')

def near_layer():
    big = new(); d = ImageDraw.Draw(big); r = np.random.default_rng(33)
    # left and right shores reaching into the fjord
    left = [(-20, 880), (120, 850), (300, 868), (470, 905), (640, 960), (820, 1040), (980, 1140), (1120, 1290), (1180, 1440)]
    right = [(1380, 1440), (1450, 1260), (1560, 1110), (1700, 1010), (1860, 940), (2040, 900), (2240, 872), (2420, 880), (2580, 860)]
    lcol, scol = hexc('#d9eefc'), hexc('#8fb4e4')
    for shore in (left, right):
        # pines on the shore, far → near
        for i, (x, y) in enumerate(shore):
            for k in range(3):
                px = x + r.uniform(-70, 70); h = r.uniform(120, 230) * (0.7 + 0.5 * abs(px - W / 2) / (W / 2))
                if 0 < px < W and abs(px - W / 2) > 260: pine(d, px, y + 24, h, h * 0.46, PAL_NEAR, tiers=6, seed=i * 10 + k + (0 if shore is left else 99))
        snow_drift(d, shore, lcol, scol)
    # the cabin on the right shore
    cx, cy = 1930, 940; wall, wallsh, roof = hexc('#6a3f34'), hexc('#4a2a28'), hexc('#eef9ff')
    d.rectangle(P([(cx - 120, cy - 110), (cx + 120, cy + 6)]), fill=wall, outline=INK, width=S * 3)
    for ly in range(5): d.line(P([(cx - 120, cy - 96 + ly * 22), (cx + 120, cy - 96 + ly * 22)]), fill=wallsh, width=S * 2)   # log courses
    d.polygon(P([(cx - 120, cy - 110), (cx - 20, cy - 190), (cx + 120, cy - 110)]), fill=wall, outline=INK, width=S * 3)
    d.rectangle(P([(cx + 56, cy - 196), (cx + 84, cy - 130)]), fill=hexc('#5a3a38'), outline=INK, width=S * 3); d.rectangle(P([(cx + 50, cy - 204), (cx + 90, cy - 190)]), fill=roof, outline=INK, width=S * 2)
    d.polygon(P([(cx - 146, cy - 100), (cx - 20, cy - 204), (cx + 146, cy - 100), (cx + 128, cy - 92), (cx - 20, cy - 176), (cx - 128, cy - 92)]), fill=roof, outline=INK, width=S * 3)   # snow roof
    d.polygon(P([(cx - 20, cy - 176), (cx + 128, cy - 92), (cx + 146, cy - 100), (cx - 20, cy - 204)]), fill=hexc('#a8c8ee'))
    for wx in (cx - 84, cx + 34):
        d.rectangle(P([(wx, cy - 78), (wx + 50, cy - 30)]), fill=hexc('#ffd27a'), outline=INK, width=S * 3); d.line(P([(wx + 25, cy - 78), (wx + 25, cy - 30)]), fill=INK, width=S * 2); d.line(P([(wx, cy - 54), (wx + 50, cy - 54)]), fill=INK, width=S * 2)
    d.rectangle(P([(cx - 18, cy - 70), (cx + 18, cy + 6)]), fill=hexc('#3a2420'), outline=INK, width=S * 3); d.ellipse([(cx + 8) * S, (cy - 36) * S, (cx + 14) * S, (cy - 30) * S], fill=hexc('#ffd27a'))
    # jetty with a lantern and a rowing boat
    jx, jy = 1640, 1010
    d.polygon(P([(jx, jy), (jx + 150, jy - 20), (jx + 160, jy - 6), (jx + 10, jy + 16)]), fill=hexc('#6a4a3a'), outline=INK, width=S * 3)
    for px in (jx + 14, jx + 80, jx + 146): d.rectangle(P([(px - 5, jy - 6), (px + 5, jy + 46)]), fill=hexc('#4a3028'), outline=INK, width=S * 2)
    d.line(P([(jx + 14, jy - 4), (jx + 14, jy - 62)]), fill=INK, width=S * 4); d.rectangle(P([(jx + 2, jy - 86), (jx + 26, jy - 58)]), fill=hexc('#ffe2a0'), outline=INK, width=S * 3)
    bx, by = 1500, 1070
    d.polygon(P([(bx - 90, by - 18), (bx + 96, by - 22), (bx + 70, by + 16), (bx - 66, by + 18)]), fill=hexc('#8a4a3a'), outline=INK, width=S * 3); d.polygon(P([(bx - 84, by - 14), (bx + 88, by - 18), (bx + 80, by - 8), (bx - 78, by - 4)]), fill=hexc('#c87858'))
    lay = down(big)
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    for (x, y, rad, a) in [(cx - 59, cy - 54, 60, 150), (cx + 59, cy - 54, 60, 150), (jx + 14, jy - 72, 44, 170)]: gd.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(255, 196, 110, a))
    lay.alpha_composite(g.filter(ImageFilter.GaussianBlur(22)))
    return lay

def front_layer():
    big = new(); d = ImageDraw.Draw(big)
    snow_drift(d, [(-20, 1240), (140, 1200), (330, 1232), (520, 1310), (660, 1440)], hexc('#f2fbff'), hexc('#9cc0ee'))
    snow_drift(d, [(1900, 1440), (2040, 1300), (2230, 1222), (2420, 1196), (2580, 1230)], hexc('#f2fbff'), hexc('#9cc0ee'))
    for (x, y, s) in [(250, 1250, 1.0), (2300, 1240, 1.2), (2470, 1300, 0.8)]:                     # snow-capped rocks
        d.polygon(P([(x - 70 * s, y + 40 * s), (x - 50 * s, y - 10 * s), (x, y - 44 * s), (x + 56 * s, y - 14 * s), (x + 78 * s, y + 40 * s)]), fill=hexc('#2a3a5e'), outline=INK, width=S * 3)
        d.polygon(P([(x - 52 * s, y - 8 * s), (x, y - 46 * s), (x + 58 * s, y - 12 * s), (x + 30 * s, y - 6 * s), (x + 6 * s, y - 20 * s), (x - 22 * s, y - 4 * s)]), fill=hexc('#f2fbff'), outline=INK, width=S * 2)
    return down(big)

def rays_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    a = np.exp(-((y - 0.56) / 0.07) ** 2) * (0.5 + 0.5 * np.sin(x * 7 + 0.6)) * 0.3
    rgb = np.broadcast_to(np.array([0.5, 1.0, 0.78]), (H, W, 3))
    return Image.fromarray((np.concatenate([rgb, a[..., None]], -1) * 255).astype(np.uint8), 'RGBA')

def pine_sprite(w, h, seed, lean):
    big = new(w, h); d = ImageDraw.Draw(big)
    pine(d, w / 2, h * 0.98, h * 0.95, w * 0.9, PAL_FRONT, tiers=9, lean=lean, seed=seed)
    return down(big, w, h)

def bough_sprite():
    w, h = 1100, 760; big = new(w, h); d = ImageDraw.Draw(big); r = np.random.default_rng(71)
    # a snowy pine bough reaching left from the right edge: a stem with drooping tiers of needles
    stem = [(w, h * 0.3), (w * 0.72, h * 0.36), (w * 0.44, h * 0.47), (w * 0.14, h * 0.62)]
    for i in range(len(stem) - 1):
        (x0, y0), (x1, y1) = stem[i], stem[i + 1]
        for t in np.linspace(0, 1, 6):
            bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; ln = 150 * (1 - 0.5 * (i + t) / 3)
            for sgn in (-1, 1):
                tip = (bx - ln * 0.75, by + sgn * ln * 0.6 + 30)
                d.polygon(P([(bx, by - 12), tip, (bx - 20, by + 14)]), fill=PAL_FRONT[0], outline=INK, width=S * 2)
                d.polygon(P([(bx, by - 12), ((bx + tip[0]) / 2 - 8, (by + tip[1]) / 2 - 12), ((bx + tip[0]) / 2, (by + tip[1]) / 2)]), fill=PAL_FRONT[1])
            d.polygon(P([(bx + 16, by - 18), (bx - ln * 0.5, by - 6), (bx - ln * 0.36, by + 10), (bx - ln * 0.16, by - 2), (bx + 6, by + 6)]), fill=PAL_FRONT[2], outline=INK, width=S)
    d.line(P(stem), fill=hexc('#3a2a2a'), width=S * 10, joint='curve')
    return down(big, w, h)

def sparkle():
    s = 160; yy, xx = np.mgrid[0:s, 0:s].astype(np.float32) - s / 2
    a = np.exp(-(xx ** 2 + yy ** 2) / 60) + np.exp(-(np.abs(xx) / 40 + (yy / 2.2) ** 2)) * 0.9 + np.exp(-(np.abs(yy) / 40 + (xx / 2.2) ** 2)) * 0.9 + np.exp(-(xx ** 2 + yy ** 2) / 900) * 0.25
    rgb = np.broadcast_to(np.array([236, 250, 255], np.float32), (s, s, 3))
    return Image.fromarray(np.concatenate([rgb, (np.clip(a, 0, 1) * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def radial(size, col, sharp=0.42, peak=0.8):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32); r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    a = np.exp(-(r / sharp) ** 2) * peak * np.clip((1 - r) * 4, 0, 1)
    return Image.fromarray(np.concatenate([np.broadcast_to(np.array(hexc(col)[:3], np.float32), (size, size, 3)), (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def smoke():
    w, h = 200, 420; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); t = 1 - yy / h
    a = np.zeros((h, w), np.float32)
    for (ph, wd, k) in [(0.0, 14, 0.7), (2.1, 10, 0.5)]:
        cx = w / 2 + np.sin(t * 6 + ph) * 30 * t + 30 * t ** 2
        a += np.exp(-((xx - cx) / (wd + 26 * t)) ** 2) * np.clip(np.sin(t * math.pi), 0, 1) * k
    return Image.fromarray(np.concatenate([np.broadcast_to(np.array([214, 228, 246], np.float32), (h, w, 3)), (np.clip(a, 0, 0.8) * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def shimmer():
    w, h = 900, 220; im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = np.random.default_rng(81)
    for _ in range(70):
        x, y = r.random() * w, r.random() * h; ln = r.uniform(14, 60) * (0.4 + y / h)
        d.line([(x, y), (x + ln, y)], fill=(200, 255, 236, int(r.uniform(120, 230))), width=2)
    arr = np.asarray(im, np.float32); xx = np.linspace(0, 1, w)[None, :]; yy = np.linspace(0, 1, h)[:, None]
    arr[..., 3] *= np.clip(np.minimum(xx, 1 - xx) * 6, 0, 1) * np.clip(np.minimum(yy, 1 - yy) * 5, 0, 1)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')

def main():
    os.makedirs(OUT, exist_ok=True)
    far = far_layer(); save(far, 'far.webp', 92)
    mid = mid_layer(); save(mid, 'mid.webp')
    near = near_layer(); save(near, 'near.webp')
    front = front_layer(); save(front, 'front.webp')
    rays = rays_layer(); save(rays, 'rays.webp', 80)
    pl = pine_sprite(900, 1300, 5, 0.0); save(pl, 's-pineL.webp'); pr = pine_sprite(760, 1200, 6, 0.0); save(pr, 's-pineR.webp')
    save(bough_sprite(), 's-bough.webp'); save(sparkle(), 's-sparkle.webp'); save(radial(360, '#ffc46e'), 's-cabinGlow.webp'); save(smoke(), 's-smoke.webp'); save(shimmer(), 's-shimmer.webp')
    flat = far.convert('RGBA')
    for name, (px, py, pw) in {'ribbonA': (0.02, 0.28, 0.74), 'ribbonB': (-0.38, 0.25, 0.6), 'ribbonC': (0.42, 0.33, 0.52)}.items():   # one period of each live ribbon, where the page hangs it
        rb = Image.open(os.path.join(OUT, f's-{name}.webp')).convert('RGBA').crop((0, 0, 1600, 640)); hh = int(pw * H); ww = int(hh * 2.5)
        rb = rb.resize((ww, hh), Image.BILINEAR); ra = np.asarray(rb, np.float32).copy(); fx_ = np.linspace(0, 1, ww)[None, :]; ra[..., 3] *= np.clip(np.minimum(fx_, 1 - fx_) / 0.14, 0, 1); rb = Image.fromarray(ra.astype(np.uint8), 'RGBA'); flat.alpha_composite(rb, (int(W / 2 + px * H - ww / 2), int(H / 2 - py * H - hh / 2)))
    flat.alpha_composite(mid); flat.alpha_composite(near); flat.alpha_composite(rays)
    for im, bx, span in ((pl, -0.66, 0.62), (pr, 0.7, 0.56)):
        hh = int(span * H); ww = int(hh * im.width / im.height); t = im.resize((ww, hh), Image.LANCZOS); flat.alpha_composite(t, (int(W / 2 + bx * H - ww / 2), int(H / 2 + 0.1 * H - hh + hh * 0.02)))
    flat.alpha_composite(front)
    p = os.path.join(ROOT, 'wallpapers/aurora-borealis.webp'); flat.convert('RGB').save(p, 'WEBP', quality=88, method=6); print('flat', os.path.getsize(p) // 1024, 'KB')

if __name__ == '__main__':
    main()
