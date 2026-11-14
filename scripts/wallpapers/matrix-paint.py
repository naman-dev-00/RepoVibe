#!/usr/bin/env python3
"""Matrix (preset-5) as a layered digital world, painted from scratch (original). Glyphs are 0/1 (plus a few code symbols) rasterised
from DejaVu Sans Mono (Bitstream Vera licence: free to use; only the rendered shapes ship, not the font).

Layers (wallpapers/depth/digital-rain/):
  far.webp     the void: a distant data city of glyph-textured towers on a glowing perspective grid floor, horizon haze, faint static code sky
  mid.webp     two close monoliths at the edges (transparent elsewhere), code etched into their faces, bright rims
  rays.webp    a soft green light cone from above and the horizon bloom
  t-codeFar / t-codeMid / t-codeNear   seamless vertical code-rain tiles at three depths (small+dim+slow → large+soft+fast); each column is a
               trail with a bright head and a fading tail, and every trail wraps exactly at the tile height so the plane loops without a seam
  s-streamA..F individual falling code columns (bright white-green head, long tail) that the page drops top → bottom at their own speeds
Also writes the flat wallpaper wallpapers/digital-rain.webp (layers + a frame of the rain composited) for previews.
  python3 -I scripts/wallpapers/matrix-paint.py"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'wallpapers/depth/digital-rain')
W, H = 2560, 1440
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
CHARS = '0101010110' + '01{}<>/;=+*'
rng = np.random.default_rng(5)

_glyphs = {}
def glyph(ch, size):
    key = (ch, size)
    if key not in _glyphs:
        f = ImageFont.truetype(FONT, size)
        w, h = int(size * 0.7) + 2, int(size * 1.2) + 2
        im = Image.new('L', (w, h), 0); ImageDraw.Draw(im).text((1, 0), ch, font=f, fill=255)
        _glyphs[key] = np.asarray(im, np.float32) / 255
    return _glyphs[key]

def stamp(buf, g, x, y, rgb, wrap_h=None):
    """add glyph mask g * rgb (light) into buf at (x, y) top-left; wrap vertically when wrap_h is given"""
    gh, gw = g.shape
    H_, W_ = buf.shape[:2]
    ys = [y] if wrap_h is None else [y % wrap_h, y % wrap_h - wrap_h]
    for yy in ys:
        y0, y1 = max(0, yy), min(H_, yy + gh); x0, x1 = max(0, x), min(W_, x + gw)
        if y1 <= y0 or x1 <= x0: continue
        buf[y0:y1, x0:x1] += g[y0 - yy:y1 - yy, x0 - x:x1 - x, None] * rgb

HEAD = np.array([0.86, 1.0, 0.9]); GREEN = np.array([0.16, 1.0, 0.42]); DEEP = np.array([0.02, 0.55, 0.2])
def trail_color(i, n):
    """i = 0 at the head; the tail fades through bright green to deep green"""
    if i == 0: return HEAD * 1.25
    t = i / max(1, n - 1)
    c = GREEN * (1 - t) + DEEP * t
    return c * (1.0 - t) ** 1.25 * (0.95 if i > 1 else 1.1)

def trail(buf, x, head_y, n, size, gain, wrap_h=None, seed=0):
    r = np.random.default_rng(seed); step = int(size * 1.08)
    for i in range(n):
        ch = CHARS[r.integers(len(CHARS))] if i else '01'[r.integers(2)]
        stamp(buf, glyph(ch, size), x, head_y - i * step, trail_color(i, n) * gain, wrap_h)

def glow(buf, radius, k):
    pil = Image.fromarray(np.clip(buf / max(1e-6, buf.max()) * 255, 0, 255).astype(np.uint8), 'RGB')
    g = np.asarray(pil.filter(ImageFilter.GaussianBlur(radius)), np.float32) / 255 * buf.max()
    return buf + g * k

def to_rgba(light, alpha_gain=1.0):
    """additive light on transparent → straight-alpha RGBA"""
    a = np.clip(light.max(-1) * alpha_gain, 0, 1)
    rgb = np.clip(light / np.maximum(a[..., None], 1e-4), 0, 1)
    return Image.fromarray((np.concatenate([rgb, a[..., None]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')

def save(im, name, q=86):
    p = os.path.join(OUT, name); im.save(p, 'WEBP', quality=q, method=6); print(name, im.size, f'{os.path.getsize(p) / 1024:.0f}KB')

# ---------------------------------------------------------------- tiles: seamless code rain at three depths
def code_tile(tw, th, size, colw, density, gain, ntrail, blur, seed):
    r = np.random.default_rng(seed); buf = np.zeros((th, tw, 3), np.float32)
    for c in range(tw // colw):
        x = c * colw + int(r.integers(0, max(1, colw - int(size * 0.7))))
        for _ in range(r.poisson(density) + (1 if r.random() < 0.6 else 0)):   # 0..3 trails per column, wrapping at the tile height
            n = int(r.integers(ntrail[0], ntrail[1])); g = gain * (0.45 + 0.55 * r.random())
            trail(buf, x, int(r.integers(0, th)), n, size, g, th, int(r.integers(1 << 30)))
    if blur: buf = np.asarray(Image.fromarray(np.clip(buf * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255
    buf = glow(buf, size * 0.55, 0.55)
    return to_rgba(buf)

# ---------------------------------------------------------------- sprites: single falling streams
def stream(n, size, gain, seed, tail_glow=0.7):
    step = int(size * 1.08); h = n * step + size * 3; w = int(size * 2.6)   # wide enough that the head's bloom fades out inside the image
    buf = np.zeros((h, w, 3), np.float32)
    trail(buf, int(size * 0.95), h - size * 2 - size // 2, n, size, gain, None, seed)
    # the head burns: an extra bloom around the leading glyph
    yy, xx = np.mgrid[0:h, 0:w]; hy = h - size * 1.9
    buf += (np.exp(-(((yy - hy) / (size * 0.62)) ** 2 + ((xx - w / 2) / (size * 0.55)) ** 2)) * 0.42)[..., None] * HEAD
    buf = glow(buf, size * 0.3, tail_glow)
    edge = np.clip(np.minimum(xx, w - 1 - xx) / (size * 0.35), 0, 1) * np.clip((h - 1 - yy) / (size * 0.5), 0, 1)   # no hard box at the image border
    return to_rgba(buf * edge[..., None])

# ---------------------------------------------------------------- far: the data city
def far_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    hz = 0.64
    sky = np.where(y < hz, 0.004 + 0.05 * (y / hz) ** 3, 0.03 * (1 - (y - hz) / (1 - hz)) + 0.006)
    img = np.zeros((H, W, 3), np.float32) + sky[..., None] * np.array([0.25, 1.0, 0.55])
    img += (np.exp(-(((x - 0.5) / 0.32) ** 2 + ((y - hz) / 0.16) ** 2)) * 0.22)[..., None] * np.array([0.2, 1, 0.5])   # core bloom
    # faint static code sky (texture, not motion)
    sky_code = np.zeros((H, W, 3), np.float32)
    r = np.random.default_rng(11)
    for c in range(W // 22):
        if r.random() < 0.55:
            trail(sky_code, c * 22 + int(r.integers(0, 6)), int(r.integers(0, int(H * hz))), int(r.integers(6, 22)), 14, 0.14, None, int(r.integers(1 << 30)))
    img += sky_code * np.clip((hz - y) / hz * 1.6, 0, 1)[..., None]
    # towers: three rows, far → near, glyph-textured faces with lit edges
    def towers(count, hmin, hmax, wmin, wmax, base, haze, tex, seed):
        rr = np.random.default_rng(seed); out = img
        for _ in range(count):
            cx = rr.random(); tw = rr.uniform(wmin, wmax); th = rr.uniform(hmin, hmax) * (1.2 - 0.6 * abs(cx - 0.5))
            x0, x1 = int((cx - tw / 2) * W), int((cx + tw / 2) * W); y1 = int(base * H); y0 = int((base - th) * H)
            x0, x1 = max(0, x0), min(W, x1)
            if x1 - x0 < 4: continue
            face = np.array([0.004, 0.03, 0.014]) * (1 + haze)
            out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * haze * 0.6 + face
            # window grid of glyph dots
            gy, gx = np.mgrid[y0:y1, x0:x1]
            lit = ((gy - y0) % tex < tex * 0.45) & ((gx - x0) % tex < tex * 0.45)
            on = rr.random(((y1 - y0) // tex + 1, (x1 - x0) // tex + 1)) < 0.35
            mask = lit & on[(gy - y0) // tex, (gx - x0) // tex]
            out[y0:y1, x0:x1] += mask[..., None] * np.array([0.05, 0.42, 0.18]) * (0.35 + 0.65 * (1 - haze))
            out[y0:y1, x0:x0 + 2] += np.array([0.1, 0.7, 0.32]) * (1 - haze) * 0.6   # lit edges
            out[y0:y0 + 2, x0:x1] += np.array([0.12, 0.8, 0.38]) * (1 - haze) * 0.7
            out[y0:y1, x1 - 2:x1] += np.array([0.05, 0.4, 0.18]) * (1 - haze) * 0.5
    towers(70, 0.06, 0.2, 0.012, 0.03, hz, 0.75, 4, 1)
    towers(38, 0.12, 0.34, 0.02, 0.05, hz + 0.005, 0.45, 6, 2)
    towers(16, 0.22, 0.5, 0.035, 0.07, hz + 0.01, 0.15, 8, 3)
    # horizon haze
    img += (np.exp(-((y - hz) / 0.03) ** 2) * 0.32)[..., None] * np.array([0.25, 1, 0.55])
    # perspective grid floor
    vx, vy = 0.5, hz
    fl = y > hz + 0.004
    d = np.maximum(y - vy, 1e-3)
    z = 0.035 / d                                               # depth along the floor
    gx = (x - vx) * z * 40                                      # lateral coordinate
    fz = np.abs(((z * 6) % 1) - 0.5)                            # rows
    fx_ = np.abs(((gx * 1.0) % 1) - 0.5)                        # columns
    wz = np.clip(0.012 / (z * 0.3 + 0.01), 0.006, 0.08)
    row = np.exp(-((0.5 - fz) / wz) ** 2); col = np.exp(-((0.5 - fx_) / (0.012 * z + 0.03)) ** 2)
    fade = np.clip(d / 0.05, 0, 1) * np.clip(1.2 - d * 1.2, 0.3, 1)
    grid = np.where(fl, (row * 0.7 + col * 0.55) * fade, 0)
    img += grid[..., None] * np.array([0.1, 0.75, 0.34]) * 0.55
    # reflection of the core bloom on the floor
    img += np.where(fl, np.exp(-(((x - 0.5) / 0.2) ** 2 + ((y - hz) / 0.1) ** 2)) * 0.18, 0)[..., None] * np.array([0.2, 1, 0.5])
    # vignette
    v = 1 - 0.55 * (((x - 0.5) / 0.7) ** 2 + ((y - 0.5) / 0.75) ** 2)
    img *= np.clip(v, 0.25, 1)[..., None]
    pil = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')
    return pil.filter(ImageFilter.GaussianBlur(0.6))

# ---------------------------------------------------------------- mid: two close monoliths
def mid_layer():
    light = np.zeros((H, W, 3), np.float32); alpha = np.zeros((H, W), np.float32)
    for side, (x0, x1, top) in enumerate([(0, int(W * 0.075), int(H * 0.1)), (int(W * 0.93), W, int(H * 0.18))]):
        alpha[top:, x0:x1] = 0.97
        light[top:, x0:x1] = np.array([0.006, 0.03, 0.014])
        face = np.zeros((H - top, x1 - x0, 3), np.float32)
        r = np.random.default_rng(40 + side)
        for c in range((x1 - x0) // 26):
            if r.random() < 0.7:
                trail(face, c * 26 + 4, int(r.integers(0, H - top)), int(r.integers(8, 30)), 18, 0.32, None, int(r.integers(1 << 30)))
        light[top:, x0:x1] += face
        # rim light on the inner edge and top
        ex = x1 - 3 if side == 0 else x0
        light[top:, ex:ex + 2] = np.array([0.22, 0.75, 0.4]); light[top:top + 2, x0:x1] = np.array([0.18, 0.7, 0.36])
        gy = np.linspace(0, 1, H - top)[:, None]
        light[top:, x0:x1] *= (0.55 + 0.45 * (1 - gy))[..., None]
    lp = glow(light, 10, 0.5)
    a = np.clip(np.maximum(alpha, lp.max(-1) * 0.9), 0, 1)
    rgb = np.clip(lp / np.maximum(a[..., None], 1e-4), 0, 1)
    return Image.fromarray((np.concatenate([rgb, a[..., None]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')

def rays_layer():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]; x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    cone = np.exp(-((x - 0.5) / (0.08 + 0.3 * y)) ** 2) * np.clip(1 - y * 1.1, 0, 1) * 0.35
    shafts = (0.6 + 0.4 * np.sin(x * 90 + np.sin(x * 13) * 3)) * cone
    a = np.clip(shafts, 0, 0.45)
    rgb = np.broadcast_to(np.array([0.45, 1.0, 0.65]), (H, W, 3))
    return Image.fromarray((np.concatenate([rgb, a[..., None]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(6))

def main():
    os.makedirs(OUT, exist_ok=True)
    far = far_layer(); save(far, 'far.webp', 88)
    mid = mid_layer(); save(mid, 'mid.webp')
    rays = rays_layer(); save(rays, 'rays.webp', 80)
    tf = code_tile(1024, 1024, 13, 17, 0.9, 0.55, (8, 22), 0.6, 21); save(tf, 't-codeFar.webp')
    tm = code_tile(1024, 1024, 22, 30, 0.7, 0.9, (10, 26), 0, 22); save(tm, 't-codeMid.webp')
    tn = code_tile(1024, 1024, 46, 120, 0.35, 0.5, (6, 12), 5, 23); save(tn, 't-codeNear.webp')
    specs = {'streamA': (26, 26, 1.0), 'streamB': (34, 22, 0.9), 'streamC': (18, 30, 1.0), 'streamD': (22, 40, 0.85), 'streamE': (30, 18, 0.8), 'streamF': (14, 52, 0.7)}
    for i, (name, (n, size, gain)) in enumerate(specs.items()):
        save(stream(n, size, gain, 100 + i), f's-{name}.webp')
    # flat preview: far + a frame of the planes + mid + rays
    flat = far.convert('RGBA')
    for t, rel in ((tf, 0.5), (tm, 0.8)):
        tw = int(W * rel); ts = t.resize((tw, tw), Image.BILINEAR); plane = Image.new('RGBA', (W, H))
        for yy in range(0, H, tw):
            for xx in range(0, W, tw): plane.alpha_composite(ts, (xx, yy))
        flat.alpha_composite(plane)
    flat.alpha_composite(mid); flat.alpha_composite(rays)
    p = os.path.join(ROOT, 'wallpapers/digital-rain.webp'); flat.convert('RGB').save(p, 'WEBP', quality=84, method=6)
    flat.convert('RGB').resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs/digital-rain.webp'), 'WEBP', quality=82, method=6)
    print('flat', os.path.getsize(p) // 1024, 'KB')

if __name__ == '__main__':
    main()
