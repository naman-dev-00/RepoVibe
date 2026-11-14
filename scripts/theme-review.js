'use strict';
/* Visual review material for the owner's approval of the built-in themes: for every preset a 1600×900 screenshot on the real-page replay
   (Ambient, popup closed) plus the measured facts the audit needs. node scripts/theme-review.js → docs/theme-review/<preset>.jpg + facts.json */
const fs = require('node:fs'), path = require('node:path');
const { launch, setConfig, visualContrast } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.join(__dirname, '../docs/theme-review'); fs.mkdirSync(OUT, { recursive: true });
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
(async () => {
  const facts = {};
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Array.from({ length: 20 }, (_, i) => `preset-${i + 1}`);
  for (const id of ids) {
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      if (SNAP) await R.serve(context, R.load(SNAP));
      await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthQuality: 'full', depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 100 } });
      const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project'); await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: 'jpeg', quality: 82 });
      const f = await page.evaluate(() => { const d = document.getElementById('repovibe-depth'); return { scene: d?.dataset.scene || null, layers: d ? [...d.children].filter(c => c.dataset.l).length : 0, sprites: document.querySelectorAll('#repovibe-depth .repv-s').length, popOuts: [...document.querySelectorAll('#repovibe-popout > .repv-s')].filter(w => !w.hidden).length, motionClass: [...document.documentElement.classList].find(c => /^repv-motion-(?!cinematic)/.test(c)) || null }; });
      const vc = await visualContrast(context, page);
      facts[id] = { ...f, textMin: +vc.min.toFixed(2), aaFails: vc.fails.length };
      console.log(id, JSON.stringify(facts[id]));
    } finally { await close(); }
  }
  const file = path.join(OUT, 'facts.json'); const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify({ ...prev, ...facts }, null, 1) + '\n');
})();
