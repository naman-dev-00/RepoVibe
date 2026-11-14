#!/usr/bin/env node
'use strict';
/* Renders the original RepoVibe wallpaper scenes to bundled WebP assets.
   Usage: node scripts/wallpapers/generate.js [--sheet path.png]
   Output: wallpapers/<slug>.webp (1920x1080) and wallpapers/thumbs/<slug>.webp (480x270). Deterministic per seed. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'wallpapers');
const SCENES = fs.readFileSync(path.join(__dirname, 'scenes.js'), 'utf8');
// slug -> seed (stable)
const LIST = ['neon-rain-street', 'midnight-skyline', 'sakura-street', 'cozy-room', 'digital-rain', 'gothic-castle', 'ocean-depths', 'forest-waterfall', 'pixel-dusk', 'pixel-island', 'solar-sunset', 'snow-peaks', 'lavender-fantasy', 'academia-library', 'mono-lines', 'obsidian-shards', 'aurora-lake', 'sunset-village', 'galaxy-planet', 'synthwave-grid'];

(async () => {
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: SCENES });
  const sheet = [];
  for (const [i, slug] of LIST.entries()) {
    const out = await page.evaluate(async ([name, seed]) => {
      const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
      const ctx = c.getContext('2d');
      let a = seed; const r = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.REPV_SCENES[name](ctx, r);
      const t = document.createElement('canvas'); t.width = 480; t.height = 270; const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(c, 0, 0, 480, 270);
      return { full: c.toDataURL('image/webp', 0.84), thumb: t.toDataURL('image/webp', 0.8) };
    }, [slug, 1000 + i * 7919]);
    const full = Buffer.from(out.full.split(',')[1], 'base64'), thumb = Buffer.from(out.thumb.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, `${slug}.webp`), full);
    fs.writeFileSync(path.join(OUT, 'thumbs', `${slug}.webp`), thumb);
    sheet.push([slug, out.thumb]);
    console.log(`${slug.padEnd(18)} ${(full.length / 1024).toFixed(0).padStart(4)} KB  thumb ${(thumb.length / 1024).toFixed(0)} KB`);
  }
  const sheetPath = process.argv.includes('--sheet') ? process.argv[process.argv.indexOf('--sheet') + 1] : null;
  if (sheetPath) {
    await page.setViewportSize({ width: 1940, height: 1220 });
    await page.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,480px);gap:4px;padding:4px;font:12px sans-serif;color:#fff">${sheet.map(([s, d]) => `<div style="position:relative"><img src="${d}" width=480 height=270 style="display:block"><span style="position:absolute;left:6px;bottom:4px;background:#0008;padding:2px 5px">${s}</span></div>`).join('')}</body>`);
    await page.screenshot({ path: sheetPath, fullPage: true });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
