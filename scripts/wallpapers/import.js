#!/usr/bin/env node
'use strict';
/* Imports an external high-resolution wallpaper (e.g. a Blender/Unreal render or a licensed 3D wallpaper pack).
   Usage:
     node scripts/wallpapers/import.js <image.png|jpg|webp> --slug misty-temple --name "Misty temple" \
       --category Anime-inspired --style 3d --license "CC BY 4.0" --attribution "Jane Doe" --source-url https://…
   Produces wallpapers/<slug>.webp (2560x1440, centre-cropped "cover") + thumbnail, adds/updates the manifest entry,
   and rebuilds shared/wallpaper-catalog.js. Refuses to run without licence and attribution. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const input = args[0];
const meta = { slug: opt('slug'), name: opt('name'), category: opt('category') || 'Other', style: opt('style') || '3d', license: opt('license'), attribution: opt('attribution'), sourceUrl: opt('source-url'), licenseFile: opt('license-file') };
const missing = ['slug', 'name', 'license', 'attribution'].filter(k => !meta[k]);
if (!input || !fs.existsSync(input) || missing.length) { console.error(`Usage: import.js <image> --slug --name --license --attribution [--category --style 3d|illustrated|photo --source-url | --license-file]\nMissing: ${missing.join(', ') || 'input file'}`); process.exit(1); }
if (!meta.sourceUrl && !meta.licenseFile) { console.error('Provide --source-url or --license-file so the licence can be verified.'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage();
  const ext = path.extname(input).slice(1).toLowerCase().replace('jpg', 'jpeg');
  const enc = await page.evaluate(async ([src]) => {
    const i = new Image(); i.src = src; await i.decode();
    if (i.naturalWidth < 1920 || i.naturalHeight < 1080) throw new Error(`source is ${i.naturalWidth}x${i.naturalHeight}; premium wallpapers need at least 1920x1080`);
    const draw = (W, H) => { const c = new OffscreenCanvas(W, H); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      const s = Math.max(W / i.naturalWidth, H / i.naturalHeight); const w = i.naturalWidth * s, h = i.naturalHeight * s; g.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); return c; };
    const b64 = async (c, q) => { const u = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: q })).arrayBuffer()); let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); };
    return { full: await b64(draw(2560, 1440), 0.9), thumb: await b64(draw(480, 270), 0.82) };
  }, [`data:image/${ext};base64,${fs.readFileSync(input).toString('base64')}`]);
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'wallpapers', `${meta.slug}.webp`), Buffer.from(enc.full, 'base64'));
  fs.writeFileSync(path.join(ROOT, 'wallpapers/thumbs', `${meta.slug}.webp`), Buffer.from(enc.thumb, 'base64'));
  const file = path.join(ROOT, 'wallpapers/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entry = { ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v)), source: 'imported', width: 2560, height: 1440 };
  manifest.wallpapers = manifest.wallpapers.filter(w => w.slug !== meta.slug).concat(entry);
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  execFileSync(process.execPath, [path.join(__dirname, 'build-catalog.js')], { stdio: 'inherit' });
  console.log(`Imported ${meta.slug}. Assign it to a preset in shared/core.js (PRESET_WALLPAPERS) or pick it in the Studio.`);
})().catch(e => { console.error(e.message || e); process.exit(1); });
