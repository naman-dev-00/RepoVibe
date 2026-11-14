#!/usr/bin/env python3
"""Cozy Coding (preset-4), second design: an anime-style autumn study in late-afternoon light. Painted from scratch (original work, no
external assets); the art direction follows the owner's reference (a dark-wood window full of backlit maple foliage, weathered plaster,
a framed map, a glossy desk that mirrors the window, a candle lantern, papers, a kettle) without copying it. The reference's seated
character is left out on purpose: an empty chair with a scarf and a steaming mug carry the presence instead.

Layers (wallpapers/depth/cozy-room/), 2560×1440:
  far.webp    outside: glowing sky, soft distant foliage, the maple's trunk and limbs, ~9000 individually drawn leaves
  mid.webp    a nearer bough hanging across the top of the window (transparent elsewhere)
  front.webp  the room, with real transparent panes: plaster wall, window frame and sill, map and frames, cabinet with a vase, the desk and
              its mirrored window light, laptop, notebook, papers, mug, lantern, kettle, chair and scarf
  t-leaves    seamless falling leaves (outside, behind the wall)          s-clumpA..C  leaf clusters that sway on the shared gust (outside)
  s-flame, s-candleGlow, s-beam, s-steam, s-leafPop                         candle, light through the window, mug steam, a drifting leaf
Also the flat wallpaper and its thumbnail.     python3 -I scripts/wallpapers/cozy-paint.py"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/cozy-room')
W, H, S = 2560, 1440, 2
# window geometry (stage px): two casements of 3 × 4 panes; the frame runs off the right edge
FX0, FY0, FY1 = 820, 36, 900                       # frame's outer left, top, bottom
CASE = [(866, 1640), (1700, 2474)]                 # casement glass extents in x
GY0, GY1 = 82, 856                                 # glass extent in y
COLS, ROWS, MULL = 3, 4, 16
DESK = 1000                                        # desk's back edge
LEAF_COLS = ['#8f2a0c', '#b83a10', '#d2501a', '#e8641a', '#ff7f1e', '#ff9a2a', '#ffb43a', '#ffd060']

def hexc(h, a=255): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def hexf(h): return np.array(hexc(h)[:3], np.float32)
def P(pts): return [(x * S, y * S) for x, y in pts]
def B(x0, y0, x1, y1): return [x0 * S, y0 * S, x1 * S, y1 * S]
def new(w=W, h=H): return Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
def down(im, w=W, h=H): return im.resize((w, h), Image.LANCZOS)
def save(im, name, q=92):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')
def fft_noise(w, h, beta, seed, stretch=1.0):
    r = np.random.default_rng(seed); fy = np.fft.fftfreq(h)[:, None] * stretch; fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2); f[0, 0] = 1
    spec = (r.normal(size=(h, w)) + 1j * r.normal(size=(h, w))) / f ** beta; spec[0, 0] = 0
    n = np.fft.ifft2(spec).real; return ((n - n.min()) / (n.max() - n.min())).astype(np.float32)
def panes():
    out = []
    for (x0, x1) in CASE:
        pw = (x1 - x0 - MULL * (COLS - 1)) / COLS; ph = (GY1 - GY0 - MULL * (ROWS - 1)) / ROWS
        for c in range(COLS):
            for r in range(ROWS): out.append((x0 + c * (pw + MULL), GY0 + r * (ph + MULL), x0 + c * (pw + MULL) + pw, GY0 + r * (ph + MULL) + ph))
    return out

# ---------------------------------------------------------------- leaves
def leaf_pts(cx, cy, size, rot):
    """a small maple leaf: five pointed lobes and a stem"""
    pts = []
    for i in range(11):
        a = rot + math.radians(-210 + i * 24); r = size * (1.0 if i % 2 == 0 else 0.46) * (0.82 if i in (0, 10) else 1)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    a = rot + math.radians(90); pts += [(cx + math.cos(a) * size * 0.25, cy + math.sin(a) * size * 0.25), (cx + math.cos(a) * size * 0.8, cy + math.sin(a) * size * 0.8), (cx + math.cos(a) * size * 0.25 + 1, cy + math.sin(a) * size * 0.25)]
    return pts
def draw_leaves(d, spots, r, smin, smax, bright, sc=S, alpha=255):
    """spots: (x, y, spread, count). Each leaf takes its own tone from the palette."""
    items = []
    for (x, y, spread, n) in spots:
        for _ in range(n):
            t = r.random(); items.append((t, x + r.normal() * spread, y + r.normal() * spread * 0.8, r.uniform(smin, smax), r.random() * 6.283))
    order = r.permutation(len(items)); items = [items[i] for i in order]   # mixed order: light and dark leaves interleave, so a dense canopy keeps its texture
    for t, x, y, sz, rot in items:
        ci = min(len(LEAF_COLS) - 1, int((t ** (1.0 / bright)) * len(LEAF_COLS)))
        d.polygon([(px * sc, py * sc) for px, py in leaf_pts(x, y, sz, rot)], fill=hexc(LEAF_COLS[ci], alpha))
def limb(d, x, y, ang, ln, wd, r, nodes, depth=0, col=(52, 28, 18, 255)):
    if ln < 16 or depth > 9: return
    x2, y2 = x + math.cos(ang) * ln, y + math.sin(ang) * ln
    d.line(P([(x, y), (x2, y2)]), fill=col, width=max(S, int(wd * S)))
    if depth >= 2: nodes.append((x2, y2, depth))
    for _ in range(2 if r.random() < 0.78 else 3): limb(d, x2, y2, ang + r.uniform(-0.6, 0.6), ln * r.uniform(0.66, 0.84), wd * 0.68, r, nodes, depth + 1, col)

def far_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    sky = hexf('#fff3d0') * (1 - y) + hexf('#ffc27a') * y
    sky = sky + (np.exp(-(((x - 0.72) / 0.3) ** 2 + ((y - 0.22) / 0.3) ** 2)) * 50)                    # the low sun behind the tree
    n1 = fft_noise(W, H, 2.4, 3)[..., None]; n2 = fft_noise(W, H, 2.0, 4)[..., None]
    far_fol = np.clip((n1 - 0.36) * 4.2, 0, 1)                                                        # distant, out-of-focus foliage masses fill most of the view
    sky = sky * (1 - far_fol * 0.92) + (hexf('#ffb040') * (1 - n2) + hexf('#e0541a') * n2) * far_fol * 0.92
    img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    big = new(); d = ImageDraw.Draw(big); r = np.random.default_rng(11); nodes = []
    # the maple: trunk at the right, leaning in; heavy limbs reaching left across the window
    d.polygon(P([(2230, 960), (2270, 620), (2300, 300), (2330, 60), (2440, 40), (2452, 320), (2440, 640), (2470, 960)]), fill=(58, 31, 20, 255))
    for (bx, by, ang, ln, wd) in [(2300, 420, -2.7, 330, 40), (2310, 260, -2.2, 300, 34), (2290, 600, 3.3, 360, 38), (2360, 120, -1.2, 200, 30), (2300, 760, 3.0, 300, 28), (2420, 300, -0.5, 200, 26)]:
        limb(d, bx, by, ang, ln, wd, r, nodes)
    # a second, farther tree at the left of the view
    limb(d, 1010, 980, -1.45, 300, 30, r, nodes, col=(96, 52, 30, 255)); limb(d, 1380, 1000, -1.7, 240, 22, r, nodes, col=(110, 60, 34, 255))
    lay = down(big)
    bark = fft_noise(W, H, 1.3, 5, 0.25); arr = np.asarray(lay, np.float32).copy(); arr[..., :3] *= (0.7 + 0.6 * bark)[..., None]      # bark: vertical grain
    lay = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA'); img.alpha_composite(lay)
    # foliage: clusters at the twig ends, plus fill
    big = new(); d = ImageDraw.Draw(big)
    # a middle-distance canopy first (smaller, slightly darker leaves), then the near leaves at the twig ends
    back = [(r.uniform(780, 2600), r.uniform(-20, 940), 64, 22) for _ in range(34)]
    draw_leaves(d, back, r, 7, 14, 0.8)
    spots = [(nx, ny, 22 + 5 * (9 - dp), 5) for nx, ny, dp in nodes if 760 < nx < 2600 and -60 < ny < 1000]
    spots += [(r.uniform(820, 2560), r.uniform(0, 900), 60, 22) for _ in range(34)]
    draw_leaves(d, spots, r, 10, 23, 1.2)
    lay = down(big); img.alpha_composite(lay)
    # back-light: the sky blooms through the gaps
    glow = img.filter(ImageFilter.GaussianBlur(26)); a = np.asarray(img, np.float32); g = np.asarray(glow, np.float32)
    out = 255 - (255 - a[..., :3]) * (255 - g[..., :3] * 0.34) / 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')

def mid_layer():
    big = new(); d = ImageDraw.Draw(big); r = np.random.default_rng(21); nodes = []
    limb(d, 760, 20, 0.22, 330, 20, r, nodes, col=(40, 22, 14, 255)); limb(d, 1500, -30, 0.9, 260, 16, r, nodes, col=(40, 22, 14, 255))
    spots = [(nx, ny, 36, 9) for nx, ny, dp in nodes if ny < 560]
    draw_leaves(d, spots, r, 15, 30, 0.95)
    return down(big)

# ---------------------------------------------------------------- the room
def code_lines(d, x0, y0, x1, y1, r, lh=13):
    pal = ['#ffb86a', '#ff8f6a', '#ffe0a0', '#c8a8ff', '#9ad8b8', '#f4ead8']; yv = y0; ind = 0
    while yv < y1 - lh:
        if r.random() < 0.14: yv += lh; continue
        ind = int(np.clip(ind + r.integers(-1, 2), 0, 4)); xv = x0 + ind * 16
        for _ in range(r.integers(1, 5)):
            wl = r.uniform(14, 80)
            if xv + wl > x1: break
            d.rounded_rectangle(B(xv, yv, xv + wl, yv + 5), radius=2 * S, fill=hexc(pal[r.integers(len(pal))], 235)); xv += wl + 7
        yv += lh

def text_lines(d, quad, r, n, col=(86, 62, 44, 200)):
    """handwriting-like rows on a page given as (top-left, top-right, bottom-right, bottom-left)"""
    (ax, ay), (bx, by), (cx, cy), (dx_, dy_) = quad
    for i in range(n):
        t = (i + 1.2) / (n + 1.6); lx, ly = ax + (dx_ - ax) * t, ay + (dy_ - ay) * t; rx, ry = bx + (cx - bx) * t, by + (cy - by) * t
        u0, u1 = 0.08, 0.92 - 0.3 * (r.random() < 0.25) * r.random()
        d.line(P([(lx + (rx - lx) * u0, ly + (ry - ly) * u0), (lx + (rx - lx) * u1, ly + (ry - ly) * u1)]), fill=col, width=S)

def front_layer(far_img):
    big = new(); d = ImageDraw.Draw(big); r = np.random.default_rng(31)
    wood, wood_hi, wood_dk = hexc('#3a2114'), hexc('#6a3c20'), hexc('#1e100a')
    # --- wall
    d.rectangle(B(0, 0, W, H), fill=hexc('#7c7464'))
    # --- map (large, left), small frames, pinned note
    d.rectangle(B(70, 120, 560, 660), fill=wood_dk); d.rectangle(B(92, 142, 538, 638), fill=hexc('#c9a35c'))
    for _ in range(30):                                                                                   # roads and rivers
        px, py = r.uniform(100, 530), r.uniform(150, 630); pts = [(px, py)]; a = r.random() * 6.28
        for _s in range(int(r.integers(4, 12))): a += r.uniform(-0.7, 0.7); px += math.cos(a) * 34; py += math.sin(a) * 34; pts.append((min(532, max(98, px)), min(632, max(148, py))))
        d.line(P(pts), fill=(120, 84, 40, 150), width=S)
    for (cx, cy, rr, c) in [(250, 330, 44, '#d8582a'), (300, 300, 22, '#e8782a'), (220, 370, 18, '#c84a22'), (330, 520, 56, '#7f9a94'), (300, 560, 30, '#8aa6a0'), (430, 240, 30, '#b8924a')]:
        d.ellipse(B(cx - rr, cy - rr * 0.8, cx + rr, cy + rr * 0.8), fill=hexc(c, 210))
    for a in range(10): an = a * 0.628; d.line(P([(250, 330), (250 + math.cos(an) * 70, 330 + math.sin(an) * 56)]), fill=hexc('#c0461e', 200), width=S * 2)
    for (x0, y0) in [(630, 300), (630, 470)]:
        d.rectangle(B(x0, y0, x0 + 116, y0 + 128), fill=wood_dk); d.rectangle(B(x0 + 12, y0 + 12, x0 + 104, y0 + 116), fill=hexc('#cdb48a'))
        for i in range(6): d.line(P([(x0 + 26, y0 + 30 + i * 13), (x0 + 90 - (i % 3) * 14, y0 + 30 + i * 13)]), fill=(84, 60, 40, 220), width=S)
    d.polygon(P([(640, 640), (738, 636), (742, 760), (644, 764)]), fill=hexc('#d8c8a0')); text_lines(d, [(640, 640), (738, 636), (742, 760), (644, 764)], r, 8); d.ellipse(B(686, 640, 696, 650), fill=hexc('#b8402a'))
    # --- window frame (panes are punched out afterwards), sill, apron
    d.rectangle(B(FX0, FY0, W + 20, FY1), fill=wood)
    for (x0, x1) in CASE: d.rectangle(B(x0 - 10, GY0 - 10, x1 + 10, GY1 + 10), outline=wood_dk, width=S * 5)
    d.rectangle(B(FX0 - 26, FY1, W + 20, FY1 + 44), fill=wood_hi); d.rectangle(B(FX0 - 26, FY1 + 30, W + 20, FY1 + 44), fill=wood_dk)
    d.rectangle(B(FX0, FY1 + 44, W + 20, DESK + 4), fill=hexc('#3c382f'))                                  # wall under the sill, in shadow
    # latch on the central post
    d.rounded_rectangle(B(1660, 440, 1680, 520), radius=5 * S, fill=hexc('#15100c')); d.ellipse(B(1654, 470, 1686, 496), fill=hexc('#2a2018'))
    # --- cabinet with vase, sprig and books (left, behind the chair)
    d.rectangle(B(-10, 800, 420, DESK + 20), fill=hexc('#3b2316')); d.rectangle(B(-10, 786, 440, 806), fill=hexc('#5a3620')); d.rectangle(B(20, 840, 380, 990), outline=wood_dk, width=S * 4)
    d.polygon(P([(96, 786), (84, 742), (100, 706), (140, 706), (156, 742), (144, 786)]), fill=hexc('#221a16'))
    for i, (a, ln) in enumerate([(-1.9, 150), (-1.5, 190), (-1.15, 160), (-2.3, 120), (-0.8, 120)]):
        px, py = 120, 706
        for sgm in range(6):
            nx, ny = px + math.cos(a) * ln / 6, py + math.sin(a) * ln / 6; d.line(P([(px, py), (nx, ny)]), fill=hexc('#243a26'), width=S * 3)
            d.ellipse(B(nx - 13, ny - 7, nx + 13, ny + 7), fill=hexc(['#2f5a36', '#3f7a44', '#27482c'][(i + sgm) % 3])); px, py = nx, ny; a += 0.07 * (i - 2)
    for i, (c, wd) in enumerate([('#5a2e22', 150), ('#2e3a34', 132), ('#6a4a2a', 140)]): d.rectangle(B(220, 786 - (i + 1) * 26, 220 + wd, 786 - i * 26), fill=hexc(c), outline=wood_dk, width=S * 2)
    # --- desk
    d.rectangle(B(-10, DESK, W + 10, H + 10), fill=hexc('#4a2212')); d.rectangle(B(-10, DESK, W + 10, DESK + 10), fill=hexc('#7a4426'))
    lay = down(big)
    arr = np.asarray(lay, np.float32).copy(); yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]; xx = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    # plaster: mottling, stains, darker toward the corner; wood grain on the desk
    wall = (np.arange(H)[:, None] < DESK) & (np.arange(W)[None, :] < FX0 - 26) | ((np.arange(H)[:, None] < FY0) & np.ones((1, W), bool))
    pl = fft_noise(W, H, 1.7, 41); st = np.clip((fft_noise(W, H, 2.6, 42) - 0.56) * 5, 0, 1); fine = fft_noise(W, H, 0.9, 43)
    wm = wall[..., None]
    arr[..., :3] = np.where(wm, arr[..., :3] * (0.72 + 0.4 * pl[..., None] + 0.12 * (fine[..., None] - 0.5)) * (1 - 0.38 * st[..., None]) * (0.62 + 0.5 * xx[..., None] / 0.32).clip(0.5, 1.12), arr[..., :3])
    grain = fft_noise(W, H, 1.6, 44, 14.0); dk = (np.arange(H)[:, None] >= DESK) & np.ones((1, W), bool)
    depth = np.clip((yy - DESK / H) / (1 - DESK / H), 0, 1)
    arr[..., :3] = np.where(dk[..., None], arr[..., :3] * (0.74 + 0.5 * grain[..., None]) * (1.05 - 0.5 * depth[..., None]), arr[..., :3])
    # the window mirrored in the polished desk: each pane lands as a bright patch, broken by leaf shadow
    refl = Image.new('L', (W * S, H * S), 0); rd = ImageDraw.Draw(refl); cxm = 1670
    for (x0, y0, x1, y1) in panes():
        def m(px, py):
            t = (GY1 - py) / (GY1 - GY0); yv = DESK + 14 + t * 400; sc = 1 + t * 0.34; return ((cxm + (px - cxm) * sc - t * 120) * S, yv * S)
        rd.polygon([m(x0, y1), m(x1, y1), m(x1, y0), m(x0, y0)], fill=255)
    rm = np.asarray(refl.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
    shadow = np.clip((fft_noise(W, H, 1.9, 45) - 0.42) * 3.2, 0, 1)                                       # dappled leaf shadow
    rm = rm * (0.3 + 0.7 * shadow) * (1 - 0.55 * depth)
    arr[..., :3] += rm[..., None] * (hexf('#ffb04a') * (1 - shadow[..., None]) + hexf('#fff0c4') * shadow[..., None]) * 0.95
    lay = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
    # --- things on the desk (drawn over the reflection), each with a soft contact shadow toward the viewer
    big = new(); d = ImageDraw.Draw(big); sh = new(); sd = ImageDraw.Draw(sh)
    def shadow_at(cx, cy, rw, rh, a=130): sd.ellipse(B(cx - rw, cy - rh, cx + rw, cy + rh), fill=(14, 6, 4, a))
    # laptop (left of centre)
    shadow_at(800, 1150, 300, 26)
    d.polygon(P([(560, 1130), (600, 1076), (1010, 1076), (1058, 1130)]), fill=hexc('#2a2622')); d.polygon(P([(604, 1082), (1004, 1082), (1034, 1120), (580, 1120)]), fill=hexc('#3a3530'))
    for kr in range(4):
        for kc in range(22): d.rectangle(B(612 + kr * -6 + kc * (17.6 + kr * 0.6), 1086 + kr * 8.4, 625 + kr * -6 + kc * (17.6 + kr * 0.6), 1091 + kr * 8.4), fill=hexc('#1a1714'))
    d.polygon(P([(594, 1076), (606, 810), (1002, 810), (1014, 1076)]), fill=hexc('#221e1b')); d.polygon(P([(612, 1058), (621, 826), (987, 826), (996, 1058)]), fill=hexc('#171a26'))
    code_lines(d, 636, 846, 976, 1048, r); d.polygon(P([(880, 826), (987, 826), (992, 960)]), fill=(255, 190, 110, 26))
    # open notebook
    shadow_at(1340, 1262, 250, 22)
    pl_ = [(1130, 1178), (1338, 1166), (1352, 1262), (1118, 1280)]; pr_ = [(1338, 1166), (1548, 1172), (1586, 1270), (1352, 1262)]
    d.polygon(P(pl_), fill=hexc('#f0dcae')); d.polygon(P(pr_), fill=hexc('#fbe9bc')); d.line(P([(1338, 1166), (1352, 1262)]), fill=(120, 84, 50, 255), width=S * 3)
    text_lines(d, pl_, r, 9); text_lines(d, pr_, r, 9)
    d.line(P([(1420, 1290), (1560, 1250)]), fill=hexc('#2a1a12'), width=S * 5); d.line(P([(1548, 1254), (1562, 1250)]), fill=hexc('#e8b04a'), width=S * 5)   # pen
    # loose papers, bottom left
    shadow_at(700, 1400, 380, 30, 110)
    for q in ([(330, 1300), (760, 1270), (830, 1400), (360, 1436)], [(640, 1330), (1060, 1300), (1110, 1410), (700, 1440)]):
        d.polygon(P(q), fill=hexc('#ead4a2')); text_lines(d, q, r, 10)
    # mug
    shadow_at(1690, 1224, 70, 14)
    d.rounded_rectangle(B(1650, 1140, 1730, 1226), radius=10 * S, fill=hexc('#e8d6b0')); d.arc(B(1716, 1158, 1766, 1212), 270, 90, fill=hexc('#e8d6b0'), width=S * 9)
    d.ellipse(B(1652, 1132, 1728, 1150), fill=hexc('#4a2a1a')); d.rectangle(B(1654, 1150, 1664, 1216), fill=hexc('#fff3d6'))
    # candle lantern
    lx, lb = 1960, 1300
    shadow_at(lx, lb + 4, 120, 20, 150)
    d.polygon(P([(lx - 86, lb), (lx - 70, lb - 26), (lx + 70, lb - 26), (lx + 86, lb)]), fill=hexc('#17120f'))
    d.rectangle(B(lx - 62, lb - 220, lx + 62, lb - 26), fill=(255, 168, 70, 84))                             # glass
    d.rectangle(B(lx - 16, lb - 96, lx + 16, lb - 28), fill=hexc('#fff0cc')); d.ellipse(B(lx - 16, lb - 102, lx + 16, lb - 90), fill=hexc('#ffe2a0'))
    for px in (lx - 66, lx - 2, lx + 58): d.rectangle(B(px, lb - 224, px + 8, lb - 24), fill=hexc('#17120f'))
    d.rectangle(B(lx - 70, lb - 132, lx + 70, lb - 124), fill=hexc('#17120f'))
    d.polygon(P([(lx - 80, lb - 220), (lx - 44, lb - 262), (lx + 44, lb - 262), (lx + 80, lb - 220)]), fill=hexc('#17120f')); d.rectangle(B(lx - 26, lb - 276, lx + 26, lb - 260), fill=hexc('#17120f'))
    d.arc(B(lx - 34, lb - 330, lx + 34, lb - 262), 180, 360, fill=hexc('#17120f'), width=S * 6)
    # kettle (right)
    kx, kb = 2400, 1210
    shadow_at(kx, kb + 2, 120, 18)
    d.polygon(P([(kx - 82, kb), (kx - 66, kb - 150), (kx + 66, kb - 150), (kx + 82, kb)]), fill=hexc('#2a2420')); d.ellipse(B(kx - 68, kb - 166, kx + 68, kb - 134), fill=hexc('#3a322c'))
    d.polygon(P([(kx - 74, kb - 96), (kx - 150, kb - 150), (kx - 138, kb - 164), (kx - 70, kb - 124)]), fill=hexc('#2a2420')); d.arc(B(kx - 10, kb - 190, kx + 130, kb - 40), 280, 80, fill=hexc('#2a2420'), width=S * 9)
    d.rectangle(B(kx - 16, kb - 182, kx + 16, kb - 164), fill=hexc('#1a1512')); d.line(P([(kx + 62, kb - 146), (kx + 78, kb - 8)]), fill=hexc('#ffb060'), width=S * 3)   # rim light
    # chair back and scarf (bottom left)
    for sx in (90, 180, 270, 360): d.rectangle(B(sx, 1080, sx + 34, 1440), fill=hexc('#4a2816'))
    d.rounded_rectangle(B(40, 1030, 470, 1096), radius=26 * S, fill=hexc('#5c321c')); d.line(P([(60, 1040), (450, 1040)]), fill=hexc('#ffa860'), width=S * 3)
    # a wool scarf draped over the chair's corner: two soft folds, a plaid band pattern, a fringe
    for (pts, c) in (([(250, 1024), (420, 1018), (474, 1050), (486, 1240), (470, 1410), (398, 1410), (410, 1240), (392, 1100), (270, 1070)], '#6e5a48'), ([(392, 1100), (410, 1240), (398, 1410), (360, 1410), (366, 1250), (350, 1120)], '#54463a')):
        d.polygon(P(pts), fill=hexc(c))
    for i in range(6): yv = 1090 + i * 54; d.line(P([(396, yv), (482, yv + 8)]), fill=(196, 150, 96, 150), width=S * 5); d.line(P([(396, yv + 12), (482, yv + 20)]), fill=(48, 34, 26, 130), width=S * 2)
    for i in range(3): xv = 420 + i * 24; d.line(P([(xv, 1050), (xv + 6, 1408)]), fill=(48, 34, 26, 110), width=S * 2)
    for i in range(12): d.line(P([(362 + i * 9, 1408), (360 + i * 9, 1436)]), fill=hexc('#6e5a48'), width=S * 2)
    d.line(P([(252, 1026), (420, 1020), (474, 1052)]), fill=hexc('#ffb878', 200), width=S * 2)
    lay.alpha_composite(down(sh).filter(ImageFilter.GaussianBlur(9))); lay.alpha_composite(down(big))
    # --- punch the panes; rim light on the frame edges that face the glass
    arr = np.asarray(lay, np.float32).copy(); hole = Image.new('L', (W * S, H * S), 0); hd = ImageDraw.Draw(hole)
    for (x0, y0, x1, y1) in panes(): hd.rectangle(B(x0, y0, x1, y1), fill=255)
    hm = np.asarray(hole.resize((W, H), Image.LANCZOS), np.float32) / 255
    edge = np.clip(np.asarray(Image.fromarray((hm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), np.float32) / 255 * 2.2 - hm * 2.2, 0, 1) * (1 - hm)
    arr[..., :3] += edge[..., None] * hexf('#ffa040') * 0.95
    # light spilling into the room: a broad warm bloom around the window, strongest on the wall beside it and on the sill
    spill = np.asarray(Image.fromarray((hm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(90)), np.float32) / 255
    arr[..., :3] += (spill ** 1.4)[..., None] * hexf('#ff9a3c') * 0.5
    beam = np.clip(1 - np.abs((xx * W - 820 + (yy * H - 200) * 0.9) / 260), 0, 1) * np.clip((yy * H - 120) / 500, 0, 1) * np.clip((DESK - yy * H) / 300, 0, 1) * (xx * W < 820)
    arr[..., :3] += beam[..., None] * hexf('#ffb060') * 0.26                                              # late sun raking across the plaster
    vig = 1 - 0.5 * np.clip(((xx - 0.6) / 0.8) ** 2 + ((yy - 0.42) / 0.75) ** 2, 0, 1)
    arr[..., :3] *= vig[..., None]
    arr[..., 3] = 255 * (1 - hm)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------- moving parts
def clump(seed, w=520, h=440):
    big = new(w, h); d = ImageDraw.Draw(big); r = np.random.default_rng(seed); nodes = []
    limb(d, w * 0.5, h * 0.98, -1.57 + r.uniform(-0.2, 0.2), h * 0.26, 7, r, nodes, col=(46, 24, 15, 255))
    draw_leaves(d, [(nx, ny, 26, 12) for nx, ny, dp in nodes], r, 11, 22, 1.4)
    return down(big, w, h)
def leaves_tile():
    w, h = 600, 1200; big = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0)); d = ImageDraw.Draw(big); r = np.random.default_rng(61)
    for _ in range(13):
        x, y, sz, rot = r.uniform(40, w - 40), r.uniform(40, h - 40), r.uniform(11, 22), r.random() * 6.283     # kept clear of the edges: the tile repeats seamlessly
        d.polygon([(px * S, py * S) for px, py in leaf_pts(x, y, sz, rot)], fill=hexc(LEAF_COLS[int(r.integers(2, len(LEAF_COLS)))], 240))
    return big.resize((w, h), Image.LANCZOS)
def radial(size, col, sharp=0.42, peak=0.8, sy=1.0):
    yy, xx = np.mgrid[0:int(size * sy), 0:size].astype(np.float32); rr = np.sqrt(((xx - size / 2) / (size / 2)) ** 2 + ((yy - size * sy / 2) / (size * sy / 2)) ** 2)
    a = np.exp(-(rr / sharp) ** 2) * peak * np.clip((1 - rr) * 4, 0, 1)
    return Image.fromarray(np.concatenate([np.broadcast_to(hexf(col), a.shape + (3,)), (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')
def flame():
    w, h = 60, 120; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); t = yy / h
    half = (w * 0.34) * np.sin(np.clip(t, 0, 1) * math.pi) ** 0.8 * (0.35 + 0.65 * t)
    a = np.clip((half - np.abs(xx - w / 2)) / 3, 0, 1) * np.clip(t * 8, 0, 1)
    col = hexf('#fff6d8') * t[..., None] ** 0.6 + hexf('#ff9a2a') * (1 - t[..., None] ** 0.6)
    return Image.fromarray(np.concatenate([col, (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')
def beam():
    w, h = 1200, 800; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); u = (xx / w) + (yy / h) * 0.9
    shafts = (0.5 + 0.5 * np.sin(u * 26)) ** 3 * np.clip(np.sin(np.clip(u - 0.25, 0, 1) * math.pi), 0, 1)
    a = shafts * 0.2 * np.clip(np.minimum(np.minimum(xx, w - xx) / 120, np.minimum(yy, h - yy) / 120), 0, 1)
    return Image.fromarray(np.concatenate([np.broadcast_to(hexf('#ffc27a'), (h, w, 3)), (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(5))
def steam():
    w, h = 160, 300; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); t = 1 - yy / h; a = np.zeros((h, w), np.float32)
    for ph, wd, k in ((0.0, 9, 0.6), (2.0, 7, 0.42)):
        cx = w / 2 + np.sin(t * 6.5 + ph) * 24 * t; a += np.exp(-((xx - cx) / (wd + 15 * t)) ** 2) * np.clip(np.sin(t * math.pi), 0, 1) ** 1.2 * k
    return Image.fromarray(np.concatenate([np.broadcast_to(hexf('#fff0dc'), (h, w, 3)), (np.clip(a, 0, 0.8) * 255)[..., None]], -1).astype(np.uint8), 'RGBA')
def leaf_pop():
    s = 300; big = Image.new('RGBA', (s * S, s * S), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    d.polygon([(px * S, py * S) for px, py in leaf_pts(150, 140, 120, 0.3)], fill=hexc('#e8641a')); d.polygon([(px * S, py * S) for px, py in leaf_pts(150, 140, 76, 0.3)], fill=hexc('#ff9a2a'))
    for i in range(5): a = 0.3 + math.radians(-210 + i * 48); d.line([(150 * S, 150 * S), ((150 + math.cos(a) * 104) * S, (140 + math.sin(a) * 104) * S)], fill=hexc('#b83a10'), width=S * 2)
    return big.resize((s, s), Image.LANCZOS)

def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))          # the first design's files are replaced wholesale
    far = far_layer(); save(far, 'far.webp', 93)
    mid = mid_layer(); save(mid, 'mid.webp', 93)
    front = front_layer(far); save(front, 'front.webp', 93)
    tile = leaves_tile(); save(tile, 't-leaves.webp')
    for i, nm in enumerate('ABC'): save(clump(70 + i), f's-clump{nm}.webp')
    save(flame(), 's-flame.webp'); save(radial(520, '#ffb04a', 0.45, 0.7), 's-candleGlow.webp'); save(beam(), 's-beam.webp'); save(steam(), 's-steam.webp'); save(leaf_pop(), 's-leafPop.webp')
    flat = far.convert('RGBA'); flat.alpha_composite(mid)
    flat.alpha_composite(front); flat.alpha_composite(radial(520, '#ffb04a', 0.45, 0.7), (1960 - 260, 1190 - 260)); fl = flame().resize((36, 72)); flat.alpha_composite(fl, (1960 - 18, 1300 - 102 - 66))
    p = os.path.join(ROOT, 'wallpapers/cozy-room.webp'); flat.convert('RGB').save(p, 'WEBP', quality=92, method=6); print('flat', os.path.getsize(p) // 1024, 'KB')
    flat.convert('RGB').resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/cozy-room.webp'), 'WEBP', quality=84, method=6)

if __name__ == '__main__':
    main()
