'use strict';
/* Motion evidence: a Cyberpunk Neon drop and its ring are one event. The page's clock is paused just before drop dp20 lands, then stepped:
   the drop falls onto the canal and its ring starts at that exact point. Four frames + crops. node scripts/drop-evidence.js <out.jpg> */
const fs = require('node:fs'), path = require('node:path');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.resolve(process.argv[2] || 'docs/screenshots/rework5/motion/cyberpunk-drop-ring.jpg'); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
(async () => {
  const { context, close } = await launch({ colorScheme: 'dark' });
  try {
    if (SNAP) await R.serve(context, R.load(SNAP));
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1', motionMode: 'ambient', depthQuality: 'full', depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 100 } });
    const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="dp1"] img', { state: 'attached' }); await page.waitForTimeout(1500);
    const pair = [process.env.RP || 'rp9', (process.env.RP || 'rp9').replace('rp', 'dp')];
    // pause every animation of the pair at local time 0.90 × duration (drop mid-fall), keeping them in step
    const seek = f => page.evaluate(([pair, f]) => {
      for (const a of document.getAnimations()) { const w = a.effect?.target?.parentElement; if (!w || !/^(rp|dp)\d/.test(w.dataset.sprite || '')) continue;
        // active time = currentTime − delay; other pairs are parked at rest (calm water, no drop) so only this event is visible
        const dur = a.effect.getComputedTiming().duration, delay = a.effect.getTiming().delay; a.pause(); a.currentTime = (pair.includes(w.dataset.sprite) ? f : 0.6) * dur + delay + dur * 4; }
    }, [pair, f]);
    const box = await page.evaluate(rp => { const r = document.querySelector(`#repovibe-depth .repv-s[data-sprite="${rp}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, pair[0]);
    const clip = { x: Math.max(0, Math.round(box.x - 120)), y: Math.max(0, Math.round(box.y - 150)), width: 240, height: 180 };
    const steps = [[0.9, 'drop falling'], [0.96, 'about to land'], [1.03, 'lands — ring starts at the impact point'], [1.18, 'ring spreads, drop gone']];
    const shots = [];
    for (const [f, label] of steps) { await seek(f); await page.waitForTimeout(120); shots.push([label, (await page.screenshot({ clip })).toString('base64')]); }
    const sheet = await extPage(context); await sheet.setViewportSize({ width: 4 * 480 + 30, height: 400 });
    await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 15px system-ui;display:flex;gap:10px">${shots.map(([l, b]) => `<div><div style="padding:6px 8px">${l}</div><img src="data:image/png;base64,${b}" width=480 height=360></div>`).join('')}</body>`);
    await sheet.waitForTimeout(300); await sheet.screenshot({ path: OUT, type: 'jpeg', quality: 85 });
    console.log('ok', JSON.stringify(box));
  } finally { await close(); }
})();
