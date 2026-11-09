'use strict';
/* Evidence for the idle butterfly: per world, frames while it arrives, rests beside the (still) cursor and flies away
   on movement; plus a WebM recording for Enchanted Forest. Real-page replay when a local snapshot exists.
   node scripts/butterfly-evidence.js   → docs/screenshots/butterfly/<world>.jpg, docs/recordings/butterfly-enchanted-forest.webm */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const SHOTS = path.join(__dirname, '../docs/screenshots/butterfly'), VIDS = path.join(__dirname, '../docs/recordings');
const WORLDS = [['preset-8', 'enchanted-forest'], ['preset-19', 'cosmic-galaxy'], ['preset-1', 'cyberpunk-neon'], ['preset-15', 'futuristic-scifi']];
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
// One flap cycle in flight, frozen at exact phases (all CSS animations of the butterfly paused and scrubbed together), shot at 3x
// device resolution and shown side by side: wings, thorax, abdomen and head must move as one creature.
async function flapStrip(context, page, world) {
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setDeviceMetricsOverride', { width: page.viewportSize().width, height: page.viewportSize().height, deviceScaleFactor: 3, mobile: false });
  await page.waitForTimeout(300);
  const phases = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
  // hold the flight pose (the extension only advances arriving → landing from 'arriving'), then freeze everything
  await page.evaluate(() => { const el = document.getElementById('repovibe-butterfly'); el.dataset.state = 'flight-test'; el.getAnimations({ subtree: true }).forEach(a => a.pause()); });
  const shots = [];
  for (const ph of phases) {
    const rect = await page.evaluate(t => { const el = document.getElementById('repovibe-butterfly'); el.getAnimations({ subtree: true }).filter(a => /^repv-/.test(a.animationName || '')).forEach(a => { a.currentTime = t * 1000; }); const r = el.getBoundingClientRect(); return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }; }, ph);
    await page.waitForTimeout(60); shots.push([ph, await page.screenshot({ clip: rect })]);
  }
  await client.send('Emulation.clearDeviceMetricsOverride');
  const helper = await extPage(context); await helper.setViewportSize({ width: shots.length * 150 + 20, height: 190 });
  await helper.setContent(`<body style="margin:0;background:#0d1117;color:#e6edf3;font:600 12px sans-serif"><div style="padding:6px 10px">${world} · one flap cycle (.34 s), flying · wings, thorax, abdomen and head on one clock (3x)</div><div style="display:flex;gap:6px;padding:0 10px">${shots.map(([p, b]) => `<figure style="margin:0;width:144px"><img style="display:block;width:144px;image-rendering:auto" src="data:image/png;base64,${b.toString('base64')}"><figcaption style="text-align:center;padding-top:3px">${Math.round(p * 1000)} ms</figcaption></figure>`).join('')}</div></body>`);
  await helper.waitForTimeout(300); await helper.screenshot({ path: path.join(SHOTS, `${world}-flap-cycle.jpg`), type: 'jpeg', quality: 90 }); await helper.close();
  await page.evaluate(() => { const el = document.getElementById('repovibe-butterfly'); if (!el) return; el.dataset.state = 'arriving'; el.getAnimations({ subtree: true }).forEach(a => a.play()); });
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(VIDS, { recursive: true });
  for (const [id, world] of WORLDS) {
    const rec = world === 'enchanted-forest';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repv-bf-'));
    const { context, close } = await launch({ colorScheme: 'dark', ...(rec ? { recordVideo: { dir, size: { width: 960, height: 540 } } } : {}) });
    let video;
    try {
      if (SNAP) await R.serve(context, R.load(SNAP));
      await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, defaultThemeId: id });
      const page = await context.newPage(); video = page.video();
      const [w, h] = rec ? [960, 540] : [1366, 768]; await page.setViewportSize({ width: w, height: h });
      await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout'); await page.waitForTimeout(1000);
      const cx = Math.round(w * 0.52), cy = Math.round(h * 0.36);
      await page.mouse.move(cx - 30, cy); await page.mouse.move(cx, cy);
      const frames = [];
      const crop = () => page.screenshot({ clip: { x: cx - 170, y: cy - 120, width: 340, height: 200 } });
      await page.waitForSelector('#repovibe-butterfly', { state: 'attached', timeout: 20000 });
      await page.waitForTimeout(1600); frames.push(['arriving (t ≈ 16.6 s idle)', await crop()]);
      if (id === 'preset-8') await flapStrip(context, page, world);
      await page.waitForFunction(() => document.getElementById('repovibe-butterfly')?.dataset.state === 'resting', null, { timeout: 8000 });
      await page.waitForTimeout(1500); frames.push(['resting beside the still cursor', await crop()]);
      const spot = await page.evaluate(() => { const r = document.getElementById('repovibe-butterfly').getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; });
      console.log(world, 'cursor', [cx, cy], 'butterfly centre', spot, '(offset', [spot[0] - cx, spot[1] - cy], ')');
      await page.mouse.move(cx + 40, cy + 20, { steps: 3 }); await page.waitForTimeout(450); frames.push(['cursor moved: flying away', await crop()]);
      await page.waitForTimeout(1800); frames.push(['gone', await crop()]);
      const helper = await extPage(context); await helper.setViewportSize({ width: 4 * 340 + 50, height: 260 });
      await helper.setContent(`<body style="margin:0;background:#0d1117;color:#e6edf3;font:600 13px sans-serif"><div style="padding:8px 10px">${world} · idle butterfly · cursor at the centre of each crop</div><div style="display:flex;gap:10px;padding:0 10px">${frames.map(([t, b]) => `<figure style="margin:0"><img style="display:block" src="data:image/png;base64,${b.toString('base64')}"><figcaption style="padding-top:4px">${t}</figcaption></figure>`).join('')}</div></body>`);
      await helper.waitForTimeout(300); await helper.screenshot({ path: path.join(SHOTS, `${world}.jpg`), type: 'jpeg', quality: 85 }); await helper.close();
      if (rec) await page.close();
      console.log('wrote', world);
    } finally { await close(); }
    if (rec && video) fs.copyFileSync(await video.path(), path.join(VIDS, 'butterfly-enchanted-forest.webm'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();
