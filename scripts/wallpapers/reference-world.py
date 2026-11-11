#!/usr/bin/env python3
"""Builds the Ocean Depths and Sakura Dreams worlds from the two reference plates in assets/reference/ (supplied by the project owner).
Hybrid 2.5D pipeline (NOT real 3D geometry): crop to 16:9, upscale+enhance, segment foreground objects (coral / tree groups) by colour and hand-placed
polygons, inpaint the plate behind them (push-pull fill), export the objects as RGBA sprites that the engine animates (wind sway), and generate extra
animated planes (caustics, clouds, light shafts, vignette). Writes wallpapers/depth/<slug>/, wallpapers/<slug>.webp, thumbs, and the sprite
placement block inside shared/worlds.js between the REF markers.
  python3 -I scripts/wallpapers/reference-world.py [ocean|sakura|both]"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageFilter, ImageChops, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W, H = 2560, 1440
SRC_W, SRC_H = 768, 432            # 16:9 crop of the 768x512 references
S = W / SRC_W
rng = np.random.default_rng(7)

def load(name, y0):
    im = Image.open(os.path.join(ROOT, 'assets/reference', name)).convert('RGB')
    return im.crop((0, y0, SRC_W, y0 + SRC_H))

def blur(a, r):  # a: HxW or HxWxC float array
    if a.ndim == 2:
        return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255
    return np.stack([blur(a[..., i], r) for i in range(a.shape[2])], -1)

def enhance(crop):
    """Upscale 3.33x (Lanczos), unsharp, restore fine texture (luminance-modulated grain). The source is only 768 px wide, so this cannot invent real detail."""
    up = crop.resize((W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.4, percent=120, threshold=2))
    a = np.asarray(up, dtype=np.float32) / 255
    lum = a.mean(-1)
    edge = np.abs(blur(lum, 1.0) - blur(lum, 3.0)); edge = edge / (edge.max() + 1e-6)
    noise = blur(rng.standard_normal((H, W)).astype(np.float32), 0.8) * 3.0
    a = a + (noise * (0.012 + 0.03 * np.sqrt(edge)))[..., None]
    g = a.mean(-1, keepdims=True); a = g + (a - g) * 1.06                  # slightly richer colour
    return np.clip(a, 0, 1)

def pushpull(rgb, valid):
    """Fill pixels where valid==0 from their surroundings (pull/push pyramid)."""
    levels = []; c = rgb * valid[..., None]; w = valid.astype(np.float32)
    while True:
        levels.append((c, w))
        if min(c.shape[:2]) <= 4: break
        h2, w2 = c.shape[0] // 2 * 2, c.shape[1] // 2 * 2
        c2 = c[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3)); ww = w[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
        c, w = c2, ww
    fill = None
    for c, w in reversed(levels):
        col = c / np.maximum(w, 1e-6)[..., None]; wt = np.clip(w / (1 if fill is None else 1), 0, 1)
        wt = np.clip(w, 0, 1) if fill is not None else np.ones_like(w)
        if fill is not None:
            up = np.stack([np.asarray(Image.fromarray(fill[..., i]).resize((c.shape[1], c.shape[0]), Image.BILINEAR)) for i in range(3)], -1)
            col = np.where((w > 0.99)[..., None], col, wt[..., None] * col + (1 - wt[..., None]) * up)
        fill = col
    return fill

def band_valid(mask_hi, e=14):
    """Pixels trusted as plate: outside the object, or deep inside it. Only the edge band (where a swaying sprite uncovers the plate) is re-filled."""
    inner = blur(mask_hi, e) > 0.985
    return ((mask_hi < 0.02) | inner).astype(np.float32)

def hsv_arrays(crop):
    h = np.asarray(crop.convert('HSV'), dtype=np.float32) / 255
    return h[..., 0] * 360, h[..., 1], h[..., 2]

def morph(mask, close=5, open_=3, grow=0):
    m = Image.fromarray((mask * 255).astype(np.uint8))
    if close and close > 1: m = m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    if open_ and open_ > 1: m = m.filter(ImageFilter.MinFilter(open_)).filter(ImageFilter.MaxFilter(open_))
    if grow and grow > 1: m = m.filter(ImageFilter.MaxFilter(grow))
    return np.asarray(m, dtype=np.float32) / 255

def poly_mask(points, y0, feather=0.0):
    m = Image.new('L', (SRC_W, SRC_H), 0); ImageDraw.Draw(m).polygon([(x, y - y0) for x, y in points], fill=255)
    a = np.asarray(m, dtype=np.float32) / 255
    return blur(a, feather) if feather else a

def hires_mask(m, soft=1.6):
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    a = np.asarray(im, dtype=np.float32) / 255
    a = blur(a, soft)
    return np.clip((a - 0.5) * 1.5 + 0.5, 0, 1)

def save_webp(a, path, q=90, alpha=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arr = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(arr, 'RGBA' if alpha else 'RGB').save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)

def cutout(plate_rgb, mask_hi, pad=10):
    """RGBA crop of the plate by mask. Returns (rgba array, bbox) with colour bled outward so edges have no dark fringe."""
    ys, xs = np.where(mask_hi > 0.02)
    if len(xs) == 0: return None
    x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad, W), max(ys.min() - pad, 0), min(ys.max() + pad, H)
    rgb = plate_rgb[y0:y1, x0:x1]; m = mask_hi[y0:y1, x0:x1]
    col = pushpull(rgb, (m > 0.5).astype(np.float32))
    out = np.concatenate([col, m[..., None]], -1)
    return out, (x0, y0, x1, y1)

def thumbs(flat, slug):
    save_webp(flat, os.path.join(ROOT, 'wallpapers', f'{slug}.webp'), 90)
    t = Image.fromarray((flat * 255).astype(np.uint8)).resize((480, 270), Image.LANCZOS)
    os.makedirs(os.path.join(ROOT, 'wallpapers/thumbs'), exist_ok=True); t.save(os.path.join(ROOT, 'wallpapers/thumbs', f'{slug}.webp'), 'WEBP', quality=82, method=6)

def tileable_noise(w, h, octaves, seed):
    r = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        f = 2 ** (o + 2)
        g = r.random((f, f)).astype(np.float32)
        big = np.asarray(Image.fromarray((np.tile(g, (3, 3)) * 255).astype(np.uint8)).resize((3 * w, 3 * h), Image.BICUBIC), dtype=np.float32) / 255
        out += big[h:2 * h, w:2 * w] * amp; tot += amp; amp *= 0.5
    return out / tot

def inject(slug_marker, js):
    p = os.path.join(ROOT, 'shared/worlds.js'); s = open(p).read()
    b, e = f'/*REF-{slug_marker}-BEGIN*/', f'/*REF-{slug_marker}-END*/'
    i, j = s.index(b) + len(b), s.index(e)
    open(p, 'w').write(s[:i] + '\n' + js + '\n  ' + s[j:])

def place(name, bbox, y0, **kw):
    x0, yy0, x1, yy1 = bbox
    cx, cy = (x0 + x1) / 2 / W * 100, (((yy0 + yy1) / 2) / H) * 100
    d = dict(n=name, plane='scene', x=round(cx, 2), y=round(cy, 2), w=round((x1 - x0) / W * 100, 2))
    d.update(kw); return d

# ------------------------------------------------------------------ OCEAN
def ocean():
    slug = 'ocean-kingdom'; y0 = 40
    crop = load('oceanbg.jpg', y0); plate = enhance(crop); h, s, v = hsv_arrays(crop)
    purple = (h > 255) & (h < 310) & (s > 0.30) & (v > 0.22)
    orange = (h > 18) & (h < 52) & (s > 0.50) & (v > 0.42)
    olive = (h > 48) & (h < 75) & (s > 0.35) & (v > 0.30)
    groups = [  # name, bbox in source coords (x0,y0,x1,y1), colour class, wind(deg), period, depth k
        ('coralPurpleL', (0, 10, 98, 236), purple, 0.7, 7.4, 1.28),
        ('coralOrangeA', (130, 188, 212, 256), orange, 1.7, 5.2, 0.86),
        ('coralOrangeB', (204, 198, 278, 262), orange, 1.9, 4.8, 0.86),
        ('coralPurpleS', (88, 238, 168, 268), purple, 1.5, 5.6, 0.86),
        ('coralOrangeBig', (70, 268, 276, 402), orange, 1.1, 6.4, 1.28),
        ('coralPurpleMid', (222, 244, 346, 338), purple, 1.3, 5.9, 0.86),
        ('coralOrangeC', (318, 312, 392, 358), orange, 2.0, 4.4, 0.86),
        ('coralOrangeD', (390, 332, 440, 366), orange, 2.2, 4.2, 0.86),
        ('coralPurpleLow', (186, 378, 268, 466), purple, 1.2, 6.0, 1.28),
        ('coralPurpleR', (388, 298, 476, 334), purple, 1.6, 5.0, 0.86),
        ('coralBushR', (440, 244, 512, 304), olive, 1.8, 4.6, 0.86),
        ('coralPurpleBR', (522, 388, 768, 432 + y0), purple, 0.9, 7.8, 1.28),
    ]
    union = np.zeros((SRC_H, SRC_W), np.float32); sprites = []; masks = {}
    for name, (bx0, by0, bx1, by1), cls, wind, fl, k in groups:
        ex = 16   # generous box: a coral must not be cut by the box edge (the cut would show as a straight seam while it sways)
        box = np.zeros((SRC_H, SRC_W), np.float32); box[max(by0 - ex - y0, 0):max(by1 + ex - y0, 0), max(bx0 - ex, 0):bx1 + ex] = 1
        m = morph((cls & (box > 0)).astype(np.float32), close=7, open_=3, grow=3)
        m = np.maximum(m - 0.0, 0) * box
        masks[name] = m; union = np.maximum(union, m)
    um = hires_mask(morph(union, 1, 0, 5), 1.0); valid = band_valid(um, 18)
    filled = pushpull(plate, valid)
    far = np.where((valid > 0.5)[..., None], plate, filled)
    far = np.clip(far + (blur(rng.standard_normal((H, W)).astype(np.float32), 0.8) * 0.012)[..., None] * (1 - valid[..., None]), 0, 1)
    out = os.path.join(ROOT, 'wallpapers/depth', slug); os.makedirs(out, exist_ok=True)
    for n in ('s-kelpA', 's-kelpB', 's-fan'):
        f = os.path.join(out, n + '.webp')
        if os.path.exists(f): os.remove(f)
    # the vignette is baked into the plate: a separate full-viewport translucent layer would have to be re-composited over the animated scene every frame
    yy0, xx0 = np.mgrid[0:H, 0:W].astype(np.float32)
    vig0 = np.clip(((xx0 / W - 0.5) ** 2 * 1.6 + (yy0 / H - 0.5) ** 2 * 1.9) - 0.12, 0, 1) ** 1.2 * 0.55
    far = far * (1 - vig0[..., None]) + np.array([0.01, 0.06, 0.1], np.float32) * vig0[..., None]
    sizes = {'far': save_webp(far, os.path.join(out, 'far.webp'), 90)}
    for name, bb, cls, wind, fl, k in groups:
        mh = hires_mask(masks[name]); c = cutout(plate, mh)
        if c is None: continue
        rgba, box = c
        sizes[name] = save_webp(rgba, os.path.join(out, f's-{name}.webp'), 90, alpha=True)
        sprites.append(place(name, box, y0, k=k, z=3 if k >= 1 else 2, wind=wind, ox='50%', oy='100%', fl=fl))
    # light shafts: warm rays fanning from the surface glare (upper centre), soft and non-repeating
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    sx, sy = 0.50 * W, -0.15 * H; ang = np.arctan2(xx - sx, yy - sy); dist = np.hypot(xx - sx, yy - sy) / H
    rays = np.zeros((H, W), np.float32)
    for f, a, ph in ((38, 1.0, 0.0), (71, 0.6, 1.7), (23, 0.7, 3.1)):
        rays += a * np.maximum(np.sin(ang * f + ph + 2.0 * np.sin(ang * 7 + ph)), 0) ** 3
    rays = rays / rays.max() * np.exp(-dist * 1.15) * np.clip(1.3 - dist, 0, 1)
    rays = blur(rays, 3)
    ra = np.concatenate([np.stack([np.full_like(rays, 1.0), np.full_like(rays, 0.92), np.full_like(rays, 0.72)], -1), np.clip(rays * 0.55, 0, 0.6)[..., None]], -1)
    sizes['rays'] = save_webp(ra, os.path.join(out, 'rays.webp'), 80, alpha=True)
    # vignette (near layer), tiny transparent mid/front (kept so the layer stack stays uniform)
    for n in ('mid', 'front', 'near'): sizes[n] = save_webp(np.zeros((9, 16, 4), np.float32), os.path.join(out, n + '.webp'), 80, alpha=True)
    # caustics: bright network, tileable, used as two counter-moving planes restricted to the sunlit sand by a mask
    T = 1024; n1 = tileable_noise(T, T, 4, 3); n2 = tileable_noise(T, T, 4, 9)
    gx = np.arange(T, dtype=np.float32)[None, :]; gy = np.arange(T, dtype=np.float32)[:, None]
    wv = np.sin((gx + 90 * n1) * 2 * np.pi / 128) * np.sin((gy + 90 * n2) * 2 * np.pi / 128)
    cau = np.clip(1 - np.abs(wv) * 2.2, 0, 1) ** 4
    ca = np.concatenate([np.stack([np.full_like(cau, 0.85), np.full_like(cau, 1.0), np.full_like(cau, 1.0)], -1), (cau * 0.5)[..., None]], -1)
    sizes['t-caustic'] = save_webp(ca, os.path.join(out, 't-caustic.webp'), 85, alpha=True)
    sand = ((v > 0.62) & (s < 0.6) & (h > 160) & (h < 215)).astype(np.float32)
    sand *= (np.arange(SRC_H)[:, None] > 255).astype(np.float32) * (np.arange(SRC_W)[None, :] > 300).astype(np.float32)
    sand = blur(morph(sand, 9, 5), 3.0)
    sm = np.concatenate([np.ones((H, W, 3), np.float32), hires_mask(sand, 6.0)[..., None]], -1)
    sizes['t-mask-sand'] = save_webp(sm, os.path.join(out, 't-mask-sand.webp'), 70, alpha=True)
    thumbs(plate, slug)
    js = '  const REF_OCEAN = ' + json.dumps(sprites, separators=(',', ':')) + ';'
    inject('OCEAN', js)
    print('ocean', {k: f'{v/1024:.0f}KB' for k, v in sizes.items()})

# ------------------------------------------------------------------ SAKURA
def sakura():
    slug = 'sakura-garden'; y0 = 40
    crop = load('cherrybg.jpg', y0); plate = enhance(crop)
    sky_poly = [(385, 26), (512, 26), (500, 50), (478, 62), (452, 75), (432, 90), (412, 100), (400, 106), (385, 100), (345, 114), (322, 120), (306, 100), (301, 60), (330, 40)]
    h, s, v = hsv_arrays(crop)
    skym = poly_mask(sky_poly, y0, 1.0) * ((v > 0.50) & (s < 0.35)).astype(np.float32)
    skym = blur(morph(skym, 5, 3, 3), 2.5)
    groups = [  # name, polygon (source coords incl. the 26 px black bar offset), wind, period, depth k
        ('treeNearL', [(0, 40), (238, 40), (236, 60), (200, 100), (165, 140), (140, 190), (118, 240), (95, 285), (70, 305), (0, 312)], 0.45, 7.0, 1.28),
        ('treeNearR', [(768, 40), (412, 40), (440, 70), (500, 100), (540, 130), (600, 160), (620, 220), (605, 300), (640, 345), (768, 352)], 0.4, 7.6, 1.28),
        ('treeMidL', [(150, 150), (200, 90), (260, 70), (330, 80), (345, 150), (330, 210), (300, 255), (270, 300), (215, 300), (185, 240), (160, 200)], 0.9, 5.4, 0.86),
        ('treeMidR', [(455, 150), (500, 120), (560, 140), (600, 200), (610, 290), (560, 300), (500, 280), (455, 250)], 1.0, 5.0, 0.86),
    ]
    masks = {}; union = np.zeros((SRC_H, SRC_W), np.float32)
    for name, poly, wind, fl, k in groups:
        m = poly_mask(poly, y0, 3.0) * (1 - 0.0)
        masks[name] = m; union = np.maximum(union, m)
    # plate behind the moving groups: filled from surroundings (soft), sky removed so the cloud plane shows through the window
    um = hires_mask(union, 1.5); valid = band_valid(um, 22)
    behind = pushpull(plate, valid)
    mid = np.where((valid > 0.5)[..., None], plate, np.clip(behind + (blur(rng.standard_normal((H, W)).astype(np.float32), 0.8) * 0.012)[..., None], 0, 1))
    skyh = hires_mask(skym, 2.0)
    out = os.path.join(ROOT, 'wallpapers/depth', slug); os.makedirs(out, exist_ok=True)
    for n in ('s-treeL', 's-treeR'):
        f = os.path.join(out, n + '.webp')
        if os.path.exists(f): os.remove(f)
    yy1, xx1 = np.mgrid[0:H, 0:W].astype(np.float32)
    vig1 = np.clip(((xx1 / W - 0.5) ** 2 * 1.3 + (yy1 / H - 0.5) ** 2 * 1.5) - 0.10, 0, 1) ** 1.2 * 0.5
    mid = mid * (1 - vig1[..., None]) + np.array([0.06, 0.02, 0.1], np.float32) * vig1[..., None]   # vignette baked in (no extra full-viewport layer to composite)
    mid_rgba = np.concatenate([mid, (1 - skyh)[..., None]], -1)
    sizes = {'mid': save_webp(mid_rgba, os.path.join(out, 'mid.webp'), 90, alpha=True)}
    # far = soft sky gradient (visible through the window under the drifting clouds)
    # sample the plate's own sky row by row inside the window so the backdrop matches what is left around it
    sm = skyh > 0.6; rows = np.zeros((H, 3), np.float32); have = np.zeros(H, bool)
    for r in range(H):
        if sm[r].sum() > 40: rows[r] = plate[r][sm[r]].mean(0); have[r] = True
    idx = np.where(have)[0]
    for c in range(3): rows[:, c] = np.interp(np.arange(H), idx, rows[idx, c])
    rows = np.stack([np.convolve(np.pad(rows[:, c], 30, mode='edge'), np.ones(61) / 61, mode='valid') for c in range(3)], -1)
    far = np.repeat(rows[:, None, :], W, 1) + 0.02 * blur(rng.standard_normal((H, W)).astype(np.float32), 25)[..., None]
    far = np.clip(far, 0, 1)
    sizes['far'] = save_webp(far, os.path.join(out, 'far.webp'), 88)
    sprites = []
    for name, poly, wind, fl, k in groups:
        mh = hires_mask(masks[name]); c = cutout(plate, mh, pad=6)
        if c is None: continue
        rgba, box = c
        sizes[name] = save_webp(rgba, os.path.join(out, f's-{name}.webp'), 90, alpha=True)
        sprites.append(place(name, box, y0, k=k, z=3 if k >= 1 else 2, wind=wind, ox='50%', oy='100%', fl=fl))
    # clouds: a seamless horizontal tile drifting very slowly; only the sky window shows it
    CW, CH = 2048, 1024
    n = tileable_noise(CW, CH, 6, 21) ; n2 = tileable_noise(CW, CH, 3, 5)
    yy2 = np.linspace(0, 1, CH, dtype=np.float32)[:, None]
    shape = np.clip((n - 0.44) * 3.2, 0, 1) * np.exp(-((yy2 - 0.17) / 0.12) ** 2) * (0.6 + 0.6 * n2)
    shade = np.clip(0.92 + 0.2 * (n2 - 0.5) - 0.1 * np.clip((n - 0.55) * 4, 0, 1), 0.82, 1)
    cl = np.concatenate([np.stack([0.98 * shade, 0.95 * shade, 1.0 * shade], -1), np.clip(shape * 0.85, 0, 0.85)[..., None]], -1)
    sizes['t-clouds'] = save_webp(cl, os.path.join(out, 't-clouds.webp'), 82, alpha=True)
    # vignette + a soft atmospheric lift near the horizon; light shafts through the canopy gaps
    yy3, xx3 = np.mgrid[0:H, 0:W].astype(np.float32)
    vig = np.clip(((xx3 / W - 0.5) ** 2 * 1.3 + (yy3 / H - 0.5) ** 2 * 1.5) - 0.10, 0, 1) ** 1.2 * 0.5
    sizes['near'] = save_webp(np.zeros((9, 16, 4), np.float32), os.path.join(out, 'near.webp'), 80, alpha=True)
    ang = np.arctan2(xx3 - 0.5 * W, yy3 + 0.3 * H); rays = np.zeros((H, W), np.float32)
    for f, a, ph in ((30, 1.0, 0.4), (53, 0.6, 2.2)): rays += a * np.maximum(np.sin(ang * f + ph + 1.7 * np.sin(ang * 6 + ph)), 0) ** 3
    rays = blur(rays / rays.max() * np.exp(-np.hypot(xx3 - 0.5 * W, yy3 + 0.3 * H) / H * 0.9), 4)
    ra = np.concatenate([np.stack([np.full_like(rays, 1.0), np.full_like(rays, 0.88), np.full_like(rays, 0.95)], -1), np.clip(rays * 0.35, 0, 0.4)[..., None]], -1)
    sizes['rays'] = save_webp(ra, os.path.join(out, 'rays.webp'), 80, alpha=True)
    sizes['front'] = save_webp(np.zeros((9, 16, 4), np.float32), os.path.join(out, 'front.webp'), 80, alpha=True)
    thumbs(plate, slug)
    inject('SAKURA', '  const REF_SAKURA = ' + json.dumps(sprites, separators=(',', ':')) + ';')
    # debug overlay for visual QA of the masks
    dbg = np.asarray(crop.resize((SRC_W * 2, SRC_H * 2)), dtype=np.float32) / 255
    for m, col in [(skym, (0, 1, 0))] + [(masks[g[0]], c) for g, c in zip(groups, [(1, 0, 0), (0, 0, 1), (1, 1, 0), (0, 1, 1)])]:
        mm = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((SRC_W * 2, SRC_H * 2)), dtype=np.float32)[..., None] / 255
        dbg = dbg * (1 - 0.35 * mm) + np.array(col) * 0.35 * mm
    save_webp(dbg, '/tmp/claude-0/sakura-mask-debug.webp', 85)
    print('sakura', {k: f'{v/1024:.0f}KB' for k, v in sizes.items()})

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'both'
    if which in ('ocean', 'both'): ocean()
    if which in ('sakura', 'both'): sakura()
