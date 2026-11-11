#!/usr/bin/env python3
"""Arctic Frost forest, painted (original). The mountains, frozen lake, snowbank and haze stay the raymarched layers from
shaders/arctic-frost-3d.glsl (far/near/rays); this script replaces the forest:
  * a spruce painter: a straight trunk with whorls of drooping boughs, each bough a feathery spray of needle twigs, snow lumps resting
    on the upper face of every bough (warm where the low sun hits, blue in shadow), a snow-capped spire; back boughs darker than front;
  * mid.webp: a hazed distant forest on the lower slopes, valley mist, the far-shore tree line and two groves, all hazed by distance;
  * the three swaying spruce sprites (s-pineA/B/C) and the flat composite wallpaper + thumbnail.
  python3 -I scripts/wallpapers/arctic-trees.py   (run after: node scripts/wallpapers/render3d.js arctic-frost-3d --layers)"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/arctic-frost-3d')
W, H = 2560, 1440
SS = 2
HAZE = np.array([0.66, 0.75, 0.88], np.float32)

def to8(a): return (np.clip(np.nan_to_num(a), 0, 1) * 255 + 0.5).astype(np.uint8)
def c8(c, a=255): return tuple(int(max(0, min(255, v * 255))) for v in c) + (a,)
def lerp(a, b, t): return a * (1 - t) + b * t
FOL_D, FOL_L = np.array([0.03, 0.08, 0.08]), np.array([0.09, 0.2, 0.17])
SNOW_SH, SNOW_LIT = np.array([0.55, 0.64, 0.82]), np.array([0.98, 0.94, 0.88])

def spruce(h, seed, snow_amt=1.0):
    """Straight-alpha RGBA spruce of height h px (base at bottom centre)."""
    r = np.random.default_rng(seed); w = int(h * 0.62); img = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    cx = w / 2; base = h - 2
    def P(x, y): return (x * SS, y * SS)
    whorls = int(9 + h / 42)
    layers = {'back': [], 'front': []}
    for i in range(whorls):
        t = i / whorls                                           # 0 bottom → 1 top
        y = base - h * (0.16 + 0.8 * t)          # lowest whorl high enough that its drooping boughs end above the ground line
        env = (1 - t) ** 0.95 * 0.46 + 0.02                       # conical, a little concave
        for side in (-1, 1):
            for layer in ('back', 'front'):
                L = h * env * (0.8 + 0.35 * r.random()) * (0.75 if layer == 'back' else 1.0)
                droop = 0.35 + 0.35 * r.random() + 0.3 * (1 - t)
                layers[layer].append((y + (r.random() - 0.5) * h * 0.01, side, L, droop, t, r.random()))
    def bough(y, side, L, droop, t, rv, dark):
        # rib leaves the trunk slightly downward and droops; the bough is a filled feathery mass hanging below it
        n = 12; rib = []
        for k in range(n + 1):
            u = k / n; rib.append((cx + side * L * u, y + L * (0.16 * u + droop * 0.32 * u * u)))
        lower = []
        for k in range(n, -1, -1):
            u = k / n; hang = L * (0.15 * (1 - u) + 0.06) * (0.8 + 0.4 * r.random())
            lower.append((rib[k][0] - side * L * 0.03 * r.random(), rib[k][1] + hang))
        u_lit = lambda u: float(np.clip(0.45 + 0.13 * side * (0.3 + u) + 0.1 * (1 - t), 0, 1))
        base_c = lerp(FOL_D, FOL_L, u_lit(0.6)) * (0.62 if dark else 1.0)
        d.polygon([P(*q) for q in rib + lower], fill=c8(base_c * 0.75))                       # shaded underside
        upper = [(x, y_ + (ly - y_) * 0.45) for (x, y_), (lx, ly) in zip(rib, lower[::-1])]
        d.polygon([P(*q) for q in rib + upper[::-1]], fill=c8(lerp(base_c, np.array([0.25, 0.36, 0.42]), 0.35)))   # sky-lit upper face
        # needle texture: short strokes hanging from the rib, lighter toward the lit tips, ragged tips below the mass
        for k in range(1, n + 1):
            u = k / n; px, py = rib[k]
            for m in range(3):
                tw = L * (0.12 + 0.12 * r.random()) * (1.1 - 0.5 * u); ox = (r.random() - 0.5) * L / n
                c = lerp(FOL_D, FOL_L, np.clip(u_lit(u) + (r.random() - 0.5) * 0.3, 0, 1)) * (0.62 if dark else 1.0)
                d.line([P(px + ox, py), P(px + ox + side * tw * 0.35, py + tw)], fill=c8(c), width=max(1, int(SS * max(1.0, h / 320))))
        if dark: return
        # snow lumps resting on the upper face (not every stretch carries snow)
        for k in range(1, n + 1):
            if r.random() > 0.8 * snow_amt: continue
            u = k / n; px, py = rib[k]; sz = L * (0.055 + 0.04 * r.random()) * (1.15 - 0.5 * u)
            sl = lerp(SNOW_SH, SNOW_LIT, np.clip(u_lit(u) * 1.1 - 0.05, 0, 1))
            d.ellipse([P(px - sz * 1.4, py - sz * 0.8), P(px + sz * 1.4, py + sz * 0.35)], fill=c8(sl))
            d.ellipse([P(px - sz * 0.8, py - sz * 0.85), P(px + sz * 0.6, py - sz * 0.3)], fill=c8(lerp(sl, SNOW_LIT, 0.45)))
    for b in sorted(layers['back'], key=lambda b: -b[0]): bough(*b, dark=True)
    d.polygon([P(cx - h * 0.012, base), P(cx + h * 0.012, base), P(cx + h * 0.003, base - h * 0.95), P(cx - h * 0.003, base - h * 0.95)], fill=c8(np.array([0.2, 0.13, 0.1])))
    for b in sorted(layers['front'], key=lambda b: -b[0]): bough(*b, dark=False)
    # spire with a snow cap
    tipy = base - h * 0.985
    d.polygon([P(cx, tipy - h * 0.02), P(cx - h * 0.012, tipy + h * 0.05), P(cx + h * 0.012, tipy + h * 0.05)], fill=c8(FOL_D))
    # a drift of snow banked around the foot of the tree (no hard cut where it meets the ground)
    for k in range(5):
        mw = w * (0.32 + 0.1 * k) * (0.9 + 0.2 * r.random()); mh = h * (0.035 - 0.004 * k)
        sl = lerp(SNOW_SH, SNOW_LIT, 0.55 + 0.08 * k)
        d.ellipse([P(cx - mw / 2 + (r.random() - 0.5) * w * 0.1, base - mh), P(cx + mw / 2, base + mh * 0.6)], fill=c8(sl))
    a = np.asarray(img.resize((w, h), Image.LANCZOS), np.float32) / 255
    ys, xs = np.where(a[..., 3] > 0.01)
    return a[:, max(0, xs.min() - 2):xs.max() + 3]

def comp(dst, dsta, rgba, x, y_base, haze):
    h, w = rgba.shape[:2]; x0, y0 = int(x - w / 2), int(y_base - h)
    cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x0 + w, W), min(y0 + h, H)
    if cx1 <= cx0 or cy1 <= cy0: return
    src = rgba[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]; a = src[..., 3:4]; c = src[..., :3] * (1 - haze) + HAZE * haze
    dst[cy0:cy1, cx0:cx1] = dst[cy0:cy1, cx0:cx1] * (1 - a) + c * a
    if dsta is not None: dsta[cy0:cy1, cx0:cx1] = np.maximum(dsta[cy0:cy1, cx0:cx1], a[..., 0])

def main():
    rng = np.random.default_rng(5)
    col = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
    shore = 0.5 * H + 0.075 * H                                   # the shader's far shore (scene y = -0.075)
    # distant forest on the lower slopes: tiny hazed spruce silhouettes in drifts
    small = [spruce(h_, 900 + h_, 0.7) for h_ in (26, 32, 40, 48)]
    for i in range(1400):
        x = rng.random() * W; y = shore - 6 - rng.random() ** 1.6 * H * 0.085
        if abs(x - W * 0.52) < W * 0.12 * (1 - (shore - y) / (H * 0.09)) * 0.0: continue
        t = small[rng.integers(4)]; s = 0.5 + 0.6 * (1 - (shore - y) / (H * 0.09))
        tt = np.asarray(Image.fromarray(to8(t)).resize((max(3, int(t.shape[1] * s)), max(4, int(t.shape[0] * s))), Image.LANCZOS), np.float32) / 255
        comp(col, al, tt, x, y, 0.62 + 0.25 * (shore - y) / (H * 0.09))
    # low valley mist above the shore
    yy = np.arange(H, dtype=np.float32)[:, None]
    mist = np.exp(-((yy - (shore - 30)) / 38) ** 2) * (0.55 + 0.45 * np.asarray(Image.fromarray(to8(np.random.default_rng(3).random((4, 40)))).resize((W, 1), Image.BICUBIC), np.float32)[0] / 255)[None, :]
    col = col * (1 - mist[..., None] * 0.7) + HAZE * 1.08 * mist[..., None] * 0.7; al = np.maximum(al, mist * 0.7)
    # far-shore tree line and two groves (near shore left/right), hazed by distance
    for i in range(260):
        x = rng.random() * W; hh = int(50 + 60 * rng.random())
        if abs(x - W * 0.5) < W * 0.07: continue
        comp(col, al, spruce(hh, 1000 + i), x, shore + 4, 0.45)
    grove_trees = []
    for i in range(46):
        side = -1 if i % 2 == 0 else 1
        x = W * 0.5 + side * W * (0.2 + 0.32 * rng.random()); hh = int(150 + 200 * rng.random() ** 1.5)
        grove_trees.append((hh, x))
    for hh, x in sorted(grove_trees):
        comp(col, al, spruce(hh, 2000 + int(x)), x, 0.5 * H + 0.115 * H + rng.random() * 14, 0.12 + 0.15 * (1 - hh / 350))
    mid = np.concatenate([col, al[..., None]], -1)
    Image.fromarray(to8(mid), 'RGBA').save(os.path.join(OUT, 'mid.webp'), 'WEBP', quality=90, method=6)
    # swaying spruce sprites
    for name, hh, seed in (('pineA', 900, 11), ('pineB', 760, 12), ('pineC', 820, 13)):
        t = spruce(hh, seed)
        Image.fromarray(to8(t), 'RGBA').save(os.path.join(OUT, f's-{name}.webp'), 'WEBP', quality=90, method=6)
        print(name, t.shape[1], 'x', t.shape[0])
    # flat composite: far + mid + sprites (at their scene positions) + near
    far = np.asarray(Image.open(os.path.join(OUT, 'far.webp')).convert('RGB'), np.float32) / 255
    flat = far * (1 - al[..., None]) + col * al[..., None]
    X = lambda x: (0.5 + x / (16 / 9)) * W; Y = lambda y: (0.5 - y) * H
    for name, bx, by, span in (('pineB', 0.44, -0.125, 0.24), ('pineA', -0.64, -0.13, 0.36), ('pineC', 0.68, -0.13, 0.32)):
        t = np.asarray(Image.open(os.path.join(OUT, f's-{name}.webp')), np.float32) / 255
        s = span * H / t.shape[0]; t = np.asarray(Image.fromarray(to8(t)).resize((int(t.shape[1] * s), int(t.shape[0] * s)), Image.LANCZOS), np.float32) / 255
        comp(flat, None, t, X(bx), Y(by), 0.0)
    near = np.asarray(Image.open(os.path.join(OUT, 'near.webp')).convert('RGBA'), np.float32) / 255
    flat = flat * (1 - near[..., 3:4]) + near[..., :3] * near[..., 3:4]
    fl = Image.fromarray(to8(flat)); fl.save(os.path.join(ROOT, 'wallpapers/arctic-frost-3d.webp'), 'WEBP', quality=90, method=6)
    fl.resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/arctic-frost-3d.webp'), 'WEBP', quality=82, method=6)
    print('arctic forest done')

if __name__ == '__main__':
    main()
