'use strict';
/* The 2026-11-14 batch of new worlds: Messy Thoughts (vector line art) and Eternal Moon (monochrome moonlit forest).
   Registration, experimental status, gallery discovery, selection + persistence, animation modes, reduced motion, asset loading,
   no reaction to the pointer, readability. Offline fixture pages. A passing test is not visual approval: see docs/review/. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, extPage, setConfig, getConfig, visualContrast } = require('./helpers');
const updateConfig = (context, src) => extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); await p.evaluate(s => RepoVibeCore.updateConfig(new Function('c', s)), src); await p.close(); });
const TUNE = { parallax: 100, motion: 100, particles: 100, foreground: 100 };
const NEW = [['preset-21', 'Messy Thoughts', 'messy-thoughts'], ['preset-22', 'Eternal Moon', 'eternal-moon']];
const openWorld = async (context, slug, w = 1600, h = 900) => {
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h }); await page.goto('https://github.com/acme/project/layout');
  await page.waitForSelector(`#repovibe-depth[data-scene="${slug}"][data-world] .repv-l[data-l="far"]`, { state: 'attached' }); await page.waitForTimeout(700); return page;
};

test('new worlds: registered as experimental, discoverable in the gallery, absent from the popup quick grid; Apply persists and survives a reload', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8', motionMode: 'ambient', repoAssignments: { 'acme/other': 'preset-11' } });
    const studio = await extPage(context, 'studio.html?view=gallery#gallery'); await studio.setViewportSize({ width: 1400, height: 1000 }); await studio.waitForSelector('.gallery-card');
    const groups = await studio.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gallery-group')].map(g => [g.dataset.group, [...g.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent)])));
    for (const [, name] of NEW) { assert.ok(groups.experimental.includes(name), `${name} is in the Experimental section`); assert.ok(!groups.approved.includes(name), `${name} is not approved`); }
    assert.equal(groups.approved.length, 12, 'the twelve approved themes are unchanged');
    for (const [, name, slug] of NEW) {
      const card = studio.locator('.gallery-card', { hasText: name });
      assert.ok(await card.locator('.art-image').evaluate(i => i.decode().then(() => i.naturalWidth > 0)), `${name} preview loads`);
      assert.match(await card.locator('.art-image').getAttribute('src'), new RegExp(`${slug}\\.webp`));
      assert.equal(await card.locator('.live-badge').count(), 1, `${name} is marked as a live world`);
    }
    await studio.fill('#gallerySearch', 'eternal');
    assert.deepEqual(await studio.evaluate(() => [...document.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent)), ['Eternal Moon']);
    await studio.fill('#gallerySearch', '');
    await studio.locator('.gallery-card', { hasText: 'Messy Thoughts' }).locator('button', { hasText: 'Apply' }).click();
    await studio.waitForFunction(async () => (await RepoVibeCore.loadConfig()).defaultThemeId === 'preset-21');
    const c = await getConfig(context);
    assert.equal(c.motionMode, 'ambient'); assert.equal(c.repoAssignments['acme/other'], 'preset-11', 'other settings untouched');
    await studio.close();
    const popup = await extPage(context, 'popup.html'); await popup.waitForSelector('.theme-tile');
    const tiles = await popup.evaluate(() => [...document.querySelectorAll('.theme-tile')].map(t => t.textContent.trim()));
    // the popup always shows the theme in use as its first tile; apart from that, experimental worlds are not featured
    assert.equal(tiles.length, 6); assert.ok(tiles[0].includes('Messy Thoughts'), 'the active theme leads the grid'); assert.ok(!tiles.slice(1).some(t => t.includes('Messy Thoughts')));
    assert.ok(!tiles.some(t => t.includes('Eternal Moon')), 'Eternal Moon is not featured while experimental');
    assert.match(await popup.evaluate(() => document.body.innerText), /16 backgrounds/);
    await popup.close();
    const page = await openWorld(context, 'messy-thoughts');
    await page.reload(); await page.waitForSelector('#repovibe-depth[data-scene="messy-thoughts"]', { state: 'attached' });
    assert.equal((await getConfig(context)).defaultThemeId, 'preset-21', 'selection persisted');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Messy Thoughts: vector strokes draw and fade while the figure stays still; fully drawn at rest in Static and reduced motion', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-21', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await openWorld(context, 'messy-thoughts');
    const info = await page.evaluate(() => {
      const fig = document.querySelector('#repovibe-depth .repv-s[data-sprite="figure"] svg'), tan = document.querySelector('#repovibe-depth .repv-s[data-sprite="tangle"] svg');
      const anims = el => [...new Set(el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').map(a => a.animationName))].sort();
      return { figPaths: fig.querySelectorAll('path').length, figAnims: anims(fig), tanLive: tan.querySelectorAll('path[data-draw]').length, tanStill: tan.querySelectorAll('path:not([data-draw])').length, tanAnims: anims(tan),
        vector: fig.namespaceURI === 'http://www.w3.org/2000/svg' && !document.querySelector('#repovibe-depth .repv-s[data-sprite="figure"] img'),
        input: [...document.querySelectorAll('#repovibe-depth, #repovibe-depth *')].filter(e => getComputedStyle(e).pointerEvents !== 'none').length,
        stroke: getComputedStyle(fig.querySelector('path')).stroke, fill: getComputedStyle(fig.querySelector('path')).fill };
    });
    assert.ok(info.vector, 'the figure is inline SVG, not a bitmap'); assert.ok(info.figPaths >= 10); assert.deepEqual(info.figAnims, [], 'the figure is anchored: nothing animates it');
    assert.ok(info.tanLive >= 12 && info.tanStill >= 3, `live ${info.tanLive}, resting ${info.tanStill}`);
    assert.deepEqual(info.tanAnims, ['repv-draw', 'repv-draw-flow', 'repv-svg-breathe']);
    assert.equal(info.input, 0, 'the scene never takes input'); assert.equal(info.stroke, 'rgb(255, 255, 255)'); assert.equal(info.fill, 'none');
    // strokes really progress: dash offsets change over time, and not all in step
    const offs = () => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth path[data-draw]')].map(p => +parseFloat(getComputedStyle(p).strokeDashoffset).toFixed(3)));
    const a = await offs(); await page.waitForTimeout(900); const b = await offs();
    assert.ok(a.filter((v, i) => v !== b[i]).length >= 4, `strokes moving: ${a.join()} → ${b.join()}`); assert.ok(new Set(a).size >= 4, 'strokes are out of phase with each other');
    // the tangle only breathes slightly: under 2.5 degrees and 3 % scale
    const m = await page.evaluate(() => { const t = new DOMMatrix(getComputedStyle(document.querySelector('#repovibe-depth .repv-s[data-sprite="tangle"] svg')).transform); return { rot: Math.abs(Math.atan2(t.b, t.a) * 180 / Math.PI), sc: Math.hypot(t.a, t.b) }; });
    assert.ok(m.rot < 2.5 && m.sc > 0.97 && m.sc < 1.03, `gentle: ${JSON.stringify(m)}`);
    // the pointer changes nothing
    const snap = () => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth > .repv-l, #repovibe-depth > .repv-b, #repovibe-depth .repv-s')].map(e => getComputedStyle(e).transform + getComputedStyle(e).translate).join('|'));
    const before = await snap(); await page.mouse.move(20, 450); await page.mouse.move(1580, 200, { steps: 6 }); await page.waitForTimeout(400);
    assert.equal(await snap(), before, 'no pointer parallax');
    const vc = await visualContrast(context, page); assert.equal(vc.fails.length, 0, `text contrast ${vc.failSummary}`);
    // Static: nothing runs and every stroke is complete and visible
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
    const rest = await page.evaluate(() => ({ anims: document.getAnimations().filter(x => /^repv-/.test(x.animationName) && x.effect?.target?.closest?.('#repovibe-depth')).length,
      paths: [...document.querySelectorAll('#repovibe-depth path')].map(p => [parseFloat(getComputedStyle(p).strokeDashoffset), +getComputedStyle(p).opacity]) }));
    assert.equal(rest.anims, 0); assert.ok(rest.paths.every(([o, op]) => o === 0 && op >= 0.5), 'Static shows the complete drawing');
    await updateConfig(context, "c.motionMode = 'cinematic';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-cinematic'));
    await page.waitForSelector('#repovibe-depth path[data-draw]', { state: 'attached' });
    assert.ok(await page.evaluate(() => parseFloat(document.querySelector('#repovibe-depth path[data-draw]').style.getPropertyValue('--dd')) > 0));
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(x => /^repv-/.test(x.animationName) && x.playState === 'running' && x.effect?.target?.closest?.('#repovibe-depth')).length), 0, 'reduced motion: at rest');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Eternal Moon: 4K layers load, the moon and trees never move, cloud and three fog planes drift in their own bands; Lite keeps fog moving; Static and reduced motion rest', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-22', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await openWorld(context, 'eternal-moon');
    const info = await page.evaluate(async () => {
      const layers = [...document.querySelectorAll('#repovibe-depth > .repv-l')];
      const art = layers.filter(l => !l.hasAttribute('data-tile'));
      const sizes = await Promise.all(art.filter(l => l.dataset.l !== 'rays').map(l => new Promise(r => { const i = new Image(); i.onload = () => r([l.dataset.l, i.naturalWidth, i.naturalHeight]); i.onerror = () => r([l.dataset.l, 0, 0]); i.src = /url\("(.+?)"\)/.exec(l.firstElementChild.style.backgroundImage)[1]; })));
      return { order: layers.map(l => l.dataset.l), sizes,
        still: art.filter(l => l.dataset.l !== 'rays').map(l => [l.dataset.l, l.firstElementChild.getAnimations().filter(a => a.playState === 'running').length]),
        tiles: layers.filter(l => l.hasAttribute('data-tw')).map(l => ({ l: l.dataset.l, sx: l.firstElementChild.style.getPropertyValue('--sx'), sy: l.firstElementChild.style.getPropertyValue('--sy2'), masked: !!l.style.maskImage, clipped: !!l.style.clipPath, run: l.firstElementChild.getAnimations().some(a => a.animationName === 'repv-tile' && a.playState === 'running') })),
        sprites: [...document.querySelectorAll('#repovibe-depth .repv-s')].map(s => s.dataset.sprite), broken: [...document.querySelectorAll('#repovibe-depth img')].filter(i => i.complete && !i.naturalWidth).length };
    });
    for (const l of ['far', 'mid', 'near', 'front', 'rays']) assert.ok(info.order.includes(l), `layer ${l}`);
    // asset tier: a 1600-wide window on a screen that cannot show more than 2560 px gets the 2560-wide layers; growing past that swaps in the 4K masters
    const tier = await page.evaluate(() => Math.max(innerWidth, innerHeight * 16 / 9, screen.width || 0) * devicePixelRatio > 2560 ? [3840, 2160] : [2560, 1440]);
    for (const [l, w, h] of info.sizes) assert.deepEqual([w, h], tier, `${l} uses the ${tier[0]}-wide asset on this screen`);
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.waitForFunction(() => /\/far\.webp/.test(document.querySelector('#repovibe-depth > [data-l="far"] > i')?.style.backgroundImage || ''), null, { timeout: 15000 });
    const big = await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = /url\("(.+?)"\)/.exec(document.querySelector('#repovibe-depth > [data-l="far"] > i').style.backgroundImage)[1]; }));
    assert.deepEqual(big, [3840, 2160], 'at 3840 × 2160 the scene is drawn from the 4K master: no upscaling');
    await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(500);
    for (const [l, n] of info.still) assert.equal(n, 0, `${l} (moon / trees / lake) has no animation`);
    assert.deepEqual(info.tiles.map(t => t.l).sort(), ['mist', 'pfar', 'pmid', 'pnear']);
    for (const t of info.tiles) { assert.equal(t.sy, '0', `${t.l} drifts sideways only`); assert.ok(['1', '-1'].includes(t.sx)); assert.ok(t.masked && t.clipped, `${t.l} confined to its band`); assert.ok(t.run, `${t.l} runs`); }
    assert.ok(new Set(info.tiles.map(t => t.sx)).size === 2, 'fog planes move in opposite directions');
    assert.ok(info.sprites.includes('halo') && info.sprites.filter(n => /^star\d/.test(n)).length === 9 && !info.sprites.some(n => /moon/i.test(n)), `sprites: ${info.sprites}`);
    assert.equal(info.broken, 0, 'every image loads');
    const tx = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#repovibe-depth > [data-l="pmid"] > i')).transform).m41);
    const x0 = await tx(); await page.waitForTimeout(700); const x1 = await tx(); assert.notEqual(x0, x1, `fog between the tree ranks moved (${x0} → ${x1})`);
    const snap = () => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth > .repv-l:not([data-tile]), #repovibe-depth > .repv-b')].map(e => getComputedStyle(e).transform).join('|'));
    const before = await snap(); await page.mouse.move(20, 450); await page.mouse.move(1580, 200, { steps: 6 }); await page.waitForTimeout(400);
    assert.equal(await snap(), before, 'no pointer parallax');
    const vc = await visualContrast(context, page); assert.equal(vc.fails.length, 0, `text contrast ${vc.failSummary}`);
    await updateConfig(context, "c.depthQuality = 'lite';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-lite'));
    const l0 = await tx(); await page.waitForTimeout(700); assert.notEqual(l0, await tx(), 'Lite: the fog plane keeps moving');
    await updateConfig(context, "c.depthQuality = 'full'; c.motionMode = 'cinematic';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-cinematic'));
    assert.equal(await page.evaluate(() => document.querySelector('#repovibe-depth > [data-l="far"] > i').getAnimations().filter(a => a.playState === 'running').length), 0, 'Cinematic: the moon still does not move');
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => /^repv-/.test(a.animationName) && a.effect?.target?.closest?.('#repovibe-depth')).length), 0, 'Static rests');
    await updateConfig(context, "c.motionMode = 'ambient';"); await page.waitForFunction(() => !document.documentElement.classList.contains('repv-depth-static'));
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => /^repv-/.test(a.animationName) && a.playState === 'running' && a.effect?.target?.closest?.('#repovibe-depth')).length), 0, 'reduced motion rests');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('new worlds at 1366×768, 1920×1080, 2560×1440 and 3840×2160: the scene covers the viewport without distortion and never upscales beyond its assets by more than the cover fit', async () => {
  for (const [id, , slug] of NEW) {
    const { context, errors, close } = await launch({ colorScheme: 'dark' });
    try {
      context.setDefaultTimeout(30000);
      await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
      const page = await openWorld(context, slug, 1366, 768);
      for (const [w, h] of [[1366, 768], [1920, 1080], [2560, 1440], [3840, 2160]]) {
        await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
        const g = await page.evaluate(() => { const far = document.querySelector('#repovibe-depth > [data-l="far"] > i'), r = far.getBoundingClientRect(), cs = getComputedStyle(far); const st = document.querySelector('#repovibe-depth > .repv-b[data-stage]')?.getBoundingClientRect();
          return { covers: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, size: cs.backgroundSize, pos: cs.backgroundPosition, stage: st ? +(st.width / st.height).toFixed(3) : null, overflowX: document.documentElement.scrollWidth > innerWidth }; });
        assert.ok(g.covers, `${slug} ${w}×${h}: scene covers the viewport`); assert.equal(g.size, 'cover', 'aspect ratio preserved (cover, never stretched)'); assert.match(g.pos, /50% 50%/);
        if (g.stage !== null) assert.ok(Math.abs(g.stage - 16 / 9) < 0.01, `${slug} ${w}×${h}: sprites share the 16:9 stage (${g.stage})`);
        assert.equal(g.overflowX, false, 'no horizontal scroll');
      }
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});
