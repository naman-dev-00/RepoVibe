#!/usr/bin/env python3
"""Sakura Dreams, painted from scratch (original artwork; replaces the reference-plate build). Concept kept from the owner's reference:
a valley path lined with cherry trees under soft dawn light, mountains beyond, a carpet of fallen petals.

Everything is drawn procedurally and supersampled 2x:
  * sky with sun glow (far.webp); soft cloud bank tile (t-clouds.webp) drifting over the sky;
  * layered mountain ranges with aerial perspective and snow on lit faces, distant blossom groves of individually stamped tiny
    flowers, a path through a meadow carpeted with fallen petals, and a row of small trees along the path (mid.webp, sky transparent);
  * four cherry trees grown recursively (gnarled tapered branches with bark shading and texture), every blossom an individual
    notched five-petal flower with stamens, shaded by its place in the cluster (s-treeNearL/R, s-treeMidL/R, sway on the shared gust);
  * two blossom sprays for the pop-out layer, three petal sprites, light shafts.
Writes wallpapers/depth/sakura-garden/, wallpapers/sakura-garden.webp + thumbnail, and the REF-SAKURA block in shared/worlds.js.
  python3 -I scripts/wallpapers/sakura-paint.py"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/sakura-garden')
W, H = 2560, 1440
SS = 2                                   # supersampling for everything drawn with PIL
rng = np.random.default_rng(11)

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255
def to8(a): return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
def save(img, name, q=90):
    os.makedirs(OUT, exist_ok=True); p = os.path.join(OUT, name); img.save(p, 'WEBP', quality=q, method=6); return os.path.getsize(p)
def blur(a, r):
    if a.ndim == 2: return np.asarray(Image.fromarray(to8(a)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    return np.stack([blur(a[..., i], r) for i in range(a.shape[2])], -1)
def noise2(w, h, scale, seed, octaves=5):
    r = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp, tot = 1.0, 0.0
    for o in range(octaves):
        gw, gh = max(2, int(w / scale * 2 ** o) + 2), max(2, int(h / scale * 2 ** o) + 2)
        g = r.random((gh, gw)).astype(np.float32)
        out += np.asarray(Image.fromarray(to8(g)).resize((w, h), Image.BICUBIC), np.float32) / 255 * amp; tot += amp; amp *= 0.5
    return out / tot
def noise1(x, freq, seed):
    r = np.random.default_rng(seed); n = int(freq) + 3; v = r.random(n).astype(np.float32)
    t = x * freq; i = np.floor(t).astype(int); f = t - i; f = f * f * (3 - 2 * f)
    return v[i] * (1 - f) + v[i + 1] * f
def ridge(x, base, amp, seed, freq=3.0):
    """Mountain skyline: ridged fractal value noise (sharp peaks, eroded shoulders). Returns y (fraction of H) per x."""
    y = np.zeros_like(x); a = 1.0; tot = 0.0
    for o in range(7):
        n = noise1(x, freq * 2 ** o, seed + o * 17)
        y += a * (1 - np.abs(n * 2 - 1)) ** (2.0 if o < 2 else 1.0); tot += a; a *= 0.48
    return base - amp * y / tot

# ------------------------------------------------------------------ blossom stamps
PALE, LIGHT, MID, DEEP, SHADE = hexc('#fff3f7'), hexc('#ffd0e2'), hexc('#f7a3c4'), hexc('#e06f9f'), hexc('#a8507c')
def make_blossom(d, rot, open_=1.0):
    """RGBA blossom, diameter d px: five notched petals, pale tips, pink bases, stamens and a magenta eye. Returns (template arrays)."""
    S = d * 4; c = (S - 1) / 2
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    x, y = (xx - c) / (S / 2), (yy - c) / (S / 2)
    r = np.hypot(x, y); th = np.arctan2(y, x) - rot
    k = (th * 5 / (2 * np.pi)) % 1.0 - 0.5                 # -0.5..0.5 within each petal
    edge = 0.62 + 0.38 * np.clip(np.cos(k * np.pi), 0, 1) ** 0.55          # rounded petal lobes
    edge -= 0.13 * np.exp(-(k / 0.07) ** 2)                 # the cherry petal's notch at the tip
    edge *= open_
    inside = np.clip((edge - r) * S / 2.2, 0, 1)
    t = np.clip(r / np.maximum(edge, 1e-3), 0, 1)
    w = (1 - t) ** 1.6                                      # 1 at the base → deeper pink
    gap = np.clip(1 - np.exp(-(np.abs(k) / 0.035) ** 2) * (t > 0.15) * 0.55, 0, 1)   # thin gap line between petals
    vein = 1 - 0.08 * np.exp(-(k / 0.015) ** 2) * t
    stamen_ring = np.zeros_like(r)
    for i in range(10):
        a = rot + i * 2 * np.pi / 10 + 0.15
        sx, sy = np.cos(a) * 0.27, np.sin(a) * 0.27
        stamen_ring = np.maximum(stamen_ring, np.clip(1 - np.hypot(x - sx, y - sy) / 0.055, 0, 1))
    eye = np.clip(1 - r / 0.13, 0, 1)
    def down(a): return np.asarray(Image.fromarray(to8(a)).resize((d, d), Image.LANCZOS), np.float32) / 255
    return down(inside * gap), down(w), down(vein), down(stamen_ring), down(eye)
STAMPS = {}
def stamp_set(d):
    if d not in STAMPS: STAMPS[d] = [make_blossom(d, rng.random() * 6.28, 0.85 + 0.15 * rng.random()) for _ in range(6)]
    return STAMPS[d]
def colour_for(light):
    """light 0..1 → petal tip colour and base colour."""
    tips = [SHADE * 1.05, MID, LIGHT, PALE]
    i = min(int(light * 3), 2); f = light * 3 - i
    tip = tips[i] * (1 - f) + tips[i + 1] * f
    base = DEEP * (0.7 + 0.3 * light)
    return tip, base
def put_blossom(canvas, alpha, cx, cy, d, light, opacity=1.0):
    """Composite one blossom (premultiplied) into float canvas (H,W,3) and alpha (H,W)."""
    inside, w, vein, st, eye = stamp_set(d)[rng.integers(6)]
    x0, y0 = int(cx - d / 2), int(cy - d / 2)
    if x0 < 0 or y0 < 0 or x0 + d > canvas.shape[1] or y0 + d > canvas.shape[0]: return
    tip, base = colour_for(light)
    col = tip[None, None] * (1 - w[..., None] * 0.75) + base[None, None] * (w[..., None] * 0.75)
    col = col * vein[..., None]
    col = col * (1 - st[..., None]) + hexc('#ffd86e')[None, None] * (0.6 + 0.4 * light) * st[..., None]
    col = col * (1 - eye[..., None] * 0.8) + hexc('#b0185a')[None, None] * eye[..., None] * 0.8
    a = inside * opacity
    reg = canvas[y0:y0 + d, x0:x0 + d]; ra = alpha[y0:y0 + d, x0:x0 + d]
    reg[:] = reg * (1 - a[..., None]) + col * a[..., None]
    ra[:] = ra + a * (1 - ra)

# ------------------------------------------------------------------ tree growth
def grow(x, y, ang, length, width, depth, segs, tips, seed, maxd=None):
    """Recursive gnarled branch. Old limbs climb, outer limbs spread almost horizontally and droop slightly (the cherry's umbrella crown).
    Blossom-cluster anchors are recorded all along every limb of the outer three orders, not only at the tips."""
    r = np.random.default_rng(seed); maxd = depth if maxd is None else maxd
    pts = []; n = 5
    cx, cy, a = x, y, ang
    bend = (r.random() - 0.5) * 0.6
    for i in range(n + 1):
        pts.append((cx, cy))
        a += bend / n + (r.random() - 0.5) * 0.22
        outer = 1 - depth / max(maxd, 1)
        a -= 0.018 * outer * math.cos(a)           # outer limbs level out (a gentle umbrella, not a weeping crown)
        cx += math.cos(a) * length / n; cy -= math.sin(a) * length / n
    segs.append((pts, width, width * 0.7, depth))
    if depth <= 2:
        for i in range(1, n + 1):
            tips.append((pts[i][0], pts[i][1], a, depth))
    ex, ey = pts[-1]
    if depth == 0 or width < 1.2:
        tips.append((ex, ey, a, 0)); return
    k = 3 if (r.random() < 0.3 and depth < maxd and depth > 2) else 2
    spread = 0.5 + 0.35 * r.random()
    for j in range(k):
        na = a + spread * (j - (k - 1) / 2) * (1.2 if k == 2 else 0.95) + (r.random() - 0.5) * 0.3
        if depth >= maxd - 3: na = na * 0.7 + math.pi / 2 * 0.3          # the main forks climb
        grow(ex, ey, na, length * (0.7 + 0.12 * r.random()), width * 0.68, depth - 1, segs, tips, seed * 7 + j * 13 + 1, maxd)
    if 1 <= depth <= 3:     # short side twigs (no further branching) carry extra blossom
        for t in (0.4, 0.8):
            px, py = pts[int(t * n)]
            ta = a + (1.0 if r.random() < 0.5 else -1.0) * (0.6 + 0.5 * r.random())
            grow(px, py, ta, length * (0.3 + 0.2 * r.random()), width * 0.38, 0, segs, tips, seed * 11 + int(t * 100), maxd)

def bark_draw(draw, segs, light_dir=(-0.6, -0.8)):
    """Tapered segments as polygons: bark base, lit rim on the light side, dark rim on the shadow side, fissure lines."""
    for pts, w0, w1, depth in sorted(segs, key=lambda s: -s[1]):
        n = len(pts) - 1
        left, right = [], []
        for i, (px, py) in enumerate(pts):
            j = min(i, n - 1); dx, dy = pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]; L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L, dx / L; w = (w0 + (w1 - w0) * i / n) / 2
            left.append((px + nx * w, py + ny * w)); right.append((px - nx * w, py - ny * w))
        poly = [(x * SS, y * SS) for x, y in left + right[::-1]]
        draw.polygon(poly, fill=(58, 36, 46, 255))
        # lit side (facing the light) and shadow side
        side_lit = left if (left[0][0] - right[0][0]) * light_dir[0] + (left[0][1] - right[0][1]) * light_dir[1] > 0 else right
        side_dark = right if side_lit is left else left
        for side, col, frac in ((side_lit, (122, 86, 92, 255), 0.42), (side_dark, (30, 18, 26, 255), 0.4)):
            inner = [((sx * (1 - frac) + px * frac) * SS, (sy * (1 - frac) + py * frac) * SS) for (sx, sy), (px, py) in zip(side, pts)]
            draw.polygon([(x * SS, y * SS) for x, y in side] + inner[::-1], fill=col)
        if w0 > 6:       # fissures along the bark
            rr = np.random.default_rng(int(w0 * 100 + pts[0][0]))
            for f in range(int(w0 / 5)):
                off = (rr.random() - 0.5) * 0.7
                line = []
                for i, (px, py) in enumerate(pts):
                    j = min(i, n - 1); dx, dy = pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]; L = math.hypot(dx, dy) or 1
                    w = (w0 + (w1 - w0) * i / n) / 2
                    line.append(((px - dy / L * w * off) * SS, (py + dx / L * w * off) * SS))
                draw.line(line, fill=(36, 22, 30, 255), width=max(1, int(SS * 0.9)))

def tree_sprite(name, base_x, base_y, trunk_len, trunk_w, lean, depth, seed, box_unused, bsize, cluster_r, density, light_from=(-0.5, -0.85)):
    """Grow a tree in plate coordinates, size its canvas to the grown tree (+ blossom margin), draw bark (2x) and stamp blossoms.
    Returns (rgba, box) with box = (x0, y0, x1, y1) in plate px (may extend beyond the plate)."""
    segs, tips = [], []
    grow(base_x, base_y, math.pi / 2 + lean, trunk_len, trunk_w, depth, segs, tips, seed)
    xs_ = [p[0] for sg in segs for p in sg[0]]; ys_ = [p[1] for sg in segs for p in sg[0]]
    m = int(cluster_r * 1.6 + bsize * 2)
    x0, y0, x1, y1 = int(min(xs_) - m), int(min(ys_) - m), int(max(xs_) + m), int(max(max(ys_), base_y) + 4)
    cw, ch = x1 - x0, y1 - y0
    segs = [([(px - x0, py - y0) for px, py in pts], w0, w1, d) for pts, w0, w1, d in segs]
    tips = [(tx - x0, ty - y0, a, d) for tx, ty, a, d in tips]
    big = Image.new('RGBA', (cw * SS, ch * SS), (0, 0, 0, 0)); bark_draw(ImageDraw.Draw(big), segs)
    barkim = big.resize((cw, ch), Image.LANCZOS)
    bark = np.asarray(barkim, np.float32) / 255
    col = bark[..., :3].copy(); alpha = bark[..., 3].copy()
    # blossom clusters: back layer (darker, behind the branches) then front layer
    r = np.random.default_rng(seed + 5)
    clusters = []
    for (tx, ty, a, d) in tips:
        if r.random() < (0.32 if d == 2 else 0.6 if d == 1 else 0.9):
            clusters.append((tx + (r.random() - 0.5) * cluster_r * 0.6, ty - r.random() * cluster_r * 0.3, cluster_r * (0.5 + 0.5 * r.random()) * (0.8 if d == 2 else 1.0)))
    cxs = np.array([c[0] for c in clusters]); cys = np.array([c[1] for c in clusters])
    ccx, ccy = cxs.mean(), cys.mean(); spanx, spany = np.ptp(cxs) / 2 + 1, np.ptp(cys) / 2 + 1
    flowers = []
    for (cx, cy, cr) in clusters:
        n = int(density * cr * cr / 100)
        for _ in range(n):
            u, v = r.normal(0, 0.45, 2)
            fx, fy = cx + u * cr, cy + v * cr * 0.8
            # light: upper-left of each cluster and of the whole crown is brighter; inner flowers darker
            lc = -(u * light_from[0] + v * light_from[1]) * 0.85 - max(v, 0) * 0.35   # each clump: lit top-left, shaded underside
            lg = -((fx - ccx) / spanx * light_from[0] + (fy - ccy) / spany * light_from[1]) * 0.3 - max((fy - ccy) / spany, 0) * 0.25
            depthv = r.random()
            light = float(np.clip(0.5 + lc + lg + 0.25 * (depthv - 0.5), 0.02, 0.98))
            flowers.append((depthv, fx, fy, light))
    cap = 60000 if bsize >= 12 else 22000 if bsize >= 8 else 2500        # enough to fill the crown, bounded render time
    if len(flowers) > cap: flowers = [flowers[i] for i in r.choice(len(flowers), cap, replace=False)]
    flowers.sort(key=lambda f: f[0])
    for i, (dv, fx, fy, light) in enumerate(flowers):
        d = int(np.clip(bsize * (0.7 + 0.6 * dv) * (0.85 + 0.3 * r.random()), 4, 60))
        put_blossom(col, alpha, fx, fy, d, light if dv > 0.25 else light * 0.75, 0.92 + 0.08 * dv)
        if i % 31 == 0 and dv > 0.6:   # a few young bronze-green leaves among the flowers
            lx, ly = fx + (r.random() - 0.5) * d, fy + (r.random() - 0.5) * d
            leaf_d = max(3, int(d * 0.4)); xx, yy = int(lx), int(ly)
            if 0 < xx < cw - leaf_d and 0 < yy < ch - leaf_d:
                ys, xs = np.mgrid[0:leaf_d, 0:leaf_d].astype(np.float32); q = ((xs - leaf_d / 2) / (leaf_d / 2)) ** 2 + ((ys - leaf_d / 2) / (leaf_d / 4)) ** 2
                la = np.clip((1 - q) * 3, 0, 1) * 0.9; lcol = hexc('#7d8a3c') * (0.7 + 0.4 * light)
                reg = col[yy:yy + leaf_d, xx:xx + leaf_d]; reg[:] = reg * (1 - la[..., None]) + lcol * la[..., None]
                alpha[yy:yy + leaf_d, xx:xx + leaf_d] = np.maximum(alpha[yy:yy + leaf_d, xx:xx + leaf_d], la)
    rgba = np.concatenate([col, alpha[..., None]], -1)
    return rgba, (x0, y0, x1, y1)

def comp(dst, dsta, rgba, box, haze=0.0, hz=None):
    """Composite rgba (straight alpha) placed at box into the plate, clipped to the plate."""
    x0, y0, x1, y1 = box
    cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x1, dst.shape[1]), min(y1, dst.shape[0])
    if cx1 <= cx0 or cy1 <= cy0: return
    src = rgba[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]; a = src[..., 3:4]; c = src[..., :3]
    if haze: c = c * (1 - haze) + hz * haze
    dst[cy0:cy1, cx0:cx1] = dst[cy0:cy1, cx0:cx1] * (1 - a) + c * a
    if dsta is not None: dsta[cy0:cy1, cx0:cx1] = np.maximum(dsta[cy0:cy1, cx0:cx1], a[..., 0])

def ground_shade(col, cx, cy, rx, ry, k=0.28):
    """Soft shade cast by a crown onto the meadow (cool, slightly purple), elliptical, feathered."""
    x0, x1, y0, y1 = max(int(cx - rx), 0), min(int(cx + rx), W), max(int(cy - ry), 0), min(int(cy + ry), H)
    if x1 <= x0 or y1 <= y0: return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    a = np.clip(1 - ((xx - cx) / rx) ** 2 - ((yy - cy) / ry) ** 2, 0, 1) ** 1.5 * k
    col[y0:y1, x0:x1] = col[y0:y1, x0:x1] * (1 - a[..., None]) + hexc('#6a5a78') * a[..., None]

def place(name, box, **kw):
    x0, y0, x1, y1 = box
    d = dict(n=name, plane='scene', x=round((x0 + x1) / 2 / W * 100, 2), y=round((y0 + y1) / 2 / H * 100, 2), w=round((x1 - x0) / W * 100, 2)); d.update(kw); return d

def main():
    os.makedirs(OUT, exist_ok=True); sizes = {}
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); X, Y = xx / W, yy / H
    # ---------------- sky (far)
    top, mid, hor = hexc('#8fa3d6'), hexc('#e8c6dc'), hexc('#ffe3d6')
    t = np.clip(Y / 0.5, 0, 1)[..., None]
    sky = np.where(t < 0.55, top * (1 - t / 0.55) + mid * (t / 0.55), mid * (1 - (t - 0.55) / 0.45) + hor * ((t - 0.55) / 0.45))
    sun = np.exp(-(((X - 0.5) * 1.78) ** 2 + (Y - 0.36) ** 2) / 0.0025)[..., None]; glow = np.exp(-(((X - 0.5) * 1.78) ** 2 + (Y - 0.36) ** 2) / 0.05)[..., None]
    sky = sky + hexc('#fff6e6') * sun * 0.45 + hexc('#ffd9c8') * glow * 0.22
    sky = np.clip(sky + (noise2(W, H, 400, 3, 3)[..., None] - 0.5) * 0.015, 0, 1)
    sizes['far'] = save(Image.fromarray(to8(sky)), 'far.webp', 90)
    # ---------------- mid: mountains, groves, meadow, path
    col = sky.copy(); alpha = np.zeros((H, W), np.float32)
    x1d = np.linspace(0, 1, W, dtype=np.float32)
    ranges = [(0.44, 0.17, 5, hexc('#b9b2d6'), 0.62), (0.5, 0.13, 9, hexc('#9a8fbf'), 0.42), (0.55, 0.09, 13, hexc('#7d6e9e'), 0.25)]
    for base, amp, seed, c, haze in ranges:
        top = ridge(x1d, base, amp, seed) * H
        m = blur((yy >= top[None, :]).astype(np.float32), 1.0)
        sl = np.convolve(np.gradient(top), np.ones(15) / 15, mode='same')[None, :]
        below = (yy - top[None, :]) / (amp * H)
        lit = np.clip(0.55 + sl * 0.12 - below * 0.15, 0.2, 1.0)                 # right-falling slopes face the sun
        peak = np.clip((base * H - top[None, :]) / (amp * H) - 0.45, 0, 1) * 2      # how high this column's summit is
        snow = (below < 0.22 * peak + 0.02 * noise2(W, H, 18, seed, 3)) & (peak > 0.05)
        mc = c[None, None] * (0.78 + 0.35 * lit[..., None]) * (0.95 + 0.08 * noise2(W, H, 24, seed + 1, 3)[..., None])
        mc = np.where(snow[..., None], hexc('#f6f0f8')[None, None] * (0.78 + 0.25 * lit[..., None]), mc)
        hz = hexc('#f2dbe6'); mist = np.clip(below * 1.6 - 0.2, 0, 1)[..., None] * 0.55
        mc = mc * (1 - haze) + hz * haze; mc = mc * (1 - mist) + hz * mist
        col = col * (1 - m[..., None]) + mc * m[..., None]; alpha = np.maximum(alpha, m)
    # valley floor and hill groves
    horizon = 0.585
    hills = ridge(x1d, horizon, 0.05, 21, 2.0) * H
    hm = (yy >= hills[None, :]).astype(np.float32)
    ground_t = np.clip((Y - horizon) / (1 - horizon), 0, 1)
    grass = (hexc('#a9bd7e') * (1 - ground_t[..., None]) + hexc('#6f9a4e') * ground_t[..., None]) * (0.85 + 0.2 * noise2(W, H, 12, 45, 3)[..., None]) * 0.72 + hexc('#f0c4d4') * 0.28
    col = col * (1 - hm[..., None]) + grass * hm[..., None]; alpha = np.maximum(alpha, hm)
    # distant groves: pink masses made of tiny individual blossoms along the hills
    # round grove crowns along the hills (scalloped tops), almost continuous: the valley reads as a forest in bloom
    crest = hills - 0.075 * H * (0.55 + 0.45 * noise2(W, 1, 140, 31, 4)[0]) - 0.012 * H * np.abs(np.sin(np.arange(W) / 23.0 + noise2(W, 1, 60, 32, 3)[0] * 6))
    grove = ((yy >= crest[None, :]) & (yy < hills[None, :] + 0.04 * H)).astype(np.float32)
    grove *= (noise2(W, H, 120, 33, 4) > 0.3)
    col = col * (1 - grove[..., None] * 0.85) + hexc('#d98fb0') * grove[..., None] * 0.85; alpha = np.maximum(alpha, grove)
    gy, gx = np.where(grove > 0.5); pick = rng.choice(len(gx), size=min(52000, len(gx)), replace=False)
    for i in pick:
        put_blossom(col, alpha, gx[i], gy[i], 4 + int(rng.random() * 2), float(np.clip(0.45 + 0.4 * (rng.random() - 0.3) - (gy[i] - crest[gx[i]]) / (0.08 * H) * 0.45, 0.05, 0.95)), 0.95)
    # the path: converges to the vanishing point between the trees
    vp = (0.5 * W, horizon * H + 10)
    halfw = lambda y: (y - vp[1]) / (H - vp[1]) * 0.26 * W + 6
    pm = ((yy > vp[1]) & (np.abs(xx - vp[0] - (yy - vp[1]) * 0.08 * np.sin((yy - vp[1]) / 260)) < halfw(yy))).astype(np.float32)
    pm = blur(pm, 1.2)
    stone = hexc('#d9b8b4') * (0.9 + 0.12 * noise2(W, H, 14, 41, 3)[..., None])
    col = col * (1 - pm[..., None]) + stone * pm[..., None]
    # fallen petals on the meadow and path: thousands of small flattened petals, larger toward the viewer
    pr = np.random.default_rng(51)
    for _ in range(110000):
        py = vp[1] + (H - vp[1]) * pr.random() ** 0.8; px = pr.random() * W
        persp = (py - vp[1]) / (H - vp[1])
        d = max(2, int(2 + 9 * persp)); ang = pr.random() * 3.14
        xs0, ys0 = int(px), int(py)
        if xs0 < 1 or ys0 < 1 or xs0 + d >= W or ys0 + d >= H: continue
        ys, xs = np.mgrid[0:d, 0:d].astype(np.float32) - (d - 1) / 2
        u = xs * math.cos(ang) + ys * math.sin(ang); v = -xs * math.sin(ang) + ys * math.cos(ang)
        q = (u / (d / 2)) ** 2 + (v / (d / 2 * (0.35 + 0.2 * persp))) ** 2
        a = np.clip((1 - q) * d * 0.6, 0, 1) * (0.75 + 0.25 * pr.random())
        light = 0.55 + 0.4 * pr.random()
        pc = (PALE * light + MID * (1 - light)) * (0.9 + 0.1 * persp)
        reg = col[ys0:ys0 + d, xs0:xs0 + d]; reg[:] = reg * (1 - a[..., None]) + pc * a[..., None]
    # a grove of cherry trees spread over the meadow on both sides (behind the avenue), hazed with distance
    meadow = []
    mr = np.random.default_rng(77)
    for i in range(96):
        side = -1 if i % 2 else 1
        ty = vp[1] + 14 + (H * 0.2) * mr.random() ** 1.7
        dd = (ty - vp[1]) / (H - vp[1])
        tx = vp[0] + side * (halfw(ty) + 160 + mr.random() * W * 0.45)
        if tx < -80 or tx > W + 80: continue
        meadow.append((ty, tx, 34 + 420 * dd ** 1.2, side, i))
    for ty, tx, h, side, i in sorted(meadow):
        dd = (ty - vp[1]) / (H - vp[1])
        ground_shade(col, tx + h * 0.15, ty + 4, h * 0.55, h * 0.07)
        rgba, tb = tree_sprite('meadow', tx, ty, h * 0.4, max(2, h * 0.07), side * -0.05 + (mr.random() - 0.5) * 0.12, 5, 300 + i, None, max(4, int(3 + 6 * dd)), h * 0.17, 12)
        comp(col, alpha, rgba, tb, 0.42 * (1 - dd) ** 1.5, hexc('#f0d6e2'))
    # the avenue: two rows of cherry trees lining the path on each side, receding to the vanishing point
    for row in (1, 0):
        for side in (-1, 1):
            for i in range(11):
                d_ = 1 - i / 11
                ty = vp[1] + 16 + (H * 0.2) * d_ ** 2.1 + row * 6
                tx = vp[0] + side * (halfw(ty) + 30 + (70 + 160 * row) * d_ ** 1.5 + row * 26)
                h = (36 + 210 * d_ ** 2) * (0.9 + 0.2 * ((i * 7 + row) % 5) / 4)
                ground_shade(col, tx - side * h * 0.15, ty + 3, h * 0.6, h * 0.07)
                rgba, tb = tree_sprite('row', tx, ty, h * 0.42, max(2, h * 0.07), side * -0.09, 5, 100 + i * 7 + (side > 0) + row * 50, None, max(4, int(3 + 6 * d_)), h * 0.17, 12)
                comp(col, alpha, rgba, tb, 0.34 * (1 - d_), hexc('#f0d6e2'))
    # gentle vignette baked in (no extra full-viewport layer)
    vig = np.clip(((X - 0.5) ** 2 * 1.3 + (Y - 0.5) ** 2 * 1.4) - 0.12, 0, 1) ** 1.2 * 0.35
    col = col * (1 - vig[..., None]) + hexc('#4a2a44') * vig[..., None]
    mid_rgba = np.concatenate([col, alpha[..., None]], -1)
    sizes['mid'] = save(Image.fromarray(to8(mid_rgba), 'RGBA'), 'mid.webp', 90)
    flat = sky * (1 - alpha[..., None]) + col * alpha[..., None]
    # ---------------- swaying trees
    trees = [  # name, base x, base y, trunk len, trunk width, lean, depth, seed, box, blossom px, cluster r, density, wind, period, k
        ('treeNearL', 90, 1440, 390, 86, -0.5, 7, 3, None, 15, 64, 18, 0.45, 7.0, 1.28),
        ('treeNearR', 2470, 1440, 400, 90, 0.52, 7, 7, None, 15, 66, 18, 0.4, 7.6, 1.28),
        ('treeMidL', 560, 1060, 150, 26, -0.16, 6, 13, None, 10, 32, 16, 0.9, 5.4, 0.86),
        ('treeMidR', 2000, 1050, 145, 25, 0.18, 6, 17, None, 10, 31, 16, 1.0, 5.0, 0.86),
    ]
    sprites = []; order = ['treeMidL', 'treeMidR', 'treeNearL', 'treeNearR']
    rendered = {}
    for name, bx, by, tl, tw, lean, depth, seed, box, bs, cr, dens, wind, fl, k in trees:
        rgba, box = tree_sprite(name, bx, by, tl, tw, lean, depth, seed, None, bs, cr, dens)
        rendered[name] = (rgba, box)
        ys, xs = np.where(rgba[..., 3] > 0.01); x0, y0, x1, y1 = box
        tb = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
        crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        sizes[name] = save(Image.fromarray(to8(crop), 'RGBA'), f's-{name}.webp', 90)
        ox = round((bx - tb[0]) / (tb[2] - tb[0]) * 100, 1); oy = round((by - tb[1]) / (tb[3] - tb[1]) * 100, 1)
        sprites.append(place(name, tb, k=k, z=3 if k >= 1 else 2, wind=wind, ox=f'{min(ox, 100)}%', oy=f'{min(oy, 100)}%', fl=fl))
    for name in order:
        rgba, box = rendered[name]; comp(flat, None, rgba, box)
    # ---------------- pop-out sprays, petals, clouds, rays, empty near/front
    for name, seed, flip in (('sprayA', 41, False), ('sprayB', 43, True)):
        cw, ch = 900, 700
        rgba, _ = tree_sprite(name, 0, 0, 380, 16, (math.pi * 0.5 if not flip else -math.pi * 0.5) + (0.12 if not flip else -0.12), 4, seed, None, 16, 52, 16)
        sizes[name] = save(Image.fromarray(to8(rgba), 'RGBA'), f's-{name}.webp', 90)
    for name, seed, ar in (('petalA', 1, 0.6), ('petalB', 2, 0.5), ('petalC', 3, 0.7)):
        d = 96; ys, xs = np.mgrid[0:d, 0:d].astype(np.float32) - (d - 1) / 2
        u, v = xs / (d / 2), ys / (d / 2 * ar)
        q = u ** 2 + v ** 2; notch = np.exp(-((u - 0.95) / 0.12) ** 2 - (v / 0.12) ** 2)
        a = np.clip((1 - q - notch * 0.5) * 20, 0, 1)
        shade = np.clip(0.75 + 0.25 * (-u * 0.5 - v * 0.5), 0, 1)
        c = (PALE * shade[..., None] + DEEP * (1 - shade[..., None]) * 0.6 + LIGHT * 0.2) / 1.0
        c = c * (1 - np.clip(1 - np.hypot(u + 0.9, v) / 0.4, 0, 1)[..., None] * 0.3)
        sizes[name] = save(Image.fromarray(to8(np.concatenate([np.clip(c, 0, 1), a[..., None]], -1)), 'RGBA'), f's-{name}.webp', 90)
    CW, CH = 2048, 1024
    n1 = noise2(CW, CH, 260, 21, 6); n2 = noise2(CW, CH, 600, 5, 3)
    # make the tile seamless horizontally by blending with its mirror half
    n1 = n1 * np.linspace(1, 0, CW)[None, :] ** 0 ; n1 = (n1 + np.roll(n1, CW // 2, 1)) / 2
    yy2 = np.linspace(0, 1, CH, dtype=np.float32)[:, None]
    shape = np.clip((n1 - 0.48) * 4.0, 0, 1) * np.exp(-((yy2 - 0.3) / 0.16) ** 2)
    shade = np.clip(0.95 - 0.25 * np.clip((yy2 - 0.25) * 3, 0, 1) + 0.1 * (n2 - 0.5), 0.6, 1)
    cl = np.concatenate([np.stack([1.0 * shade, 0.93 * shade, 0.95 * shade], -1), np.clip(shape * 0.7, 0, 0.7)[..., None]], -1)
    sizes['t-clouds'] = save(Image.fromarray(to8(cl), 'RGBA'), 't-clouds.webp', 82)
    ang = np.arctan2(xx - 0.44 * W, yy + 0.25 * H); rays = np.zeros((H, W), np.float32)
    for f, a_, ph in ((30, 1.0, 0.4), (53, 0.6, 2.2)): rays += a_ * np.maximum(np.sin(ang * f + ph + 1.7 * np.sin(ang * 6 + ph)), 0) ** 3
    rays = blur(rays / rays.max() * np.exp(-np.hypot(xx - 0.44 * W, yy + 0.25 * H) / H * 0.9), 4)
    ra = np.concatenate([np.stack([np.full_like(rays, 1.0), np.full_like(rays, 0.9), np.full_like(rays, 0.93)], -1), np.clip(rays * 0.3, 0, 0.35)[..., None]], -1)
    sizes['rays'] = save(Image.fromarray(to8(ra), 'RGBA'), 'rays.webp', 80)
    for n in ('near', 'front'): sizes[n] = save(Image.new('RGBA', (16, 9), (0, 0, 0, 0)), f'{n}.webp', 80)
    flatim = Image.fromarray(to8(flat))
    flatim.save(os.path.join(ROOT, 'wallpapers/sakura-garden.webp'), 'WEBP', quality=90, method=6)
    flatim.resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/sakura-garden.webp'), 'WEBP', quality=82, method=6)
    p = os.path.join(ROOT, 'shared/worlds.js'); s = open(p).read(); b, e = '/*REF-SAKURA-BEGIN*/', '/*REF-SAKURA-END*/'
    i, j = s.index(b) + len(b), s.index(e)
    open(p, 'w').write(s[:i] + '\n  const REF_SAKURA = ' + json.dumps(sprites, separators=(',', ':')) + ';\n  ' + s[j:])
    print('sakura', {k: f'{v / 1024:.0f}KB' for k, v in sizes.items()})

if __name__ == '__main__':
    main()
