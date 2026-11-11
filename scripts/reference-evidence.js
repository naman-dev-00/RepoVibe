'use strict';
/* Evidence for the reference-based Ocean Depths / Sakura Dreams: 1080p + 4K screenshots on the real-page replay, a pop-out crop, a motion strip
   (pointer parked) and Ambient + Cinematic recordings. node scripts/reference-evidence.js */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const OUT = path.join(__dirname, '../docs/screenshots/worlds/reference'), VIDS = path.join(__dirname, '../docs/recordings/worlds');
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const TUNE = { parallax: 100, motion: 100, particles: 100, foreground: 100 };
const WORLDS = [['ocean-kingdom', 'preset-7'], ['sakura-garden', 'preset-3']].filter(([s]) => !process.argv[2] || process.argv.slice(2).includes(s));
const open = async (context, w, h) => { if (SNAP) await R.serve(context, R.load(SNAP)); const page = await context.newPage(); await page.setViewportSize({ width: w, height: h }); await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
  await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached', timeout: 20000 }); await page.waitForFunction(() => [...document.querySelectorAll('#repovibe-depth img, #repovibe-popout img')].every(i => i.complete && i.naturalWidth > 0)); return page; };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [slug, id] of WORLDS) {
    for (const [tag, w, h] of [['1080p', 1920, 1080], ['4k', 3840, 2160]]) {
      const { context, close } = await launch({ colorScheme: 'dark' });
      try {
        await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthEffects: true, depthQuality: 'full', depthTuning: TUNE });
        const page = await open(context, w, h); await page.waitForTimeout(3500);
        await page.screenshot({ path: path.join(OUT, `${slug}-after-${tag}.jpg`), type: 'jpeg', quality: 90 });
        if (tag === '1080p') {
          // pop-out examples: crop around each visible pop-out
          const boxes = await page.evaluate(() => [...document.querySelectorAll('#repovibe-popout > .repv-s:not([hidden])')].map(w => { const r = w.getBoundingClientRect(); return { n: w.dataset.sprite, x: r.x, y: r.y, w: r.width, h: r.height }; }));
          fs.writeFileSync(path.join(OUT, `${slug}-popouts.json`), JSON.stringify(boxes, null, 1));
          let i = 0; for (const b of boxes.slice(0, 4)) { const pad = 40; const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(w, b.w + 2 * pad), height: Math.min(h, b.h + 2 * pad) }; if (clip.width > 20 && clip.height > 20) await page.screenshot({ path: path.join(OUT, `${slug}-popout-${i++}-${b.n}.jpg`), type: 'jpeg', quality: 90, clip }); }
          const frames = []; for (let k = 0; k < 3; k++) { frames.push(await page.screenshot({ clip: { x: 0, y: 40, width: 1920, height: 560 } })); await page.waitForTimeout(2500); }
          const strip = await extPage(context); await strip.setViewportSize({ width: 960, height: 3 * 280 + 40 });
          await strip.setContent(`<body style="margin:0;background:#000;font:600 13px sans-serif;color:#fff">${frames.map((b, k) => `<div style="position:relative;height:280px;margin-bottom:${k < 2 ? 20 : 0}px"><img style="display:block;width:960px" src="data:image/png;base64,${b.toString('base64')}"><span style="position:absolute;left:8px;top:8px;background:#000b;padding:3px 8px;border-radius:5px">${slug} · Ambient · pointer still · t = ${(k * 2.5).toFixed(1)} s</span></div>`).join('')}</body>`);
          await strip.waitForTimeout(300); await strip.screenshot({ path: path.join(OUT, `${slug}-motion.jpg`), type: 'jpeg', quality: 84 }); await strip.close();
        }
      } finally { await close(); }
    }
    for (const mode of ['ambient', 'cinematic']) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repv-ref-'));
      const { context, close } = await launch({ colorScheme: 'dark', recordVideo: { dir, size: { width: 960, height: 540 } } });
      let video;
      try { await setConfig(context, { enabled: true, motionMode: mode, defaultThemeId: id, depthEffects: true, depthQuality: 'full', depthTuning: TUNE });
        const ctl = await extPage(context); await ctl.waitForFunction(() => !!globalThis.RepoVibeCore);
        const page = await open(context, 1280, 720); video = page.video(); await page.setViewportSize({ width: 960, height: 540 }); await page.waitForTimeout(12000); await page.close();
      } finally { await close(); }
      if (video) fs.copyFileSync(await video.path(), path.join(VIDS, `${slug}-reference-${mode}.webm`));
      fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log('done', slug);
  }
})();
