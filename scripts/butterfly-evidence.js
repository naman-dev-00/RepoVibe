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
      await page.waitForFunction(() => document.getElementById('repovibe-butterfly')?.dataset.state === 'resting', null, { timeout: 8000 });
      await page.waitForTimeout(1500); frames.push(['resting beside the still cursor', await crop()]);
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
