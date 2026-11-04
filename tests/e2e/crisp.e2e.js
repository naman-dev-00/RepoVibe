'use strict';
/* CRISP IMMERSIVE design system (Phase 1B visual redesign). Offline fixture reproducing GitHub's current React
   repository layout (tests/e2e/fixture-layout.html). Regression guards for the "blurry, recoloured GitHub" defect:
   no backdrop blur by default, no blurred wallpaper copy, no nested glass, a sharp scene window, presets that are
   actually different, independent controls, restore of visual defaults, and diagnostics of what really runs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EXT_ID, launch, extPage, setConfig, getConfig, diffRatio, visualContrast, sceneMetrics } = require('./helpers');

const OUT = path.join(__dirname, 'output');
const FLAGSHIPS = [['preset-1', 'cyberpunk-neon'], ['preset-8', 'enchanted-forest'], ['preset-19', 'cosmic-galaxy'], ['preset-15', 'futuristic-scifi']];
const URL_LAYOUT = 'https://github.com/acme/project/layout';
const blurredElements = page => page.evaluate(() => [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backdropFilter !== 'none').map(e => e.id || e.className || e.tagName));
const LOG = [];

for (const [id, label] of FLAGSHIPS) {
  test(`Crisp Immersive by default (${label}): zero backdrop blur, sharp scene window, single readable panel layer, AA text`, async () => {
    const { context, errors, close } = await launch();
    try {
      context.setDefaultTimeout(30000);
      // A config written before the redesign: no `appearance`, no `sceneWindow` → must upgrade to Crisp Immersive.
      await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'static' });
      const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(URL_LAYOUT);
      await page.waitForFunction(() => document.querySelectorAll('[data-repv-panel]').length >= 2 && document.documentElement.classList.contains('repv-scene-window'));
      await page.waitForTimeout(300);
      assert.deepEqual(await blurredElements(page), [], 'no element has a backdrop blur in Crisp Immersive');
      const layer = await page.evaluate(() => ({ before: getComputedStyle(document.body, '::before').content, filter: getComputedStyle(document.body, '::before').filter, window: parseFloat(getComputedStyle(document.getElementById('repo-content-pjax-container')).paddingTop),
        panel: Number(getComputedStyle(document.documentElement).getPropertyValue('--repv-panel-opacity')), nested: [...document.querySelectorAll('[data-repv-panel] [data-repv-panel], [data-repv-panel] .Box')].filter(e => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)').length }));
      assert.equal(layer.before, 'none', 'no blurred wallpaper copy'); assert.ok(layer.window >= 140, `scene window ${layer.window}px`);
      assert.ok(layer.panel >= 0.84, `clean, nearly solid reading panels (${layer.panel})`); assert.equal(layer.nested, 0, 'no nested glass');
      const crisp = await sceneMetrics(context, page);
      fs.writeFileSync(path.join(OUT, `crisp-${label}.png`), await page.screenshot({ animations: 'disabled' }));
      // Same page with a 6 px wallpaper blur: the sharpness metric must see the difference (sanity of the measurement).
      const preset = await extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); const t = await p.evaluate(i => RepoVibeCore.PRESETS.find(x => x.id === i), id); await p.close(); return t; });
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-blur', customThemes: { 'custom-blur': { ...preset, id: 'custom-blur', wallpaperBlur: 6 } } });
      await page.goto(URL_LAYOUT); await page.waitForTimeout(700);
      const blurred = await sceneMetrics(context, page);
      LOG.push(`${label}: crisp sharpness ${crisp.sharpness?.toFixed(2)} vs 6px-blurred ${blurred.sharpness?.toFixed(2)}; exposed ${(crisp.exposedShare * 100).toFixed(0)}%; correlation ${crisp.correlation.toFixed(2)} (full frame), ${crisp.exposedCorrelation?.toFixed(2)} (exposed scene)`);
      assert.ok(crisp.exposedShare >= 0.25, `≥ 25 % of the viewport shows the scene with nothing over it (${(crisp.exposedShare * 100).toFixed(0)}%)`);
      assert.ok(crisp.sharpness >= blurred.sharpness * 1.6, `exposed scene keeps its native detail: sharpness ${crisp.sharpness.toFixed(2)} vs blurred ${blurred.sharpness.toFixed(2)}`);
      // Shapes: where the scene is exposed it must match the source art closely (full-frame correlation also mixes in the
      // panel layout, which dominates for dark low-variance scenes, so it is a weaker floor)
      assert.ok(crisp.exposedCorrelation >= 0.8, `scene shapes visible in the exposed area (correlation ${crisp.exposedCorrelation?.toFixed(2)})`);
      assert.ok(crisp.correlation >= 0.3, `scene shapes visible over the full frame (correlation ${crisp.correlation.toFixed(2)})`);
      await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: 'static' });
      await page.goto(URL_LAYOUT); await page.waitForTimeout(700);
      const contrast = await visualContrast(context, page);
      assert.equal(contrast.below45, 0, `text below 4.5:1: ${JSON.stringify(contrast.low)}`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

test('the three appearance presets are visibly different; only Frosted Glass blurs panels; controls stay independent', async () => {
  const { context, errors, close } = await launch();
  try {
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
    const shots = {}, state = {};
    for (const appearance of ['crisp', 'balanced', 'frosted']) {
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'preset-8', appearance });
      await page.goto(URL_LAYOUT); await page.waitForFunction(() => document.querySelectorAll('[data-repv-panel]').length >= 2); await page.waitForTimeout(400);
      // Compare where the presets act: the file table panel (and the scene band above it).
      const box = await page.$eval('#fileTable', el => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 60), width: r.width + 40, height: r.height + 80 }; });
      shots[appearance] = { panel: await page.screenshot({ animations: 'disabled', clip: box }), page: await page.screenshot({ animations: 'disabled' }) };
      state[appearance] = { blurred: (await blurredElements(page)).length, panel: Number(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel-opacity'))), root: await page.evaluate(() => getComputedStyle(document.documentElement).backgroundImage.slice(0, 120)) };
      fs.writeFileSync(path.join(OUT, `appearance-${appearance}.png`), shots[appearance].page);
    }
    assert.equal(state.crisp.blurred, 0); assert.equal(state.balanced.blurred, 0); assert.ok(state.frosted.blurred >= 2, 'Frosted Glass blurs the panels');
    // Balanced: more solid panels. Frosted: blurred glass (its rendered opacity is whatever the readability guard needs).
    assert.ok(state.balanced.panel > state.crisp.panel, JSON.stringify(state));
    // Balanced acts on the scene (comfort overlay); Frosted acts on the panels (glass): compare where each acts.
    for (const [a, b, where] of [['crisp', 'balanced', 'page'], ['crisp', 'frosted', 'panel'], ['balanced', 'frosted', 'panel']]) {
      const d = await diffRatio(context, shots[a][where], shots[b][where]);
      assert.ok(d > 0.05, `${a} vs ${b} (${where}): visibly different (${(d * 100).toFixed(1)}% of pixels)`);
    }
    // Independence: raising panel opacity on a custom theme does not touch wallpaper blur, overlay or brightness.
    await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-x', customThemes: { 'custom-x': { id: 'custom-x', name: 'x', bg: '#08181a', surface: '#10272a', text: '#e6fbf5', backgroundMode: 'image', wallpaperRef: 'builtin:enchanted-forest', glassOpacity: 100, wallpaperBlur: 0, glass: 0, wallpaperOverlay: 5, wallpaperBrightness: 100 } } });
    await page.goto(URL_LAYOUT); await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ before: getComputedStyle(document.body, '::before').content, image: getComputedStyle(document.documentElement).backgroundImage, blurred: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backdropFilter !== 'none').length }));
    assert.equal(r.before, 'none'); assert.equal(r.blurred, 0); assert.match(r.image, /^linear-gradient\(rgba\(8, 24, 26, 0\.05\)/, 'only the chosen 5 % overlay, no brightness veil');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('popup: Appearance and Scene window switches act on the page; installed version shown', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'preset-19' });
    const gh = await context.newPage(); await gh.setViewportSize({ width: 1366, height: 768 });
    await gh.goto(URL_LAYOUT); await gh.waitForFunction(() => document.documentElement.classList.contains('repv-scene-window'));
    const popup = await extPage(context); await gh.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
    assert.equal(await popup.textContent('#version'), `v${JSON.parse(fs.readFileSync(path.join(__dirname, '../../manifest.json'), 'utf8')).version}`);
    assert.equal(await popup.isChecked('input[name="appearance"][value="crisp"]'), true);
    await popup.click('label:has(input[name="appearance"][value="frosted"])');
    await gh.waitForFunction(() => [...document.querySelectorAll('[data-repv-panel]')].some(e => getComputedStyle(e).backdropFilter !== 'none'));
    await popup.click('label:has(input[name="appearance"][value="crisp"])');
    await gh.waitForFunction(() => [...document.querySelectorAll('*')].every(e => getComputedStyle(e).backdropFilter === 'none'));
    await popup.click('#sceneWindow');
    await gh.waitForFunction(() => !document.documentElement.classList.contains('repv-scene-window') && parseFloat(getComputedStyle(document.getElementById('repo-content-pjax-container')).paddingTop) < 20);
    assert.equal((await getConfig(context)).sceneWindow, false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Studio: Restore visual defaults clears old blur/glass values but keeps assignments, wallpapers, colours and names; diagnostics report what runs', async () => {
  const { context, errors, close } = await launch();
  try {
    // Settings as an older version could have saved them: Frosted appearance + a heavily blurred custom theme.
    await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'native', appearance: 'frosted', repoAssignments: { 'acme/project': 'custom-old' },
      customThemes: { 'custom-old': { id: 'custom-old', name: 'My forest', bg: '#08181a', surface: '#10272a', text: '#e6fbf5', accent: '#5ee0c1', backgroundMode: 'image', wallpaperRef: 'builtin:enchanted-forest', glass: 14, wallpaperBlur: 8, wallpaperOverlay: 40, wallpaperBrightness: 70, glassOpacity: 55 } } });
    const gh = await context.newPage(); await gh.setViewportSize({ width: 1366, height: 768 });
    await gh.goto(URL_LAYOUT); await gh.waitForFunction(() => getComputedStyle(document.body, '::before').filter.includes('blur(8px)'));
    const studio = await context.newPage(); await studio.goto(`chrome-extension://${EXT_ID}/studio.html`);
    await studio.waitForSelector('#restoreVisual', { state: 'attached' });
    await studio.click('.sidebar-link[data-view="settings"]');
    await gh.bringToFront();
    await studio.$eval('#refreshDiagnostics', b => b.click()); // Studio is a background tab here (GitHub must stay active for Diagnostics): DOM click, no rAF-based actionability wait
    await studio.waitForFunction(() => /Running on the page: v/.test(document.getElementById('diagnostics').textContent));
    const before = await studio.textContent('#diagnostics');
    assert.match(before, /single installation/); assert.match(before, /wallpaper blur 8px, panel backdrop blur 14px/);
    await studio.$eval('#restoreVisual', b => b.click());
    await gh.waitForFunction(() => getComputedStyle(document.body, '::before').content === 'none' && [...document.querySelectorAll('*')].every(e => getComputedStyle(e).backdropFilter === 'none'));
    const cfg = await getConfig(context);
    const t = cfg.customThemes['custom-old'];
    assert.equal(cfg.appearance, 'crisp');
    assert.deepEqual([t.glass, t.wallpaperBlur, t.wallpaperBrightness], [0, 0, 100]);
    assert.deepEqual([t.name, t.accent, t.wallpaperRef, cfg.repoAssignments['acme/project']], ['My forest', '#5ee0c1', 'builtin:enchanted-forest', 'custom-old']);
    await studio.$eval('#refreshDiagnostics', b => b.click()); // Studio is a background tab here (GitHub must stay active for Diagnostics): DOM click, no rAF-based actionability wait
    await studio.waitForFunction(() => /wallpaper blur 0px, panel backdrop blur 0px \(0 blurred panels\)/.test(document.getElementById('diagnostics').textContent));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test.after(() => { if (LOG.length) console.log(`# crisp metrics\n${LOG.map(l => `#   ${l}`).join('\n')}`); });
