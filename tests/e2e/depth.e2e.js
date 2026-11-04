'use strict';
/* 2.5D depth engine E2E (offline fixture, real Chromium, unpacked extension).
   Layered artwork, not real-time 3D geometry: pre-rendered depth slabs + particle planes move at different
   rates with the pointer (parallax) and, in Cinematic, with a slow camera drift. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, extPage, setConfig } = require('./helpers');

const updateConfig = (context, fnSource) => extPage(context).then(async p => {
  await p.waitForFunction(() => !!globalThis.RepoVibeCore);
  await p.evaluate(src => RepoVibeCore.updateConfig(new Function('c', src)), fnSource);
  await p.close();
});
const layerX = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#repovibe-depth > .repv-l')]
  .map(l => [l.dataset.l, new DOMMatrixReadOnly(getComputedStyle(l).transform).m41])));
async function sweep(page) {
  const { width, height } = page.viewportSize();
  // wait for the smoothed pointer (--px = -pointer x in [-1, 1]) to settle at each end
  const settle = target => page.waitForFunction(t => Math.abs(parseFloat(document.getElementById('repovibe-depth').style.getPropertyValue('--px') || '0') - t) < 0.02, target, { polling: 50 });
  await page.mouse.move(5, height / 2);
  await settle(1 - 10 / width);
  const left = await layerX(page);
  await page.mouse.move(width - 5, height / 2, { steps: 4 });
  await settle(-(1 - 10 / width));
  const right = await layerX(page);
  return Object.fromEntries(Object.keys(left).map(k => [k, Math.abs(right[k] - left[k])]));
}

test('depth engine: layered scene, parallax ordered by depth, never intercepts input, modes, Home, restore', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8', motionMode: 'ambient', depthEffects: true });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('https://github.com/acme/project');
    await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached' });
    const info = await page.evaluate(() => {
      const el = document.getElementById('repovibe-depth'); const s = getComputedStyle(el);
      return { scene: el.dataset.scene, layers: [...el.children].map(c => c.dataset.l || c.className), pe: s.pointerEvents, z: s.zIndex, pos: s.position,
        aria: el.getAttribute('aria-hidden'), parent: el.parentElement.tagName, afterNone: getComputedStyle(document.documentElement, '::after').content };
    });
    assert.equal(info.scene, 'enchanted-forest');
    for (const l of ['far', 'mid', 'near', 'front', 'pfar', 'pmid', 'pnear']) assert.ok(info.layers.includes(l), `layer ${l} in ${info.layers}`);
    assert.deepEqual([info.pe, info.z, info.pos, info.aria, info.parent], ['none', '-1', 'fixed', 'true', 'HTML']);
    assert.equal(info.afterNone, 'none', 'the flat live layer is replaced, not stacked');
    // every layer's art is actually loaded (no broken URLs)
    const loaded = await page.evaluate(() => Promise.all([...document.querySelectorAll('#repovibe-depth .repv-l > i')].map(i => {
      const m = /url\("([^"]+)"\)/.exec(i.style.backgroundImage); if (!m || m[1].startsWith('data:')) return true;
      return new Promise(r => { const im = new Image(); im.onload = () => r(im.naturalWidth >= 1920); im.onerror = () => r(false); im.src = m[1]; });
    })));
    assert.ok(loaded.every(Boolean), `layer images load at full resolution: ${loaded}`);
    // parallax: nearer layers move further than distant ones (not a single translated image)
    const d = await sweep(page);
    assert.ok(d.far > 0.5, `far moves a little (${d.far})`);
    assert.ok(d.mid > d.far * 2 && d.near > d.mid * 1.5 && d.front > d.near && d.pnear > d.front, `depth ordering ${JSON.stringify(d)}`);
    // never intercepts input; no horizontal overflow from the oversized layers
    const hit = await page.evaluate(() => { const a = document.querySelector('#toOther'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + 5, r.top + r.height / 2) === a; });
    assert.ok(hit, 'link is the hit target above the scene');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'no horizontal scroll');
    // only compositor-friendly properties animate
    const props = await page.evaluate(() => [...new Set(document.getAnimations().filter(a => a.animationName).flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))].sort());
    assert.ok(props.every(p => ['opacity', 'transform'].includes(p)), props.join());
    // Cinematic: larger amplitude and a slow camera drift on the art layers
    await updateConfig(context, "c.motionMode = 'cinematic';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-cinematic'));
    const names = await page.evaluate(() => [...new Set(document.getAnimations().map(a => a.animationName))]);
    assert.ok(names.includes('repv-cam') && names.includes('repv-sway'), names.join());
    const dc = await sweep(page);
    assert.ok(dc.front > d.front * 1.8, `cinematic parallax is stronger (${dc.front} vs ${d.front})`);
    // Static, depth off and reduced motion each fall back to the sharp flat scene
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => !document.getElementById('repovibe-depth') && !document.documentElement.classList.contains('repv-depth'));
    assert.ok(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundImage.includes('enchanted-forest.webp')), 'flat scene stays');
    await updateConfig(context, "c.motionMode = 'ambient'; c.depthEffects = false;");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-fireflies'));
    assert.equal(await page.evaluate(() => !!document.getElementById('repovibe-depth')), false, 'depth effects off');
    await updateConfig(context, 'c.depthEffects = true;');
    await page.waitForSelector('#repovibe-depth', { state: 'attached' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.getElementById('repovibe-depth'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForSelector('#repovibe-depth', { state: 'attached' });
    // scene-window height setting (the offline fixture has no repository content container: add an empty one)
    await page.evaluate(() => { const c = document.createElement('div'); c.id = 'repo-content-pjax-container'; document.body.appendChild(c); });
    const pad = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#repo-content-pjax-container')).paddingTop));
    const standard = await pad();
    await updateConfig(context, "c.sceneHeight = 'tall';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-scene-tall'));
    const tall = await pad();
    await updateConfig(context, "c.sceneHeight = 'compact';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-scene-compact'));
    const compact = await pad();
    assert.ok(compact < standard && standard < tall, `scene height compact ${compact} < standard ${standard} < tall ${tall}`);
    // Home never runs the depth engine (cards use static thumbnails)
    const home = await context.newPage();
    await home.goto('https://github.com/');
    await home.waitForFunction(() => document.querySelector('[data-repv-card]'));
    assert.equal(await home.evaluate(() => !!document.getElementById('repovibe-depth')), false, 'no depth scene on Home');
    await home.close();
    // disabling removes everything and stops listening
    await updateConfig(context, 'c.enabled = false;');
    await page.waitForFunction(() => !document.documentElement.className.includes('repv'));
    assert.equal(await page.evaluate(() => !!document.getElementById('repovibe-depth')), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('depth engine: each flagship world builds its own layered scene', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1366, height: 800 });
    for (const [preset, slug] of [['preset-1', 'neon-city-3d'], ['preset-8', 'enchanted-forest'], ['preset-19', 'cosmic-galaxy'], ['preset-15', 'scifi-ai']]) {
      await setConfig(context, { enabled: true, defaultThemeId: preset, motionMode: 'ambient' });
      await page.goto('https://github.com/acme/project');
      await page.waitForFunction(s => document.getElementById('repovibe-depth')?.dataset.scene === s, slug);
      const layers = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth > .repv-l')].map(l => l.dataset.l));
      for (const l of ['far', 'mid', 'near', 'front', 'rays']) assert.ok(layers.includes(l), `${slug}: ${l} in ${layers}`);
      const d = await sweep(page);
      assert.ok(d.near > d.far * 3 && d.front > d.near, `${slug}: depth ordering ${JSON.stringify(d)}`);
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
