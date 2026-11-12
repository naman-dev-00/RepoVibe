'use strict';
/* Round-3 curation evidence. Runs against the extension in THIS checkout (run a copy inside a git worktree of an older commit for the
   "before" shots). On the real github.com page replay when the local snapshot exists (offline fixture otherwise), Ambient, 1600×900:
     <out>/alpine-lake-github.jpg, <out>/synthwave-valley-github.jpg  — a theme based on Cyberpunk Neon (live rain) moved onto each background
     <out>/alpine-lake-motion.jpg, <out>/synthwave-valley-motion.jpg  — two frames 0.5 s apart + whether rain runs
     <out>/gallery.jpg (Studio gallery, full page), <out>/background-picker.jpg (Studio Background picker), <out>/popup.jpg
   node scripts/curation-evidence.js <outDir> */
const fs = require('node:fs'), path = require('node:path');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.resolve(process.argv[2] || 'docs/screenshots/rework3/curation'); fs.mkdirSync(OUT, { recursive: true });
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const base = { name: 'Neon theme on another background', description: 'x', bg: '#100c25', surface: '#1b1538', surfaceAlt: '#292044', text: '#f3edff', muted: '#c4bbe3', accent: '#c6a8ff', border: '#49337e', gradientTo: '#25104c', gradientThird: '#051f31', code: '#15122a', backgroundMode: 'image', motion: 'rain', flagship: true };
(async () => {
  const facts = {};
  for (const [name, ref] of [['alpine-lake', 'builtin:alpine-lake'], ['synthwave-valley', 'builtin:synthwave-3d']]) {
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      if (SNAP) await R.serve(context, R.load(SNAP));
      await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: 'custom-x', customThemes: { 'custom-x': { ...base, id: 'custom-x', wallpaperRef: ref } } });
      const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project'); await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(OUT, `${name}-github.jpg`), type: 'jpeg', quality: 84 });
      const a = await page.screenshot({ clip: { x: 0, y: 168, width: 1600, height: 440 } }); await page.waitForTimeout(500);
      const b = await page.screenshot({ clip: { x: 0, y: 168, width: 1600, height: 440 } });
      facts[name] = await page.evaluate(() => ({ rainClass: document.documentElement.className.includes('repv-motion-rain'), rainAnimations: document.getAnimations().filter(x => x.animationName === 'repv-rain').length }));
      const sheet = await extPage(context); await sheet.setViewportSize({ width: 1600, height: 2 * 474 });
      await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 18px system-ui">${[a, b].map((f, i) => `<div style="padding:6px 12px">t = ${i * 0.5} s · rain layer ${facts[name].rainClass ? 'ON' : 'off'}</div><img src="data:image/png;base64,${f.toString('base64')}" width=1600 height=440 style="display:block">`).join('')}</body>`);
      await sheet.waitForTimeout(300); await sheet.screenshot({ path: path.join(OUT, `${name}-motion.jpg`), type: 'jpeg', quality: 80 });
      console.log(name, JSON.stringify(facts[name]));
    } finally { await close(); }
  }
  {
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      await setConfig(context, { enabled: true, defaultThemeId: 'preset-8' });
      const studio = await extPage(context, 'studio.html?view=gallery#gallery'); await studio.setViewportSize({ width: 1400, height: 1000 });
      await studio.waitForSelector('.gallery-card'); await studio.waitForTimeout(1200);
      await studio.screenshot({ path: path.join(OUT, 'gallery.jpg'), type: 'jpeg', quality: 82, fullPage: true });
      facts.gallery = await studio.evaluate(() => ({ count: document.getElementById('galleryCount')?.textContent, groups: Object.fromEntries([...document.querySelectorAll('.gallery-group')].map(g => [g.dataset.group, [...g.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent)])) }));
      await studio.click('.sidebar-link[data-view="background"]'); await studio.waitForSelector('#wallpaperGrid .wallpaper-tile'); await studio.waitForTimeout(1200);
      await studio.locator('#wallpaperGrid').screenshot({ path: path.join(OUT, 'background-picker.jpg'), type: 'jpeg', quality: 82 });
      facts.picker = await studio.evaluate(() => [...document.querySelectorAll('#wallpaperGrid .wallpaper-tile')].map(t => t.title));
      const popup = await extPage(context, 'popup.html'); await popup.setViewportSize({ width: 384, height: 760 }); await popup.waitForTimeout(1200);
      await popup.screenshot({ path: path.join(OUT, 'popup.jpg'), type: 'jpeg', quality: 86 });
      facts.popupFeatured = await popup.evaluate(() => [...document.querySelectorAll('#quickThemes > *')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    } finally { await close(); }
  }
  fs.writeFileSync(path.join(OUT, 'facts.json'), JSON.stringify(facts, null, 1) + '\n');
  console.log(JSON.stringify(facts.gallery), facts.picker.length, 'picker tiles');
})().catch(e => { console.error(e); process.exit(1); });
