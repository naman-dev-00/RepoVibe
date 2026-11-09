'use strict';
/* Evidence for the Enchanted Forest falling leaves: the actual on-screen path of every leaf (sampled each 100 ms for 16 s) drawn
   over the scene, wobble statistics (rotation range, sideways direction changes), and before/after leaf sprites.
   node scripts/leaf-evidence.js [oldLeafWebp]   → docs/screenshots/leaves/{leaf-paths.jpg,leaf-sprites.jpg}, docs/leaf-motion.json */
const fs = require('node:fs');
const path = require('node:path');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.join(__dirname, '../docs/screenshots/leaves');
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { context, close } = await launch({ colorScheme: 'dark' });
  try {
    if (SNAP) await R.serve(context, R.load(SNAP));
    await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, defaultThemeId: 'preset-8', idleButterfly: false });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout'); await page.waitForTimeout(1500);
    const shot = await page.screenshot();
    const samples = await page.evaluate(() => new Promise(res => {
      const imgs = [...document.querySelectorAll('#repovibe-depth img[data-fall]')]; const t0 = performance.now(); const out = imgs.map(() => []);
      const tick = () => { const t = performance.now() - t0; imgs.forEach((im, i) => { const r = im.getBoundingClientRect(); const m = new DOMMatrixReadOnly(getComputedStyle(im).transform); out[i].push([Math.round(t), r.x + r.width / 2, r.y + r.height / 2, Math.atan2(m.b, m.a) * 180 / Math.PI, r.width]); });
        if (t < 16000) setTimeout(tick, 100); else res(out); };
      tick();
    }));
    // statistics: leaves in view only
    const stats = samples.map((s, i) => { const v = s.filter(p => p[2] > 0 && p[2] < 768 && p[1] > 0 && p[1] < 1366); const dxs = v.slice(1).map((p, k) => p[1] - v[k][1]); let flips = 0; for (let k = 1; k < dxs.length; k++) if (Math.sign(dxs[k]) !== Math.sign(dxs[k - 1]) && Math.abs(dxs[k]) > 0.2) flips++;
      const w = v.map(p => p[4]); return { leaf: i, inView: v.length, sidewaysReversals: flips, widthRangePx: [Math.round(Math.min(...w)), Math.round(Math.max(...w))], travelPx: v.length ? Math.round(Math.hypot(v.at(-1)[1] - v[0][1], v.at(-1)[2] - v[0][2])) : 0 }; });
    fs.writeFileSync(path.join(__dirname, '../docs/leaf-motion.json'), JSON.stringify(stats, null, 2) + '\n');
    console.log(JSON.stringify(stats));
    const helper = await extPage(context); await helper.setViewportSize({ width: 1366, height: 768 });
    await helper.setContent(`<body style="margin:0;position:relative;background:#000"><img style="position:absolute;inset:0;width:1366px;opacity:.85" src="data:image/png;base64,${shot.toString('base64')}"><canvas id=c width=1366 height=768 style="position:absolute;inset:0"></canvas><div style="position:absolute;left:10px;top:10px;font:600 14px sans-serif;color:#fff;background:#000a;padding:4px 9px;border-radius:6px">Enchanted Forest · actual paths of 6 falling leaves over 16 s (wind drives them right; each sways, flutters and turns on its own timing)</div></body>`);
    await helper.evaluate(S => { const g = document.getElementById('c').getContext('2d'); const cols = ['#ffd84a', '#7cf26b', '#ff9a3c', '#7df0d0', '#ffe27a', '#9be26b'];
      S.forEach((s, i) => { g.strokeStyle = cols[i % 6]; g.lineWidth = 2; g.globalAlpha = .95; g.beginPath(); s.forEach((p, k) => k ? g.lineTo(p[1], p[2]) : g.moveTo(p[1], p[2])); g.stroke(); const l = s.at(-1); s.forEach((p, k) => { if (k % 12 === 0) { g.fillStyle = cols[i % 6]; g.beginPath(); g.arc(p[1], p[2], 3.5, 0, 7); g.fill(); } }); }); }, samples);
    await helper.waitForTimeout(300); await helper.screenshot({ path: path.join(OUT, 'leaf-paths.jpg'), type: 'jpeg', quality: 85 }); await helper.close();
    // before / after sprites
    const old = process.argv[2];
    const dir = path.join(__dirname, '../wallpapers/depth/enchanted-forest');
    const f = (cap, file) => `<figure style="margin:0;position:relative"><img style="height:230px;display:block" src="data:image/webp;base64,${fs.readFileSync(file).toString('base64')}"><figcaption style="position:absolute;left:6px;top:4px;color:#fff;font:12px sans-serif;text-shadow:0 0 3px #000">${cap}</figcaption></figure>`;
    const sh = await extPage(context); await sh.setViewportSize({ width: 1500, height: 290 });
    await sh.setContent(`<body style="margin:0;background:linear-gradient(120deg,#2c5f61,#3d7f7a 50%,#1f4a4d);display:flex;gap:12px;align-items:center;padding:20px">${old && fs.existsSync(old) ? f('before: dark green', old) : ''}${[['G', 'fresh green'], ['Y', 'golden'], ['O', 'amber'], ['M', 'mint']].map(([k, n]) => f(`after: ${n}`, path.join(dir, `s-leaf${k}.webp`))).join('')}</body>`);
    await sh.waitForTimeout(300); await sh.screenshot({ path: path.join(OUT, 'leaf-sprites.jpg'), type: 'jpeg', quality: 88 }); await sh.close();
  } finally { await close(); }
})();
