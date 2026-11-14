'use strict';
/* REGRESSION: "wallpapers invisible on real GitHub" (P0). Offline fixture reproducing GitHub's current React layout
   (tests/e2e/fixture-layout.html, structure measured on real github.com). Before the fix the whole page below the header
   sat under 60–90 % glass + 12 px blur and the scenes were a colour wash; these tests fail on that architecture.
   Real-site verification: tests/live (LIVE 9). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, extPage, setConfig, diffRatio, visualContrast, sceneMetrics } = require('./helpers');

const FLAGSHIPS = [['preset-1', 'neon-city-3d', 'cyberpunk-neon'], ['preset-8', 'enchanted-forest', 'enchanted-forest'], ['preset-19', 'cosmic-galaxy', 'cosmic-galaxy'], ['preset-15', 'scifi-ai', 'futuristic-scifi']];
const DIAGNOSTIC = { wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperBlur: 0, wallpaperOverlay: 0 };
const OUT = path.join(__dirname, 'output');
const presetOf = (context, id) => extPage(context).then(async p => { await p.waitForFunction(() => !!globalThis.RepoVibeCore); const t = await p.evaluate(i => ({ ...RepoVibeCore.PRESETS.find(x => x.id === i), guard: RepoVibeCore.panelOpacity(RepoVibeCore.PRESETS.find(x => x.id === i)) }), id); await p.close(); return t; });
const LOG = [];

for (const [id, slug, label] of FLAGSHIPS) {
  test(`scene visible and recognisable on GitHub's React layout: ${label} (diagnostic, production, solid comparison, AA text)`, async () => {
    const { context, errors, close } = await launch();
    try {
      context.setDefaultTimeout(30000);
      const preset = await presetOf(context, id);
      const page = await context.newPage();
      await page.setViewportSize({ width: 1366, height: 768 });
      const show = async config => { await setConfig(context, config); await page.goto('https://github.com/acme/project/layout'); await page.waitForFunction(s => s === 'none' || getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(s), config.customThemes?.['custom-solid'] ? 'none' : `${slug}.webp`); await page.waitForTimeout(400); };
      // 1. Diagnostic configuration (opacity 100 %, brightness 100 %, blur 0, overlay 0): unmistakable.
      await show({ enabled: true, motionMode: 'static', defaultThemeId: 'custom-diag', customThemes: { 'custom-diag': { ...preset, ...DIAGNOSTIC, id: 'custom-diag' } } });
      const diag = await sceneMetrics(context, page);
      // 2. Production defaults.
      await show({ enabled: true, motionMode: 'static', defaultThemeId: id });
      const prod = await sceneMetrics(context, page);
      const art = await page.screenshot({ animations: 'disabled' });
      fs.writeFileSync(path.join(OUT, `scene-${label}.png`), art);
      const contrast = await visualContrast(context, page);
      const layer = await page.evaluate(() => ({ attach: getComputedStyle(document.documentElement).backgroundAttachment, before: getComputedStyle(document.body, '::before').content, panels: document.querySelectorAll('[data-repv-panel]').length }));
      // 3. Same theme colours without the image.
      await show({ enabled: true, motionMode: 'static', defaultThemeId: 'custom-solid', customThemes: { 'custom-solid': { ...preset, id: 'custom-solid', backgroundMode: 'solid' } } });
      const solid = await page.screenshot({ animations: 'disabled' });
      const changed = await diffRatio(context, solid, art);
      LOG.push(`${label}: diag corr ${diag.correlation.toFixed(2)} median ${diag.median.toFixed(2)} clear ${(diag.clear * 100).toFixed(0)}% | prod corr ${prod.correlation.toFixed(2)} (exposed ${prod.exposedCorrelation?.toFixed(2)}) median ${prod.median.toFixed(2)} min ${prod.min.toFixed(2)} clear ${(prod.clear * 100).toFixed(0)}% | vs solid ${(changed * 100).toFixed(1)}% | panel ${preset.guard.opacity} | text min ${contrast.min.toFixed(2)}`);
      // Recognisable: the page's luminance structure follows the scene's own shapes.
      // Exposed-area correlation is the strict check; full-frame correlation also reflects the panel layout, which
      // dominates for dark low-variance scenes (forest, sci-fi hall), so it only has a lower floor.
      for (const [name, m] of [['diagnostic', diag], ['production', prod]]) {
        assert.ok(m.exposedCorrelation >= 0.8, `${name}: scene shapes visible where exposed (correlation ${m.exposedCorrelation?.toFixed(2)})`);
        assert.ok(m.correlation >= 0.3, `${name}: scene shapes visible over the full frame (correlation ${m.correlation.toFixed(2)})`);
      }
      // Visible: a large part of the viewport shows the scene unobstructed, and nowhere does glass stack.
      assert.ok(prod.clear >= 0.45, `≥ 45 % of the viewport shows the scene unobstructed (${(prod.clear * 100).toFixed(0)}%)`);
      assert.ok(prod.median >= 0.6, `the typical point shows ≥ 60 % of the scene (median transmission ${prod.median.toFixed(2)}; the pre-fix renderer measured 0.27–0.44 here)`);
      const floor = Math.min((1 - preset.guard.opacity) * 0.69, 1 - preset.guard.loose) - 0.02;
      assert.ok(prod.min >= floor, `never more than one glass layer (+ muted tint) over the scene: min transmission ${prod.min.toFixed(2)} ≥ ${floor.toFixed(2)}`);
      assert.ok(changed >= 0.3, `scene changes ≥ 30 % of pixels vs. the same theme without artwork (${(changed * 100).toFixed(1)}%)`);
      assert.match(layer.attach, /fixed/, 'scene painted as the fixed root background');
      assert.equal(layer.before, 'none', 'no negative-z copy needed at blur 0');
      assert.ok(layer.panels >= 2, `bordered boxes / list containers detected as panels (${layer.panels})`);
      // Readable: screenshot-measured text contrast meets WCAG AA.
      assert.equal(contrast.below45, 0, `text below 4.5:1: ${JSON.stringify(contrast.low)}`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  });
}

test('wallpaper controls change the visible scene: opacity, overlay, brightness, blur, position/size, panel opacity, glass blur', async () => {
  const { context, errors, close } = await launch();
  try {
    const preset = await presetOf(context, 'preset-8');
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 1000 }); // not 16:9, so cover crops
    const shotWith = async patch => {
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-c', customThemes: { 'custom-c': { ...preset, ...DIAGNOSTIC, glassOpacity: 55, glass: 0, ...patch, id: 'custom-c' } } });
      await page.goto('https://github.com/acme/project/layout'); await page.waitForTimeout(500);
      return { png: await page.screenshot({ animations: 'disabled' }), m: await page.evaluate(() => ({ panel: getComputedStyle(document.documentElement).getPropertyValue('--repv-panel-opacity').trim(), box: getComputedStyle(document.querySelector('#fileTable')).backdropFilter })) };
    };
    const base = await shotWith({});
    const lum = async png => { const p = await context.newPage(); const v = await p.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(i.width, i.height); const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, i.width, i.height).data; let s = 0; for (let k = 0; k < d.length; k += 16) s += d[k] * .2126 + d[k + 1] * .7152 + d[k + 2] * .0722; return s / (d.length / 16); }, `data:image/png;base64,${png.toString('base64')}`); await p.close(); return v; };
    const L0 = await lum(base.png);
    for (const [name, patch, check] of [
      ['opacity 40 %', { wallpaperOpacity: 40 }, null],
      ['overlay 60 %', { wallpaperOverlay: 60 }, l => l < L0],
      ['brightness 60 %', { wallpaperBrightness: 60 }, l => l < L0],
      ['brightness 130 %', { wallpaperBrightness: 130 }, l => l > L0],
      ['blur 12 px', { wallpaperBlur: 12 }, null],
      ['position left', { wallpaperPosition: 'left' }, null],
      ['size contain', { wallpaperSize: 'contain' }, null]
    ]) {
      const r = await shotWith(patch);
      const d = await diffRatio(context, base.png, r.png);
      assert.ok(d > 0.05, `${name} visibly changes the page (${(d * 100).toFixed(1)}% of pixels)`);
      if (check) assert.ok(check(await lum(r.png)), `${name} moves brightness in the expected direction`);
    }
    // On the full-brightness diagnostic scene the readability guard (which also counts the brightest moving objects)
    // already raises a low choice to nearly solid; test the control where the guard leaves it room (60 % overlay).
    const lowPanels = await shotWith({ wallpaperOverlay: 60, glassOpacity: 55 }), solidPanels = await shotWith({ wallpaperOverlay: 60, glassOpacity: 100 });
    const pd = await diffRatio(context, lowPanels.png, solidPanels.png);
    assert.equal(solidPanels.m.panel, '1'); assert.ok(Number(lowPanels.m.panel) < 0.9, `guarded opacity ${lowPanels.m.panel}`); assert.ok(pd > 0.002, `panel opacity changes the page (${(pd * 100).toFixed(2)}% of pixels over a 60 %-overlay scene)`);
    const blurred = await shotWith({ glass: 24 });
    assert.match(blurred.m.box, /blur\(24px\)/, 'glass blur applies to panels');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('switching repositories switches the artwork; disabling restores GitHub exactly (React layout)', async () => {
  const base = await launch({ extension: false });
  let native;
  try { const p = await base.context.newPage(); await p.setViewportSize({ width: 1366, height: 768 }); await p.goto('https://github.com/acme/project/layout'); await p.waitForTimeout(300); native = await p.screenshot(); }
  finally { await base.close(); }
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'native', repoAssignments: { 'acme/project': 'preset-8', 'acme/other': 'preset-19' } });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).backgroundImage.includes('enchanted-forest.webp'));
    await page.goto('https://github.com/acme/other/layout');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).backgroundImage.includes('cosmic-galaxy.webp'));
    await page.waitForFunction(() => document.querySelectorAll('[data-repv-panel]').length >= 2);
    await setConfig(context, { enabled: false, defaultThemeId: 'native', repoAssignments: { 'acme/project': 'preset-8', 'acme/other': 'preset-19' } });
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
    assert.equal(await page.evaluate(() => document.querySelectorAll('[data-repv-panel]').length), 0, 'panel markers removed');
    await page.goto('https://github.com/acme/project/layout'); await page.waitForTimeout(300);
    const restored = await page.screenshot();
    assert.ok(await diffRatio(context, native, restored) < 0.001, 'disabled RepoVibe renders exactly like GitHub without the extension');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test.after(() => { if (LOG.length) console.log(`# scene metrics\n${LOG.map(l => `#   ${l}`).join('\n')}`); });
