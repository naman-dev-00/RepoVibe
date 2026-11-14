'use strict';
/* Before/after quality evidence at 1920x1080 and 3840x2160 (real-page replay when a local snapshot exists). Writes docs/screenshots/worlds/quality/<slug>-after-{1080p,4k}.jpg
   and a 4K crop of the nearest sprites at 1:1. node scripts/quality-evidence.js slug:preset ... */
const path = require('node:path');
const { launch, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.join(__dirname, '../docs/screenshots/worlds/quality');
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
(async () => {
  for (const arg of process.argv.slice(2)) {
    const [slug, id] = arg.split(':');
    for (const [tag, w, h] of [['1080p', 1920, 1080], ['4k', 3840, 2160]]) {
      const { context, close } = await launch({ colorScheme: 'dark' });
      try {
        if (SNAP) await R.serve(context, R.load(SNAP));
        await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthEffects: true, depthQuality: 'full', depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 100 } });
        const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
        await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
        await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached', timeout: 20000 });
        await page.waitForFunction(() => [...document.querySelectorAll('#repovibe-depth img, #repovibe-popout img')].every(i => i.complete && i.naturalWidth > 0));
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(OUT, `${slug}-after-${tag}.jpg`), type: 'jpeg', quality: 90 });
        if (tag === '4k') await page.screenshot({ path: path.join(OUT, `${slug}-after-4k-crop-1to1.jpg`), type: 'jpeg', quality: 92, clip: { x: 0, y: 200, width: 1920, height: 1080 } });
      } finally { await close(); }
    }
    console.log('done', slug);
  }
})();
