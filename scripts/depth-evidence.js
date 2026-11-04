'use strict';
/* Developer evidence for the 2.5D depth engine: per-world screenshots (popup closed, real page replay when a local
   snapshot exists, otherwise the offline React-layout fixture), pointer-left/right parallax comparisons, short WebM
   recordings (pointer sweep in Ambient, then Cinematic), per-layer displacement and CDP performance metrics.
   node scripts/depth-evidence.js [outDir]   (writes docs/screenshots/depth, docs/recordings, docs/depth-metrics.json) */
const fs = require('node:fs');
const path = require('node:path');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs/screenshots/depth');
const VIDS = path.join(ROOT, 'docs/recordings');
const WORLDS = [['preset-8', 'enchanted-forest'], ['preset-19', 'cosmic-galaxy'], ['preset-1', 'cyberpunk-neon'], ['preset-15', 'futuristic-scifi']];
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const setMode = (context, src) => extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); await p.evaluate(s => RepoVibeCore.updateConfig(new Function('c', s)), src); await p.close(); });
const layerX = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#repovibe-depth > .repv-l')].map(l => [l.dataset.l, new DOMMatrixReadOnly(getComputedStyle(l).transform).m41])));
const settle = (page, t) => page.waitForFunction(v => Math.abs(parseFloat(document.getElementById('repovibe-depth')?.dataset.px || '0') - v) < 0.02, t, { polling: 50, timeout: 10000 }).catch(() => {});

async function open(context, w, h) {
  if (SNAP) await R.serve(context, R.load(SNAP));
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
  return page;
}
async function perf(page, client, ms, move) {
  await client.send('Performance.enable');
  const get = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const a = await get();
  const frames = page.evaluate(d => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < d) requestAnimationFrame(f); else r(n / (d / 1000)); }; requestAnimationFrame(f); }), ms);
  if (move) { const { width, height } = page.viewportSize(); for (let i = 0; i < ms / 50; i++) { await page.mouse.move(width * (0.5 + 0.45 * Math.sin(i / 12)), height * (0.4 + 0.2 * Math.cos(i / 17))); await page.waitForTimeout(50); } }
  const fps = await frames;
  const b = await get();
  const sec = (b.Timestamp - a.Timestamp);
  const d = k => (b[k] - a[k]) / sec * 1000; // ms of main-thread work per second
  return { fps: +fps.toFixed(1), taskMsPerS: +d('TaskDuration').toFixed(1), scriptMsPerS: +d('ScriptDuration').toFixed(1), styleMsPerS: +d('RecalcStyleDuration').toFixed(1), layoutMsPerS: +d('LayoutDuration').toFixed(1), heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(1), nodes: b.Nodes };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(VIDS, { recursive: true });
  const out = { source: SNAP ? `real github.com page replay (${SNAP}, logged out, captured locally; not committed)` : 'offline React-layout fixture', viewport: '1366x768', worlds: {} };
  for (const [id, label] of WORLDS) {
    const rec = {};
    // 1. Screenshots + parallax + performance at 1366x768
    {
      const { context, close } = await launch({ colorScheme: 'dark' });
      try {
        await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthEffects: true, depthQuality: 'full' });
        const page = await open(context, 1366, 768);
        await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached' });
        await page.waitForTimeout(1500);
        const client = await context.newCDPSession(page);
        await page.mouse.move(683, 384); await settle(page, 0);
        await page.screenshot({ path: path.join(SHOTS, `${label}-ambient.jpg`), type: 'jpeg', quality: 85 });
        const crop = { x: 0, y: 160, width: 1366, height: 300 };
        await page.mouse.move(4, 384); await settle(page, 0.994); const left = await layerX(page);
        await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
        const shotL = await page.screenshot({ clip: crop });
        await page.mouse.move(1362, 384, { steps: 4 }); await settle(page, -0.994); const right = await layerX(page);
        const shotR = await page.screenshot({ clip: crop });
        await page.evaluate(() => document.getAnimations().forEach(a => a.play()));
        rec.parallaxPx = Object.fromEntries(Object.keys(left).map(k => [k, +Math.abs(right[k] - left[k]).toFixed(1)]));
        // side-by-side (top: pointer left, bottom: pointer right) to show near layers shifting more than far ones
        const helper = await extPage(context); await helper.setViewportSize({ width: 1366, height: 620 });
        await helper.setContent(`<body style="margin:0;background:#000;font:600 13px sans-serif;color:#fff">${[['pointer at left edge', shotL], ['pointer at right edge', shotR]].map(([t, b]) => `<div style="position:relative;height:300px;margin-bottom:${t.includes('left') ? 20 : 0}px"><img style="display:block" src="data:image/png;base64,${b.toString('base64')}"><span style="position:absolute;left:8px;top:8px;background:#000b;padding:3px 8px;border-radius:5px">${label} · ${t}</span></div>`).join('')}</body>`);
        await helper.waitForTimeout(300); await helper.screenshot({ path: path.join(SHOTS, `${label}-parallax.jpg`), type: 'jpeg', quality: 85 }); await helper.close();
        // autonomous motion: pointer held still, three moments ~2 s apart (scene band crop)
        await page.mouse.move(683, 384); await settle(page, 0);
        const frames = [];
        for (let i = 0; i < 3; i++) { frames.push(await page.screenshot({ clip: { x: 0, y: 160, width: 1366, height: 300 } })); await page.waitForTimeout(2000); }
        rec.autonomous = await page.evaluate(() => [...document.querySelectorAll('.repv-s:not([hidden]) > img')].length);
        const strip = await extPage(context); await strip.setViewportSize({ width: 1366, height: 3 * 300 + 40 });
        await strip.setContent(`<body style="margin:0;background:#000;font:600 13px sans-serif;color:#fff">${frames.map((b, i) => `<div style="position:relative;height:300px;margin-bottom:${i < 2 ? 20 : 0}px"><img style="display:block" src="data:image/png;base64,${b.toString('base64')}"><span style="position:absolute;left:8px;top:8px;background:#000b;padding:3px 8px;border-radius:5px">${label} · pointer still · t = ${i * 2} s</span></div>`).join('')}</body>`);
        await strip.waitForTimeout(300); await strip.screenshot({ path: path.join(SHOTS, `${label}-autonomous.jpg`), type: 'jpeg', quality: 82 }); await strip.close();
        rec.perf = { ambientPointer: await perf(page, client, 4000, true) };
        await setMode(context, "c.motionMode = 'cinematic';"); await page.waitForTimeout(1200);
        await page.mouse.move(683, 384); await settle(page, 0); await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(SHOTS, `${label}-cinematic.jpg`), type: 'jpeg', quality: 85 });
        // full-page parallax states (pointer far left / far right) in Cinematic
        for (const [side, x, t] of [['left', 4, 0.994], ['right', 1362, -0.994]]) { await page.mouse.move(x, 384, { steps: 3 }); await settle(page, t); await page.evaluate(() => document.getAnimations().forEach(a => a.pause())); await page.screenshot({ path: path.join(SHOTS, `${label}-cinematic-pointer-${side}.jpg`), type: 'jpeg', quality: 80 }); await page.evaluate(() => document.getAnimations().forEach(a => a.play())); }
        rec.perf.cinematicPointer = await perf(page, client, 4000, true);
        await setMode(context, "c.motionMode = 'ambient'; c.depthQuality = 'lite';"); await page.waitForTimeout(1200);
        rec.perf.liteAmbientPointer = await perf(page, client, 4000, true);
        await setMode(context, "c.motionMode = 'ambient'; c.depthEffects = false;"); await page.waitForTimeout(1200);
        rec.perf.flatAmbient = await perf(page, client, 4000, true);
        await setMode(context, "c.motionMode = 'static';"); await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(SHOTS, `${label}-static.jpg`), type: 'jpeg', quality: 85 });
        rec.perf.static = await perf(page, client, 4000, true);
      } finally { await close(); }
    }
    // 2. Recording: pointer sweep in Ambient, then Cinematic (960x540 to keep files small)
    {
      const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'repv-vid-'));
      const { context, close } = await launch({ colorScheme: 'dark', recordVideo: { dir, size: { width: 960, height: 540 } } });
      let video;
      try {
        await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthEffects: true, depthQuality: 'full' });
        const page = await open(context, 960, 540);
        video = page.video();
        await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached' }); await page.waitForTimeout(1200);
        for (let i = 0; i <= 80; i++) { await page.mouse.move(480 + 470 * Math.sin(i / 80 * Math.PI * 2), 270 + 120 * Math.sin(i / 40 * Math.PI)); await page.waitForTimeout(60); }
        await setMode(context, "c.motionMode = 'cinematic';"); await page.waitForTimeout(600);
        for (let i = 0; i <= 80; i++) { await page.mouse.move(480 + 470 * Math.sin(i / 80 * Math.PI * 2), 270); await page.waitForTimeout(60); }
        await page.waitForTimeout(2500);
        await page.close();
      } finally { await close(); }
      if (video) fs.copyFileSync(await video.path(), path.join(VIDS, `${label}-depth.webm`));
      fs.rmSync(dir, { recursive: true, force: true });
    }
    out.worlds[label] = rec;
    console.log(label, JSON.stringify(rec));
  }
  fs.writeFileSync(path.join(ROOT, 'docs/depth-metrics.json'), JSON.stringify(out, null, 2) + '\n');
})();
