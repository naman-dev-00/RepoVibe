#!/usr/bin/env python3
"""Cozy Coding (preset-4): an anime-style night workspace, painted from scratch (original work; no external assets).
Cel shading: flat colour areas, a darker outline, one highlight and one shadow tone per object, warm lamp light against a cool window.

Layers (wallpapers/depth/cozy-room/), 2560×1440, drawn at 2× and downsampled:
  far.webp    what the window looks out on: night sky, big moon, shooting-star streak, layered city with lit windows, distant hills
  mid.webp    the room wall with a real window hole (frame, sill, curtains), book shelves, posters, wall clock, fairy lights, hanging plant
  near.webp   the desk: monitor with code, second vertical monitor, keyboard, mug, desk lamp, books, headphones, cactus, sleeping cat on the sill
  front.webp  foreground framing: a monstera at the left, a chair back, a floor lamp at the right
  rays.webp   lamp light pools and the monitor's glow
  t-snow      seamless falling snow seen through the window
  s-*         steam, lamp glow, screen glow, fairy lights, cat tail, leaf, cursor
Also the flat wallpaper wallpapers/cozy-room.webp.     python3 -I scripts/wallpapers/cozy-paint.py"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/cozy-room')
W, H, S = 2560, 1440, 2
INK = (38, 20, 34, 255)

def hexc(h, a=255): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def P(pts): return [(x * S, y * S) for x, y in pts]
def B(x0, y0, x1, y1): return [x0 * S, y0 * S, x1 * S, y1 * S]
def new(): return Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
def down(im): return im.resize((W, H), Image.LANCZOS)
def save(im, name, q=90):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')
def rrect(d, x0, y0, x1, y1, r, fill, outline=INK, width=3):
    d.rounded_rectangle(B(x0, y0, x1, y1), radius=r * S, fill=fill, outline=outline, width=int(width * S) if outline else 0)
def glow_img(points, blur):
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    for x, y, r, col, a in points: d.ellipse([x - r, y - r, x + r, y + r], fill=hexc(col, a))
    return g.filter(ImageFilter.GaussianBlur(blur))

# window opening in the wall (stage px): mirrored in shared/worlds.js (snow region, cat, etc.)
WX0, WY0, WX1, WY1 = 1420, 150, 2330, 800

# ---------------------------------------------------------------- far: the night outside
def far_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    top, midc, hor = np.array([10, 14, 46]), np.array([36, 44, 120]), np.array([150, 104, 170])
    t = np.clip(y / 0.6, 0, 1)
    sky = top * (1 - t) ** 1.5 + midc * (1 - (1 - t) ** 1.5) * (1 - t ** 2.5) + hor * t ** 2.5
    img = Image.fromarray(np.clip(np.broadcast_to(sky[:, None, :] if sky.ndim == 2 else sky, (H, W, 3)), 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    d = ImageDraw.Draw(img); r = np.random.default_rng(3)
    for _ in range(420):
        sx, sy, b = r.uniform(1300, 2460), r.random() ** 1.4 * 620, r.random(); rad = 0.8 + b * 1.7
        d.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=(255, 250, 235, int(110 + 145 * b)))
        if b > 0.9: d.line([(sx - 7, sy), (sx + 7, sy)], fill=(255, 255, 255, 170)); d.line([(sx, sy - 7), (sx, sy + 7)], fill=(255, 255, 255, 170))
    mx, my, mr = 2090, 300, 92                                                         # moon with a soft anime halo
    img.alpha_composite(glow_img([(mx, my, mr * 2.4, '#b8c8ff', 90), (mx, my, mr * 1.4, '#fff6dc', 120)], 46))
    d = ImageDraw.Draw(img); d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=hexc('#fff3d2'))
    d.ellipse([mx - mr * 0.5, my - mr * 0.3, mx - mr * 0.1, my + mr * 0.1], fill=hexc('#f0dcb4')); d.ellipse([mx + mr * 0.15, my + mr * 0.2, mx + mr * 0.5, my + mr * 0.55], fill=hexc('#f0dcb4')); d.ellipse([mx + mr * 0.2, my - mr * 0.55, mx + mr * 0.42, my - mr * 0.33], fill=hexc('#f0dcb4'))
    d.line([(1560, 210), (1700, 262)], fill=(255, 255, 255, 190), width=3); d.line([(1500, 188), (1560, 210)], fill=(255, 255, 255, 80), width=2)   # shooting star
    # anime clouds: stacked rounded puffs with a lit top
    for (cx, cy, sc) in [(1560, 420, 1.0), (2260, 500, 0.8), (1820, 560, 0.6)]:
        for (ox, oy, rr) in [(-90, 10, 44), (-40, -14, 58), (20, -4, 66), (84, 12, 46), (0, 22, 80)]:
            d.ellipse([cx + (ox - rr) * sc, cy + (oy - rr * 0.55) * sc, cx + (ox + rr) * sc, cy + (oy + rr * 0.55) * sc], fill=(70, 78, 150, 235))
        for (ox, oy, rr) in [(-40, -20, 46), (20, -12, 54)]:
            d.ellipse([cx + (ox - rr) * sc, cy + (oy - rr * 0.5) * sc, cx + (ox + rr) * sc, cy + (oy + rr * 0.2) * sc], fill=(120, 126, 196, 235))
    # hills and three rows of city
    d.polygon([(1250, 700), (1500, 610), (1760, 660), (2050, 590), (2330, 650), (2560, 620), (2560, 900), (1250, 900)], fill=hexc('#2c2a66'))
    lights = []
    for (seed, base, hmin, hmax, wmin, wmax, col, plit) in [(1, 760, 60, 170, 34, 70, '#232458', 0.3), (2, 800, 70, 240, 44, 96, '#191a44', 0.42), (3, 840, 50, 150, 60, 130, '#101233', 0.5)]:
        rr = np.random.default_rng(seed); x = 1240
        while x < 2560:
            bw, bh = rr.uniform(wmin, wmax), rr.uniform(hmin, hmax)
            d.rectangle([x, base - bh, x + bw, 900], fill=hexc(col))
            if rr.random() < 0.3: d.rectangle([x + bw * 0.3, base - bh - 16, x + bw * 0.7, base - bh], fill=hexc(col)); d.line([(x + bw * 0.5, base - bh - 16), (x + bw * 0.5, base - bh - 46)], fill=hexc(col), width=3); lights.append((x + bw * 0.5, base - bh - 46, 7, '#ff6a6a', 230))
            for wy in np.arange(base - bh + 10, base - 6, 15):
                for wx in np.arange(x + 6, x + bw - 8, 12):
                    if rr.random() < plit:
                        c = ['#ffd27a', '#ffe9b0', '#8fd0ff', '#ffb06a'][rr.integers(4)]; d.rectangle([wx, wy, wx + 6, wy + 8], fill=hexc(c)); lights.append((wx + 3, wy + 4, 8, c, 70))
            x += bw + rr.uniform(-4, 10)
    img.alpha_composite(glow_img(lights, 7))
    return img.convert('RGB')

# ---------------------------------------------------------------- mid: the wall
def books(d, x0, y, x1, rng, hmax=92):
    x = x0 + 6
    pal = ['#e86a6a', '#f2a65a', '#f2d06a', '#7ac48a', '#6aa8e8', '#9a7ae0', '#e88ab8', '#f4ead8', '#5ac0c0']
    while x < x1 - 22:
        bw, bh = rng.uniform(15, 30), rng.uniform(hmax * 0.6, hmax); c = hexc(pal[rng.integers(len(pal))])
        if rng.random() < 0.12 and x < x1 - 80:   # a leaning book
            d.polygon(P([(x, y), (x + 24, y - bh), (x + 24 + bw, y - bh + 6), (x + bw, y)]), fill=c, outline=INK, width=S * 2); x += bw + 30; continue
        d.rectangle(B(x, y - bh, x + bw, y), fill=c, outline=INK, width=S * 2)
        d.rectangle(B(x + 3, y - bh + 3, x + 7, y - 3), fill=mix(c, (255, 255, 255), 0.35))                 # cel highlight
        d.rectangle(B(x + 3, y - bh * 0.72, x + bw - 3, y - bh * 0.66), fill=mix(c, (0, 0, 0), 0.3))        # band
        x += bw + (rng.uniform(1, 3) if rng.random() < 0.9 else rng.uniform(16, 40))

def mid_layer():
    big = new(); d = ImageDraw.Draw(big); rng = np.random.default_rng(14)
    # wall: plum → warm, with a wainscot; drawn as horizontal strips for a soft cel gradient
    for i in range(48):
        t = i / 47; c = mix(hexc('#3a2444'), hexc('#5a3248'), t)
        d.rectangle(B(0, H * t * 0.74, W, H * (t + 0.03) * 0.74), fill=c)
    d.rectangle(B(0, H * 0.72, W, H), fill=hexc('#4a2a3a')); d.line(P([(0, H * 0.72), (W, H * 0.72)]), fill=INK, width=S * 4)
    for px in range(0, W, 128): d.line(P([(px, H * 0.72), (px, H)]), fill=mix(hexc('#4a2a3a'), (0, 0, 0), 0.3), width=S * 2)
    # window hole (punched below), frame, sill, curtains
    fr = hexc('#f0d9b8'); frs = hexc('#c9a47e')
    rrect(d, WX0 - 28, WY0 - 28, WX1 + 28, WY1 + 28, 10, fr, INK, 4)
    hole = (WX0, WY0, WX1, WY1)
    # shelves (left wall), two rows
    wood, woodhi = hexc('#8a5236'), hexc('#b8754a')
    for (sx0, sx1, sy) in [(150, 760, 330), (90, 620, 520), (700, 1290, 250)]:
        books(d, sx0, sy, sx1, rng)
        rrect(d, sx0 - 14, sy, sx1 + 14, sy + 20, 4, wood, INK, 3); d.line(P([(sx0 - 8, sy + 5), (sx1 + 8, sy + 5)]), fill=woodhi, width=S * 3)
        for bx in (sx0 + 30, sx1 - 30): d.polygon(P([(bx - 5, sy + 20), (bx + 5, sy + 20), (bx, sy + 48)]), fill=wood, outline=INK, width=S * 2)
    # trinkets on the shelves: a small plant, a globe lamp, a figure
    for (px, py) in [(690, 330), (1220, 250)]:
        rrect(d, px - 22, py - 34, px + 22, py, 5, hexc('#e8a070'), INK, 3)
        for a in (-0.7, -0.25, 0.25, 0.7): d.ellipse(B(px + math.sin(a) * 34 - 13, py - 80 - abs(a) * -18, px + math.sin(a) * 34 + 13, py - 28), fill=hexc('#5aa870'), outline=INK, width=S * 2)
    d.ellipse(B(560, 452, 624, 516), fill=hexc('#ffe6a8'), outline=INK, width=S * 3)                        # globe lamp on shelf 2
    # posters / frames
    for (x0, y0, x1, y1, c1, c2) in [(860, 330, 1040, 560, '#2a3a7a', '#ff9a8a'), (1080, 380, 1280, 520, '#234a5a', '#ffd27a')]:
        rrect(d, x0, y0, x1, y1, 4, hexc('#f4ead8'), INK, 3); d.rectangle(B(x0 + 12, y0 + 12, x1 - 12, y1 - 12), fill=hexc(c1))
        d.ellipse(B(x0 + (x1 - x0) * 0.5, y0 + 26, x0 + (x1 - x0) * 0.5 + 46, y0 + 72), fill=hexc(c2))       # sun/moon
        d.polygon(P([(x0 + 12, y1 - 12), (x0 + (x1 - x0) * 0.35, y1 - (y1 - y0) * 0.45), (x0 + (x1 - x0) * 0.6, y1 - 30), (x0 + (x1 - x0) * 0.8, y1 - (y1 - y0) * 0.36), (x1 - 12, y1 - 12)]), fill=mix(hexc(c1), (0, 0, 0), 0.4))
    # wall clock
    cx, cy, cr = 96, 190, 52
    d.ellipse(B(cx - cr, cy - cr, cx + cr, cy + cr), fill=hexc('#f4ead8'), outline=INK, width=S * 4)
    for a in range(12): an = a * math.pi / 6; d.line(P([(cx + math.cos(an) * cr * 0.76, cy + math.sin(an) * cr * 0.76), (cx + math.cos(an) * cr * 0.9, cy + math.sin(an) * cr * 0.9)]), fill=INK, width=S * 2)
    d.line(P([(cx, cy), (cx + 6, cy - 38)]), fill=INK, width=S * 3); d.line(P([(cx, cy), (cx - 24, cy + 8)]), fill=INK, width=S * 4); d.ellipse(B(cx - 4, cy - 4, cx + 4, cy + 4), fill=hexc('#e86a6a'))
    # hanging plant, top right corner
    hx = 2440
    d.line(P([(hx, 0), (hx, 150)]), fill=INK, width=S * 2); rrect(d, hx - 40, 150, hx + 40, 206, 14, hexc('#e8c8a0'), INK, 3)
    for i, (a, ln) in enumerate([(-1.0, 150), (-0.5, 230), (0.0, 190), (0.45, 260), (0.95, 160)]):
        pts = [(hx + a * 30 + math.sin(t * 3 + i) * 10 + a * 24 * t, 200 + ln * t) for t in np.linspace(0, 1, 12)]
        d.line(P(pts), fill=hexc('#3f8a5a'), width=S * 3)
        for (px, py) in pts[2::2]: d.ellipse(B(px - 12, py - 7, px + 12, py + 7), fill=hexc('#5ab878'), outline=INK, width=S)
    lay = big
    # punch the window, then draw the mullions over the hole
    px = lay.load()
    hole_img = Image.new('RGBA', ((WX1 - WX0) * S, (WY1 - WY0) * S), (0, 0, 0, 0)); lay.paste(hole_img, (WX0 * S, WY0 * S))
    d = ImageDraw.Draw(lay)
    d.rectangle(B(WX0, WY0, WX1, WY1), outline=INK, width=S * 4)
    mxm = (WX0 + WX1) / 2
    d.rectangle(B(mxm - 11, WY0, mxm + 11, WY1), fill=fr, outline=INK, width=S * 3); d.rectangle(B(WX0, 420, WX1, 440), fill=fr, outline=INK, width=S * 3)
    d.line(P([(mxm - 5, WY0 + 6), (mxm - 5, WY1 - 6)]), fill=(255, 255, 255, 150), width=S * 2)
    rrect(d, WX0 - 60, WY1 + 20, WX1 + 60, WY1 + 58, 6, fr, INK, 4); d.rectangle(B(WX0 - 54, WY1 + 44, WX1 + 54, WY1 + 54), fill=frs)   # sill
    # curtains: scalloped folds, cel-shaded
    for side in (0, 1):
        x0 = WX0 - 150 if side == 0 else WX1 - 60; x1 = x0 + 210; c = hexc('#c8506a'); cs = hexc('#9a3a56'); ch = hexc('#e8788a')
        pts = [(x0, WY0 - 60), (x1, WY0 - 60)] + [(x1 - (i % 2) * 16 - (0 if side else 40) * (i / 10), WY0 - 60 + (WY1 - WY0 + 150) * i / 10) for i in range(1, 11)] + [(x0 + (40 if side else 0), WY1 + 96)]
        d.polygon(P(pts), fill=c, outline=INK, width=S * 3)
        for i in range(1, 6):
            fx = x0 + 210 * i / 6; d.line(P([(fx, WY0 - 40), (fx + (6 if side else -6), WY1 + 70)]), fill=cs, width=S * 5); d.line(P([(fx + 12, WY0 - 40), (fx + 16, WY1 + 40)]), fill=ch, width=S * 3)
    rrect(d, WX0 - 190, WY0 - 82, WX1 + 190, WY0 - 56, 12, hexc('#8a5236'), INK, 4)                         # curtain rod
    # fairy-light wire along the top (the bulbs themselves are a glowing sprite + painted cores)
    wire = [(x, 70 + 34 * math.sin(x / 150) ** 2) for x in range(60, 1300, 20)]
    d.line(P(wire), fill=INK, width=S * 2)
    for i, (x, yv) in enumerate(wire[2::3]):
        c = ['#ffd27a', '#ff9ab8', '#8fd0ff', '#b6ff9a'][i % 4]; d.ellipse(B(x - 8, yv + 2, x + 8, yv + 20), fill=hexc(c), outline=INK, width=S)
    return down(lay)

# ---------------------------------------------------------------- near: the desk
CODE = ['#ff8fb8', '#8fd0ff', '#b6ff9a', '#ffd27a', '#c8a8ff', '#e8eef8']
def code_lines(d, x0, y0, x1, y1, rng, lh=17):
    yv = y0; indent = 0
    while yv < y1 - lh:
        if rng.random() < 0.13: yv += lh; continue
        indent = int(np.clip(indent + rng.integers(-1, 2), 0, 4)); x = x0 + indent * 22
        for _ in range(rng.integers(1, 5)):
            wl = rng.uniform(18, 110)
            if x + wl > x1: break
            d.rounded_rectangle(B(x, yv, x + wl, yv + 7), radius=3 * S, fill=hexc(CODE[rng.integers(len(CODE))])); x += wl + 9
        yv += lh

def near_layer():
    big = new(); d = ImageDraw.Draw(big); rng = np.random.default_rng(23)
    dy = 880                                                                                              # desk top
    wood, woodhi, woodsh = hexc('#a8683e'), hexc('#cf8a55'), hexc('#7a4628')
    # monitor stand + main monitor
    d.polygon(P([(820, dy), (870, dy - 60), (990, dy - 60), (1040, dy)]), fill=hexc('#3a3448'), outline=INK, width=S * 3); d.rectangle(B(900, dy - 130, 960, dy - 50), fill=hexc('#4a445a'), outline=INK, width=S * 3)
    rrect(d, 520, 400, 1340, dy - 110, 16, hexc('#2a2536'), INK, 5); rrect(d, 540, 420, 1320, dy - 150, 6, hexc('#141a33'), INK, 3)
    d.rectangle(B(543, 423, 1317, 452), fill=hexc('#222a4c'))
    for i, c in enumerate(('#ff6a6a', '#ffd06a', '#6ad08a')): d.ellipse(B(556 + i * 22, 431, 570 + i * 22, 445), fill=hexc(c))
    d.rectangle(B(543, 452, 700, dy - 153), fill=hexc('#1b2240'))                                           # file tree
    for i in range(13): d.rounded_rectangle(B(560 + (i % 3) * 14, 470 + i * 21, 560 + (i % 3) * 14 + rng.uniform(50, 110), 478 + i * 21), radius=3 * S, fill=hexc('#6a78b8'))
    code_lines(d, 724, 470, 1300, dy - 160, rng)
    d.polygon(P([(1100, 423), (1317, 423), (1317, 560)]), fill=(255, 255, 255, 16))                        # glass sheen
    # vertical second monitor
    rrect(d, 1370, 470, 1640, dy - 60, 12, hexc('#2a2536'), INK, 5); rrect(d, 1386, 486, 1624, dy - 76, 5, hexc('#101827'), INK, 3)
    code_lines(d, 1400, 502, 1614, dy - 90, rng, 15); d.rectangle(B(1480, dy - 60, 1530, dy), fill=hexc('#4a445a'), outline=INK, width=S * 3)
    # desk
    d.rectangle(B(-10, dy, W + 10, dy + 54), fill=wood, outline=INK, width=S * 4); d.rectangle(B(0, dy + 4, W, dy + 14), fill=woodhi)
    d.rectangle(B(-10, dy + 54, W + 10, H), fill=woodsh, outline=INK, width=S * 4)
    for (x0, x1) in [(120, 700), (760, 1340), (1860, 2440)]:                                               # drawers
        rrect(d, x0, dy + 84, x1, dy + 250, 8, hexc('#8a5230'), INK, 3); rrect(d, (x0 + x1) / 2 - 50, dy + 150, (x0 + x1) / 2 + 50, dy + 172, 9, hexc('#e8c080'), INK, 3)
    # keyboard + mouse
    d.polygon(P([(640, dy - 6), (680, dy - 40), (1200, dy - 40), (1240, dy - 6)]), fill=hexc('#e8e2ee'), outline=INK, width=S * 3)
    for r_ in range(3):
        for k in range(24 - r_): d.rounded_rectangle(B(690 + r_ * 8 + k * (21 + r_ * 0.6), dy - 36 + r_ * 10, 706 + r_ * 8 + k * (21 + r_ * 0.6), dy - 29 + r_ * 10), radius=2 * S, fill=hexc(['#c8b8e8', '#ffb8cc', '#b8dcff'][(k + r_) % 3] if (k * 7 + r_) % 5 == 0 else '#8a84a0'))
    d.ellipse(B(1270, dy - 34, 1330, dy - 2), fill=hexc('#e8e2ee'), outline=INK, width=S * 3)
    # mug with a heart, left of the keyboard
    rrect(d, 400, dy - 96, 486, dy - 2, 10, hexc('#f4ead8'), INK, 4); d.arc(B(470, dy - 78, 522, dy - 24), 270, 90, fill=INK, width=S * 9); d.arc(B(474, dy - 74, 518, dy - 28), 270, 90, fill=hexc('#f4ead8'), width=S * 4)
    d.ellipse(B(404, dy - 104, 482, dy - 86), fill=hexc('#6a3a2a'), outline=INK, width=S * 3)
    d.polygon(P([(443, dy - 30), (424, dy - 52), (434, dy - 64), (443, dy - 56), (452, dy - 64), (462, dy - 52)]), fill=hexc('#e86a7a'))
    # desk lamp (left): base, two arms, shade
    lx = 250
    d.ellipse(B(lx - 60, dy - 22, lx + 60, dy + 2), fill=hexc('#e8b04a'), outline=INK, width=S * 3)
    d.line(P([(lx, dy - 14), (lx - 50, dy - 220)]), fill=INK, width=S * 12); d.line(P([(lx, dy - 14), (lx - 50, dy - 220)]), fill=hexc('#e8b04a'), width=S * 6)
    d.line(P([(lx - 50, dy - 220), (lx + 70, dy - 330)]), fill=INK, width=S * 12); d.line(P([(lx - 50, dy - 220), (lx + 70, dy - 330)]), fill=hexc('#e8b04a'), width=S * 6)
    d.polygon(P([(lx + 40, dy - 372), (lx + 150, dy - 330), (lx + 176, dy - 250), (lx + 44, dy - 286)]), fill=hexc('#f2c45a'), outline=INK, width=S * 4)
    d.polygon(P([(lx + 54, dy - 284), (lx + 170, dy - 252), (lx + 160, dy - 240), (lx + 60, dy - 268)]), fill=hexc('#fff3c0'), outline=INK, width=S * 2)
    # stack of books + headphones (right of the monitors)
    for i, (c, wv) in enumerate([('#6aa8e8', 230), ('#e88ab8', 200), ('#f2d06a', 214)]):
        y1 = dy - 2 - i * 34; rrect(d, 1700 + i * 8, y1 - 32, 1700 + i * 8 + wv, y1, 4, hexc(c), INK, 3); d.rectangle(B(1700 + i * 8 + wv - 26, y1 - 27, 1700 + i * 8 + wv - 6, y1 - 5), fill=hexc('#f4ead8'))
    d.arc(B(1750, dy - 190, 1890, dy - 60), 180, 360, fill=INK, width=S * 14); d.arc(B(1754, dy - 186, 1886, dy - 64), 180, 360, fill=hexc('#5a5470'), width=S * 7)
    for hx in (1736, 1868): rrect(d, hx, dy - 150, hx + 36, dy - 96, 12, hexc('#ff9ab8'), INK, 3)
    # cactus pot
    rrect(d, 60, dy - 62, 140, dy - 2, 8, hexc('#e8a070'), INK, 3); rrect(d, 78, dy - 150, 122, dy - 58, 20, hexc('#5ab878'), INK, 3)
    rrect(d, 48, dy - 118, 80, dy - 84, 12, hexc('#5ab878'), INK, 3); d.ellipse(B(92, dy - 162, 110, dy - 146), fill=hexc('#ff8fb8'), outline=INK, width=S * 2)
    # sleeping cat on the window sill (orange tabby, curled)
    cx, cy = 2110, 858 - 20
    d.ellipse(B(cx - 110, cy - 62, cx + 96, cy + 22), fill=hexc('#f0a05a'), outline=INK, width=S * 4)       # body
    d.ellipse(B(cx - 150, cy - 48, cx - 62, cy + 22), fill=hexc('#f4b06a'), outline=INK, width=S * 4)       # head
    for ex in (-136, -92): d.polygon(P([(cx + ex, cy - 36), (cx + ex + 8, cy - 70), (cx + ex + 30, cy - 42)]), fill=hexc('#f4b06a'), outline=INK, width=S * 3)
    d.arc(B(cx - 132, cy - 20, cx - 112, cy - 6), 0, 180, fill=INK, width=S * 3); d.arc(B(cx - 100, cy - 20, cx - 80, cy - 6), 0, 180, fill=INK, width=S * 3)   # closed eyes
    d.ellipse(B(cx - 111, cy - 4, cx - 101, cy + 4), fill=hexc('#ff8fa8'))
    for sx in (-30, 6, 42): d.arc(B(cx + sx - 24, cy - 60, cx + sx + 24, cy - 16), 200, 340, fill=hexc('#c8743a'), width=S * 5)   # stripes
    return down(big)

# ---------------------------------------------------------------- front
def leaf(d, x, y, ang, ln, col, hi):
    """a monstera-like leaf: ellipse along `ang` with a lighter midrib and two notches"""
    pts = []
    for t in np.linspace(0, 2 * math.pi, 40):
        r = 1 - 0.16 * max(0, math.cos(3 * t)) ** 6
        lx, ly = math.cos(t) * ln / 2 * r + ln / 2, math.sin(t) * ln * 0.3 * r
        pts.append((x + lx * math.cos(ang) - ly * math.sin(ang), y + lx * math.sin(ang) + ly * math.cos(ang)))
    d.polygon(P(pts), fill=col, outline=INK, width=S * 4)
    d.line(P([(x, y), (x + math.cos(ang) * ln * 0.92, y + math.sin(ang) * ln * 0.92)]), fill=hi, width=S * 4)
    for t in (0.3, 0.5, 0.7):
        bx, by = x + math.cos(ang) * ln * t, y + math.sin(ang) * ln * t
        for sgn in (-1, 1): d.line(P([(bx, by), (bx + math.cos(ang + sgn * 0.9) * ln * 0.2, by + math.sin(ang + sgn * 0.9) * ln * 0.2)]), fill=hi, width=S * 2)

def front_layer():
    big = new(); d = ImageDraw.Draw(big)
    # monstera, bottom-left: pot + stems (the swaying leaves are sprites; a few rest leaves are painted)
    rrect(d, -40, H - 250, 190, H + 20, 20, hexc('#e8825a'), INK, 5); d.rectangle(B(-40, H - 250, 190, H - 216), fill=hexc('#f2a070'), outline=INK, width=S * 4)
    for (a, ln) in [(-1.25, 330), (-0.95, 300), (-1.7, 280)]:
        d.line(P([(70, H - 240), (70 + math.cos(a) * ln * 0.5, H - 240 + math.sin(a) * ln * 0.5)]), fill=hexc('#3f8a5a'), width=S * 7)
    leaf(d, 40, H - 380, -1.9, 250, hexc('#3f9a62'), hexc('#8ad89a')); leaf(d, 120, H - 330, -0.5, 230, hexc('#4aa870'), hexc('#8ad89a'))
    # floor lamp, right edge
    x = W - 96
    d.rectangle(B(x - 5, 520, x + 5, H), fill=hexc('#3a3448'), outline=INK, width=S * 2)
    d.polygon(P([(x - 90, 520), (x - 56, 350), (x + 56, 350), (x + 90, 520)]), fill=hexc('#ffe2a0'), outline=INK, width=S * 5)
    d.polygon(P([(x - 56, 350), (x - 30, 350), (x - 52, 520), (x - 90, 520)]), fill=hexc('#fff3cf'))
    # chair back, bottom centre-right (rounded gaming-chair silhouette with a cushion highlight)
    rrect(d, 1040, H - 210, 1500, H + 60, 70, hexc('#5a4a8a'), INK, 6); rrect(d, 1090, H - 170, 1450, H + 60, 50, hexc('#7a68b0'), None)
    d.arc(B(1100, H - 180, 1440, H + 100), 200, 340, fill=hexc('#9a8ad0'), width=S * 6)
    return down(big)

def rays_layer():
    pts = [(250 + 110, 880 - 250, 330, '#ffd88a', 105), (360, 880, 250, '#ffc56a', 70),                    # desk lamp pool
           (930, 600, 470, '#8fb0ff', 46), (1505, 640, 220, '#8fb0ff', 30),                                 # monitors
           (W - 96, 430, 300, '#ffe2a0', 95), (592, 484, 110, '#ffe6a8', 90)]                               # floor lamp, globe lamp
    return glow_img(pts, 70)

def snow_tile():
    w = h = 768; r = np.random.default_rng(31); im = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for _ in range(150):
        x, yv, rad = r.random() * w * 2, r.random() * h * 2, r.uniform(2, 7); a = int(r.uniform(150, 255))
        for ox in (-w * 2, 0, w * 2):
            for oy in (-h * 2, 0, h * 2): d.ellipse([x + ox - rad, yv + oy - rad, x + ox + rad, yv + oy + rad], fill=(255, 255, 255, a))
    return im.resize((w, h), Image.LANCZOS)

def steam_sprite():
    w, h = 160, 300; yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); t = 1 - yy / h
    cxs = w / 2 + np.sin(t * 7.0) * 22 * t
    a = np.exp(-((xx - cxs) / (9 + 16 * t)) ** 2) * np.clip(np.sin(t * math.pi), 0, 1) ** 1.2 * 0.75
    cx2 = w / 2 + np.sin(t * 6.0 + 2.0) * 26 * t
    a = np.clip(a + np.exp(-((xx - cx2) / (7 + 12 * t)) ** 2) * np.clip(np.sin(t * math.pi), 0, 1) ** 1.2 * 0.5, 0, 1)
    rgb = np.broadcast_to(np.array([255, 244, 232], np.float32), (h, w, 3))
    return Image.fromarray(np.concatenate([rgb, (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def radial(size, col, sharp=0.42, peak=0.8):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32); r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    a = np.exp(-(r / sharp) ** 2) * peak * np.clip((1 - r) * 4, 0, 1)
    rgb = np.broadcast_to(np.array(hexc(col)[:3], np.float32), (size, size, 3))
    return Image.fromarray(np.concatenate([rgb, (a * 255)[..., None]], -1).astype(np.uint8), 'RGBA')

def fairy_sprite():
    """glow halos for the fairy-light bulbs, in the bulbs' own stage positions (crop 0..1340 × 0..180)"""
    g = Image.new('RGBA', (1340, 180), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    wire = [(x, 70 + 34 * math.sin(x / 150) ** 2) for x in range(60, 1300, 20)]
    for i, (x, yv) in enumerate(wire[2::3]):
        c = ['#ffd27a', '#ff9ab8', '#8fd0ff', '#b6ff9a'][i % 4]; d.ellipse([x - 22, yv - 10, x + 22, yv + 34], fill=hexc(c, 200))
    return g.filter(ImageFilter.GaussianBlur(11))

def tail_sprite():
    w, h = 200, 120; im = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pts = [(20 + 160 * t, 90 - 60 * t ** 1.6 - math.sin(t * 3.1) * 10) for t in np.linspace(0, 1, 24)]
    d.line([(x * 2, y * 2) for x, y in pts], fill=INK, width=44, joint='curve'); d.line([(x * 2, y * 2) for x, y in pts], fill=hexc('#f0a05a'), width=30, joint='curve')
    for (x, y) in pts[5::5]: d.ellipse([x * 2 - 10, y * 2 - 16, x * 2 + 10, y * 2 + 16], fill=hexc('#c8743a'))
    ex, ey = pts[-1]; d.ellipse([ex * 2 - 15, ey * 2 - 15, ex * 2 + 15, ey * 2 + 15], fill=hexc('#fff0dc'))   # pale tail tip
    return im.resize((w, h), Image.LANCZOS)

def leaf_sprite():
    w, h = 520, 360; im = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    leaf(d, 20, h - 60, -0.55, 440, hexc('#46a86c'), hexc('#9ae0a8'))
    return im.resize((w, h), Image.LANCZOS)

def cursor_sprite():
    im = Image.new('RGBA', (16, 28), hexc('#e8eef8')); return im

def main():
    os.makedirs(OUT, exist_ok=True)
    far = far_layer(); save(far, 'far.webp')
    mid = mid_layer(); save(mid, 'mid.webp')
    near = near_layer(); save(near, 'near.webp')
    front = front_layer(); save(front, 'front.webp')
    rays = rays_layer(); save(rays, 'rays.webp', 80)
    snow = snow_tile(); save(snow, 't-snow.webp')
    save(steam_sprite(), 's-steam.webp'); save(radial(420, '#ffd88a'), 's-lampGlow.webp'); save(radial(900, '#8fb0ff', 0.5, 0.42), 's-screenGlow.webp')
    save(fairy_sprite(), 's-fairy.webp'); save(tail_sprite(), 's-tail.webp'); save(leaf_sprite(), 's-leaf.webp'); save(cursor_sprite(), 's-cursor.webp')
    flat = far.convert('RGBA')
    sn = Image.new('RGBA', (W, H));
    for xx in range(WX0, WX1, 768):
        for yv in range(WY0, WY1, 768): sn.alpha_composite(snow, (xx, yv))
    sn = sn.crop((WX0, WY0, WX1, WY1)); flat.alpha_composite(sn, (WX0, WY0))
    for l in (mid, near, front, rays): flat.alpha_composite(l)
    p = os.path.join(ROOT, 'wallpapers/cozy-room.webp'); flat.convert('RGB').save(p, 'WEBP', quality=88, method=6); print('flat', os.path.getsize(p) // 1024, 'KB')
    flat.convert('RGB').resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/cozy-room.webp'), 'WEBP', quality=82, method=6)

if __name__ == '__main__':
    main()
