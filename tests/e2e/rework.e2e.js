'use strict';
/* Targeted theme rework (owner feedback 2026-11-11): Cyberpunk rain ripples, Ocean sea-life roster and haze, translucent reading
   surfaces on the light worlds (Sakura, Arctic) that still pass WCAG AA, and the reworked worlds' assets. Offline fixture pages. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { launch, extPage, setConfig, visualContrast } = require('./helpers');
const updateConfig = (context, src) => extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); await p.evaluate(s => RepoVibeCore.updateConfig(new Function('c', s)), src); await p.close(); });
const TUNE = { parallax: 100, motion: 100, particles: 100, foreground: 100 };

test('Cyberpunk Neon: rain-drop ripples on the canal animate (scale/opacity only), rest in Static and reduced motion, never take input', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth img[data-fx="ripple"]', { state: 'attached' });
    const info = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('#repovibe-depth img[data-fx="ripple"]')];
      const anims = document.getAnimations().filter(a => a.animationName === 'repv-ripple');
      const props = [...new Set(anims.flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))].sort();
      const durs = new Set(imgs.map(i => getComputedStyle(i).animationDuration));
      return { n: imgs.length, anims: anims.length, props, durs: durs.size, pe: getComputedStyle(document.getElementById('repovibe-depth')).pointerEvents, src: imgs[0].src };
    });
    assert.ok(info.n >= 16, `ripples: ${info.n}`); assert.equal(info.anims, info.n, 'every ripple animates');
    assert.deepEqual(info.props, ['opacity', 'scale'], 'compositor-only properties');
    assert.ok(info.durs >= 6, 'drops land out of step (different periods)'); assert.equal(info.pe, 'none');
    assert.match(info.src, /neon-city-3d\/s-ripple\.webp$/);
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'repv-ripple' && a.playState === 'running').length), 0, 'Static: ripples rest');
    const rest = await page.evaluate(() => { const i = document.querySelector('#repovibe-depth img[data-fx="ripple"]'); return i ? +getComputedStyle(i).opacity : null; });
    assert.ok(rest === null || (rest > 0 && rest <= 0.5), `rest opacity ${rest}`);
    await updateConfig(context, "c.motionMode = 'ambient';");
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'repv-ripple').length), 0, 'reduced motion: no ripple animation');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Ocean Depths: no cartoon manta/whale; the distant school is hazed by opacity; corals sway on the current', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-7', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="turtle"]', { state: 'attached' });
    const f = await page.evaluate(() => {
      const s = [...document.querySelectorAll('#repovibe-depth .repv-s, #repovibe-popout .repv-s')];
      const srcs = s.map(w => w.querySelector('img').src.split('/').pop());
      const hazed = s.filter(w => w.style.opacity && +w.style.opacity < 1).length;
      const coralWind = s.filter(w => /^coral/.test(w.dataset.sprite) && w.querySelector('img[data-wind]')).map(w => parseFloat(w.querySelector('img').style.getPropertyValue('--wa')));
      return { srcs, hazed, coralWind };
    });
    assert.ok(!f.srcs.some(x => /manta|whale/.test(x)), f.srcs.join());
    assert.ok(f.hazed >= 4, `hazed far school: ${f.hazed}`);
    assert.ok(f.coralWind.length >= 8 && Math.min(...f.coralWind) >= 1.3, `coral sway amplitudes ${f.coralWind}`);
    for (const n of ['manta', 'whale']) assert.ok(!fs.existsSync(path.join(__dirname, '../../wallpapers/depth/ocean-kingdom', `s-${n}.webp`)), `${n} asset removed`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('light worlds (Sakura Dreams, Arctic Frost): reading surfaces are translucent, not solid white, and every text element still passes WCAG AA', async () => {
  for (const id of ['preset-3', 'preset-12']) {
    const { context, errors, close } = await launch({ colorScheme: 'light' });
    try {
      context.setDefaultTimeout(30000);
      await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'static', depthQuality: 'full', depthTuning: TUNE });
      const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
      const op = await page.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--repv-panel-opacity')));
      assert.ok(op > 0.6 && op <= 0.8, `${id}: panel opacity ${op} (was 0.88–0.91 before the rework)`);
      const vc = await visualContrast(context, page);
      assert.equal(vc.fails.length, 0, `${id}: ${vc.failSummary}`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('reworked worlds ship their assets: Pixel Paradise and Arctic Frost layers and sprites, no leftover crystal props', () => {
  const D = path.join(__dirname, '../../wallpapers/depth');
  for (const [slug, files] of [['pixel-paradise-3d', ['far', 'mid', 'near', 'front', 'rays', 's-palmA', 's-palmB', 's-cloudA', 's-cloudB', 's-gull', 's-cube', 's-crab']],
    ['arctic-frost-3d', ['far', 'mid', 'near', 'front', 'rays', 's-pineA', 's-pineB', 's-pineC', 's-fox', 's-flake']], ['neon-city-3d', ['s-ripple']]])
    for (const f of files) assert.ok(fs.existsSync(path.join(D, slug, `${f}.webp`)), `${slug}/${f}.webp`);
  for (const f of ['s-crystal', 's-shard']) assert.ok(!fs.existsSync(path.join(D, 'arctic-frost-3d', `${f}.webp`)));
});
