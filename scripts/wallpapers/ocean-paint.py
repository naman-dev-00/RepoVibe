#!/usr/bin/env python3
"""Ocean Depths, painted from scratch (original artwork; replaces the reference-plate build). Concept kept from the owner's reference:
a sunlit reef seen from the sand, coral gardens left and right, light shafts from the surface, open blue water in the middle.

Procedural, supersampled 2x where drawn with PIL:
  * far.webp: water column (bright surface band with Snell's-window glare and wave pattern seen from below, deepening blue), distant
    reef silhouettes in haze, a rippled sand floor with baked caustic light, reef walls and rocks (noise-shaped, shaded from above,
    ambient occlusion, encrusting growth), staghorn and table corals, brain corals, tube sponges — all hazed by distance;
  * swaying plant sprites (each pivots at its holdfast and moves on the shared current): kelp, sea fans, soft corals, seagrass;
  * t-caustic + t-mask-sand (moving caustics on the lit sand), rays.webp (light shafts), empty mid/near/front.
Writes wallpapers/depth/ocean-kingdom/, wallpapers/ocean-kingdom.webp + thumbnail and the REF-OCEAN block in shared/worlds.js.
  python3 -I scripts/wallpapers/ocean-paint.py"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/ocean-kingdom')
W, H = 2560, 1440
SS = 2
rng = np.random.default_rng(23)
WATER_FAR = None

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255
def to8(a): return (np.clip(np.nan_to_num(a), 0, 1) * 255 + 0.5).astype(np.uint8)
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
def tileable(w, h, octaves, seed):
    r = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        f = 2 ** (o + 2); g = r.random((f, f)).astype(np.float32)
        big = np.asarray(Image.fromarray(to8(np.tile(g, (3, 3)))).resize((3 * w, 3 * h), Image.BICUBIC), np.float32) / 255
        out += big[h:2 * h, w:2 * w] * amp; tot += amp; amp *= 0.5
    return out / tot

def water_at(y):
    """Water colour by height in the frame (bright near the surface, deep blue below)."""
    t = np.clip(y, 0, 1)
    c0, c1, c2 = hexc('#7fe0e8'), hexc('#1f8fae'), hexc('#0b3f63')
    return np.where((t < 0.45)[..., None], c0 * (1 - t / 0.45)[..., None] + c1 * (t / 0.45)[..., None],
                    c1 * (1 - (t - 0.45) / 0.55)[..., None] + c2 * ((t - 0.45) / 0.55)[..., None])
def haze_mix(c, depth, y):
    """Blend a colour toward the water at distance depth (0 near .. 1 far)."""
    w = water_at(np.asarray(y, np.float32) / H if np.ndim(y) else np.float32(y / H))
    return c * (1 - depth) + w * depth

# ------------------------------------------------------------------ PIL helpers (2x)
def tapered(draw, pts, w0, w1, fill):
    n = len(pts) - 1; left, right = [], []
    for i, (px, py) in enumerate(pts):
        j = min(i, n - 1); dx, dy = pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]; L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L; w = (w0 + (w1 - w0) * i / max(n, 1)) / 2
        left.append(((px + nx * w) * SS, (py + ny * w) * SS)); right.append(((px - nx * w) * SS, (py - ny * w) * SS))
    draw.polygon(left + right[::-1], fill=fill)
    r = w1 / 2 * SS; ex, ey = pts[-1][0] * SS, pts[-1][1] * SS
    draw.ellipse([ex - r, ey - r, ex + r, ey + r], fill=fill)
def canvas(w, h): return Image.new('RGBA', (int(w * SS), int(h * SS)), (0, 0, 0, 0))
def finish(img): return np.asarray(img.resize((img.width // SS, img.height // SS), Image.LANCZOS), np.float32) / 255

# ------------------------------------------------------------------ organisms (each returns float RGBA, base at bottom-centre)
def staghorn(size, base_col, tip_col, seed):
    """Branching staghorn coral: thick antler branches climbing and forking, pale growing tips, polyp texture."""
    r = np.random.default_rng(seed); w, h = int(size * 1.6), int(size * 1.15)
    img = canvas(w, h); d = ImageDraw.Draw(img)
    branches = []
    def br(x, y, a, L, wd, dep):
        pts = [(x, y)]
        for i in range(4):
            a += (r.random() - 0.5) * 0.35; x += math.cos(a) * L / 4; y -= math.sin(a) * L / 4; pts.append((x, y))
        branches.append((pts, wd, wd * 0.72, dep))
        if dep > 0:
            for s in (-1, 1):
                if r.random() < 0.85: br(x, y, a + s * (0.35 + 0.35 * r.random()), L * (0.72 + 0.1 * r.random()), wd * 0.72, dep - 1)
    for i in range(7):
        br(w / 2 + (r.random() - 0.5) * size * 0.3, h - 2, math.pi / 2 + (i - 3) * 0.28 + (r.random() - 0.5) * 0.2, size * 0.36, size * 0.13, 3)
    for pts, w0, w1, dep in sorted(branches, key=lambda b: -b[3]):
        shade = 0.55 + 0.45 * (1 - dep / 3)
        c = tuple(int(v) for v in (base_col * shade * 255)) + (255,)
        tapered(d, pts, w0, w1, c)
        hl = tuple(int(min(255, v * 1.25)) for v in (base_col * shade * 255)) + (255,)        # lit flank (light from above-left)
        tapered(d, [(x - w0 * 0.18, y - w0 * 0.1) for x, y in pts], w0 * 0.42, w1 * 0.42, hl)
        tc = tuple(int(v) for v in (tip_col * 255)) + (255,)
        ex, ey = pts[-1]; rr = w1 * 0.55 * SS
        d.ellipse([ex * SS - rr, ey * SS - rr, ex * SS + rr, ey * SS + rr], fill=tc)
    a = finish(img)
    # polyp dots and light from above
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    pol = (noise2(a.shape[1], a.shape[0], 3, seed + 1, 2) > 0.62).astype(np.float32) * 0.18
    top = np.clip(1.15 - yy / a.shape[0] * 0.5, 0.6, 1.2)
    a[..., :3] = np.clip(a[..., :3] * top[..., None] * (1 + pol[..., None]), 0, 1)
    return a

def seafan(width, height, col, edge_col, seed):
    """Gorgonian sea fan: a flat fan of fine branches radiating from the holdfast, cross-linked into a lace, lighter at the rim."""
    r = np.random.default_rng(seed); img = canvas(width, height); d = ImageDraw.Draw(img)
    cx, by = width / 2, height - 2
    def br(x, y, a, L, wd, dep):
        pts = [(x, y)]
        for i in range(5):
            a += (r.random() - 0.5) * 0.25; x += math.cos(a) * L / 5; y -= math.sin(a) * L / 5; pts.append((x, y))
        t = 1 - dep / 6
        c = tuple(int(v * 255) for v in (col * (1 - t) + edge_col * t)) + (255,)
        tapered(d, pts, wd, wd * 0.8, c)
        if dep > 0:
            for s in (-1, 1): br(x, y, a + s * (0.28 + 0.2 * r.random()), L * 0.8, max(wd * 0.75, 1.1), dep - 1)
    tapered(d, [(cx, by), (cx, by - height * 0.12)], width * 0.03, width * 0.02, tuple(int(v * 255) for v in col * 0.7) + (255,))
    for i in range(5): br(cx, by - height * 0.12, math.pi / 2 + (i - 2) * 0.32, height * 0.2, width * 0.018, 6)
    a = finish(img)
    # mesh: fill the fan between branches with a fine translucent lattice
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    fan = blur((a[..., 3] > 0.3).astype(np.float32), 7) > 0.18
    lat = ((np.abs(np.sin(xx * 0.55 + np.sin(yy * 0.07) * 3)) < 0.18) | (np.abs(np.sin(yy * 0.6 + xx * 0.12)) < 0.16)) & fan
    la = lat.astype(np.float32) * 0.55 * (1 - a[..., 3])
    a[..., :3] = a[..., :3] * (1 - la[..., None]) + (col * 0.9)[None, None] * la[..., None]
    a[..., 3] = np.maximum(a[..., 3], la)
    return a

def kelp(height, seed, col=hexc('#6f6a26')):
    """Giant kelp strand: a slender stipe with long lance-shaped blades angled upward, wavy edges, translucent gold-olive with lighter
    rims and a midrib, small gas bladders at each blade's base; lit from the surface."""
    r = np.random.default_rng(seed); width = int(height * 0.42); img = canvas(width, height); d = ImageDraw.Draw(img)
    cx = width / 2; pts = []
    for i in range(40):
        y = height - 2 - i * (height - 8) / 39; x = cx + math.sin(i * 0.22 + seed) * width * 0.06; pts.append((x, y))
    tapered(d, pts, width * 0.03, width * 0.014, tuple(int(v * 255) for v in col * 0.55) + (255,))
    for i in range(3, 39, 2):
        px, py = pts[i]; s_ = 1 if (i // 2) % 2 else -1; L = width * (0.5 + 0.16 * r.random()) * (1.05 - i / 60)
        ang = math.pi / 2 - s_ * (0.55 + 0.25 * r.random())
        n = 10; blade_c = []; blade_w = width * 0.05 * (1.1 - i / 60)
        for t in np.linspace(0, 1, n):
            bx = px + math.cos(ang) * L * t + math.sin(t * 9 + i) * 3; by = py - math.sin(ang) * L * t
            blade_c.append((bx, by))
        tone = col * (0.85 + 0.45 * r.random())
        # lance shape: widest a third of the way out
        left, right = [], []
        for k, (bx, by) in enumerate(blade_c):
            t = k / (n - 1); w_ = blade_w * math.sin(math.pi * min(1, t * 1.25 + 0.05)) ** 0.8 * (1 + 0.15 * math.sin(t * 22 + i))
            nx, ny = math.sin(ang), math.cos(ang)
            left.append(((bx + nx * w_) * SS, (by + ny * w_) * SS)); right.append(((bx - nx * w_) * SS, (by - ny * w_) * SS))
        d.polygon(left + right[::-1], fill=tuple(int(v * 255) for v in tone) + (165,))
        d.line(left, fill=tuple(int(min(255, v * 330)) for v in tone) + (230,), width=max(1, int(SS * 1.3)))         # lit rim
        d.line([(x * SS, y * SS) for x, y in blade_c], fill=tuple(int(v * 180) for v in tone) + (220,), width=max(1, int(SS)))  # midrib
        d.ellipse([(px - 5) * SS, (py - 6) * SS, (px + 5) * SS, (py + 4) * SS], fill=tuple(int(min(255, v * 300)) for v in col) + (255,))
    a = finish(img)
    yy = np.mgrid[0:a.shape[0], 0:a.shape[1]][0].astype(np.float32) / a.shape[0]
    a[..., :3] = np.clip(a[..., :3] * (1.3 - 0.5 * yy)[..., None], 0, 1)
    return a

def softcoral(size, col, seed):
    """Soft coral / sea-plume clump: many feathery stalks, lighter tips."""
    r = np.random.default_rng(seed); w, h = int(size * 1.2), int(size); img = canvas(w, h); d = ImageDraw.Draw(img)
    for i in range(26):
        a = math.pi / 2 + (r.random() - 0.5) * 1.3; L = size * (0.5 + 0.45 * r.random())
        x, y = w / 2 + (r.random() - 0.5) * size * 0.2, h - 2; pts = [(x, y)]
        for k in range(6):
            a += (r.random() - 0.5) * 0.2; x += math.cos(a) * L / 6; y -= math.sin(a) * L / 6; pts.append((x, y))
        t = r.random()
        tapered(d, pts, size * 0.035, size * 0.012, tuple(int(v * 255) for v in col * (0.6 + 0.5 * t)) + (255,))
        for k in range(2, 7):   # feathery side plumes
            px, py = pts[k]
            for s in (-1, 1):
                d.line([(px * SS, py * SS), ((px + s * size * 0.04) * SS, (py - size * 0.03) * SS)], fill=tuple(int(v * 255) for v in col * (0.8 + 0.4 * t)) + (255,), width=max(1, int(SS * 1.2)))
    return finish(img)

def seagrass(size, seed):
    r = np.random.default_rng(seed); w, h = int(size * 0.9), int(size); img = canvas(w, h); d = ImageDraw.Draw(img)
    for i in range(18):
        x = w / 2 + (r.random() - 0.5) * w * 0.5; a = math.pi / 2 + (r.random() - 0.5) * 0.6; L = size * (0.5 + 0.5 * r.random())
        pts = [(x, h - 2)]; xx, yy = x, h - 2
        for k in range(8): a += (r.random() - 0.4) * 0.08 * (1 if x > w / 2 else -1); xx += math.cos(a) * L / 8; yy -= math.sin(a) * L / 8; pts.append((xx, yy))
        tapered(d, pts, size * 0.03, size * 0.006, tuple(int(v * 255) for v in hexc('#5a9a4a') * (0.7 + 0.5 * r.random())) + (255,))
    return finish(img)

def brain(r_, seed, col=hexc('#c8a85a')):
    """Brain coral dome with meandering grooves, lit from above."""
    s = int(r_ * 2); yy, xx = np.mgrid[0:s, 0:s].astype(np.float32); x, y = (xx - r_) / r_, (yy - r_) / (r_ * 0.75)
    dome = (x ** 2 + y ** 2 < 1) & (y < 0.55)
    n = noise2(s, s, max(4, r_ / 5), seed, 3)
    groove = np.abs(np.sin(n * 40)) < 0.25
    z = np.sqrt(np.clip(1 - x ** 2 - y ** 2, 0, 1)); light = np.clip(0.35 + 0.65 * (z * 0.6 - y * 0.5), 0.2, 1.1)
    c = col[None, None] * light[..., None] * np.where(groove, 0.62, 1.0)[..., None]
    a = blur(dome.astype(np.float32), 0.7)
    return np.concatenate([np.clip(c, 0, 1), a[..., None]], -1)

def sprite_crop(a):
    ys, xs = np.where(a[..., 3] > 0.01)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def comp(dst, rgba, x, y_base, haze=0.0):
    """Composite an organism with its base-centre at (x, y_base), hazed toward the water at that height."""
    h, w = rgba.shape[:2]; x0, y0 = int(x - w / 2), int(y_base - h)
    cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x0 + w, W), min(y0 + h, H)
    if cx1 <= cx0 or cy1 <= cy0: return
    src = rgba[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]; a = src[..., 3:4]
    yy = np.arange(cy0, cy1, dtype=np.float32)[:, None] / H * np.ones((1, cx1 - cx0), np.float32)
    c = src[..., :3] * (1 - haze) + water_at(yy) * haze
    dst[cy0:cy1, cx0:cx1] = dst[cy0:cy1, cx0:cx1] * (1 - a) + c * a

def place(name, rgba_shape, x_base, y_base, **kw):
    h, w = rgba_shape[:2]
    d = dict(n=name, plane='scene', x=round(x_base / W * 100, 2), y=round((y_base - h / 2) / H * 100, 2), w=round(w / W * 100, 2), ox='50%', oy='100%'); d.update(kw); return d

def main():
    os.makedirs(OUT, exist_ok=True); sizes = {}
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); X, Y = xx / W, yy / H
    # ---------------- water column + surface seen from below
    col = water_at(Y)
    surf = np.clip(1 - Y / 0.16, 0, 1)
    waves = noise2(W, H, 70, 3, 4); wv = np.abs(np.sin(waves * 46 + noise2(W, H, 30, 4, 3) * 9))
    sun = np.exp(-(((X - 0.5) * 1.78) ** 2 + (Y + 0.05) ** 2) / 0.05)
    col = col + (hexc('#e9fff6') * np.clip(1 - wv / 0.14, 0, 1)[..., None] * 0.45 + hexc('#fff8d8') * sun[..., None] * 0.55) * surf[..., None] ** 1.6
    col = col + hexc('#d9fff4') * np.exp(-(((X - 0.5) * 1.78) ** 2 + (Y - 0.02) ** 2) / 0.012)[..., None] * 0.6  # Snell's window glare
    # distant reef silhouettes in haze
    for base, amp, seed, hz in ((0.6, 0.12, 5, 0.82), (0.66, 0.16, 9, 0.66)):
        n = noise2(W, 1, 220, seed, 5)[0]; top = (base - amp * n * (0.4 + 0.9 * np.abs(X[0] - 0.5) * 2)) * H
        m = blur((yy >= top[None, :]).astype(np.float32), 2.0)
        rock = hexc('#264a5e') * (0.85 + 0.3 * noise2(W, H, 40, seed + 2, 4))[..., None]
        col = col * (1 - m[..., None]) + haze_mix(rock, hz, yy) * m[..., None]
    # sand floor with ripples and baked caustics
    floor_top = (0.7 + 0.03 * noise2(W, 1, 300, 13, 4)[0]) * H
    fm = blur((yy >= floor_top[None, :]).astype(np.float32), 1.5)
    ft = np.clip((yy - floor_top[None, :]) / (H - floor_top[None, :]), 0, 1)
    rip = np.sin((yy * (0.06 + 0.12 * ft) + noise2(W, H, 80, 17, 3) * 9) ) * 0.5 + 0.5
    caus = noise2(W, H, 60, 7, 4) + 0.35 * noise2(W, H, 25, 8, 3); cl = np.clip(1 - np.abs(np.sin(caus * 38)) * 3.0, 0, 1) ** 3 * (0.4 + ft[..., None][..., 0] * 0.6)
    sand = hexc('#cfe6dc') * (0.8 + 0.12 * rip + 0.08 * noise2(W, H, 6, 19, 2))[..., None] + hexc('#f6fff0') * cl[..., None] * 0.35
    sand = haze_mix(sand, np.clip(0.55 - ft * 0.7, 0, 0.55)[..., None], yy)
    col = col * (1 - fm[..., None]) + sand * fm[..., None]
    # reef walls (left and right) and mid rocks: noise-shaped, lit from above, ambient occlusion, encrusting growth
    def rock_mask(cx, cy, rx, ry, seed, rough=0.35):
        n = noise2(W, H, max(rx, ry) * 0.5, seed, 5)
        d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) + (n - 0.5) * rough * 2
        return d
    walls = [(-60, 0.62 * H, 760, 640, 31, 0.25), (W + 80, 0.6 * H, 720, 660, 37, 0.25), (520, 0.86 * H, 420, 180, 41, 0.15),
             (2050, 0.84 * H, 460, 200, 43, 0.15), (1330, 0.78 * H, 260, 90, 47, 0.45)]
    rockm = np.zeros((H, W), np.float32)
    for cx, cy, rx, ry, seed, hz in walls:
        dist = rock_mask(cx, cy, rx, ry, seed)
        m = blur((dist < 1).astype(np.float32), 1.2)
        ny = np.gradient(blur(dist, 6), axis=0); lit = np.clip(0.5 - ny * 40, 0, 1)        # tops (where distance shrinks upward) catch light
        ao = np.clip((1 - dist) * 2.2, 0, 1)
        tex = noise2(W, H, 9, seed + 3, 4)
        big = noise2(W, H, 60, seed + 5, 4)
        rc = hexc('#5a5a52') * (0.45 + 0.75 * lit[..., None]) * (0.7 + 0.5 * tex[..., None]) * (0.65 + 0.35 * ao[..., None])
        rc = rc * (1 - (1 - lit[..., None]) * 0.5) + hexc('#1d4a66') * (1 - lit[..., None]) * 0.5            # undersides take the water's blue
        # soft coralline-algae and sponge patches on the lit faces (pink, mauve, olive), with a little fine texture
        pz = np.clip((noise2(W, H, 22, seed + 7, 4) - 0.52) * 6, 0, 1) * np.clip(lit * 1.6 - 0.4, 0, 1)
        pc = np.where((big > 0.55)[..., None], hexc('#c97a92'), np.where((big > 0.42)[..., None], hexc('#9a7ab0'), hexc('#8fa05a')))
        pc = pc * (0.75 + 0.35 * noise2(W, H, 4, seed + 8, 2)[..., None])
        rc = rc * (1 - pz[..., None]) + pc * (0.6 + 0.5 * lit[..., None]) * pz[..., None]
        rc = haze_mix(rc, hz, yy)
        col = col * (1 - m[..., None]) + rc * m[..., None]; rockm = np.maximum(rockm, m)
    # baked coral garden on the rocks (static; the swaying plants are sprites)
    corals = []
    rr = np.random.default_rng(61)
    for i in range(46):
        side = -1 if i % 2 == 0 else 1
        x = (rr.random() * 0.3 + (0.02 if side < 0 else 0.68)) * W
        cand = np.where(rockm[:, int(np.clip(x, 0, W - 1))] > 0.5)[0]
        if len(cand) == 0: continue
        ytop = cand.min() + rr.integers(0, 60)
        depth = np.clip(1 - (ytop / H - 0.35) / 0.6, 0, 1) * 0.5
        kind = rr.random()
        if kind < 0.42: o = staghorn(70 + 120 * rr.random(), hexc('#e08a3a') if rr.random() < 0.6 else hexc('#c9a73a'), hexc('#ffe2a6'), 70 + i)
        elif kind < 0.62: o = brain(28 + 40 * rr.random(), 80 + i, hexc('#c7a467') if rr.random() < 0.5 else hexc('#9fb36b'))
        elif kind < 0.8:  o = softcoral(70 + 90 * rr.random(), hexc('#a35ac8') if rr.random() < 0.6 else hexc('#d9628c'), 90 + i)
        else:             o = staghorn(60 + 60 * rr.random(), hexc('#8a4fc4'), hexc('#e2b6ff'), 100 + i)
        corals.append((ytop, x, sprite_crop(o), depth))
    for ytop, x, o, depth in sorted(corals, key=lambda c: c[0]):
        comp(col, o, x, ytop + o.shape[0] * 0.15, depth)
    # sand-floor seagrass tufts (baked, distant)
    for i in range(30):
        x = rr.random() * W * 0.5 + W * 0.25; y = (0.74 + 0.08 * rr.random()) * H
        comp(col, sprite_crop(seagrass(30 + 40 * rr.random(), 200 + i)), x, y, 0.35)
    # vignette baked in
    vig = np.clip(((X - 0.5) ** 2 * 1.5 + (Y - 0.5) ** 2 * 1.8) - 0.12, 0, 1) ** 1.2 * 0.55
    col = col * (1 - vig[..., None]) + hexc('#03182a') * vig[..., None]
    sizes['far'] = save(Image.fromarray(to8(col)), 'far.webp', 90)
    flat = col.copy()
    # ---------------- swaying plant sprites
    plants = []   # name, organism, base x, base y, k, wind, period
    defs = [
        ('kelpL1', kelp(900, 1), 140, 1440, 1.28, 2.6, 6.2), ('kelpL2', kelp(760, 2), 330, 1440, 1.28, 3.0, 5.6),
        ('kelpR1', kelp(940, 3), 2440, 1440, 1.28, 2.4, 6.6), ('kelpR2', kelp(700, 4), 2250, 1440, 1.28, 3.2, 5.2),
        ('fanL', seafan(420, 480, hexc('#7a2a8a'), hexc('#e48ad8'), 5), 560, 1150, 0.86, 2.4, 5.4),
        ('fanR', seafan(380, 440, hexc('#a3324a'), hexc('#ffa0a0'), 6), 1980, 1130, 0.86, 2.6, 5.0),
        ('softL', softcoral(260, hexc('#c45ab8'), 7), 760, 1290, 1.28, 3.4, 4.6), ('softR', softcoral(240, hexc('#e0708a'), 8), 1820, 1300, 1.28, 3.6, 4.4),
        ('grassA', seagrass(160, 9), 1180, 1110, 0.86, 4.2, 3.8), ('grassB', seagrass(140, 10), 1420, 1120, 0.86, 4.6, 3.6),
    ]
    sprites = []
    for name, org, bx, by, k, wind, fl in defs:
        o = sprite_crop(org)
        sizes[name] = save(Image.fromarray(to8(o), 'RGBA'), f's-{name}.webp', 90)
        sprites.append(place(name, o.shape, bx, by, k=k, z=3 if k >= 1 else 2, wind=wind, fl=fl))
        comp(flat, o, bx, by, 0.0)
    # ---------------- caustics for the sand (two counter-moving planes), rays, empty layers
    T = 1024; n1 = tileable(T, T, 4, 3); n2 = tileable(T, T, 4, 9)
    gx = np.arange(T, dtype=np.float32)[None, :]; gy = np.arange(T, dtype=np.float32)[:, None]
    wv2 = np.sin((gx + 90 * n1) * 2 * np.pi / 128) * np.sin((gy + 90 * n2) * 2 * np.pi / 128)
    cau = np.clip(1 - np.abs(wv2) * 2.2, 0, 1) ** 4
    sizes['t-caustic'] = save(Image.fromarray(to8(np.concatenate([np.stack([np.full_like(cau, 0.85), np.full_like(cau, 1.0), np.full_like(cau, 1.0)], -1), (cau * 0.5)[..., None]], -1)), 'RGBA'), 't-caustic.webp', 85)
    sm = blur(fm * (1 - rockm) * np.clip((X - 0.2) * 3, 0, 1) * np.clip((0.82 - X) * 3, 0, 1), 6)
    sizes['t-mask-sand'] = save(Image.fromarray(to8(np.concatenate([np.ones((H, W, 3), np.float32), sm[..., None]], -1)), 'RGBA'), 't-mask-sand.webp', 70)
    sx, sy = 0.5 * W, -0.15 * H; ang = np.arctan2(xx - sx, yy - sy); dist = np.hypot(xx - sx, yy - sy) / H
    rays = np.zeros((H, W), np.float32)
    for f, a_, ph in ((38, 1.0, 0.0), (71, 0.6, 1.7), (23, 0.7, 3.1)): rays += a_ * np.maximum(np.sin(ang * f + ph + 2.0 * np.sin(ang * 7 + ph)), 0) ** 3
    rays = blur(rays / rays.max() * np.exp(-dist * 1.15) * np.clip(1.3 - dist, 0, 1), 3)
    sizes['rays'] = save(Image.fromarray(to8(np.concatenate([np.stack([np.full_like(rays, 0.95), np.full_like(rays, 1.0), np.full_like(rays, 0.9)], -1), np.clip(rays * 0.45, 0, 0.5)[..., None]], -1)), 'RGBA'), 'rays.webp', 80)
    for n in ('mid', 'near', 'front'): sizes[n] = save(Image.new('RGBA', (16, 9), (0, 0, 0, 0)), f'{n}.webp', 80)
    for f in os.listdir(OUT):       # drop the old reference-plate coral cut-outs
        if f.startswith('s-coral'): os.remove(os.path.join(OUT, f))
    fl = Image.fromarray(to8(flat)); fl.save(os.path.join(ROOT, 'wallpapers/ocean-kingdom.webp'), 'WEBP', quality=90, method=6)
    fl.resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/ocean-kingdom.webp'), 'WEBP', quality=82, method=6)
    p = os.path.join(ROOT, 'shared/worlds.js'); s = open(p).read(); b, e = '/*REF-OCEAN-BEGIN*/', '/*REF-OCEAN-END*/'
    i, j = s.index(b) + len(b), s.index(e)
    open(p, 'w').write(s[:i] + '\n  const REF_OCEAN = ' + json.dumps(sprites, separators=(',', ':')) + ';\n  ' + s[j:])
    print('ocean', {k: f'{v / 1024:.0f}KB' for k, v in sizes.items()})

if __name__ == '__main__':
    main()
