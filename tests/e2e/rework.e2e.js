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

test('Ocean Depths (painted from scratch): no cartoon manta/whale; the distant school is hazed by opacity; plants sway on the current', async () => {
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
      const plantWind = s.filter(w => /^(kelp|fan|soft|grass)/.test(w.dataset.sprite) && w.querySelector('img[data-wind]')).map(w => parseFloat(w.querySelector('img').style.getPropertyValue('--wa')));
      return { srcs, hazed, plantWind };
    });
    assert.ok(!f.srcs.some(x => /manta|whale/.test(x)), f.srcs.join());
    assert.ok(f.hazed >= 4, `hazed far school: ${f.hazed}`);
    assert.ok(f.plantWind.length >= 12 && Math.min(...f.plantWind) >= 2.4, `kelp / sea fan / soft coral / seagrass sway amplitudes ${f.plantWind}`);
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
      assert.ok(op > 0.45 && op <= 0.7, `${id}: panel opacity ${op} (0.88–0.91 white before the rework; now a tinted, softer surface)`);
      const surf = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim());
      const [r, g, b] = surf.match(/[0-9a-f]{2}/gi).map(h => parseInt(h, 16));
      assert.ok(Math.min(r, g, b) < 0xe6, `${id}: reading surface is tinted, not white (${surf})`);
      const vc = await visualContrast(context, page);
      assert.equal(vc.fails.length, 0, `${id}: ${vc.failSummary}`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('reworked worlds ship their assets: Pixel Paradise and Arctic Frost layers and sprites, no leftover crystal props', () => {
  const D = path.join(__dirname, '../../wallpapers/depth');
  for (const [slug, files] of [['pixel-paradise-3d', ['far', 'mid', 'near', 'front', 'rays', 's-palmA', 's-palmB', 's-cloudA', 's-cloudB', 's-gull', 's-cube', 's-crab']],
    ['arctic-frost-3d', ['far', 'mid', 'near', 'front', 'rays', 's-pineA', 's-pineB', 's-pineC', 's-fox', 's-flake']], ['neon-city-3d', ['s-ripple']],
    ['sakura-garden', ['far', 'mid', 's-treeNearL', 's-treeNearR', 's-treeMidL', 's-treeMidR', 's-sprayA', 's-sprayB', 't-clouds']],
    ['ocean-kingdom', ['far', 's-kelpL1', 's-kelpR1', 's-fanL', 's-fanR', 's-softL', 's-anemL', 't-caustic', 't-mask-sand']]])
    for (const f of files) assert.ok(fs.existsSync(path.join(D, slug, `${f}.webp`)), `${slug}/${f}.webp`);
  for (const f of ['s-crystal', 's-shard']) assert.ok(!fs.existsSync(path.join(D, 'arctic-frost-3d', `${f}.webp`)));
  assert.ok(!fs.readdirSync(path.join(D, 'ocean-kingdom')).some(f => f.startsWith('s-coral')), 'reference-plate coral cut-outs removed');
});

test('Lite / Auto on a slow machine: weather never freezes — rain, snow and petals keep falling, ripples run, plants sway, swimmers swim', async () => {
  for (const [id, label, must] of [['preset-1', 'cyberpunk', ['repv-drop', 'repv-ripple']], ['preset-17', 'aurora', ['repv-flow', 'repv-aurora-sway', 'repv-tile']], ['preset-12', 'arctic', ['repv-tile']], ['preset-3', 'sakura', ['repv-tile', 'repv-gust-r']], ['preset-7', 'ocean', ['repv-cross-rev', 'repv-gust-r']]]) {
    const { context, errors, close } = await launch({ colorScheme: 'dark' });
    try {
      context.setDefaultTimeout(30000);
      await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'ambient', depthQuality: 'lite', depthTuning: TUNE });
      const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-lite'));
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => {
        const run = [...new Set(document.getAnimations().filter(a => a.playState === 'running' && a.animationName).map(a => a.animationName))];
        const pmid = document.querySelector('#repovibe-depth > [data-l="pmid"]');
        const pm = pmid && pmid.firstElementChild ? document.getAnimations().filter(a => a.effect?.target === pmid.firstElementChild && a.playState === 'running').length : 0;
        return { run, pmidVisible: pmid ? getComputedStyle(pmid).visibility : null, pmidAnims: pm };
      });
      for (const m of must) assert.ok(info.run.includes(m), `${label} (Lite): ${m} must run; running: ${info.run.join()}`);
      if (label === 'cyberpunk') { assert.deepEqual(errors, []); continue; }   // Cyberpunk has no free weather plane: its drops are paired with their rings
      assert.equal(info.pmidVisible, 'visible', `${label}: the weather plane stays visible`);
      assert.ok(info.pmidAnims >= 1, `${label}: the visible weather plane animates (no frozen overlay)`);
      // the plane really travels: its transform changes over time
      const t0 = await page.evaluate(() => getComputedStyle(document.querySelector('#repovibe-depth > [data-l="pmid"] > i')).transform);
      await page.waitForTimeout(400);
      const t1 = await page.evaluate(() => getComputedStyle(document.querySelector('#repovibe-depth > [data-l="pmid"] > i')).transform);
      assert.notEqual(t0, t1, `${label}: weather plane moved (${t0} → ${t1})`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('round 3 curation: no rain over Alpine Lake or Synthwave Valley; archived backgrounds leave the Studio picker; saved Synthwave assignment still works', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    const base = { id: 'custom-rain', name: 'Neon over the lake', description: 'x', bg: '#100c25', surface: '#1b1538', surfaceAlt: '#292044', text: '#f3edff', muted: '#c4bbe3', accent: '#c6a8ff', border: '#49337e', gradientTo: '#25104c', gradientThird: '#051f31', code: '#15122a', backgroundMode: 'image', motion: 'rain', flagship: true };
    await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: 'custom-rain', repoAssignments: { 'acme/synth': 'preset-20' },
      customThemes: { 'custom-rain': { ...base, wallpaperRef: 'builtin:alpine-lake' }, 'custom-synth': { ...base, id: 'custom-synth', wallpaperRef: 'builtin:synthwave-3d' } } });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('alpine-lake'));
    await page.waitForTimeout(300);
    const rainy = () => page.evaluate(() => document.documentElement.className.includes('repv-motion-rain') || document.getAnimations().some(a => a.animationName === 'repv-rain'));
    assert.equal(await rainy(), false, 'Alpine Lake: no rain');
    await updateConfig(context, "c.defaultThemeId = 'custom-synth';");
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('synthwave-3d'));
    await page.waitForTimeout(300);
    assert.equal(await rainy(), false, 'Synthwave Valley: no rain');
    await updateConfig(context, "c.defaultThemeId = 'preset-1';");
    await page.waitForFunction(() => document.documentElement.className.includes('repv-motion-rain') || !!document.querySelector('#repovibe-depth[data-scene="neon-city-3d"]'));
    // the archived Synthwave theme still applies where it was assigned
    await page.goto('https://github.com/acme/synth');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('synthwave-highway'));
    // Studio background picker: archived backgrounds are gone, kept ones are offered
    const studio = await extPage(context, 'studio.html'); await studio.setViewportSize({ width: 1400, height: 1000 });
    await studio.click('.sidebar-link[data-view="background"]');
    await studio.waitForSelector('#wallpaperGrid .wallpaper-tile');
    const tiles = await studio.evaluate(() => [...document.querySelectorAll('#wallpaperGrid .wallpaper-tile')].map(t => [t.dataset.ref.replace('builtin:', ''), t.title]));
    const refs = tiles.map(t => t[0]);
    for (const gone of ['pixel-island', 'galaxy-planet', 'neon-rain-street', 'alien-world', 'synthwave-grid']) assert.ok(!refs.includes(gone), `${gone} hidden`);
    // the Studio is editing acme/synth (Synthwave): its own archived background stays visible, labelled, so it is never silently lost
    const hw = tiles.find(t => t[0] === 'synthwave-highway');
    assert.ok(!hw || /archived, still in use/.test(hw[1]), `synthwave-highway only as the in-use tile: ${hw}`);
    for (const kept of ['alpine-lake', 'synthwave-3d']) assert.ok(refs.includes(kept), `${kept} offered`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Ocean Depths: turtles and fish swim forward (the way they face), never backwards; the middle rock carries no plants', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-7', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="turtle"] img', { state: 'attached' });
    // the sea-life sprites face left: every crossing swimmer must travel right → left (cross="rev") unless mirrored
    const sw = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s')].filter(w => /turtle|fish/.test(w.querySelector('img').src) && w.querySelector('img[data-cross]'))
      .map(w => ({ n: w.dataset.sprite, rev: w.querySelector('img').dataset.cross === 'rev', mirrored: w.style.scale === '-1 1' })));
    assert.ok(sw.length >= 10, `crossing swimmers: ${sw.length}`);
    for (const s of sw) assert.equal(s.rev !== s.mirrored, true, `${s.n} must travel the way it faces`);
    const x = () => page.evaluate(() => document.querySelector('#repovibe-depth .repv-s[data-sprite="turtle"] img').getBoundingClientRect().x);
    const x0 = await x(); await page.waitForTimeout(1500); const x1 = await x();
    assert.ok(x1 < x0, `turtle moves left, head first (${x0.toFixed(1)} → ${x1.toFixed(1)})`);
    // no seagrass sprites (they grew on the middle rock); plants still sway elsewhere
    assert.equal(await page.evaluate(() => document.querySelectorAll('#repovibe-depth .repv-s[data-sprite^="grass"]').length), 0);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Cyberpunk Neon: every drop is paired with its ring (same spot, same clock) — no free-falling rain that misses the water', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="dp1"] img', { state: 'attached' }); await page.waitForTimeout(400);
    const pairs = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s[data-sprite^="rp"]')].map(r => {
      const d = document.querySelector(`#repovibe-depth .repv-s[data-sprite="${r.dataset.sprite.replace('rp', 'dp')}"]`);
      const rr = r.getBoundingClientRect(), dr = d.getBoundingClientRect(), ri = r.firstChild, di = d.firstChild;
      return { n: r.dataset.sprite, dx: Math.abs((rr.x + rr.width / 2) - (dr.x + dr.width / 2)), dy: Math.abs((rr.y + rr.height / 2) - (dr.y + dr.height)),
        sameDur: getComputedStyle(ri).animationDuration === getComputedStyle(di).animationDuration, sameDelay: ri.style.animationDelay === di.style.animationDelay };
    }));
    assert.equal(pairs.length, 20);
    for (const p of pairs) assert.ok(p.dx < 1.5 && p.dy < 1.5 && p.sameDur && p.sameDelay, `${p.n} drop lands on its ring: ${JSON.stringify(p)}`);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'repv-rain').length), 0, 'no unpaired rain planes');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Aurora: ribbons stream, undulate and breathe; stars drift; at rest in Static', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-17', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="ribbonA"] img', { state: 'attached' }); await page.waitForTimeout(400);
    const tr = () => page.evaluate(() => ['ribbonA', 'ribbonB', 'ribbonC'].map(n => { const w = document.querySelector(`#repovibe-depth .repv-s[data-sprite="${n}"]`); return [getComputedStyle(w.firstChild).transform, getComputedStyle(w).transform, getComputedStyle(w).overflow]; }));
    const a = await tr(); await page.waitForTimeout(700); const b = await tr();
    for (let i = 0; i < 3; i++) { assert.notEqual(a[i][0], b[i][0], `ribbon ${i} streams`); assert.notEqual(a[i][1], b[i][1], `ribbon ${i} undulates`); assert.equal(a[i][2], 'hidden'); }
    const run = await page.evaluate(() => [...new Set(document.getAnimations().filter(x => x.playState === 'running').map(x => x.animationName))]);
    for (const m of ['repv-flow', 'repv-flow-rev', 'repv-aurora-glow', 'repv-aurora-sway', 'repv-tile']) assert.ok(run.includes(m), `${m}: ${run}`);
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
    assert.equal(await page.evaluate(() => document.getAnimations().filter(x => /^repv-(flow|aurora)/.test(x.animationName)).length), 0, 'Static: aurora at rest');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

/* ---- Round 5 (owner feedback 2026-11-13): Matrix, Dracula, Cozy Coding rebuilt as layered worlds; Aurora repainted; three themes archived. */
test('Matrix: the code moves continuously top → bottom (streams and rain planes), in Lite too; at rest inside the scene in Static', async () => {
  for (const quality of ['full', 'lite']) {
    const { context, errors, close } = await launch({ colorScheme: 'dark' });
    try {
      context.setDefaultTimeout(30000);
      await setConfig(context, { enabled: true, defaultThemeId: 'preset-5', motionMode: 'ambient', depthQuality: quality, depthTuning: TUNE });
      const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 }); await page.goto('https://github.com/acme/project/layout');
      await page.waitForSelector('#repovibe-depth[data-scene="digital-rain"] .repv-s img[data-fx="stream"]', { state: 'attached' });
      await page.waitForTimeout(500);
      // every stream: sample its vertical position 5 times; it only ever moves down, except for the one wrap back to the top of the loop
      const sample = () => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s img[data-fx="stream"]')].map(i => i.getBoundingClientRect().top));
      const frames = []; for (let i = 0; i < 5; i++) { frames.push(await sample()); await page.waitForTimeout(250); }
      assert.ok(frames[0].length >= 16, `${frames[0].length} streams`);
      let wraps = 0;
      for (let s = 0; s < frames[0].length; s++) {
        let down = 0;
        for (let f = 1; f < frames.length; f++) { const dy = frames[f][s] - frames[f - 1][s]; if (dy > 2) down++; else if (dy < -200) wraps++; else assert.fail(`${quality}: stream ${s} did not fall between frames (${frames[f - 1][s]} → ${frames[f][s]})`); }
        assert.ok(down >= 3, `${quality}: stream ${s} falls`);
      }
      assert.ok(wraps <= frames[0].length, 'a stream restarts from the top at most once in the window');
      // the travel covers the whole stage: starts above the viewport, ends below it
      const span = await page.evaluate(() => { const i = document.querySelector('#repovibe-depth .repv-s img[data-fx="stream"]'); const a = i.getAnimations().find(x => x.animationName === 'repv-stream');
        const d = a.effect.getComputedTiming().duration; a.pause(); a.effect.updateTiming({ delay: 0 }); a.currentTime = 0; /* the phase offset is a negative delay: cleared to read the loop's own start and end */ const top0 = i.getBoundingClientRect(); a.currentTime = d * 0.999; const top1 = i.getBoundingClientRect(); a.play(); return { b0: top0.bottom, t1: top1.top, vh: innerHeight }; });
      assert.ok(span.b0 <= 2, `starts above the scene (bottom ${span.b0})`); assert.ok(span.t1 >= span.vh - 2, `ends below it (top ${span.t1}, viewport ${span.vh})`);
      // the code-rain plane(s) slide straight down by one tile per loop
      const planes = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth > .repv-l[data-tw] > i')].filter(i => getComputedStyle(i.parentElement).visibility === 'visible').map(i => ({ l: i.parentElement.dataset.l, sx: i.style.getPropertyValue('--sx'), sy: i.style.getPropertyValue('--sy2'), run: i.getAnimations().some(a => a.animationName === 'repv-tile' && a.playState === 'running') })));
      assert.ok(planes.length >= (quality === 'full' ? 3 : 1), `${quality}: ${planes.length} visible code planes`);
      for (const p of planes) { assert.equal(p.sx, '0'); assert.equal(p.sy, '1'); assert.ok(p.run, `${p.l} plane runs`); }
      const m0 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#repovibe-depth > [data-l="pmid"] > i')).transform).m42);
      await page.waitForTimeout(400);
      const m1 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#repovibe-depth > [data-l="pmid"] > i')).transform).m42);
      assert.ok(m1 > m0 || m1 < m0 - 100, `${quality}: the mid code plane moved down (${m0} → ${m1})`);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth, #repovibe-depth *')].filter(e => getComputedStyle(e).pointerEvents !== 'none').length), 0, 'the scene never takes input');
      if (quality === 'full') {
        await updateConfig(context, "c.motionMode = 'static';");
        await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
        const rest = await page.evaluate(() => ({ anims: document.getAnimations().filter(a => /^repv-(stream|tile)$/.test(a.animationName)).length,
          inside: [...document.querySelectorAll('#repovibe-depth .repv-s img[data-fx="stream"]')].filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length }));
        assert.equal(rest.anims, 0, 'Static: nothing falls'); assert.ok(rest.inside >= 16, `Static: streams rest inside the scene (${rest.inside})`);
      }
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('Dracula, Cozy Coding, Aurora: each world shows its layers and its own live elements; text passes WCAG AA; Static rests', async () => {
  const WORLDS = [
    ['preset-6', 'gothic-castle', ['far', 'mid', 'near', 'front'], ['repv-cross', 'repv-flap', 'repv-swim', 'repv-glow', 'repv-tile'], s => s.filter(n => /^bat\d/.test(n)).length >= 5 && s.filter(n => /^lamp\d/.test(n)).length === 7 && s.includes('moonHalo')],
    ['preset-4', 'cozy-room', ['far', 'mid', 'front'], ['repv-glow', 'repv-tile', 'repv-gust-r', 'repv-flick'], s => ['clumpA', 'clumpB', 'clumpC', 'beam', 'candleGlow', 'flame', 'steam'].every(n => s.includes(n))],
    ['preset-17', 'aurora-borealis', ['far', 'mid', 'near', 'front'], ['repv-flow', 'repv-aurora-sway', 'repv-glow', 'repv-gust-r'], s => ['ribbonA', 'ribbonB', 'ribbonC', 'veilA', 'veilB', 'veilC', 'iceGlow', 'shimmer', 'shrub'].every(n => s.includes(n)) && s.filter(n => /^star\d/.test(n)).length === 9]];
  for (const [id, slug, layers, must, roster] of WORLDS) {
    const { context, errors, close } = await launch({ colorScheme: 'dark' });
    try {
      context.setDefaultTimeout(30000);
      await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
      const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 }); await page.goto('https://github.com/acme/project/layout');
      await page.waitForSelector(`#repovibe-depth[data-scene="${slug}"][data-world] .repv-l[data-l="far"]`, { state: 'attached' });
      await page.waitForTimeout(900);
      const info = await page.evaluate(() => ({ layers: [...document.querySelectorAll('#repovibe-depth > .repv-l')].map(l => l.dataset.l), sprites: [...document.querySelectorAll('#repovibe-depth .repv-s')].map(s => s.dataset.sprite),
        broken: [...document.querySelectorAll('#repovibe-depth img, #repovibe-popout img')].filter(i => i.complete && !i.naturalWidth).map(i => i.src), run: [...new Set(document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName))] }));
      for (const l of layers) assert.ok(info.layers.includes(l), `${slug}: layer ${l}`);
      assert.ok(roster(info.sprites), `${slug} roster: ${info.sprites.join()}`); assert.deepEqual(info.broken, [], `${slug}: every sprite image loads`);
      for (const m of must) assert.ok(info.run.includes(m), `${slug}: ${m} runs (${info.run.join()})`);
      const vc = await visualContrast(context, page);
      assert.equal(vc.fails.length, 0, `${slug}: text contrast ${vc.failSummary}`);
      await updateConfig(context, "c.motionMode = 'static';");
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
      assert.equal(await page.evaluate(() => document.getAnimations().filter(a => /^repv-/.test(a.animationName) && a.effect?.target?.closest?.('#repovibe-depth, #repovibe-popout')).length), 0, `${slug}: Static rests`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('Dracula: bats beat their wings while they cross (the wing beat is on top of the travel, not instead of it)', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-6', motionMode: 'ambient', depthQuality: 'full', depthTuning: TUNE });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="bat1"] img', { state: 'attached' }); await page.waitForTimeout(500);
    const names = await page.evaluate(() => document.querySelector('#repovibe-depth .repv-s[data-sprite="bat1"] img').getAnimations().map(a => a.animationName).sort());
    assert.deepEqual(names, ['repv-cross', 'repv-flap', 'repv-swim']);
    const heights = []; for (let i = 0; i < 8; i++) { heights.push(await page.evaluate(() => document.querySelector('#repovibe-depth .repv-s[data-sprite="bat1"] img').getBoundingClientRect().height)); await page.waitForTimeout(60); }
    assert.ok(Math.max(...heights) / Math.min(...heights) > 1.3, `wings beat: ${heights.map(h => h.toFixed(0)).join()}`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('round 5 curation: Midnight Developer, Lavender Nights, Sunset Boulevard leave the gallery, popup and picker; saved assignments keep applying', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8' });
    const studio = await extPage(context, 'studio.html?view=gallery#gallery'); await studio.waitForSelector('.gallery-card');
    const names = await studio.evaluate(() => [...document.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent));
    for (const gone of ['Midnight Developer', 'Lavender Nights', 'Sunset Boulevard', 'Sakura Dreams', 'Dark Academia', 'Synthwave']) assert.ok(!names.includes(gone), `${gone} hidden`);
    assert.equal(names.length, 16);
    const groups = await studio.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gallery-group')].map(g => [g.dataset.group, [...g.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent)])));
    assert.deepEqual([...groups.experimental].sort(), ['Cozy Coding', 'Eternal Moon'], 'the two themes that need more work are not approved');
    assert.equal(groups.approved.length, 14); assert.ok(groups.approved.includes('Matrix') && groups.approved.includes('Dracula'), 'Matrix and Dracula approved (round 6)');
    const picker = await studio.evaluate(() => RepoVibeCore.pickerWallpapers('').map(w => w.slug));
    for (const slug of ['midnight-skyline', 'lavender-fantasy', 'sunset-coast']) assert.ok(!picker.includes(slug), `${slug} not offered`);
    await studio.close();
    const popup = await extPage(context, 'popup.html'); await popup.waitForSelector('.theme-tile, .quick-theme, [data-theme-id]');
    const quick = await popup.evaluate(() => document.body.innerText);
    for (const gone of ['Midnight Developer', 'Lavender Nights', 'Sunset Boulevard']) assert.ok(!quick.includes(gone), `${gone} not in the popup`);
    await popup.close();
    // saved assignments on the archived themes: untouched in storage, still applied on the page, shown as "archived, still in use"
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-13', ownerAssignments: { acme: 'preset-2' }, repoAssignments: { 'acme/project': 'preset-18' } });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('sunset-coast'));
    const s2 = await extPage(context, 'studio.html?view=gallery#gallery'); await s2.waitForSelector('.gallery-group[data-group="inUseArchived"]');
    const inUse = await s2.evaluate(() => [...document.querySelectorAll('.gallery-group[data-group="inUseArchived"] .gallery-card strong')].map(s => s.firstChild.textContent).sort());
    assert.deepEqual(inUse, ['Lavender Nights', 'Midnight Developer', 'Sunset Boulevard']);
    const cfg = await s2.evaluate(() => RepoVibeCore.loadConfig());
    assert.equal(cfg.defaultThemeId, 'preset-13'); assert.equal(cfg.ownerAssignments.acme, 'preset-2'); assert.equal(cfg.repoAssignments['acme/project'], 'preset-18');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
