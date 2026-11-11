'use strict';
/* Core acceptance E2E tests (offline GitHub fixture, real Chromium + unpacked extension).
   Run: npm run test:e2e   (UPDATE_SNAPSHOTS=1 npm run test:e2e to refresh visual baselines) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OUT_DIR, launch, extPage, setConfig, getConfig, openGitHub, state, hexToRgb, diffRatio, matchSnapshot, openStudioFor } = require('./helpers');

test('native/disabled RepoVibe has no visual or DOM effect', async () => {
  const plain = await launch({ extension: false });
  const withExt = await launch();
  try {
    const reference = await openGitHub(plain.context);
    const refShot = await reference.screenshot();
    await setConfig(withExt.context, { enabled: false, defaultThemeId: 'preset-1', repoAssignments: { 'acme/project': 'preset-6' } });
    const page = await openGitHub(withExt.context);
    const s = await state(page);
    assert.equal(s.active, false); assert.equal(s.style, false); assert.equal(s.mode, 'dark');
    assert.equal(await diffRatio(withExt.context, refShot, await page.screenshot()), 0, 'disabled screenshot must equal no-extension screenshot');
    await setConfig(withExt.context, { enabled: true, defaultThemeId: 'native' });
    await page.waitForTimeout(150);
    assert.equal((await state(page)).active, false);
    assert.equal(await diffRatio(withExt.context, refShot, await page.screenshot()), 0, 'native screenshot must equal no-extension screenshot');
    assert.deepEqual(withExt.errors, []);
  } finally { await plain.close(); await withExt.close(); }
});

test('preset applies tokens, keeps neutral emphasis, and matches visual baseline', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1' }); // Cyberpunk Neon
    const page = await openGitHub(context);
    const s = await state(page);
    assert.equal(s.active, true);
    assert.equal(s.bgDefault, '#1b1538');
    assert.equal(s.accent, '#c6a8ff');
    assert.notEqual(s.emphasis, '#c6a8ff', 'neutral emphasis must not become the accent');
    assert.equal(s.overlayBg, hexToRgb('#1b1538'), 'menus/overlays follow the theme surface');
    assert.equal(s.containerMax, '1280px', 'standard layout keeps GitHub max width');
    await matchSnapshot(context, page, 'repo-cyberpunk-dark');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('light theme on a dark-mode account switches GitHub base mode and restores it', async () => {
  const { context, errors, close } = await launch({ mode: 'dark' });
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-12' }); // Arctic Frost (light)
    const page = await openGitHub(context);
    let s = await state(page);
    assert.equal(s.mode, 'light'); assert.equal(s.colorScheme, 'light');
    await matchSnapshot(context, page, 'repo-arctic-on-dark-account');
    await setConfig(context, { enabled: false, defaultThemeId: 'preset-12' });
    await page.waitForTimeout(150);
    s = await state(page);
    assert.equal(s.active, false); assert.equal(s.mode, 'dark', 'original data-color-mode restored');
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-repv-original-color-mode')), false);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('repository > owner > global priority, including prototype-like owner names', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-2', ownerAssignments: { acme: 'preset-3' }, repoAssignments: { 'acme/project': 'preset-1' } });
    assert.equal((await state(await openGitHub(context, 'acme/project'))).bgDefault, '#1b1538');
    assert.equal((await state(await openGitHub(context, 'acme/another'))).bgDefault, '#fff1f7'); // Sakura's pinker reading surface (rework 2026-11-11)
    assert.equal((await state(await openGitHub(context, 'else/another'))).bgDefault, '#151e30');
    assert.equal((await state(await openGitHub(context, 'constructor/thing'))).bgDefault, '#151e30');
    assert.equal((await state(await openGitHub(context, 'tostring/x'))).bgDefault, '#151e30');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('layout and code settings do what their labels say', async () => {
  const { context, errors, close } = await launch();
  try {
    const custom = { id: 'custom-layout', name: 'L', layout: 'wide', codeFontSize: 17, bg: '#101010', surface: '#202020' };
    await setConfig(context, { enabled: true, defaultThemeId: 'custom-layout', customThemes: { 'custom-layout': custom } });
    const page = await openGitHub(context);
    let s = await state(page);
    assert.notEqual(s.containerMax, '1280px'); assert.notEqual(s.containerMax, 'none');
    assert.equal(s.codeSize, '17px'); assert.equal(s.textareaSize, '17px', 'cursor textarea stays aligned with code lines');
    await setConfig(context, { enabled: true, defaultThemeId: 'custom-layout', customThemes: { 'custom-layout': { ...custom, layout: 'compact' } } });
    await page.waitForTimeout(150);
    s = await state(page);
    assert.equal(s.containerMax, '1280px'); assert.equal(s.rowPadding, '5px');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('client-side navigation (pushState and turbo:load) re-resolves the theme', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native', repoAssignments: { 'acme/project': 'preset-1', 'acme/other': 'preset-5', 'zeta/tools': 'preset-20' } });
    const page = await openGitHub(context, 'acme/project');
    assert.equal((await state(page)).bgDefault, '#1b1538');
    await page.click('#toOther');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#0d1c10');
    await page.click('#toTurbo');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#33194a');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/acme/other' && getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#0d1c10');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('popup renders, applies a quick theme globally, and toggles the engine', async () => {
  const { context, errors, close } = await launch();
  try {
    const gh = await openGitHub(context);
    const popup = await extPage(context);
    await popup.setViewportSize({ width: 384, height: 600 });
    await popup.waitForSelector('.theme-tile');
    assert.equal(await popup.locator('.theme-tile').count(), 6);
    await popup.check('input[name="scope"][value="global"]', { force: true });
    await popup.click('.theme-tile >> text=Retro Terminal');
    assert.match(await popup.textContent('#status'), /Retro Terminal applied globally/);
    assert.equal((await getConfig(context)).defaultThemeId, 'preset-9');
    await gh.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    await popup.click('.switch span');
    await gh.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
    assert.equal((await getConfig(context)).enabled, false);
    await matchSnapshot(context, popup, 'popup-paused', 0.02);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});


test('studio live preview survives soft navigation, reverts on close, persists on save', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    const gh = await openGitHub(context);
    let studio = await openStudioFor(context, gh);
    assert.equal(await studio.textContent('#targetLabel'), 'acme/project');
    await studio.click('.gallery-card >> text=Galaxy');
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#17183d');
    await gh.click('#toOther');
    await gh.waitForTimeout(200);
    assert.equal((await state(gh)).bgDefault, '#17183d', 'preview kept while Studio is open');
    await studio.close();
    await gh.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));

    await gh.goto('https://github.com/acme/project');
    studio = await openStudioFor(context, gh);
    await studio.click('.gallery-card >> text=Galaxy');
    await studio.click('#saveButton');
    assert.equal((await getConfig(context)).repoAssignments['acme/project'], 'preset-19');
    await studio.close();
    await gh.reload(); await gh.waitForTimeout(250);
    assert.equal((await state(gh)).bgDefault, '#17183d');
    await matchSnapshot(context, gh, 'repo-galaxy-saved');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('studio editing: colors, sliders, undo/redo, custom save, export/import', async () => {
  const { context, errors, close } = await launch();
  try {
    const gh = await openGitHub(context);
    const studio = await openStudioFor(context, gh);
    await studio.click('.sidebar-link[data-view="customize"]');
    const setColor = (index, value) => studio.evaluate(([i, v]) => {
      const input = document.querySelectorAll('#colorControls input[type=color]')[i];
      input.value = v; input.dispatchEvent(new Event('input', { bubbles: true }));
    }, [index, value]);
    await setColor(1, '#223344'); // Panels
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#223344');
    await studio.fill('#themeName', 'My E2E theme');
    await studio.evaluate(() => { const r = document.getElementById('radius'); r.value = '4'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await studio.textContent('#radiusVal'), '4px');
    await studio.click('#undoButton');
    assert.notEqual(await studio.textContent('#radiusVal'), '4px');
    await studio.click('#redoButton');
    assert.equal(await studio.textContent('#radiusVal'), '4px');
    await studio.click('#saveButton');
    let config = await getConfig(context);
    const id = config.repoAssignments['acme/project'];
    assert.match(id, /^custom-/);
    assert.equal(config.customThemes[id].name, 'My E2E theme');
    assert.equal(config.customThemes[id].surface, '#223344');
    assert.equal(config.customThemes[id].radius, 4);

    await studio.click('.sidebar-link[data-view="settings"]');
    const [download] = await Promise.all([studio.waitForEvent('download'), studio.click('#exportTheme')]);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.format, 'repovibe-theme'); assert.equal(exported.theme.surface, '#223344');

    await studio.click('.sidebar-link[data-view="library"]');
    const importFile = path.join(OUT_DIR, 'import.json');
    fs.writeFileSync(importFile, JSON.stringify({ format: 'repovibe-theme', theme: { name: 'Imported <b>x</b>', bg: 'red;}', accent: '#00ff00', __proto__: { polluted: 1 } } }));
    await studio.setInputFiles('#importInput', importFile);
    await studio.waitForSelector('.library-item >> text=Imported bx/b');
    config = await getConfig(context);
    const imported = Object.values(config.customThemes).find(t => t.name === 'Imported bx/b');
    assert.equal(imported.accent, '#00ff00'); assert.match(imported.bg, /^#[0-9a-f]{6}$/i);
    assert.equal({}.polluted, undefined);
    fs.writeFileSync(importFile, 'null');
    await studio.setInputFiles('#importInput', importFile);
    await studio.waitForFunction(() => document.getElementById('toast').textContent.includes('missing theme data'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

// The v0.1 inline-data-URL wallpaper upload test was replaced by the IndexedDB upload tests in phase1b.e2e.js.

test('studio and popup fit a narrow viewport without horizontal scroll', async () => {
  const { context, errors, close } = await launch();
  try {
    const studio = await extPage(context, 'studio.html');
    await studio.setViewportSize({ width: 390, height: 844 });
    await studio.waitForSelector('.gallery-card');
    for (const view of ['gallery', 'customize', 'background', 'code', 'library', 'settings']) {
      await studio.click(`.sidebar-link[data-view="${view}"]`);
      const overflow = await studio.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${view} view overflows horizontally by ${overflow}px`);
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
