'use strict';
/* Developer diagnostic: render a REAL github.com snapshot (tests/e2e/real-snapshots/<name>.mhtml.gz) with a theme and
   report wallpaper coverage + screenshot.  node scripts/diag-snapshot.js <snapshot> <presetId|native> [w] [h] [out.png] [overridesJSON] */
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
(async () => {
  const [name, id, w = 1366, h = 768, out, overrides] = process.argv.slice(2);
  const snap = R.load(name);
  const { context, close } = await launch({ colorScheme: 'dark' });
  try {
    await R.serve(context, snap);
    const ext = await extPage(context);
    await ext.waitForFunction(() => !!globalThis.RepoVibeCore);
    const preset = id === 'native' ? null : await ext.evaluate(pid => RepoVibeCore.PRESETS.find(p => p.id === pid), id);
    await ext.close();
    const o = overrides ? JSON.parse(overrides) : null;
    await setConfig(context, !preset ? { enabled: true, defaultThemeId: 'native' } : o
      ? { enabled: true, motionMode: 'static', defaultThemeId: 'custom-d', customThemes: { 'custom-d': { ...preset, ...o, id: 'custom-d' } } }
      : { enabled: true, motionMode: 'static', defaultThemeId: id });
    const page = await context.newPage();
    await page.setViewportSize({ width: Number(w), height: Number(h) });
    await page.goto(snap.main, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    if (out) await page.screenshot({ path: out });
    const cov = await page.evaluate(() => {
      const alphaOf = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
      const res = [];
      for (let y = 40; y < innerHeight; y += 40) for (let x = 20; x < innerWidth; x += 40) {
        const t = document.elementsFromPoint(x, y).filter(e => e !== document.documentElement).reduce((acc, e) => acc * (1 - alphaOf(getComputedStyle(e).backgroundColor)), 1);
        res.push(t);
      }
      res.sort((a, b) => a - b);
      return { median: res[res.length >> 1], p25: res[res.length >> 2], visibleShare: res.filter(v => v > 0.5).length / res.length };
    });
    console.log(JSON.stringify(cov));
  } finally { await close(); }
})();
