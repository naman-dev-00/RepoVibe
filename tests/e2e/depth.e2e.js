'use strict';
/* 2.5D depth engine E2E (offline fixture, real Chromium, unpacked extension).
   Layered artwork, not real-time 3D geometry: pre-rendered depth slabs + particle planes move at different
   rates with the pointer (parallax) and, in Cinematic, with a slow camera drift. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, extPage, setConfig } = require('./helpers');
const FULL_TUNING = { parallax: 100, motion: 100, particles: 100, foreground: 100 };

const updateConfig = (context, fnSource) => extPage(context).then(async p => {
  await p.waitForFunction(() => !!globalThis.RepoVibeCore);
  await p.evaluate(src => RepoVibeCore.updateConfig(new Function('c', src)), fnSource);
  await p.close();
});
const layerX = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#repovibe-depth > .repv-l, #repovibe-depth > .repv-b, #repovibe-popout > .repv-s')]
  .map(l => [l.dataset.l || (l.classList.contains('repv-b') ? `sprite:bucket:${l.dataset.k}` : `pop:${l.dataset.sprite}:${l.dataset.k}`), new DOMMatrixReadOnly(getComputedStyle(l).transform).m41])));
async function sweep(page) {
  const { width, height } = page.viewportSize();
  // pointer from far left to far right: the scene must NOT react (mouse parallax was removed by request)
  await page.mouse.move(5, height / 2); await page.waitForTimeout(600);
  const left = await layerX(page);
  await page.mouse.move(width - 5, height / 2, { steps: 4 }); await page.waitForTimeout(600);
  const right = await layerX(page);
  return Object.fromEntries(Object.keys(left).map(k => [k, Math.abs(right[k] - left[k])]));
}

test('depth engine: layered scene, no mouse parallax, never intercepts input, modes, Home, restore', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8', motionMode: 'ambient', depthEffects: true, depthQuality: 'full', depthTuning: FULL_TUNING });
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
    assert.ok(Object.values(d).every(v => v < 0.5), `no layer or object follows the mouse ${JSON.stringify(d)}`);
    // never intercepts input; no horizontal overflow from the oversized layers
    const hit = await page.evaluate(() => { const a = document.querySelector('#toOther'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + 5, r.top + r.height / 2) === a; });
    assert.ok(hit, 'link is the hit target above the scene');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'no horizontal scroll');
    // only compositor-friendly properties animate (transform and its individual translate / rotate / scale, and opacity)
    const props = await page.evaluate(() => [...new Set(document.getAnimations().filter(a => a.animationName).flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))].sort());
    assert.ok(props.every(p => ['opacity', 'transform', 'translate', 'rotate', 'scale'].includes(p)), props.join());
    // Cinematic: larger amplitude and a slow camera drift on the art layers
    await updateConfig(context, "c.motionMode = 'cinematic';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-cinematic'));
    const names = await page.evaluate(() => [...new Set(document.getAnimations().map(a => a.animationName))]);
    assert.ok(names.includes('repv-cam') && names.includes('repv-sway'), names.join());
    const dc = await sweep(page);
    assert.ok(Object.values(dc).every(v => v < 0.5), `Cinematic: still no mouse parallax ${JSON.stringify(dc)}`);
    // Quality: Lite hides the extra particle planes; Full keeps them; diagnostics report it
    await updateConfig(context, "c.depthQuality = 'lite';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-lite'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#repovibe-depth > [data-l="pnear"]')).visibility), 'hidden');
    await updateConfig(context, "c.depthQuality = 'full';");
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-depth-lite'));
    // Static (and reduced motion): the same layered scene at rest — no animation, no pointer response, no overscan
    const still = async label => {
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
      const st = await page.evaluate(() => ({ anims: document.getAnimations().filter(a => /^repv-/.test(a.animationName || '')).length, layers: document.querySelectorAll('#repovibe-depth > .repv-l').length }));
      assert.equal(st.anims, 0, `${label}: nothing animates`); assert.ok(st.layers >= 5, `${label}: still layered (${st.layers} layers)`);
      const before = await layerX(page); await page.mouse.move(5, 300); await page.waitForTimeout(500); await page.mouse.move(1360, 300); await page.waitForTimeout(500);
      assert.deepEqual(await layerX(page), before, `${label}: no pointer parallax`);
    };
    await updateConfig(context, "c.motionMode = 'static';");
    await still('Static');
    await updateConfig(context, "c.motionMode = 'ambient'; c.depthEffects = false;");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-fireflies'));
    assert.equal(await page.evaluate(() => !!document.getElementById('repovibe-depth')), false, 'depth effects off');
    await updateConfig(context, 'c.depthEffects = true;');
    await page.waitForSelector('#repovibe-depth', { state: 'attached' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await still('reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-depth-static'));
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
      await setConfig(context, { enabled: true, defaultThemeId: preset, motionMode: 'ambient', depthTuning: FULL_TUNING });
      await page.goto('https://github.com/acme/project');
      await page.waitForFunction(s => document.getElementById('repovibe-depth')?.dataset.scene === s, slug);
      const layers = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth > .repv-l')].map(l => l.dataset.l));
      for (const l of ['far', 'mid', 'rays']) assert.ok(layers.includes(l), `${slug}: ${l} in ${layers}`);
      // individually moving objects: scene sprites behind the page and pop-out sprites in front of it (safe regions only)
      const sp = await page.evaluate(() => ({ scene: document.querySelectorAll('#repovibe-depth .repv-s').length, pop: document.querySelectorAll('#repovibe-popout > .repv-s').length,
        popPE: document.getElementById('repovibe-popout') ? getComputedStyle(document.getElementById('repovibe-popout')).pointerEvents : null }));
      assert.ok(sp.scene >= 2 && sp.pop >= 2 && sp.popPE === 'none', `${slug}: sprites ${JSON.stringify(sp)}`);
      const d = await sweep(page);
      assert.ok(Object.values(d).every(v => v < 0.5), `${slug}: nothing follows the mouse ${JSON.stringify(d)}`);
      // ...but the objects keep moving on their own
      const pos = () => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s > img')].map(i => getComputedStyle(i).transform + getComputedStyle(i).rotate + getComputedStyle(i).opacity));
      const p0 = await pos(); await page.waitForTimeout(1500); const p1 = await pos();
      assert.ok(p0.filter((v, i) => v !== p1[i]).length >= 2, `${slug}: objects move autonomously`);
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Cosmic Galaxy hero: asteroids move on their own, pop-out objects sit in front but never over text and never take clicks', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-19', motionMode: 'ambient', depthQuality: 'full', depthTuning: FULL_TUNING });
    const page = await context.newPage(); await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://github.com/acme/project/layout');
    // the offline fixture has no repository content container: add one at the top of the content (scene window band)
    await page.evaluate(() => { const c = document.createElement('div'); c.id = 'repo-content-pjax-container'; c.innerHTML = '<p id="firstText" style="margin:0 40px">Repository content starts here</p>'; (document.querySelector('main, .application-main') || document.body).prepend(c); });
    await page.waitForSelector('#repovibe-popout .repv-s:not([hidden])', { state: 'attached' });
    await page.mouse.move(960, 540); await page.waitForTimeout(800);
    // autonomous motion: with the pointer still, sprites keep moving (drift/rotation loops)
    const pos = () => page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-s > img, #repovibe-popout > .repv-s:not([hidden]) > img')].map(i => { const r = i.getBoundingClientRect(); return [i.parentElement.dataset.sprite, r.x, r.y, getComputedStyle(i).transform]; }));
    const a = await pos(); await page.waitForTimeout(3000); const b = await pos();
    const moved = a.filter((p, i) => Math.hypot(p[1] - b[i][1], p[2] - b[i][2]) > 3 || p[3] !== b[i][3]).map(p => p[0]);
    assert.ok(moved.length >= 6, `objects move on their own without input: ${moved.join(', ')}`);
    // pop-out sprites: above the page (z-index > content), pointer-events none, and nothing readable/clickable beneath
    const pops = await page.evaluate(() => [...document.querySelectorAll('#repovibe-popout > .repv-s:not([hidden])')].map(s => {
      const r = s.getBoundingClientRect(); const hits = [];
      for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
        const x = r.left + r.width * i / 6, y = r.top + r.height * j / 6; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const e = document.elementsFromPoint(x, y).find(e => e !== document.documentElement && e !== document.body);
        if (e && (e.matches('a, button, input, p, span, code, img, svg') || [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()))) hits.push(e.tagName + '#' + e.id);
      }
      return { n: s.dataset.sprite, z: getComputedStyle(s.parentElement).zIndex, pe: getComputedStyle(s.parentElement).pointerEvents, w: Math.round(r.width), hits };
    }));
    assert.ok(pops.length >= 2, `pop-out objects shown: ${JSON.stringify(pops)}`);
    for (const p of pops) { assert.equal(p.pe, 'none'); assert.equal(p.z, '2'); assert.deepEqual(p.hits, [], `${p.n} is over content`); }
    // clicks pass straight through a pop-out object
    const hit = await page.evaluate(() => { const s = document.querySelector('#repovibe-popout > .repv-s:not([hidden])'); const r = s.getBoundingClientRect(); const x = Math.min(innerWidth - 2, Math.max(1, r.left + r.width / 2)), y = r.top + r.height / 2; return document.elementFromPoint(x, y)?.closest('#repovibe-popout') === null; });
    assert.ok(hit, 'the element under a pop-out object receives the pointer');
    // foreground intensity 0 removes the pop-out layer; disabling removes everything
    await updateConfig(context, 'c.depthTuning = { parallax: 100, motion: 100, particles: 100, foreground: 0 };');
    await page.waitForFunction(() => !document.getElementById('repovibe-popout'));
    await updateConfig(context, 'c.enabled = false;');
    await page.waitForFunction(() => !document.getElementById('repovibe-depth') && !document.getElementById('repovibe-popout'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('true defaults: pop-out layer on, Auto quality decides once and never oscillates across mode changes', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    // an explicit v2 config without depth settings → real defaults (Ambient, Auto quality, foreground 100 %)
    await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, defaultThemeId: 'preset-1' });
    const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('https://github.com/acme/project/layout');
    await page.evaluate(() => { const c = document.createElement('div'); c.id = 'repo-content-pjax-container'; c.innerHTML = '<p style="margin:0 40px">Repository content</p>'; (document.querySelector('main, .application-main') || document.body).prepend(c); });
    await page.waitForSelector('#repovibe-popout .repv-s:not([hidden])', { state: 'attached' });
    const pops = await page.evaluate(() => document.querySelectorAll('#repovibe-popout .repv-s:not([hidden])').length);
    assert.ok(pops >= 1, 'pop-out objects are shown with the default settings');
    // count every Lite on/off change from here on
    await page.evaluate(() => { window.__liteFlips = []; let was = document.documentElement.classList.contains('repv-depth-lite');
      new MutationObserver(() => { const now = document.documentElement.classList.contains('repv-depth-lite'); if (now !== was) { window.__liteFlips.push(now); was = now; } }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); });
    await page.waitForTimeout(5000); // Auto measures once (1.5 s settle + 2 s probe)
    for (const mode of ['cinematic', 'ambient', 'static', 'cinematic', 'ambient']) { await updateConfig(context, `c.motionMode = '${mode}';`); await page.waitForTimeout(4200); }
    const flips = await page.evaluate(() => window.__liteFlips);
    assert.ok(flips.length <= 1 && !flips.includes(false), `Auto switched at most once and never back to Full: ${JSON.stringify(flips)}`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('no idle creature or cursor interaction remains: nothing appears after a long rest, nothing follows the cursor, old saved preference is ignored', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    // a config saved by an earlier build still carries the removed idleButterfly flag
    await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, defaultThemeId: 'preset-8', idleButterfly: true });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    await page.mouse.move(600, 380); await page.mouse.move(620, 400);
    await page.waitForTimeout(17000); // longer than the old 15 s idle trigger
    const extra = await page.evaluate(() => [...document.documentElement.children].filter(e => e.id && /^repovibe-/.test(e.id)).map(e => e.id).sort());
    assert.deepEqual(extra.filter(id => !['repovibe-depth', 'repovibe-popout', 'repovibe-style', 'repovibe-wallpaper', 'repovibe-cards-v1'].includes(id) && !/^repovibe-(style|wallpaper|cards)/.test(id)), [], `only the scene planes exist: ${extra}`);
    assert.equal(await page.evaluate(() => !!document.querySelector('[id*="butterfly" i], [class*="butterfly" i], .bf-w')), false, 'no butterfly element');
    // moving the cursor moves nothing (no parallax, no follower)
    const before = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-l')].map(l => getComputedStyle(l).transform).join('|'));
    await page.mouse.move(40, 40); await page.mouse.move(1300, 700, { steps: 6 }); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth .repv-l')].map(l => getComputedStyle(l).transform).join('|')), before, 'layers do not react to the cursor');
    // saving an unrelated setting keeps the user's other settings and drops the dead flag
    await updateConfig(context, "c.sceneHeight = 'tall';");
    const cfg = await extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); const v = await p.evaluate(() => RepoVibeCore.loadConfig()); await p.close(); return v; });
    assert.equal(cfg.sceneHeight, 'tall'); assert.equal(cfg.defaultThemeId, 'preset-8'); assert.equal('idleButterfly' in cfg, false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Enchanted Forest falling leaves: bright natural colours, wind-driven organic motion (drift + sway + flutter + turn), at rest in Static', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    // 1. colour: every leaf sprite is clearly lighter than the old dark-green leaf and has a distinct hue
    const ext = await extPage(context); await ext.waitForFunction(() => !!globalThis.RepoVibeCore);
    const colours = await ext.evaluate(async () => {
      const out = {};
      for (const k of ['G', 'Y', 'O', 'M']) {
        const i = new Image(); i.src = chrome.runtime.getURL(`wallpapers/depth/enchanted-forest/s-leaf${k}.webp`); await i.decode();
        const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, i.width, i.height).data;
        let n = 0, r = 0, gr = 0, b = 0, l = 0;
        for (let p = 0; p < d.length; p += 4) if (d[p + 3] > 200) { n++; r += d[p]; gr += d[p + 1]; b += d[p + 2]; l += d[p] * .2126 + d[p + 1] * .7152 + d[p + 2] * .0722; }
        out[k] = { luma: l / n, rgb: [r / n, gr / n, b / n].map(Math.round), opaque: n };
      }
      return out;
    });
    await ext.close();
    for (const [k, c] of Object.entries(colours)) { assert.ok(c.opaque > 5000, `leaf${k} has a body (${c.opaque} px)`); assert.ok(c.luma >= 105, `leaf${k} is bright enough to read in the glade (mean luma ${Math.round(c.luma)}; the old dark leaf was ~45)`); }
    assert.ok(colours.Y.rgb[0] > colours.Y.rgb[2] + 60 && colours.O.rgb[0] > colours.O.rgb[1] + 40 && colours.G.rgb[1] > colours.G.rgb[0] + 30, `distinct natural tones ${JSON.stringify(colours)}`);
    // 2. motion
    await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, defaultThemeId: 'preset-8', depthQuality: 'full' });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => document.querySelectorAll('#repovibe-depth img[data-fall]').length >= 5);
    const props = await page.evaluate(() => { const im = document.querySelector('#repovibe-depth img[data-fall]'); return [...new Set(im.getAnimations().flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))].sort(); });
    assert.deepEqual(props, ['opacity', 'rotate', 'scale', 'transform', 'translate'], 'drift/fall, sway, flutter and turn animate on their own properties');
    const names = await page.evaluate(() => [...new Set([...document.querySelectorAll('#repovibe-depth img[data-fall]')].flatMap(i => i.getAnimations().map(a => a.animationName)))].sort());
    assert.deepEqual(names, ['repv-fall', 'repv-leaf-flutter', 'repv-leaf-sway', 'repv-leaf-turn']);
    // sample each leaf for ~9 s: it must drift mostly one way (wind) yet reverse sideways several times, rotate both ways and change width
    const tr = await page.evaluate(() => new Promise(res => { const ims = [...document.querySelectorAll('#repovibe-depth img[data-fall]')], out = ims.map(() => []), t0 = performance.now();
      const tick = () => { ims.forEach((im, i) => { const r = im.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(im).transform); out[i].push([r.x + r.width / 2, r.y + r.height / 2, Math.atan2(m.b, m.a) * 180 / Math.PI, r.width]); }); if (performance.now() - t0 < 9000) setTimeout(tick, 100); else res(out); }; tick(); }));
    let organic = 0;
    for (const s of tr) {
      const v = s.filter(p => p[1] > 0 && p[1] < 800 && p[0] > 0 && p[0] < 1366); if (v.length < 25) continue;
      const dxs = v.slice(1).map((p, k) => p[0] - v[k][0]); let flips = 0; for (let k = 1; k < dxs.length; k++) if (Math.sign(dxs[k]) !== Math.sign(dxs[k - 1]) && Math.abs(dxs[k]) > 0.15) flips++;
      const rots = v.map(p => p[2]), ws = v.map(p => p[3]);
      const ok = flips >= 2 && Math.max(...rots) - Math.min(...rots) > 25 && Math.max(...ws) / Math.min(...ws) > 1.3;
      if (ok) organic++;
    }
    assert.ok(organic >= 3, `at least 3 leaves visibly sway (sideways reversals), flutter (rotation range) and turn (width change): ${organic}`);
    // 3. Static: leaves lie in the scene at rest instead of hiding above it
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-depth-static'));
    const rest = await page.evaluate(() => [...document.querySelectorAll('#repovibe-depth img[data-fall]')].map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.y), i.getAnimations().length]; }));
    assert.ok(rest.every(([y, a]) => y > 100 && y < 800 && a === 0), `Static: leaves rest in view without animating ${JSON.stringify(rest)}`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
