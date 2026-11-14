#!/usr/bin/env python3
"""Intake for owner-supplied master artwork (the route for scenes that must not be redrawn by code: Cherry Blossom, Anime Street,
Waterfall, Cozy Coding). It never repaints, filters, sharpens, blurs or enlarges the art: it only checks it, crops it to 16:9 around the
focal point when needed, and encodes it.

Put the files in art-masters/<slug>/ (not shipped, not committed) — see docs/MASTER_ART.md:
  world.json    name, category, description, license, attribution, source, focal [x, y] (0..1, default 0.5 0.5)
  master.png    the complete illustration (PNG / lossless WebP / high-quality JPEG). Required.
  far.png mid.png near.png front.png rays.png    optional depth layers, same canvas as master, transparent where empty
  s-<name>.png  optional moving elements (transparent cut-outs, any size)      t-<name>.png  optional seamless tiles / masks

What it checks, and refuses on (exit 1) unless --allow is given for that check:
  licence       license/attribution/source must be filled in; placeholders such as "unknown" or "found online" are refused
  size          master at least 2560 × 1440 after the 16:9 crop (3840 × 2160 recommended; below that a 4K screen upscales it)
  real detail   an image that was enlarged from a small original has almost no fine detail left at its pixel size. Measured by comparing
                the image with itself after a 2× down-and-up resample: the share of edge energy that survives. Refused above 0.90; 0.72–0.90 is reported as possibly mildly enlarged.
  layers        every layer has the master's canvas size; layers composited in order must reproduce the master closely
                (mean absolute difference reported; refused above 6/255) so the layered scene looks like the approved illustration

What it writes (never larger than the source; nothing is upscaled):
  wallpapers/<slug>.webp (+ thumbs/)                flat scene for Static mode, previews and the gallery
  wallpapers/depth/<slug>/<layer>.webp              full size (up to 3840 wide), WebP quality 93 (alpha preserved)
  wallpapers/depth/<slug>/<layer>.2k.webp           2560-wide variant served to screens that cannot show more
  wallpapers/depth/<slug>/s-*.webp, t-*.webp        sprites and tiles, re-encoded only
  wallpapers/manifest.json                          entry added or updated (licence and attribution copied from world.json)
Then run: node scripts/wallpapers/build-catalog.js      and define the motion in shared/worlds.js.

  python3 -I scripts/wallpapers/import-master.py <slug> [--check-only] [--allow size|detail|layers]"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
LAYERS = ['far', 'mid', 'near', 'front', 'rays']
BAD_LICENSE = ('unknown', 'found online', 'internet', 'pinterest', 'google', 'tbd', 'todo', 'n/a', 'none', '?')
Image.MAX_IMAGE_PIXELS = 120_000_000

def find(d, stem):
    for ext in ('.png', '.webp', '.jpg', '.jpeg', '.tif', '.tiff'):
        p = os.path.join(d, stem + ext)
        if os.path.exists(p): return p
    return None

def crop_box(w, h, focal):
    """largest 16:9 box inside (w, h), centred on the focal point as far as the edges allow — never stretches"""
    tw, th = (w, round(w * 9 / 16)) if w * 9 <= h * 16 else (round(h * 16 / 9), h)
    x0 = min(max(0, round(focal[0] * w - tw / 2)), w - tw); y0 = min(max(0, round(focal[1] * h - th / 2)), h - th)
    return (x0, y0, x0 + tw, y0 + th)

def detail_survival(im):
    """share of edge energy that survives a 2× down/up resample. Genuine full-resolution art loses a lot (≈0.45–0.85);
    an image enlarged from a smaller one loses almost nothing (> 0.93) because the fine detail was never there."""
    g = im.convert('L'); w, h = g.size
    if max(w, h) > 2560: g = g.crop(((w - 2560) // 2 if w > 2560 else 0, (h - 1440) // 2 if h > 1440 else 0, (w + 2560) // 2 if w > 2560 else w, (h + 1440) // 2 if h > 1440 else h))   # centre crop, native pixels
    a = np.asarray(g, np.float32)
    b = np.asarray(g.resize((g.width // 2, g.height // 2), Image.LANCZOS).resize(g.size, Image.BICUBIC), np.float32)
    lap = lambda x: np.abs(4 * x[1:-1, 1:-1] - x[:-2, 1:-1] - x[2:, 1:-1] - x[1:-1, :-2] - x[1:-1, 2:])
    ea, eb = float(lap(a).mean()), float(lap(b).mean())
    return eb / max(ea, 1e-6), ea

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; flags = sys.argv[1:]
    allow = {flags[i + 1] for i, f in enumerate(flags) if f == '--allow' and i + 1 < len(flags)}; args = [a for a in args if a not in allow]
    if len(args) != 1: print(__doc__); sys.exit(2)
    slug = args[0]; src = os.path.join(ROOT, 'art-masters', slug); problems, notes = [], []
    if not os.path.isdir(src): sys.exit(f'art-masters/{slug}/ not found (see docs/MASTER_ART.md)')
    meta_p = os.path.join(src, 'world.json')
    if not os.path.exists(meta_p): sys.exit('world.json missing')
    meta = json.load(open(meta_p))
    for k in ('name', 'category', 'description', 'license', 'attribution', 'source'):
        v = str(meta.get(k, '')).strip()
        if not v: problems.append(f'world.json: "{k}" is empty')
        elif k in ('license', 'source') and any(v.lower() == b or v.lower().startswith(b + ' ') for b in BAD_LICENSE): problems.append(f'world.json: "{k}" = "{v}" is not a usable right to ship the artwork')
    focal = meta.get('focal', [0.5, 0.5])
    mp = find(src, 'master')
    if not mp: sys.exit('master image missing (master.png / .webp / .jpg)')
    master = Image.open(mp); box = crop_box(*master.size, focal); cw, ch = box[2] - box[0], box[3] - box[1]
    notes.append(f'master {master.width}×{master.height} ({os.path.basename(mp)}), 16:9 crop {cw}×{ch} at {box[:2]} (focal {focal})' + ('' if (cw, ch) == master.size else ' — cropped, not stretched'))
    if cw < 2560 or ch < 1440: (notes if 'size' in allow else problems).append(f'size: {cw}×{ch} after cropping is below 2560×1440; a 2560 screen would upscale it {2560 / cw:.2f}×')
    elif cw < 3840: notes.append(f'size: fine for 2560×1440; a 3840×2160 screen will upscale it {3840 / cw:.2f}× (supply ≥ 3840 wide to avoid that)')
    if mp.lower().endswith(('.jpg', '.jpeg')): notes.append('master is a JPEG: its compression artefacts are baked in; prefer PNG or lossless WebP')
    surv, energy = detail_survival(master.crop(box))
    notes.append(f'real detail: {surv:.2f} of edge energy survives a 2× down/up resample (edge energy {energy:.1f}); enlarged images score > 0.9')
    if 0.72 < surv <= 0.9: notes.append("real detail: softer than native art usually is — possibly enlarged by up to ~1.5×, or simply a soft painting; judge by eye at 100 %")
    if surv > 0.9: (notes if 'detail' in allow else problems).append('real detail: this looks enlarged from a smaller image — its pixel size overstates its detail')
    layers = {l: find(src, l) for l in LAYERS}; layers = {l: p for l, p in layers.items() if p}
    if layers:
        if 'far' not in layers: problems.append("layers: 'far' is required when layers are supplied")
        comp = None
        for l in LAYERS:
            if l not in layers: continue
            im = Image.open(layers[l]).convert('RGBA')
            if im.size != master.size: problems.append(f'layers: {l} is {im.width}×{im.height}, the master is {master.width}×{master.height}'); continue
            if l != 'rays': comp = im if comp is None else Image.alpha_composite(comp, im)
        if comp is not None and not any(p.startswith('layers:') for p in problems):
            a = np.asarray(comp.convert('RGB').resize((960, 540), Image.BILINEAR), np.float32); b = np.asarray(master.convert('RGB').resize((960, 540), Image.BILINEAR), np.float32)
            mad = float(np.abs(a - b).mean()); notes.append(f'layers: far→front composited differ from the master by {mad:.1f}/255 on average')
            if mad > 6: (notes if 'layers' in allow else problems).append(f'layers: the composite does not reproduce the master (mean difference {mad:.1f}/255)')
    else: notes.append('no depth layers supplied: the scene will be a single sharp plate; motion then comes only from sprites, tiles and light')
    print('\n'.join('  ' + n for n in notes))
    if problems:
        print('\nREFUSED:\n' + '\n'.join('  - ' + p for p in problems)); sys.exit(1)
    if '--check-only' in flags: print('\nOK (check only, nothing written)'); return
    # ---- encode. Never upscale: the full variant is the crop itself, capped at 3840 wide.
    out = os.path.join(ROOT, 'wallpapers/depth', slug); os.makedirs(out, exist_ok=True)
    fw = min(cw, 3840); fh = round(fw * 9 / 16); budget = []
    def fit(im, w, h): return im if im.size == (w, h) else im.resize((w, h), Image.LANCZOS)
    def enc(im, path, q=93):
        kw = dict(quality=q, method=6);
        if im.mode == 'RGBA': kw['alpha_quality'] = 100; kw['exact'] = True
        im.save(path, 'WEBP', **kw); budget.append((os.path.relpath(path, ROOT), im.size, os.path.getsize(path)))
    flat = fit(master.crop(box).convert('RGB'), fw, fh)
    enc(flat, os.path.join(ROOT, 'wallpapers', f'{slug}.webp')); flat.resize((480, 270), Image.LANCZOS).save(os.path.join(ROOT, 'wallpapers/thumbs', f'{slug}.webp'), 'WEBP', quality=86, method=6)
    plates = layers or {'far': mp}
    for l, p in plates.items():
        im = Image.open(p); im = im.convert('RGBA' if (l != 'far' or im.mode in ('RGBA', 'LA', 'P')) and layers else 'RGB').crop(box)
        enc(fit(im, fw, fh), os.path.join(out, f'{l}.webp'))
        if fw > 2560: enc(fit(im, 2560, 1440), os.path.join(out, f'{l}.2k.webp'))
    for f in sorted(os.listdir(src)):
        stem, ext = os.path.splitext(f)
        if stem[:2] in ('s-', 't-') and ext.lower() in ('.png', '.webp'): enc(Image.open(os.path.join(src, f)).convert('RGBA'), os.path.join(out, stem + '.webp'), 92)
    mf = os.path.join(ROOT, 'wallpapers/manifest.json'); m = json.load(open(mf))
    entry = {'slug': slug, 'name': meta['name'], 'category': meta['category'], 'style': '3d', 'source': 'master-art', 'generator': 'scripts/wallpapers/import-master.py',
             'description': meta['description'], 'width': fw, 'height': fh, 'license': meta['license'], 'attribution': meta['attribution'], 'artSource': meta['source']}
    m['wallpapers'] = [w for w in m['wallpapers'] if w['slug'] != slug] + [entry]
    open(mf, 'w').write(json.dumps(m, indent=2, ensure_ascii=False) + '\n')
    total = sum(b[2] for b in budget); gpu = sum(b[1][0] * b[1][1] * 4 for b in budget if '/depth/' in b[0] and '.2k.' not in b[0]) / 1e6
    print('\nWritten:'); [print(f'  {p}  {s[0]}×{s[1]}  {n / 1024:.0f} KB') for p, s, n in budget]
    print(f'\npackage +{total / 1e6:.1f} MB; decoded full-size layers ≈ {gpu:.0f} MB of image memory on a 4K screen ({gpu * (2560 * 1440) / (fw * fh):.0f} MB with the 2k variants)')
    print('next: node scripts/wallpapers/build-catalog.js, then define tiles/sprites for this slug in shared/worlds.js')

if __name__ == '__main__':
    main()
