'use strict';
/* Hardening E2E tests (offline GitHub fixture, real Chromium + unpacked extension).
   Each test targets a previously untested fix or a regression found in code review. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, extPage, setConfig, getConfig, openGitHub, state, openStudioFor, pixelAt } = require('./helpers');

const bgDefault = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim());
const markers = page => page.evaluate(() => ({
  mode: document.documentElement.getAttribute('data-color-mode'),
  original: document.documentElement.getAttribute('data-repv-original-color-mode'),
  written: document.documentElement.getAttribute('data-repv-color-mode')
}));

test('theme is restored after GitHub replaces <head>, removes the style tag, or resets <html> class', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1' });
    const page = await openGitHub(context);
    assert.equal((await state(page)).active, true);
    await page.evaluate(() => document.head.replaceWith(document.createElement('head')));
    await page.evaluate(() => document.getElementById('repovibe-style-v1')?.remove());
    await page.waitForFunction(() => !!document.getElementById('repovibe-style-v1'));
    assert.equal(await bgDefault(page), '#1b1538');
    await page.evaluate(() => { document.documentElement.className = ''; });
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Studio handles an unavailable target tab and a tab that closes mid-session', async () => {
  const { context, errors, close } = await launch();
  try {
    let studio = await extPage(context, 'studio.html?target=987654');
    await studio.waitForFunction(() => document.getElementById('previewState').textContent.includes('No active GitHub tab'));
    assert.equal(await studio.textContent('#sidebarRepo'), 'All GitHub');
    assert.equal(await studio.inputValue('#scopeSelect'), 'global');
    assert.equal(await studio.$eval('#scopeSelect option[value="repository"]', o => o.disabled), true);
    await studio.click('.gallery-card >> text=Obsidian');
    await studio.click('#saveButton');
    assert.equal((await getConfig(context)).defaultThemeId, 'preset-16', 'saving works without a linked tab');
    await studio.close();

    const gh = await openGitHub(context);
    studio = await openStudioFor(context, gh);
    await gh.close();
    await studio.waitForFunction(() => document.getElementById('previewState').textContent.includes('disconnected'));
    await studio.click('.gallery-card >> text=Galaxy');
    await studio.click('#saveButton');
    assert.equal((await getConfig(context)).repoAssignments['acme/project'], 'preset-19');
    assert.deepEqual(errors, [], 'no unchecked runtime.lastError or page errors');
  } finally { await close(); }
});

test('Studio links the most recently used GitHub tab, not the first one', async () => {
  const { context, errors, close } = await launch();
  try {
    const first = await openGitHub(context, 'first/repo');
    const recent = await openGitHub(context, 'recent/repo');
    await first.bringToFront(); await recent.bringToFront();
    const studio = await extPage(context, 'studio.html');
    await studio.waitForFunction(() => document.getElementById('previewState').textContent.includes('connected'));
    assert.equal(await studio.textContent('#sidebarRepo'), 'recent/repo');
    await first.bringToFront();
    const again = await extPage(context, 'studio.html');
    await again.waitForFunction(() => document.getElementById('previewState').textContent.includes('connected'));
    assert.equal(await again.textContent('#sidebarRepo'), 'first/repo');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('blurred wallpaper reaches the viewport edges (no soft transparent border)', async () => {
  const { context, errors, close } = await launch();
  try {
    const helper = await extPage(context);
    const red = await helper.evaluate(async () => {
      const c = new OffscreenCanvas(64, 64); const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 64, 64);
      const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let s = ''; for (const b of bytes) s += String.fromCharCode(b);
      return `data:image/png;base64,${btoa(s)}`;
    });
    await helper.close();
    const theme = { id: 'custom-wall', name: 'W', bg: '#0000ff', gradientTo: '#0000ff', gradientThird: '#0000ff', backgroundMode: 'image', wallpaper: red, wallpaperOpacity: 100, wallpaperBlur: 20 };
    await setConfig(context, { enabled: true, defaultThemeId: 'custom-wall', customThemes: { 'custom-wall': theme } });
    const page = await openGitHub(context);
    const shot = await page.screenshot();
    for (const [x, y] of [[1, 798], [1278, 798], [640, 798], [1278, 400]]) {
      const [r, , b] = await pixelAt(context, shot, x, y);
      assert.ok(r > 225 && b < 30, `edge pixel (${x},${y}) is rgb(${r},?,${b}); blue page background is bleeding through`);
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('enable/disable during client-side navigation follows the current repository', async () => {
  const { context, errors, close } = await launch();
  try {
    const base = { defaultThemeId: 'native', repoAssignments: { 'acme/project': 'preset-1', 'acme/other': 'preset-5', 'zeta/tools': 'preset-20' } };
    await setConfig(context, { enabled: true, ...base });
    const page = await openGitHub(context, 'acme/project');
    await setConfig(context, { enabled: false, ...base });
    await page.click('#toOther');
    await page.waitForTimeout(200);
    assert.equal((await state(page)).active, false, 'stays disabled after navigation');
    assert.deepEqual(await markers(page), { mode: 'dark', original: null, written: null });
    await setConfig(context, { enabled: true, ...base });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#0d1c10');
    // Toggle off and navigate in the same tick.
    const helper = await extPage(context);
    await helper.evaluate(cfg => chrome.storage.local.set({ 'repovibe.v1': cfg }), { enabled: false, ...base });
    await page.click('#toTurbo');
    await page.waitForTimeout(250);
    assert.equal((await state(page)).active, false);
    await helper.evaluate(cfg => chrome.storage.local.set({ 'repovibe.v1': cfg }), { enabled: true, ...base });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#33194a');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('editing a custom theme shared by two repositories updates both and says so', async () => {
  const { context, errors, close } = await launch();
  try {
    const shared = { id: 'custom-shared', name: 'Shared', bg: '#101820', surface: '#203040' };
    await setConfig(context, { enabled: true, defaultThemeId: 'native', customThemes: { 'custom-shared': shared }, repoAssignments: { 'acme/project': 'custom-shared', 'acme/other': 'custom-shared' } });
    const other = await openGitHub(context, 'acme/other');
    const gh = await openGitHub(context, 'acme/project');
    assert.equal(await bgDefault(other), '#203040');
    const studio = await openStudioFor(context, gh);
    assert.equal(await studio.inputValue('#themeName'), 'Shared');
    await studio.click('.sidebar-link[data-view="customize"]');
    await studio.evaluate(() => { const i = document.querySelectorAll('#colorControls input[type=color]')[1]; i.value = '#405060'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await studio.click('#saveButton');
    await studio.waitForFunction(() => document.getElementById('toast').textContent.includes('also used by 1 other assignment'));
    const config = await getConfig(context);
    assert.equal(config.repoAssignments['acme/project'], 'custom-shared', 'edited in place, not duplicated');
    assert.equal(config.customThemes['custom-shared'].surface, '#405060');
    await other.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#405060');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('GitHub appearance changes while RepoVibe is active are respected and restored correctly', async () => {
  const { context, errors, close } = await launch({ mode: 'dark' });
  try {
    // Dark theme on a dark account: GitHub's attribute is never touched.
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1' });
    const page = await openGitHub(context);
    assert.deepEqual(await markers(page), { mode: 'dark', original: null, written: null });

    // Light theme on a dark account: switched, with the user's value remembered.
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-12' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-color-mode') === 'light');
    assert.deepEqual(await markers(page), { mode: 'light', original: 'dark', written: 'light' });

    // User switches GitHub to "auto" while the system is dark -> RepoVibe keeps the light theme
    // consistent but now remembers "auto" (not the stale "dark").
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-color-mode', 'auto'));
    await page.waitForFunction(() => document.documentElement.getAttribute('data-repv-original-color-mode') === 'auto');
    assert.equal((await markers(page)).mode, 'light');

    // System switches to light: "auto" already renders light, so RepoVibe stops overriding.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-color-mode') === 'auto');
    assert.deepEqual(await markers(page), { mode: 'auto', original: null, written: null });

    // System dark again -> override returns; disabling restores the user's latest choice.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-color-mode') === 'light');
    await setConfig(context, { enabled: false, defaultThemeId: 'preset-12' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
    assert.deepEqual(await markers(page), { mode: 'auto', original: null, written: null });
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('Studio save does not overwrite a change made in the popup meanwhile', async () => {
  const { context, errors, close } = await launch();
  try {
    const gh = await openGitHub(context);
    const studio = await openStudioFor(context, gh);
    const popup = await extPage(context);
    await popup.waitForSelector('.theme-tile');
    await popup.check('input[name="scope"][value="global"]', { force: true });
    await popup.click('.theme-tile >> text=Retro Terminal');
    await studio.click('.gallery-card >> text=Galaxy');
    await studio.click('#saveButton');
    const config = await getConfig(context);
    assert.equal(config.defaultThemeId, 'preset-9', 'popup change preserved');
    assert.equal(config.repoAssignments['acme/project'], 'preset-19');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('orphaned content script (extension reloaded/disabled) stops observing and restores GitHub', async () => {
  const { context, errors, close } = await launch({ mode: 'dark' });
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-12' });
    const page = await openGitHub(context);
    assert.equal((await markers(page)).mode, 'light');
    const helper = await extPage(context);
    await helper.evaluate(() => { setTimeout(() => chrome.runtime.reload(), 50); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.body.appendChild(document.createElement('div')));
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
    assert.deepEqual(await markers(page), { mode: 'dark', original: null, written: null });
    assert.equal(await page.evaluate(() => !!document.getElementById('repovibe-style-v1')), false);
    await page.click('#toOther');
    await page.waitForTimeout(200);
    assert.equal((await state(page)).active, false, 'no zombie re-application after navigation');
    assert.deepEqual(errors.filter(e => e.startsWith('https://github.com')), []);
  } finally { await close(); }
});

test('"Wide coding space" is never narrower than GitHub\'s own layout and is wider on large screens', async () => {
  const { context, errors, close } = await launch();
  try {
    const width = page => page.evaluate(() => Math.round(document.querySelector('.container-xl').getBoundingClientRect().width));
    const page = await openGitHub(context);
    const results = {};
    for (const vw of [1100, 1280, 1600]) {
      await page.setViewportSize({ width: vw, height: 800 });
      await setConfig(context, { enabled: true, defaultThemeId: 'native' });
      await page.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
      const native = await width(page);
      const wide = { id: 'custom-wide', name: 'W', layout: 'wide' };
      await setConfig(context, { enabled: true, defaultThemeId: 'custom-wide', customThemes: { 'custom-wide': wide } });
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
      results[vw] = [native, await width(page)];
      assert.ok(results[vw][1] >= native, `at ${vw}px viewport wide layout is narrower: ${native}px → ${results[vw][1]}px`);
    }
    assert.ok(results[1600][1] > results[1600][0], `wide layout should widen the container at 1600px: ${results[1600].join(' → ')}`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
