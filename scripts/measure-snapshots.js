'use strict';
/* Developer check: screenshot-measured text contrast + scene visibility on REAL github.com snapshots for each
   flagship theme. node scripts/measure-snapshots.js [WxH] [presetIds...] */
const { launch, extPage, setConfig, visualContrast, diffRatio } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
(async () => {
  const [size = '1366x768', ...ids] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number);
  const presets = ids.length ? ids : ['preset-1', 'preset-8', 'preset-19', 'preset-15'];
  for (const snapName of R.available().filter(n => !process.env.SNAP || n.includes(process.env.SNAP))) {
    const snap = R.load(snapName);
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      await R.serve(context, snap);
      const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
      for (const id of presets) {
        const ext = await extPage(context); await ext.waitForFunction(() => !!globalThis.RepoVibeCore);
        const p = await ext.evaluate(pid => RepoVibeCore.PRESETS.find(x => x.id === pid), id); await ext.close();
        await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-solid', customThemes: { 'custom-solid': { ...p, id: 'custom-solid', backgroundMode: 'solid' } } });
        await page.goto(snap.main); await page.waitForTimeout(600);
        const solid = await page.screenshot();
        await setConfig(context, { enabled: true, motionMode: process.env.MOTION || 'static', defaultThemeId: id, appearance: process.env.APPEARANCE || 'crisp' });
        await page.goto(snap.main); await page.waitForTimeout(900);
        const art = await page.screenshot();
        const changed = await diffRatio(context, solid, art);
        let vc = await visualContrast(context, page, 400);
        // Also below the fold (README, long lists): one and two viewports down.
        for (const k of [1, 2]) {
          await page.evaluate(n => window.scrollTo(0, innerHeight * n), k); await page.waitForTimeout(250);
          const more = await visualContrast(context, page, 400);
          vc = { ...vc, count: vc.count + more.count, min: Math.min(vc.min, more.min), below45: vc.below45 + more.below45, below3: [...vc.below3, ...more.below3], low: [...vc.low, ...more.low.map(x => ({ ...x, at: `${x.at} (scroll ${k})` }))] };
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        console.log(`${snapName} ${id} ${size}: scene changes ${(changed * 100).toFixed(1)}% of pixels vs solid; text n=${vc.count} min ${vc.min.toFixed(2)} p10 ${vc.p10.toFixed(2)} <4.5:${vc.below45} <3:${vc.below3.length} ${vc.low.slice(0, 6).map(x => `"${x.text}" ${x.ratio.toFixed(2)} @${x.at}`).join('; ')}`);
      }
    } finally { await close(); }
  }
})();
