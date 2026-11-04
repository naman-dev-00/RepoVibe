#!/usr/bin/env node
'use strict';
/* Validates wallpapers/manifest.json and generates shared/wallpaper-catalog.js (consumed by the extension).
   For every entry: the WebP + thumbnail must exist, dimensions must match, licence/attribution must be present,
   and the readability tones (98th / 2nd percentile colour per channel) are measured from the actual image. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const STYLES = ['3d', 'illustrated', 'photo'];

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'wallpapers/manifest.json'), 'utf8'));
  const problems = [];
  const slugs = new Set();
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage();
  const out = [];
  for (const w of manifest.wallpapers) {
    if (!/^[a-z0-9-]{1,40}$/.test(w.slug || '')) { problems.push(`bad slug ${w.slug}`); continue; }
    if (slugs.has(w.slug)) problems.push(`duplicate slug ${w.slug}`); slugs.add(w.slug);
    if (!STYLES.includes(w.style)) problems.push(`${w.slug}: style must be one of ${STYLES}`);
    for (const k of ['name', 'category', 'license', 'attribution']) if (!w[k]) problems.push(`${w.slug}: missing ${k}`);
    if (w.source === 'imported' && !w.sourceUrl && !w.licenseFile) problems.push(`${w.slug}: imported wallpapers need sourceUrl or licenseFile`);
    const file = path.join(ROOT, 'wallpapers', `${w.slug}.webp`), thumb = path.join(ROOT, 'wallpapers/thumbs', `${w.slug}.webp`);
    if (!fs.existsSync(file) || !fs.existsSync(thumb)) { problems.push(`${w.slug}: missing wallpaper or thumbnail`); continue; }
    const info = await page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = new OffscreenCanvas(480, 270); const g = c.getContext('2d'); g.drawImage(i, 0, 0, 480, 270);
      const d = g.getImageData(0, 0, 480, 270).data; const ch = [[], [], []];
      for (let k = 0; k < d.length; k += 4) { ch[0].push(d[k]); ch[1].push(d[k + 1]); ch[2].push(d[k + 2]); }
      const pct = (a, q) => { a.sort((x, y) => x - y); return a[Math.floor(a.length * q)]; };
      const hex = v => `#${v.map(x => x.toString(16).padStart(2, '0')).join('')}`;
      // toneSoft: the same percentiles after a blur equivalent to RepoVibe's minimum panel backdrop blur (6 px at
      // 1920 px ≈ 1.5 px at this 480 px size): what text on blurred glass can actually sit on.
      const cs = new OffscreenCanvas(480, 270); const gs = cs.getContext('2d'); gs.filter = 'blur(1.5px)'; gs.drawImage(i, 0, 0, 480, 270);
      const ds = gs.getImageData(8, 8, 464, 254).data; const cs3 = [[], [], []];
      for (let k = 0; k < ds.length; k += 4) { cs3[0].push(ds[k]); cs3[1].push(ds[k + 1]); cs3[2].push(ds[k + 2]); }
      return { width: i.naturalWidth, height: i.naturalHeight, tone: [hex(ch.map(a => pct(a.slice(), 0.98))), hex(ch.map(a => pct(a.slice(), 0.02)))],
        toneSoft: [hex(cs3.map(a => pct(a.slice(), 0.98))), hex(cs3.map(a => pct(a.slice(), 0.02)))] };
    }, `data:image/webp;base64,${fs.readFileSync(file).toString('base64')}`);
    if (w.width && (info.width !== w.width || info.height !== w.height)) problems.push(`${w.slug}: is ${info.width}x${info.height}, manifest says ${w.width}x${w.height}`);
    if (info.width < 1920) problems.push(`${w.slug}: below 1920px wide`);
    // Depth layers (2.5D engine): present only when rendered with render3d.js --layers.
    const depthDir = path.join(ROOT, 'wallpapers', 'depth', w.slug);
    const depth = ['far', 'mid', 'near', 'front', 'rays'].filter(l => fs.existsSync(path.join(depthDir, `${l}.webp`)));
    if (depth.length && !depth.includes('far')) problems.push(`${w.slug}: depth layers need at least 'far'`);
    // Depth worlds: readability tones must cover what the depth engine actually shows (layers composited, light shafts at
    // their runtime 0.8 opacity), which can be brighter than the flat image. Use the brighter / darker of both (99/1 %).
    if (depth.length) {
      const srcs = depth.filter(l => l !== 'rays').map(l => `data:image/webp;base64,${fs.readFileSync(path.join(depthDir, `${l}.webp`)).toString('base64')}`);
      const rays = depth.includes('rays') ? `data:image/webp;base64,${fs.readFileSync(path.join(depthDir, 'rays.webp')).toString('base64')}` : null;
      const comp = await page.evaluate(async ([srcs, rays]) => {
        const c = new OffscreenCanvas(480, 270); const g = c.getContext('2d');
        const draw = async (src, a) => { const i = new Image(); i.src = src; await i.decode(); g.globalAlpha = a; g.drawImage(i, 0, 0, 480, 270); };
        for (const s of srcs) await draw(s, 1); if (rays) await draw(rays, 0.8);
        const d = g.getImageData(0, 0, 480, 270).data; const ch = [[], [], []];
        for (let k = 0; k < d.length; k += 4) { ch[0].push(d[k]); ch[1].push(d[k + 1]); ch[2].push(d[k + 2]); }
        const pct = (a, q) => { a.sort((x, y) => x - y); return a[Math.floor(a.length * q)]; };
        return [ch.map(a => pct(a.slice(), 0.99)), ch.map(a => pct(a.slice(), 0.01))];
      }, [srcs, rays]);
      // moving objects (sprites) can sit behind any panel: their bright opaque pixels count too
      const spriteFiles = fs.readdirSync(depthDir).filter(f => /^s-[A-Za-z0-9]+\.webp$/.test(f)).map(f => `data:image/webp;base64,${fs.readFileSync(path.join(depthDir, f)).toString('base64')}`);
      if (spriteFiles.length) {
        const sp = await page.evaluate(async srcs => {
          const ch = [[], [], []];
          for (const src of srcs) { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(160, Math.max(1, Math.round(160 * i.naturalHeight / i.naturalWidth))); const g = c.getContext('2d'); g.drawImage(i, 0, 0, c.width, c.height);
            const d = g.getImageData(0, 0, c.width, c.height).data; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 200) { ch[0].push(d[k]); ch[1].push(d[k + 1]); ch[2].push(d[k + 2]); } }
          const pct = (a, q) => { a.sort((x, y) => x - y); return a[Math.floor(a.length * q)] || 0; };
          return ch.map(a => pct(a, 0.99));
        }, spriteFiles);
        comp[0] = comp[0].map((v, i) => Math.max(v, sp[i]));
      }
      const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), hex = v => `#${v.map(x => x.toString(16).padStart(2, '0')).join('')}`;
      const [hi, lo] = [rgb(info.tone[0]), rgb(info.tone[1])];
      info.tone = [hex(hi.map((v, i) => Math.max(v, comp[0][i]))), hex(lo.map((v, i) => Math.min(v, comp[1][i])))];
    }
    const sprites = fs.existsSync(depthDir) ? fs.readdirSync(depthDir).filter(f => /^s-[A-Za-z0-9]+\.webp$/.test(f)).map(f => f.slice(2, -5)).sort() : [];
    out.push({ slug: w.slug, name: w.name, category: w.category, style: w.style, tone: info.tone, toneSoft: info.toneSoft, ...(depth.length ? { depth } : {}), ...(sprites.length ? { sprites } : {}) });
  }
  await browser.close();
  if (problems.length) { console.error(`Wallpaper catalog FAILED:\n - ${problems.join('\n - ')}`); process.exit(1); }
  const js = `/* GENERATED by scripts/wallpapers/build-catalog.js from wallpapers/manifest.json — do not edit by hand. */\n(function (root) {\n  'use strict';\n  root.RepoVibeWallpaperCatalog = Object.freeze(${JSON.stringify(out, null, 2).replace(/\n/g, '\n  ')}.map(Object.freeze));\n})(globalThis);\n`;
  fs.writeFileSync(path.join(ROOT, 'shared/wallpaper-catalog.js'), js);
  console.log(`Catalog OK: ${out.length} wallpapers (${out.filter(w => w.style === '3d').length} 3D, ${out.filter(w => w.style !== '3d').length} other)`);
})().catch(e => { console.error(e); process.exit(1); });
