'use strict';
/* Developer evidence for the eight additional immersive worlds. Per world, with the popup closed:
   full screenshot (Ambient), foreground-depth crop (2x), three autonomous-motion frames (pointer parked, 2.5 s apart),
   a Static frame + proof that nothing moves in Static, Ambient and Cinematic WebM recordings, a comparison against the previous
   theme version, and measured facts (sprites, pop-outs, pointer-events, layer list). The page is a real github.com replay when a local
   snapshot exists, otherwise the offline fixture; output says which.
   node scripts/world-evidence.js [slug ...]   → docs/screenshots/worlds, docs/recordings/worlds, docs/worlds-evidence.json */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs/screenshots/worlds'), VIDS = path.join(ROOT, 'docs/recordings/worlds');
const WORLDS = [
  ['preset-3', 'sakura-garden', 'Sakura Dreams', 'sakura-street', 'dark'], ['preset-7', 'ocean-kingdom', 'Ocean Depths', 'ocean-twilight', 'dark'],
  ['preset-12', 'arctic-frost-3d', 'Arctic Frost', 'alpine-lake', 'light'], ['preset-17', 'aurora-borealis', 'Aurora', 'aurora-fjord', 'dark'],
  ['preset-20', 'synthwave-highway', 'Synthwave', 'synthwave-3d', 'dark'], ['preset-14', 'dark-library', 'Dark Academia', 'academia-library', 'dark'],
  ['preset-10', 'pixel-paradise-3d', 'Pixel Paradise', 'pixel-island', 'dark'], ['preset-18', 'sunset-coast', 'Sunset Boulevard', 'sunset-village', 'dark']
];
const TUNE = { parallax: 100, motion: 100, particles: 100, foreground: 100 };
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const only = process.argv.slice(2);
const setMode = (context, src) => extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); await p.evaluate(s => RepoVibeCore.updateConfig(new Function('c', s)), src); await p.close(); });

async function open(context, w, h) {
  if (SNAP) await R.serve(context, R.load(SNAP));
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
  if (!SNAP) await page.evaluate(() => { const c = document.createElement('div'); c.id = 'repo-content-pjax-container'; c.innerHTML = '<p style="margin:0 40px">Repository content starts here</p>'; (document.querySelector('main, .application-main') || document.body).prepend(c); });
  await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached', timeout: 20000 });
  return page;
}
const positions = page => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s > img, #repovibe-popout > .repv-s:not([hidden]) > img, #repovibe-depth > .repv-l > i')].map(i => { const r = i.getBoundingClientRect(); return [i.parentElement.dataset.sprite || i.parentElement.dataset.l, Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width), getComputedStyle(i).transform, getComputedStyle(i).rotate, getComputedStyle(i).translate]; }));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(VIDS, { recursive: true });
  const outJson = path.join(ROOT, 'docs/worlds-evidence.json');
  const out = fs.existsSync(outJson) ? JSON.parse(fs.readFileSync(outJson, 'utf8')) : {};
  out.source = SNAP ? `real github.com page replay (${SNAP}, logged out, captured locally; not committed)` : 'offline React-layout fixture (repository content band added)'; out.viewport = '1920x1080'; out.worlds = out.worlds || {};
  for (const [id, slug, label, prev, scheme] of WORLDS) {
    if (only.length && !only.includes(slug)) continue;
    const rec = {};
    {
      const { context, errors, close } = await launch({ colorScheme: scheme });
      try {
        await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id, depthEffects: true, depthQuality: 'full', depthTuning: TUNE });
        const page = await open(context, 1920, 1080);
        await page.mouse.move(960, 540); await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(SHOTS, `${slug}-full.jpg`), type: 'jpeg', quality: 88 });
        rec.facts = await page.evaluate(() => ({ layers: [...document.querySelectorAll('#repovibe-depth > .repv-l')].map(l => l.dataset.l), sceneSprites: document.querySelectorAll('#repovibe-depth .repv-s').length, popOuts: [...document.querySelectorAll('#repovibe-popout > .repv-s')].filter(w => !w.hidden).length, popPointerEvents: document.getElementById('repovibe-popout') ? getComputedStyle(document.getElementById('repovibe-popout')).pointerEvents : null, depthPointerEvents: getComputedStyle(document.getElementById('repovibe-depth')).pointerEvents }));
        // foreground-depth crop: the nearest planes (bottom band + pop-outs), 2x
        const fg = await context.newPage(); await fg.close();
        const clip = { x: 0, y: 640, width: 1920, height: 440 };
        await page.screenshot({ path: path.join(SHOTS, `${slug}-foreground.jpg`), type: 'jpeg', quality: 90, clip });
        // autonomous motion: pointer parked, three frames 2.5 s apart (scene band)
        const frames = [];
        for (let i = 0; i < 3; i++) { frames.push(await page.screenshot({ clip: { x: 0, y: 40, width: 1920, height: 560 } })); await page.waitForTimeout(2500); }
        const strip = await extPage(context); await strip.setViewportSize({ width: 960, height: 3 * 280 + 40 });
        await strip.setContent(`<body style="margin:0;background:#000;font:600 13px sans-serif;color:#fff">${frames.map((b, i) => `<div style="position:relative;height:280px;margin-bottom:${i < 2 ? 20 : 0}px"><img style="display:block;width:960px" src="data:image/png;base64,${b.toString('base64')}"><span style="position:absolute;left:8px;top:8px;background:#000b;padding:3px 8px;border-radius:5px">${label} · Ambient · pointer still · t = ${(i * 2.5).toFixed(1)} s</span></div>`).join('')}</body>`);
        await strip.waitForTimeout(300); await strip.screenshot({ path: path.join(SHOTS, `${slug}-motion.jpg`), type: 'jpeg', quality: 84 }); await strip.close();
        // Cinematic frame, then Static: positions identical 2 s apart
        await setMode(context, "c.motionMode = 'cinematic';"); await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(SHOTS, `${slug}-cinematic.jpg`), type: 'jpeg', quality: 88 });
        await setMode(context, "c.motionMode = 'static';"); await page.waitForTimeout(1500);
        const a = JSON.stringify(await positions(page)); await page.waitForTimeout(2500); const b = JSON.stringify(await positions(page));
        rec.staticStopsMovement = a === b; rec.staticAnimating = await page.evaluate(() => document.getAnimations().filter(x => x.playState === 'running' && /repovibe/.test(x.effect?.target?.closest?.('#repovibe-depth, #repovibe-popout') ? 'repovibe' : '')).length);
        await page.screenshot({ path: path.join(SHOTS, `${slug}-static.jpg`), type: 'jpeg', quality: 88 });
        // popup-closed repository page without the pop-out overlay crop is the same as -full; comparison with the previous theme version
        const prevImg = fs.readFileSync(path.join(ROOT, 'wallpapers', `${prev}.webp`)).toString('base64');
        const nowImg = fs.readFileSync(path.join(SHOTS, `${slug}-static.jpg`)).toString('base64');
        const cmp = await extPage(context); await cmp.setViewportSize({ width: 1400, height: 440 });
        await cmp.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 13px sans-serif"><div style="display:flex;gap:10px;padding:8px"><div><div style="padding:4px 0">BEFORE · ${prev} (flat wallpaper)</div><img style="width:680px;display:block" src="data:image/webp;base64,${prevImg}"></div><div><div style="padding:4px 0">AFTER · ${label} (layered world, Static, on a repository page)</div><img style="width:680px;display:block" src="data:image/jpeg;base64,${nowImg}"></div></div></body>`);
        await cmp.waitForTimeout(400); await cmp.screenshot({ path: path.join(SHOTS, `${slug}-comparison.jpg`), type: 'jpeg', quality: 85 }); await cmp.close();
        rec.errors = errors;
      } finally { await close(); }
    }
    for (const mode of ['ambient', 'cinematic']) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repv-world-'));
      const { context, close } = await launch({ colorScheme: scheme, recordVideo: { dir, size: { width: 960, height: 540 } } });
      let video;
      try {
        await setConfig(context, { enabled: true, motionMode: mode, defaultThemeId: id, depthEffects: true, depthQuality: 'full', depthTuning: TUNE });
        const ctl = await extPage(context); await ctl.waitForFunction(() => !!globalThis.RepoVibeCore);
        const page = await open(context, 1280, 720); video = page.video();
        await page.setViewportSize({ width: 960, height: 540 }); await page.waitForTimeout(9000); await page.close();
      } finally { await close(); }
      if (video) fs.copyFileSync(await video.path(), path.join(VIDS, `${slug}-${mode}.webm`));
      fs.rmSync(dir, { recursive: true, force: true });
    }
    out.worlds[slug] = rec; console.log(slug, JSON.stringify(rec));
    fs.writeFileSync(outJson, JSON.stringify(out, null, 2) + '\n');
  }
})();
