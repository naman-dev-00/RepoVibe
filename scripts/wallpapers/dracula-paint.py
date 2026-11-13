#!/usr/bin/env python3
"""Dracula (preset-6) as a layered gothic city, painted from scratch (original work; no external assets).

Layers (wallpapers/depth/gothic-castle/), 2560×1440, drawn at 2× and downsampled:
  far.webp    night sky, stars, a huge moon with maria and halo, two mountain ridges, the castle on its crag (keep, towers, curtain wall,
              arched bridge), lit windows
  mid.webp    two rows of the old town in atmospheric haze: steep gables, spires, a cathedral with twin spires and a rose window, a clock tower
  near.webp   the front row: larger, darker, detailed houses (timber framing, dormers, chimneys, shop lanterns), street lamps, iron fence
  front.webp  framing: a bare tree on the left, a gothic pinnacle with a gargoyle on the right
  rays.webp   moon bloom and lamp halos
  t-clouds / t-fog   seamless drifting moonlit clouds and low fog (FFT noise: periodic by construction)
  s-bat, s-lampGlow, s-moonHalo, s-winGlow, s-branch   moving / glowing objects
Also the flat wallpaper wallpapers/gothic-castle.webp.     python3 -I scripts/wallpapers/dracula-paint.py"""
import os, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/gothic-castle')
W, H, S = 2560, 1440, 2
SW, SH = W * S, H * S

def hexc(h, a=255): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def P(pts): return [(x * S, y * S) for x, y in pts]
def new(): return Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
def down(im): return im.resize((W, H), Image.LANCZOS)
def save(im, name, q=88):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')

def fft_noise(w, h, beta, seed):
    """periodic fractal noise in 0..1"""
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1
    spec = (r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta; spec[0, 0] = 0
    n = np.fft.ifft2(spec).real; n = (n - n.min()) / (n.max() - n.min())
    return n.astype(np.float32)

def ridge(n, seed, rough=0.55):
    r = np.random.default_rng(seed); x = np.linspace(0, 1, n); y = np.zeros(n)
    for o in range(1, 8): y += np.sin(x * math.pi * 2 * (o * 1.7 + r.random()) + r.random() * 6.28) * rough ** o
    return (y - y.min()) / (y.max() - y.min())

class Lights:
    """warm lights collected per layer, rendered once as a blurred additive glow plus crisp cores"""
    def __init__(self): self.l = []
    def add(self, x, y, r, col='#ffc56a', k=1.0): self.l.append((x, y, r, col, k))
    def render(self, blur=14, gain=0.9):
        g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
        for x, y, r, col, k in self.l: d.ellipse([x - r * 1.5, y - r * 1.5, x + r * 1.5, y + r * 1.5], fill=hexc(col, min(255, int(64 * k * gain))))
        return g.filter(ImageFilter.GaussianBlur(blur))

# ---------------------------------------------------------------- architecture
MOON = (0.33 * W, 0.3 * H, 205)        # x, y, radius
def lit_window(d, L, x, y, w, h, rng, p_lit, arch=True, glow=1.0, cols=('#ffc56a', '#ffb04a', '#ffd88a', '#ff9440')):
    lit = rng.random() < p_lit
    c = hexc(cols[rng.integers(len(cols))]) if lit else (8, 5, 16, 255)
    d.rectangle(P([(x, y + (w / 2 if arch else 0)), (x + w, y + h)]), fill=c)
    if arch: d.pieslice([x * S, y * S, (x + w) * S, (y + w) * S], 180, 360, fill=c)
    if lit:
        d.line(P([(x + w / 2, y), (x + w / 2, y + h)]), fill=(60, 30, 20, 200), width=max(1, int(S * 0.8)))   # mullion
        d.line(P([(x, y + h * 0.5), (x + w, y + h * 0.5)]), fill=(60, 30, 20, 200), width=max(1, int(S * 0.8)))
        L.add(x + w / 2, y + h / 2, max(w, h) * 0.9, '#ffb45a', glow)
    return lit

def roof_tiles(d, pts, col, hi, rows):
    """gable/cone polygon with a moon-side highlight edge and tile course lines"""
    d.polygon(P(pts), fill=col)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; top = min(ys); bot = max(ys); apex = pts[ys.index(top)]
    left = min(pts, key=lambda p: p[0])
    for i in range(1, rows):
        t = i / rows; y = top + (bot - top) * t
        xl = apex[0] + (min(xs) - apex[0]) * t; xr = apex[0] + (max(xs) - apex[0]) * t
        d.line(P([(xl, y), (xr, y)]), fill=mix(col, (0, 0, 0), 0.35), width=S)
    d.line(P([left, apex]), fill=hi, width=int(S * 2.2))

def house(d, L, rng, x, base, w, h, body, roof, hi, p_lit, detail=0, lantern=False):
    rh = w * rng.uniform(0.75, 1.25)
    d.rectangle(P([(x, base - h), (x + w, base)]), fill=body)
    d.rectangle(P([(x, base - h), (x + max(2, w * 0.035), base)]), fill=hi)                         # moonlit corner
    if detail >= 2:   # timber framing
        tc = mix(body, (0, 0, 0), 0.45)
        for fy in (0.33, 0.66): d.line(P([(x, base - h * fy), (x + w, base - h * fy)]), fill=tc, width=int(S * 2))
        for fx in (0.5,): d.line(P([(x + w * fx, base - h), (x + w * fx, base)]), fill=tc, width=int(S * 2))
        d.line(P([(x, base - h * 0.66), (x + w * 0.5, base - h)]), fill=tc, width=int(S * 2)); d.line(P([(x + w, base - h * 0.66), (x + w * 0.5, base - h)]), fill=tc, width=int(S * 2))
    # chimney (behind the roof)
    if rng.random() < 0.7:
        cx = x + w * rng.uniform(0.6, 0.82); cw = max(4, w * 0.09); ch = rh * rng.uniform(0.5, 0.8)
        d.rectangle(P([(cx, base - h - ch), (cx + cw, base - h)]), fill=mix(body, (0, 0, 0), 0.25)); d.rectangle(P([(cx - cw * 0.2, base - h - ch), (cx + cw * 1.2, base - h - ch + cw * 0.4)]), fill=hi)
    ov = w * 0.07
    roof_tiles(d, [(x - ov, base - h), (x + w / 2, base - h - rh), (x + w + ov, base - h)], roof, hi, max(4, int(rh / (7 if detail else 11))))
    # attic window
    aw = w * 0.13
    lit_window(d, L, x + w / 2 - aw / 2, base - h - rh * 0.42, aw, aw * 1.5, rng, p_lit * 0.7)
    floors = max(1, int(h / (w * 0.42))); cols = max(2, int(w / (26 if detail else 20)))
    ww = w / cols * 0.42; wh = h / floors * 0.52
    for f in range(floors):
        for c in range(cols):
            wx = x + w * (c + 0.5) / cols - ww / 2; wy = base - h + h * (f + 0.25) / floors
            if detail and f == floors - 1 and c == cols // 2:   # door
                d.rectangle(P([(wx - ww * 0.2, wy), (wx + ww * 1.2, base)]), fill=(10, 6, 16, 255)); d.pieslice([(wx - ww * 0.2) * S, (wy - ww * 0.7) * S, (wx + ww * 1.2) * S, (wy + ww * 0.7) * S], 180, 360, fill=(10, 6, 16, 255))
                if lantern: L.add(wx + ww * 1.7, wy + 2, 7, '#ffcf7a', 1.5); d.ellipse([(wx + ww * 1.5) * S, (wy - 3) * S, (wx + ww * 1.9) * S, (wy + 7) * S], fill=hexc('#ffe2a0'))
                continue
            lit_window(d, L, wx, wy, ww, wh, rng, p_lit)
            if detail >= 2: d.line(P([(wx - 2, wy + wh + 2), (wx + ww + 2, wy + wh + 2)]), fill=hi, width=S)    # sill
    if detail >= 2 and rng.random() < 0.6:   # dormer
        dx = x + w * rng.uniform(0.2, 0.34); dw = w * 0.16
        d.polygon(P([(dx - dw * 0.2, base - h - rh * 0.16), (dx + dw / 2, base - h - rh * 0.16 - dw), (dx + dw * 1.2, base - h - rh * 0.16)]), fill=mix(roof, (0, 0, 0), 0.2))
        lit_window(d, L, dx + dw * 0.2, base - h - rh * 0.16 - dw * 0.55, dw * 0.6, dw * 0.55, rng, p_lit, arch=False)

def spire(d, L, rng, x, base, w, h, body, roof, hi, p_lit, cren=False, clock=False, cone=1.6):
    d.rectangle(P([(x, base - h), (x + w, base)]), fill=body); d.rectangle(P([(x, base - h), (x + max(2, w * 0.06), base)]), fill=hi)
    if cren:
        n = max(3, int(w / 9)); cw = w / (n * 2 - 1)
        for i in range(n): d.rectangle(P([(x + i * 2 * cw, base - h - cw * 1.1), (x + i * 2 * cw + cw, base - h)]), fill=body)
    ch = w * cone * rng.uniform(0.9, 1.2)
    top = base - h - (w * 0.18 if cren else 0)
    roof_tiles(d, [(x - w * 0.12, top), (x + w / 2, top - ch), (x + w * 1.12, top)], roof, hi, max(5, int(ch / 9)))
    d.line(P([(x + w / 2, top - ch), (x + w / 2, top - ch - w * 0.35)]), fill=hi, width=S)                 # finial
    d.ellipse([(x + w / 2 - 2) * S, (top - ch - w * 0.35 - 2) * S, (x + w / 2 + 2) * S, (top - ch - w * 0.35 + 2) * S], fill=hi)
    ww = w * 0.2
    for i in range(max(1, int(h / (w * 0.9)))):
        lit_window(d, L, x + w / 2 - ww / 2, base - h + w * 0.3 + i * w * 0.9, ww, ww * 2.1, rng, p_lit)
    if clock:
        cy = base - h + w * 0.55; r = w * 0.34
        d.ellipse([(x + w / 2 - r) * S, (cy - r) * S, (x + w / 2 + r) * S, (cy + r) * S], fill=hexc('#ffe9b8'), outline=(40, 22, 30, 255), width=int(S * 2))
        for a in range(12):
            an = a * math.pi / 6; d.line(P([(x + w / 2 + math.cos(an) * r * 0.78, cy + math.sin(an) * r * 0.78), (x + w / 2 + math.cos(an) * r * 0.92, cy + math.sin(an) * r * 0.92)]), fill=(40, 22, 30, 255), width=S)
        d.line(P([(x + w / 2, cy), (x + w / 2 + r * 0.05, cy - r * 0.7)]), fill=(30, 16, 24, 255), width=int(S * 1.6)); d.line(P([(x + w / 2, cy), (x + w / 2 - r * 0.45, cy - r * 0.2)]), fill=(30, 16, 24, 255), width=int(S * 2))
        L.add(x + w / 2, cy, r * 1.3, '#ffdf9a', 1.3)

def cathedral(d, L, rng, x, base, w, h, body, roof, hi, p_lit):
    tw = w * 0.2
    d.rectangle(P([(x + tw * 0.6, base - h * 0.62), (x + w - tw * 0.6, base)]), fill=body)                 # nave
    roof_tiles(d, [(x + tw * 0.5, base - h * 0.62), (x + w / 2, base - h * 0.95), (x + w - tw * 0.5, base - h * 0.62)], roof, hi, 14)
    for sx in (x, x + w - tw): spire(d, L, rng, sx, base, tw, h, body, roof, hi, p_lit, cone=2.6)
    cx, cy, r = x + w / 2, base - h * 0.44, w * 0.11                                                      # rose window
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=hexc('#ff9a5a'), outline=(30, 16, 30, 255), width=int(S * 2))
    d.ellipse([(cx - r * 0.45) * S, (cy - r * 0.45) * S, (cx + r * 0.45) * S, (cy + r * 0.45) * S], fill=hexc('#c05cff'))
    for a in range(8):
        an = a * math.pi / 4; d.line(P([(cx, cy), (cx + math.cos(an) * r, cy + math.sin(an) * r)]), fill=(30, 16, 30, 255), width=int(S * 1.4))
    L.add(cx, cy, r * 1.5, '#ff9a6a', 1.4)
    ww = w * 0.07
    for i in range(3):                                                                                   # lancet windows + door
        lit_window(d, L, x + w * (0.3 + 0.165 * i), base - h * 0.27, ww, h * 0.2, rng, 0.9, cols=('#ffb86a', '#ff8a5a', '#d08cff'))
    for bx in (x + tw * 1.15, x + w - tw * 1.3):                                                         # buttress pinnacles
        d.polygon(P([(bx, base - h * 0.62), (bx + tw * 0.08, base - h * 0.78), (bx + tw * 0.16, base - h * 0.62)]), fill=body)

def town_row(layer, L, seed, base, scale, body, roof, hi, p_lit, detail, specials=()):
    rng = np.random.default_rng(seed); d = ImageDraw.Draw(layer); x = -40 * scale
    sp = {int(s[0] * W): s[1] for s in specials}; keys = sorted(sp)
    while x < W + 40:
        nxt = next((k for k in keys if x <= k < x + 150 * scale), None)
        if nxt is not None:
            kind = sp[nxt]; keys.remove(nxt)
            if kind == 'cathedral': w = 250 * scale; cathedral(d, L, rng, nxt, base, w, 330 * scale, body, roof, hi, p_lit)
            elif kind == 'clock': w = 62 * scale; spire(d, L, rng, nxt, base, w, 300 * scale, body, roof, hi, p_lit, cren=True, clock=True, cone=2.0)
            else: w = 46 * scale; spire(d, L, rng, nxt, base, w, 240 * scale * rng.uniform(0.85, 1.2), body, roof, hi, p_lit, cone=2.6)
            x = nxt + w + rng.uniform(-6, 6) * scale; continue
        t = rng.random()
        if t < 0.14:
            w = rng.uniform(26, 40) * scale; spire(d, L, rng, x, base, w, rng.uniform(120, 210) * scale, body, roof, hi, p_lit, cren=rng.random() < 0.4, cone=rng.uniform(1.7, 2.8))
        else:
            w = rng.uniform(62, 118) * scale; house(d, L, rng, x, base, w, rng.uniform(58, 135) * scale, mix(body, hi, rng.uniform(0, 0.12)), mix(roof, (60, 20, 50), rng.uniform(0, 0.25)), hi, p_lit, detail, lantern=detail >= 2)
        x += w + rng.uniform(-10, 4) * scale

# ---------------------------------------------------------------- layers
def far_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    top, midc, hor = np.array([8, 5, 22]), np.array([40, 20, 70]), np.array([122, 62, 118])
    t = np.clip(y / 0.62, 0, 1)
    sky = top[None, None, :] * (1 - t[..., None]) ** 1.6 + midc[None, None, :] * (1 - (1 - t[..., None]) ** 1.6) * (1 - t[..., None] ** 3) + hor[None, None, :] * t[..., None] ** 3
    sky = np.broadcast_to(sky, (H, W, 3)).copy()
    mx, my, mr = MOON
    dist = np.sqrt((x * W - mx) ** 2 + (y * H - my) ** 2)
    sky += (np.exp(-(dist / (mr * 2.6)) ** 2) * 70)[..., None] * np.array([1.0, 0.8, 1.0]) + (np.exp(-(dist / (mr * 6)) ** 2) * 34)[..., None] * np.array([0.9, 0.6, 1.0])
    # nebula-like high cloud veil
    n = fft_noise(W, H, 1.9, 4); sky += ((n - 0.5) * 36 * np.clip(1 - y * 1.4, 0, 1))[..., None] * np.array([0.8, 0.5, 1.0])
    img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(9)
    for _ in range(520):                                                                                  # stars
        sx, sy = r.random() * W, r.random() ** 1.5 * H * 0.6; b = r.random()
        if math.hypot(sx - mx, sy - my) < mr * 1.5: continue
        rad = 0.6 + b * 1.5; c = (255, 240 + int(15 * r.random()), 255, int(120 + 135 * b))
        d.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=c)
        if b > 0.93: d.line([(sx - 6, sy), (sx + 6, sy)], fill=(255, 255, 255, 150)); d.line([(sx, sy - 6), (sx, sy + 6)], fill=(255, 255, 255, 150))
    # moon: disc + maria + limb shading
    yy, xx = np.mgrid[0:int(mr * 2 + 8), 0:int(mr * 2 + 8)].astype(np.float32); cx = cy = mr + 4
    rr = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip((mr - rr) / 1.5, 0, 1)
    mn = fft_noise(int(mr * 2 + 8), int(mr * 2 + 8), 2.2, 12)
    shade = 1 - 0.16 * np.clip((mn - 0.5) * 4, 0, 1) - 0.12 * (rr / mr) ** 3
    col = np.stack([246 * shade, 232 * shade, 224 * shade + 8], -1)
    for (ox, oy, cr) in [(-0.3, -0.25, 0.2), (0.25, 0.1, 0.26), (-0.1, 0.42, 0.16), (0.42, -0.4, 0.12), (-0.5, 0.2, 0.1)]:
        m = np.exp(-(((xx - cx - ox * mr) ** 2 + (yy - cy - oy * mr) ** 2) / (cr * mr) ** 2) ** 2); col -= m[..., None] * np.array([34, 36, 26])
    moon = Image.fromarray(np.concatenate([np.clip(col, 0, 255), a[..., None] * 255], -1).astype(np.uint8), 'RGBA')
    img.alpha_composite(moon, (int(mx - cx), int(my - cy)))
    # ridges
    big = new(); bd = ImageDraw.Draw(big)
    for (seed, base, amp, c) in [(21, 0.56, 0.17, '#3a2258'), (22, 0.6, 0.13, '#2c1846')]:
        rl = ridge(260, seed); pts = [(i / 259 * W, (base - rl[i] * amp) * H) for i in range(260)]
        bd.polygon(P(pts + [(W, H), (0, H)]), fill=hexc(c))
    # the crag and castle (right of centre), silhouetted against the lighter sky
    L = Lights(); cb, cr_, chi = hexc('#170d2b'), hexc('#100820'), hexc('#5b3f86')
    crag = [(0.5, 0.64), (0.55, 0.56), (0.6, 0.5), (0.635, 0.455), (0.67, 0.44), (0.8, 0.44), (0.84, 0.47), (0.88, 0.53), (0.93, 0.58), (1.0, 0.61), (1.0, 1.0), (0.5, 1.0)]
    bd.polygon(P([(px * W, py * H) for px, py in crag]), fill=hexc('#1b1030'))
    rng = np.random.default_rng(31); base = 0.445 * H
    # curtain wall with crenellations
    bd.rectangle(P([(0.655 * W, base - 62), (0.815 * W, base + 6)]), fill=cb)
    for i in range(34): bd.rectangle(P([(0.655 * W + i * 12.2, base - 72), (0.655 * W + i * 12.2 + 7, base - 62)]), fill=cb)
    # arched bridge to the left ridge
    bx0, bx1, by = 0.52 * W, 0.66 * W, base + 2
    bd.rectangle(P([(bx0, by - 16), (bx1, by + 8)]), fill=cb)
    for i in range(6):
        ax = bx0 + (bx1 - bx0) * (i + 0.5) / 6; aw = (bx1 - bx0) / 6 * 0.72
        bd.rectangle(P([(ax - aw / 2 - 12, by), (ax - aw / 2 + 4, by + 150)]), fill=cb); bd.pieslice([(ax - aw / 2 + 2) * S, (by - 2) * S, (ax + aw / 2 + 12) * S, (by + 60) * S], 180, 270, fill=cb)
    bd.rectangle(P([(bx1 - 6, by), (bx1, by + 150)]), fill=cb)
    for i in range(12): bd.rectangle(P([(bx0 + i * 30, by - 22), (bx0 + i * 30 + 14, by - 14)]), fill=cb)
    # towers (x, w, h, cone)
    for (tx, tw, th, cone, cren) in [(0.655, 46, 170, 2.4, True), (0.685, 34, 250, 3.0, False), (0.708, 70, 215, 1.5, True), (0.74, 50, 395, 2.9, False), (0.768, 38, 300, 3.1, False),
                                     (0.79, 58, 200, 1.9, True), (0.812, 30, 140, 2.6, False), (0.726, 24, 315, 3.4, False), (0.672, 20, 205, 3.2, False)]:
        spire(bd, L, rng, tx * W, base, tw, th, cb, cr_, chi, 0.55, cren=cren, cone=cone)
    # keep
    bd.rectangle(P([(0.712 * W, base - 150), (0.795 * W, base)]), fill=cb)
    for i in range(7):
        for j in range(3): lit_window(bd, L, 0.72 * W + i * 28, base - 134 + j * 42, 9, 22, rng, 0.45)
    lit_window(bd, L, 0.7485 * W, base - 46, 22, 46, rng, 1.0)                                              # gate
    img.alpha_composite(down(big))
    img.alpha_composite(L.render(5, 0.6))
    # haze at the foot of the ridges
    hz = np.zeros((H, W, 4), np.float32); hz[..., :3] = np.array([110, 62, 120]); hz[..., 3] = np.clip(np.exp(-((y - 0.64) / 0.07) ** 2) * 120, 0, 255)
    img.alpha_composite(Image.fromarray(hz.astype(np.uint8), 'RGBA'))
    return img.convert('RGB')

def haze_band(layer, y0, y1, col, a):
    """fog pooled at the foot of a row (only where the layer already has paint above/behind is irrelevant: it is a soft translucent band)"""
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    al = np.clip((yy * H - y0) / (y1 - y0), 0, 1) ** 1.5 * a
    band = np.zeros((H, W, 4), np.float32); band[..., :3] = np.array(col); band[..., 3] = np.broadcast_to(al, (H, W))
    layer.alpha_composite(Image.fromarray(band.astype(np.uint8), 'RGBA'))

def mid_layer():
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for (seed, base, scale, body, roof, hi, p, fog) in [(41, 0.665 * H, 0.82, '#33204f', '#2a1842', '#7a5aa6', 0.34, 90), (42, 0.75 * H, 1.12, '#23143a', '#1b0f2e', '#6a4a96', 0.42, 70)]:
        big = new(); L = Lights()
        sp = [(0.1, 'spire'), (0.3, 'cathedral'), (0.86, 'spire')] if seed == 41 else [(0.045, 'clock'), (0.47, 'spire'), (0.93, 'spire'), (0.2, 'spire')]
        town_row(big, L, seed, base, scale, hexc(body), hexc(roof), hexc(hi), p, 1 if seed == 42 else 0, sp)
        ImageDraw.Draw(big).rectangle(P([(0, base), (W, H)]), fill=hexc(body))
        lay = down(big); lay.alpha_composite(L.render(7, 0.9))
        haze_band(lay, base - 70 * scale, base + 60, (96, 58, 120), fog)
        out.alpha_composite(lay)
    return out

LAMPS = [(0.035, 0.9), (0.105, 0.86), (0.895, 0.86), (0.965, 0.9), (0.3, 0.93), (0.5, 0.95), (0.7, 0.93)]   # x, lantern y (stage fractions): mirrored in shared/worlds.js
def near_layer():
    big = new(); L = Lights(); d = ImageDraw.Draw(big); base = 0.9 * H
    town_row(big, L, 43, base, 1.75, hexc('#150b25'), hexc('#0f081c'), hexc('#5a3d86'), 0.5, 2, [(0.13, 'spire'), (0.8, 'spire')])
    d.rectangle(P([(0, base), (W, H)]), fill=hexc('#0c0616'))
    # cobbles: rows of small arcs catching the moon
    rng = np.random.default_rng(7)
    for row in range(9):
        yy = base + 10 + row * 15; step = 26 + row * 3
        for cx in np.arange(-step * (row % 2) / 2, W, step):
            d.arc([cx * S, yy * S, (cx + step * 0.9) * S, (yy + 12) * S], 190, 350, fill=(70, 48, 104, 130 + row * 8), width=S)
    for (lx, ly) in LAMPS:                                                                                # street lamps
        x, yl = lx * W, ly * H; foot = H * 0.995
        d.rectangle(P([(x - 3, yl + 16), (x + 3, foot)]), fill=(6, 4, 12, 255)); d.rectangle(P([(x - 8, foot - 16), (x + 8, foot)]), fill=(6, 4, 12, 255))
        d.line(P([(x - 14, yl + 30), (x + 14, yl + 30)]), fill=(6, 4, 12, 255), width=int(S * 2.4))
        d.polygon(P([(x - 11, yl + 16), (x - 8, yl - 12), (x + 8, yl - 12), (x + 11, yl + 16)]), fill=hexc('#ffd88a'), outline=(6, 4, 12, 255), width=int(S * 2))
        d.polygon(P([(x - 13, yl - 12), (x, yl - 26), (x + 13, yl - 12)]), fill=(6, 4, 12, 255)); d.line(P([(x, yl - 26), (x, yl - 34)]), fill=(6, 4, 12, 255), width=S * 2)
        L.add(x, yl, 20, '#ffc56a', 1.7)
    # iron fence along the bottom
    for fx in np.arange(0, W, 17):
        d.line(P([(fx, H - 58), (fx, H)]), fill=(5, 3, 10, 255), width=int(S * 2)); d.polygon(P([(fx - 3.4, H - 58), (fx, H - 70), (fx + 3.4, H - 58)]), fill=(5, 3, 10, 255))
    d.line(P([(0, H - 48), (W, H - 48)]), fill=(5, 3, 10, 255), width=int(S * 3)); d.line(P([(0, H - 14), (W, H - 14)]), fill=(5, 3, 10, 255), width=int(S * 3))
    lay = down(big); lay.alpha_composite(L.render(8, 0.55))
    return lay

def branch(d, x, y, ang, ln, wd, rng, depth=0):
    if ln < 9 or depth > 9: return
    x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
    d.line(P([(x, y), (x2, y2)]), fill=(6, 3, 12, 255), width=max(S, int(wd * S)))
    n = 2 if rng.random() < 0.82 else 3
    for i in range(n):
        branch(d, x2, y2, ang + rng.uniform(-0.75, 0.75), ln * rng.uniform(0.62, 0.8), wd * 0.66, rng, depth + 1)

def front_layer():
    big = new(); d = ImageDraw.Draw(big); rng = np.random.default_rng(77)
    # bare tree, left edge
    d.polygon(P([(-10, H), (0, H * 0.3), (40, H * 0.52), (74, H), ]), fill=(6, 3, 12, 255))
    for (y0, a, l, w) in [(0.62, -0.5, 190, 13), (0.5, -0.85, 200, 12), (0.4, -0.35, 170, 10), (0.34, -1.1, 150, 9), (0.74, -0.2, 150, 10)]:
        branch(d, 24, H * y0, a, l, w, rng)
    # gothic pinnacle with a gargoyle, right edge
    x0 = W - 120
    d.rectangle(P([(x0 + 22, H * 0.46), (W + 4, H)]), fill=(6, 3, 12, 255))
    d.polygon(P([(x0 + 10, H * 0.46), (x0 + 72, H * 0.24), (W + 14, H * 0.46)]), fill=(6, 3, 12, 255))
    for i in range(7):   # crockets up the pinnacle
        t = i / 7; px = x0 + 10 + 62 * t; py = H * (0.46 - 0.22 * t); d.ellipse([(px - 9) * S, (py - 6) * S, (px + 3) * S, (py + 6) * S], fill=(6, 3, 12, 255))
    d.line(P([(x0 + 72, H * 0.24), (x0 + 72, H * 0.2)]), fill=(6, 3, 12, 255), width=S * 3); d.line(P([(x0 + 62, H * 0.215), (x0 + 82, H * 0.215)]), fill=(6, 3, 12, 255), width=S * 3)
    gy = H * 0.56                                                                                          # gargoyle crouched on a ledge, facing left
    d.rectangle(P([(x0 - 26, gy), (x0 + 30, gy + 16)]), fill=(6, 3, 12, 255))
    d.polygon(P([(x0 - 20, gy), (x0 - 30, gy - 34), (x0 - 52, gy - 44), (x0 - 44, gy - 58), (x0 - 22, gy - 62), (x0 - 8, gy - 84), (x0 + 2, gy - 60), (x0 + 22, gy - 96), (x0 + 30, gy - 40), (x0 + 30, gy)]), fill=(6, 3, 12, 255))
    d.polygon(P([(x0 - 40, gy - 58), (x0 - 46, gy - 76), (x0 - 32, gy - 62)]), fill=(6, 3, 12, 255))       # horn
    d.ellipse([(x0 - 42) * S, (gy - 54) * S, (x0 - 36) * S, (gy - 48) * S], fill=hexc('#ff5a4a'))             # ember eye
    lay = down(big)
    # moon rim on the silhouettes: a faint violet edge
    a = np.asarray(lay, np.float32)[..., 3] / 255
    rim = np.clip(a - np.roll(a, 3, axis=1), 0, 1) * 0.5
    arr = np.asarray(lay, np.float32).copy(); arr[..., :3] += rim[..., None] * np.array([120, 90, 170])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')

def rays_layer():
    y = np.arange(H, dtype=np.float32)[:, None]; x = np.arange(W, dtype=np.float32)[None, :]
    mx, my, mr = MOON; dist = np.sqrt((x - mx) ** 2 + (y - my) ** 2)
    a = np.exp(-(dist / (mr * 2.1)) ** 2) * 0.3 * np.clip((dist - mr * 0.9) / (mr * 0.4), 0, 1)
    rgb = np.broadcast_to(np.array([0.93, 0.82, 1.0]), (H, W, 3))
    return Image.fromarray((np.concatenate([rgb, a[..., None]], -1) * 255).astype(np.uint8), 'RGBA')

def cloud_tile():
    w, h = 2048, 1024
    n = fft_noise(w, h, 2.0, 51); n2 = fft_noise(w, h, 2.6, 52)
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    env = np.clip(np.sin(y * math.pi), 0, 1) ** 0.8                                    # fades at the tile's top and bottom (the plane only repeats horizontally in view)
    den = np.clip((n * 0.65 + n2 * 0.35 - 0.52) * 4.2, 0, 1) * env
    lit = np.clip((np.roll(den, 14, axis=0) - den) * 3 + 0.25, 0, 1)                  # moonlit upper edges
    col = np.array([30, 18, 52])[None, None] * (1 - lit[..., None]) + np.array([150, 112, 190])[None, None] * lit[..., None]
    return Image.fromarray(np.concatenate([col, (den * 215)[..., None]], -1).astype(np.uint8), 'RGBA')

def fog_tile():
    w, h = 2048, 1024
    n = fft_noise(w, h, 2.3, 61)
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    den = np.clip((n - 0.4) * 2.4, 0, 1) * np.clip(np.sin(y * math.pi), 0, 1) ** 0.7
    col = np.broadcast_to(np.array([150, 112, 176]), (h, w, 3))
    return Image.fromarray(np.concatenate([col, (den * 105)[..., None]], -1).astype(np.uint8), 'RGBA')

def bat():
    s = 4; im = Image.new('RGBA', (240 * s, 110 * s), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = (8, 4, 16, 255)
    def q(pts): return [(x * s, y * s) for x, y in pts]
    d.ellipse(q([(108, 40), (132, 78)]), fill=c)                                                           # body
    d.polygon(q([(111, 44), (108, 26), (118, 38)]), fill=c); d.polygon(q([(129, 44), (132, 26), (122, 38)]), fill=c)   # ears
    for sgn in (-1, 1):
        cx = 120
        pts = [(cx + sgn * 8, 46), (cx + sgn * 46, 14), (cx + sgn * 112, 30), (cx + sgn * 96, 50), (cx + sgn * 78, 46), (cx + sgn * 66, 68), (cx + sgn * 48, 56), (cx + sgn * 34, 80), (cx + sgn * 8, 66)]
        d.polygon(q(pts), fill=c)
    return im.resize((240, 110), Image.LANCZOS)

def glow_sprite(size, col, core=0.0):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32); r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    a = np.clip(np.exp(-(r / 0.42) ** 2) * 0.85 + core * np.exp(-(r / 0.12) ** 2), 0, 1) * np.clip((1 - r) * 4, 0, 1)
    rgb = np.broadcast_to(np.array(hexc(col)[:3], np.float32), (size, size, 3))
    return Image.fromarray(np.concatenate([rgb, (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def halo_sprite():
    size = 900; yy, xx = np.mgrid[0:size, 0:size].astype(np.float32); r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    a = (np.exp(-((r - 0.5) / 0.2) ** 2) * 0.34 + np.exp(-(r / 0.7) ** 2) * 0.16) * np.clip((1 - r) * 5, 0, 1) * np.clip((r - 0.4) / 0.08, 0, 1)
    rgb = np.broadcast_to(np.array([236, 208, 255], np.float32), (size, size, 3))
    return Image.fromarray(np.concatenate([rgb, (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def branch_sprite():
    w, h = 700, 420; im = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im); rng = np.random.default_rng(88)
    def br(x, y, ang, ln, wd, depth=0):
        if ln < 12 or depth > 8: return
        x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
        d.line([(x * 2, y * 2), (x2 * 2, y2 * 2)], fill=(6, 3, 12, 255), width=max(2, int(wd * 2)))
        for i in range(2 if rng.random() < 0.8 else 3): br(x2, y2, ang + rng.uniform(-0.6, 0.6), ln * rng.uniform(0.64, 0.8), wd * 0.68, depth + 1)
    br(w, h * 0.55, math.pi, 170, 15)                                                                       # grows leftwards from the right edge
    return im.resize((w, h), Image.LANCZOS)

def main():
    os.makedirs(OUT, exist_ok=True)
    far = far_layer(); save(far, 'far.webp', 90)
    mid = mid_layer(); save(mid, 'mid.webp', 90)
    near = near_layer(); save(near, 'near.webp', 90)
    front = front_layer(); save(front, 'front.webp')
    rays = rays_layer(); save(rays, 'rays.webp', 80)
    ct = cloud_tile(); save(ct, 't-clouds.webp', 82); ft = fog_tile(); save(ft, 't-fog.webp', 80)
    # soft vertical masks (stage-sized, 'cover'): the cloud plane fades out above the roofs, the fog plane fades in below the ridge line
    for name, y0, y1, inv in (('t-mask-sky', 0.4, 0.56, True), ('t-mask-low', 0.46, 0.66, False)):
        yy = np.linspace(0, 1, 360, dtype=np.float32)[:, None]; t = np.clip((yy - y0) / (y1 - y0), 0, 1); al = (1 - t) if inv else t
        m = np.zeros((360, 640, 4), np.float32); m[..., :3] = 255; m[..., 3] = np.broadcast_to(al * 255, (360, 640))
        save(Image.fromarray(m.astype(np.uint8), 'RGBA'), f'{name}.webp', 90)
    save(bat(), 's-bat.webp'); save(glow_sprite(256, '#ffc56a', 0.5), 's-lampGlow.webp'); save(halo_sprite(), 's-moonHalo.webp'); save(branch_sprite(), 's-branch.webp')
    flat = far.convert('RGBA')
    c2 = ct.resize((int(W * 0.9), int(W * 0.45)), Image.BILINEAR)
    for xx in range(0, W, c2.width): flat.alpha_composite(c2, (xx, -int(H * 0.08)))
    flat.alpha_composite(mid)
    f2 = ft.resize((W, W // 2), Image.BILINEAR); flat.alpha_composite(f2, (0, int(H * 0.5)))
    flat.alpha_composite(near); flat.alpha_composite(front); flat.alpha_composite(rays)
    p = os.path.join(ROOT, 'wallpapers/gothic-castle.webp'); flat.convert('RGB').save(p, 'WEBP', quality=86, method=6); print('flat', os.path.getsize(p) // 1024, 'KB')
    print('LAMPS', json.dumps(LAMPS))

if __name__ == '__main__':
    main()
