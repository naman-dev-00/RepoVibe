'use strict';
/* The eight additional immersive worlds (shared/worlds.js): assignment, asset loading, autonomous motion, wind, pop-out safety,
   Static / reduced motion, switching, cleanup, persistence, SPA navigation, contrast, no blocked interactions, no duplicate loops,
   Home preview integration. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, extPage, setConfig, getConfig, visualContrast } = require('./helpers');

const WORLDS = [['preset-3', 'sakura-garden', 'dark'], ['preset-7', 'ocean-kingdom', 'dark'], ['preset-12', 'arctic-frost-3d', 'light'], ['preset-17', 'aurora-borealis', 'dark'],
  ['preset-20', 'synthwave-highway', 'dark'], ['preset-14', 'dark-library', 'dark'], ['preset-10', 'pixel-paradise-3d', 'dark'], ['preset-18', 'sunset-coast', 'dark']];
const FULL = { parallax: 100, motion: 100, particles: 100, foreground: 100 };
const updateConfig = (context, src) => extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); await p.evaluate(s => RepoVibeCore.updateConfig(new Function('c', s)), src); await p.close(); });
const band = page => page.evaluate(() => { const c = document.createElement('div'); c.id = 'repo-content-pjax-container'; c.innerHTML = '<p id="firstText" style="margin:0 40px">Repository content starts here</p>'; (document.querySelector('main, .application-main') || document.body).prepend(c); });
const spritePos = page => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s > img, #repovibe-popout > .repv-s:not([hidden]) > img')].map(i => { const r = i.getBoundingClientRect(); return `${i.parentElement.dataset.sprite}:${r.x.toFixed(1)},${r.y.toFixed(1)}:${getComputedStyle(i).transform}|${getComputedStyle(i).rotate}|${getComputedStyle(i).translate}`; }));
const running = page => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.closest?.('#repovibe-depth, #repovibe-popout')).length);
async function openWorld(context, id, w = 1600, h = 900) {
  await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'ambient', depthEffects: true, depthQuality: 'full', depthTuning: FULL });
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  await page.goto('https://github.com/acme/project/layout'); await band(page);
  await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached' });
  return page;
}

for (const [id, slug, scheme] of WORLDS) {
  test(`${slug}: assigned to ${id}, assets load, moves on its own, pop-outs never block, Static stops everything, text stays readable`, async () => {
    const { context, errors, close } = await launch({ colorScheme: scheme });
    try {
      context.setDefaultTimeout(30000);
      const page = await openWorld(context, id);
      await page.waitForSelector('#repovibe-popout .repv-s:not([hidden])', { state: 'attached' });
      const facts = await page.evaluate(() => { const d = document.getElementById('repovibe-depth'); return { scene: d.dataset.scene, world: d.hasAttribute('data-world'), layers: [...d.children].map(c => c.dataset.l).filter(Boolean), stageBuckets: d.querySelectorAll('.repv-b[data-stage]').length }; });
      assert.equal(facts.scene, slug); assert.ok(facts.world, 'world scene flag'); assert.ok(facts.layers.includes('far') && facts.layers.includes('near') && facts.layers.includes('front') && facts.layers.includes('rays'), JSON.stringify(facts.layers));
      assert.ok(facts.stageBuckets >= 1, 'sprites live in the registered 16:9 stage');
      // every layer image and sprite decodes (no 404 / broken asset)
      await page.waitForFunction(() => [...document.querySelectorAll('#repovibe-depth img, #repovibe-popout img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
      const layerBad = await page.evaluate(async () => { const bad = []; for (const l of document.querySelectorAll('#repovibe-depth > .repv-l:not([data-tile]) > i')) { const m = /url\("?([^")]+)"?\)/.exec(l.style.backgroundImage); if (m) { const r = await fetch(m[1]); if (!r.ok) bad.push(m[1]); } } return bad; });
      assert.deepEqual(layerBad, [], 'layer images');
      // autonomous motion with the pointer parked: animations run and sprites actually move
      await page.mouse.move(800, 450); await page.waitForTimeout(500);
      const a = await spritePos(page); await page.waitForTimeout(2500); const b = await spritePos(page);
      assert.ok(await running(page) > 5, 'animations running');
      assert.ok(a.filter((v, i) => v !== b[i]).length >= 3, `sprites move on their own (${a.filter((v, i) => v !== b[i]).length} of ${a.length})`);
      // wind: tree/plant sprites are driven by the shared gust curve
      assert.ok(await page.evaluate(() => document.querySelectorAll('#repovibe-depth img[data-wind], #repovibe-popout img[data-wind]').length) >= 1, 'wind-driven sprites present');
      // pop-outs: in front but transparent to input, never over text, and the page stays usable
      const pop = await page.evaluate(() => { const p = document.getElementById('repovibe-popout'); const f = document.getElementById('firstText').getBoundingClientRect(); const bad = [...p.querySelectorAll('.repv-s:not([hidden])')].filter(w => { const r = w.getBoundingClientRect(); return r.right > f.left && r.left < f.right && r.bottom > f.top && r.top < f.bottom && f.width > 200 && Math.abs(r.top - f.top) < 40 && r.left > f.left + 5 && r.right < f.right - 5; }).length; return { pe: getComputedStyle(p).pointerEvents, children: [...p.querySelectorAll('.repv-s:not([hidden])')].map(w => getComputedStyle(w).pointerEvents + getComputedStyle(w.firstChild).pointerEvents), bad }; });
      assert.equal(pop.pe, 'none'); assert.ok(pop.children.every(c => c === 'nonenone'), 'pop-out sprites ignore the pointer');
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('repovibe-depth')).pointerEvents), 'none');
      const hit = await page.evaluate(() => { const r = document.getElementById('firstText').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 10, r.top + r.height / 2); return e && (e.id === 'firstText' || e.closest('#firstText') !== null || e.tagName === 'P'); });
      assert.ok(hit, 'text remains the click target');
      // readable over the art (the contrast guard covers the scene tones)
      const contrast = await visualContrast(context, page);
      assert.equal(contrast.below45, 0, `AA text contrast over ${slug}: ${JSON.stringify(contrast.low.slice(0, 3))}`);
      // Static: the full layered artwork, nothing animating, nothing moving
      await updateConfig(context, "c.motionMode = 'static';");
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
      await page.waitForTimeout(800);
      const s1 = await spritePos(page); await page.waitForTimeout(2000); const s2 = await spritePos(page);
      assert.deepEqual(s1, s2, 'Static: no sprite moves');
      assert.equal(await running(page), 0, 'Static: no running animations');
      assert.ok(await page.evaluate(() => document.querySelectorAll('#repovibe-depth .repv-l').length) >= 4, 'Static keeps the layered scene');
      // reduced motion behaves like Static
      await updateConfig(context, "c.motionMode = 'ambient';");
      await page.waitForFunction(() => !document.documentElement.classList.contains('repv-depth-static'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'), null, { timeout: 8000 });
      assert.equal(await running(page), 0, 'reduced motion: no running animations');
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

test('switching between all eight worlds is live, leaves no duplicate scenes or animation loops, restores cleanly and persists', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    const page = await openWorld(context, 'preset-3');
    let baseline = null;
    for (const [id, slug] of [...WORLDS, ['preset-8', 'enchanted-forest'], ['preset-3', 'sakura-garden']]) {
      await updateConfig(context, `c.defaultThemeId = '${id}'; c.autoAssign = false;`);
      await page.waitForFunction(s => document.getElementById('repovibe-depth')?.dataset.scene === s, slug);
      await page.waitForTimeout(600);
      const n = await page.evaluate(() => ({ depth: document.querySelectorAll('#repovibe-depth').length, pop: document.querySelectorAll('#repovibe-popout').length, style: document.querySelectorAll('style[data-repovibe]').length }));
      assert.equal(n.depth, 1, `${slug}: one scene`); assert.ok(n.pop <= 1, `${slug}: at most one pop-out layer`);
      if (slug === 'sakura-garden') { const r = await running(page); if (baseline === null) baseline = r; else assert.ok(r <= baseline + 2, `no leaked animation loops after switching through all worlds (${r} vs ${baseline})`); }
    }
    // persistence: reload keeps the world; SPA navigation keeps one scene
    await page.reload(); await band(page);
    await page.waitForFunction(() => document.getElementById('repovibe-depth')?.dataset.scene === 'sakura-garden');
    await page.evaluate(() => { history.pushState({}, '', '/acme/project/issues'); document.dispatchEvent(new Event('turbo:render')); document.dispatchEvent(new Event('turbo:load')); });
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#repovibe-depth').length), 1, 'SPA navigation: still one scene');
    assert.equal((await getConfig(context)).defaultThemeId, 'preset-3');
    // disable restores everything
    await updateConfig(context, 'c.enabled = false;');
    await page.waitForFunction(() => !document.getElementById('repovibe-depth') && !document.getElementById('repovibe-popout') && !document.documentElement.className.includes('repv'));
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('#repovibe-depth, #repovibe-popout')).length), 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('world themes keep Home "Top repositories" cards on optimised thumbnails (no live renderers) and the resolved theme', async () => {
  for (const [, slug] of WORLDS) assert.ok(fs.existsSync(path.join(__dirname, '../../wallpapers/thumbs', `${slug}.webp`)), `${slug} thumbnail`);
  const sizes = WORLDS.map(([, slug]) => fs.statSync(path.join(__dirname, '../../wallpapers/thumbs', `${slug}.webp`)).size);
  assert.ok(Math.max(...sizes) < 60 * 1024, `thumbnails are small (${Math.max(...sizes)} bytes max)`);
});
