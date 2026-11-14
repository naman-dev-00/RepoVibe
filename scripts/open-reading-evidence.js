'use strict';
/* Developer evidence for "Text only" readability backing vs the previous full panels: same real-page replay, same
   theme, same scroll positions. Reports the share of the viewport where the scene is exposed (nothing painted over
   it), screenshot-measured text contrast, and writes side-by-side before/after images.
   node scripts/open-reading-evidence.js [presetIds...]   (needs local snapshots in tests/e2e/real-snapshots) */
const fs = require('node:fs');
const path = require('node:path');
const { launch, extPage, setConfig, visualContrast, sceneMetrics } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.join(__dirname, '../docs/screenshots/open-reading');
const NAMES = { 'preset-1': 'cyberpunk-neon', 'preset-8': 'enchanted-forest', 'preset-19': 'cosmic-galaxy', 'preset-15': 'futuristic-scifi' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const presets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAMES);
  const rows = [];
  for (const snapName of R.available().filter(n => !process.env.SNAP || n.includes(process.env.SNAP))) {
    const snap = R.load(snapName);
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      await R.serve(context, snap);
      const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
      for (const id of presets) {
        const shots = {};
        for (const mode of ['panels', 'text']) {
          await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: id, readingBacking: mode });
          await page.goto(snap.main); await page.waitForTimeout(900);
          const stops = await page.evaluate(() => { const md = document.querySelector('.markdown-body'); const y = md ? md.getBoundingClientRect().top + scrollY - 80 : null; return [0, ...(y ? [y, y + innerHeight * 0.9] : [innerHeight, innerHeight * 2])]; });
          shots[mode] = [];
          for (const [i, y] of stops.entries()) {
            await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(250);
            const m = await sceneMetrics(context, page);
            const vc = await visualContrast(context, page, 400);
            shots[mode].push({ y: Math.round(y), exposed: m.exposedShare, min: vc.min, below45: vc.below45, n: vc.count, low: vc.low.slice(0, 3).map(x => `${x.text.slice(0, 30)} ${x.ratio.toFixed(2)}`), png: await page.screenshot() });
            void i;
          }
        }
        for (let i = 0; i < shots.text.length; i++) {
          const b = shots.panels[i], a = shots.text[i];
          rows.push({ page: snapName, world: NAMES[id], stop: i, exposedBefore: +(b.exposed * 100).toFixed(1), exposedAfter: +(a.exposed * 100).toFixed(1), minBefore: +b.min.toFixed(2), minAfter: +a.min.toFixed(2), below45After: a.below45, textAfter: a.n, lowAfter: a.low });
          if (i > 0 || snapName.endsWith('code')) {
            const helper = await extPage(context); await helper.setViewportSize({ width: 1366 * 2 + 12, height: 768 + 30 });
            await helper.setContent(`<body style="margin:0;background:#000;font:600 14px sans-serif;color:#fff;display:flex;gap:12px">${[['BEFORE · full panels', b], ['AFTER · text-only backing', a]].map(([t, s]) => `<div><div style="height:30px;line-height:30px;padding-left:8px">${t} — scene exposed ${(s.exposed * 100).toFixed(0)} % of viewport · text min ${s.min.toFixed(2)}:1</div><img style="display:block" src="data:image/png;base64,${s.png.toString('base64')}"></div>`).join('')}</body>`);
            await helper.waitForTimeout(300);
            await helper.screenshot({ path: path.join(OUT, `${snapName}-${NAMES[id]}-${i}.jpg`), type: 'jpeg', quality: 80 }); await helper.close();
          }
        }
        console.log(rows.filter(r => r.page === snapName && r.world === NAMES[id]).map(r => `${r.page} ${r.world} stop${r.stop}: exposed ${r.exposedBefore}% → ${r.exposedAfter}%, text min ${r.minBefore} → ${r.minAfter}, <4.5 after ${r.below45After}${r.lowAfter.length ? ` [${r.lowAfter.join('; ')}]` : ''}`).join('\n'));
      }
    } finally { await close(); }
  }
  fs.writeFileSync(path.join(__dirname, '../docs/open-reading-metrics.json'), JSON.stringify(rows, null, 2) + '\n');
})();
