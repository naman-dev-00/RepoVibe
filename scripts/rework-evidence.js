'use strict';
/* Evidence for the targeted theme rework (owner feedback 2026-11-11). Per theme, on the real github.com page replay when the local
   snapshot exists (otherwise the offline fixture; output says which), Ambient, popup closed, 1600×900:
     after/<name>-github.jpg       the same framing as docs/theme-review (the "before" shots were copied from there, commit e98753f)
     compare/<name>.jpg            before above after
     motion/<name>-motion.jpg      three frames of the scene band ~1.2 s apart (pointer parked: only autonomous motion)
     recordings/<name>-ambient.webm  6 s recording
   node scripts/rework-evidence.js [name ...]   names: cyberpunk-neon sakura-dreams ocean-depths pixel-paradise arctic-frost */
const fs = require('node:fs'), path = require('node:path');
const { launch, extPage, setConfig, visualContrast } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const ROUND = process.env.ROUND || '2';
const DIRS = { 1: ['rework', 'rework/before', 'Before (e98753f)'], 2: ['rework2', 'rework/after', 'Before (3a8945c, round 1)'], 3: ['rework3', 'rework2/after', 'Before (07a4a06, round 2)'] }[ROUND];
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs/screenshots', DIRS[0]), VIDS = path.join(ROOT, 'docs/recordings', DIRS[0]);
const BEFORE = path.join(ROOT, 'docs/screenshots', DIRS[1]), BEFORE_LABEL = DIRS[2];
// Round 2 uses the default quality (Auto), which is what users get: on slow (software-rendered) machines it drops to Lite, where weather
// used to freeze. Motion is also measured: the share of scene-band pixels that change between frames 0.5 s apart.
const QUALITY = process.env.QUALITY || (ROUND === '1' ? 'full' : 'auto');
const THEMES = [['preset-1', 'cyberpunk-neon', 'dark'], ['preset-3', 'sakura-dreams', 'dark'], ['preset-7', 'ocean-depths', 'dark'], ['preset-10', 'pixel-paradise', 'dark'], ['preset-12', 'arctic-frost', 'light']];
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const only = process.argv.slice(2);
const TUNE = { parallax: 100, motion: 100, particles: 100, foreground: 100 };

async function open(context) {
  if (SNAP) await R.serve(context, R.load(SNAP));
  const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
  await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached', timeout: 20000 });
  return page;
}
(async () => {
  for (const d of ['after', 'compare', 'motion']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  fs.mkdirSync(VIDS, { recursive: true });
  const factsFile = path.join(OUT, 'facts.json'); const facts = fs.existsSync(factsFile) ? JSON.parse(fs.readFileSync(factsFile, 'utf8')) : {};
  facts.source = SNAP ? `real github.com page replay (${SNAP}, logged out, captured locally; not committed)` : 'offline fixture';
  for (const [id, name, scheme] of THEMES) {
    if (only.length && !only.includes(name)) continue;
    const vdir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rv-vid-'));
    const { context, errors, close } = await launch({ colorScheme: scheme, recordVideo: { dir: vdir, size: { width: 1600, height: 900 } } });
    try {
      await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthQuality: QUALITY, depthTuning: TUNE });
      const page = await open(context);
      await page.mouse.move(800, 450); await page.waitForTimeout(3500);
      const after = path.join(OUT, 'after', `${name}-github.jpg`);
      await page.screenshot({ path: after, type: 'jpeg', quality: 84 });
      const frames = [];
      const STEP = ROUND === '1' ? 1200 : 500;
      for (let i = 0; i < (ROUND === '1' ? 3 : 4); i++) { frames.push((await page.screenshot({ clip: { x: 0, y: 168, width: 1600, height: 440 } })).toString('base64')); await page.waitForTimeout(STEP); }
      await page.waitForTimeout(1200);
      const vc = await visualContrast(context, page);
      const f = await page.evaluate(() => ({ scene: document.getElementById('repovibe-depth')?.dataset.scene, sprites: document.querySelectorAll('#repovibe-depth .repv-s').length, popOuts: [...document.querySelectorAll('#repovibe-popout > .repv-s')].filter(w => !w.hidden).length,
        quality: document.documentElement.classList.contains('repv-depth-minimal') ? 'auto→minimal' : document.documentElement.classList.contains('repv-depth-lite') ? 'auto→lite' : 'full',
        running: [...new Set(document.getAnimations().filter(a => a.playState === 'running' && a.animationName).map(a => a.animationName))].sort() }));
      facts[name] = { ...f, textMin: +vc.min.toFixed(2), aaFails: vc.fails.length, failSummary: vc.failSummary, errors: errors.filter(e => e.includes('chrome-extension://')).length };
      const video = page.video(); await page.close();
      const sheet = await extPage(context);
      const before = path.join(BEFORE, `${name}-github.jpg`);
      const b64 = p => fs.existsSync(p) ? `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}` : '';
      // motion: fraction of scene-band pixels (outside GitHub's content column) that change by > 12/255 between consecutive frames
      const motion = await sheet.evaluate(async fr => {
        const load = b => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b; });
        const imgs = await Promise.all(fr.map(load)); const c = new OffscreenCanvas(1600, 440), g = c.getContext('2d', { willReadFrequently: true });
        const px = imgs.map(i => { g.drawImage(i, 0, 0); return g.getImageData(0, 0, 1600, 300).data; });
        const out = [];
        for (let k = 1; k < px.length; k++) { let ch = 0, n = 0; const a = px[k - 1], b = px[k];
          for (let y = 0; y < 300; y += 2) for (let x = 0; x < 1600; x += 2) { if (x > 180 && x < 1420 && y > 250) continue; const i = (y * 1600 + x) * 4; n++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 36) ch++; }
          out.push(+(ch / n * 100).toFixed(2)); }
        return out;
      }, frames);
      facts[name].motionChangedPct = motion;
      await sheet.setViewportSize({ width: 1600, height: 1860 });
      await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 22px system-ui"><div style="padding:8px 14px">${BEFORE_LABEL}</div><img src="${b64(before)}" width=1600 height=900 style="display:block"><div style="padding:8px 14px">After</div><img src="${b64(after)}" width=1600 height=900 style="display:block"></body>`);
      await sheet.waitForTimeout(300); await sheet.screenshot({ path: path.join(OUT, 'compare', `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
      await sheet.setViewportSize({ width: 1600, height: frames.length * (440 + 34) });
      await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 18px system-ui">${frames.map((f, i) => `<div style="padding:6px 12px">t = ${(i * STEP / 1000).toFixed(1)} s · pointer parked · quality ${facts[name].quality}${i ? ` · ${motion[i - 1]}% of scene pixels changed since previous frame` : ''}</div><img src="data:image/png;base64,${f}" width=1600 height=440 style="display:block">`).join('')}</body>`);
      await sheet.waitForTimeout(300); await sheet.screenshot({ path: path.join(OUT, 'motion', `${name}-motion.jpg`), type: 'jpeg', quality: 80 });
      await sheet.close();
      if (video) { await context.close().catch(() => {}); fs.copyFileSync(await video.path(), path.join(VIDS, `${name}-ambient.webm`)); }
      console.log(name, JSON.stringify(facts[name]));
    } finally { await close().catch(() => {}); }
  }
  fs.writeFileSync(factsFile, JSON.stringify(facts, null, 1) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
