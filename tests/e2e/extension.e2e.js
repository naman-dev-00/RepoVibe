'use strict';
/* Browser E2E tests: loads the unpacked extension into real Chromium (new headless mode) and
   serves an offline GitHub-shaped fixture for https://github.com/* via request interception,
   so the content script injects exactly as it would on github.com.
   Run: npm run test:e2e   (UPDATE_SNAPSHOTS=1 npm run test:e2e to refresh visual baselines) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const EXT = path.resolve(__dirname, '../..');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const SNAP_DIR = path.join(__dirname, '__screenshots__');
const OUT_DIR = path.join(__dirname, 'output');
const KEY = 'repovibe.v1';
const VIEWPORT = { width: 1280, height: 800 };
// Unpacked extension IDs are derived from the absolute path.
const EXT_ID = [...crypto.createHash('sha256').update(EXT).digest('hex').slice(0, 32)]
  .map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function launch({ extension = true, mode = 'dark' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repovibe-e2e-'));
  const args = extension ? [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] : ['--disable-extensions'];
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium', headless: true, viewport: VIEWPORT, deviceScaleFactor: 1, args, acceptDownloads: true
  });
  const errors = [];
  const watch = page => {
    page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  };
  context.on('page', watch);
  context.pages().forEach(watch);
  await context.route('https://github.com/**', route => {
    const url = new URL(route.request().url());
    const title = url.pathname.split('/').filter(Boolean).slice(0, 2).join('/') || 'GitHub';
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: FIXTURE.replaceAll('__TITLE__', title).replace('__MODE__', mode) });
  });
  const close = async () => { await context.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { context, errors, close };
}

async function extPage(context, file = 'popup.html') {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${EXT_ID}/${file}`);
  return page;
}
async function setConfig(context, config) {
  const page = await extPage(context);
  await page.evaluate(([k, v]) => chrome.storage.local.set({ [k]: v }), [KEY, config]);
  await page.close();
}
async function getConfig(context) {
  const page = await extPage(context);
  const value = await page.evaluate(k => chrome.storage.local.get(k).then(o => o[k]), KEY);
  await page.close();
  return value;
}
async function openGitHub(context, repoPath = 'acme/project') {
  const page = await context.newPage();
  await page.goto(`https://github.com/${repoPath}`);
  await page.waitForTimeout(250); // content script loads config asynchronously
  return page;
}
const state = page => page.evaluate(() => {
  const root = document.documentElement, cs = getComputedStyle(root);
  return {
    active: root.classList.contains('repv-active'),
    style: !!document.getElementById('repovibe-style-v1'),
    mode: root.getAttribute('data-color-mode'),
    bgDefault: cs.getPropertyValue('--bgColor-default').trim(),
    emphasis: cs.getPropertyValue('--bgColor-emphasis').trim(),
    accent: cs.getPropertyValue('--fgColor-accent').trim(),
    colorScheme: cs.colorScheme,
    containerMax: getComputedStyle(document.querySelector('.container-xl')).maxWidth,
    rowPadding: getComputedStyle(document.querySelector('.Box-row')).paddingTop,
    codeSize: getComputedStyle(document.querySelector('.react-code-text')).fontSize,
    textareaSize: getComputedStyle(document.querySelector('#read-only-cursor-text-area')).fontSize,
    overlayBg: getComputedStyle(document.querySelector('#overlay')).backgroundColor,
    wallpaper: getComputedStyle(document.body, '::before').backgroundImage.slice(0, 30)
  };
});
const hexToRgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`; };

// Pixel comparison done inside Chromium (no image-diff dependency).
async function diffRatio(context, a, b) {
  const page = await context.newPage();
  const ratio = await page.evaluate(async ([x, y]) => {
    const load = src => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const read = img => { const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const da = read(ia), db = read(ib);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24) diff++;
    }
    return diff / (da.length / 4);
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
  await page.close();
  return ratio;
}
async function matchSnapshot(context, page, name, tolerance = 0.01) {
  const shot = await page.screenshot();
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), shot);
  const baseline = path.join(SNAP_DIR, `${name}.png`);
  if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(baseline)) {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(baseline, shot);
    return;
  }
  const ratio = await diffRatio(context, shot, fs.readFileSync(baseline));
  assert.ok(ratio <= tolerance, `${name}: ${(ratio * 100).toFixed(2)}% pixels differ from baseline (see tests/e2e/output/${name}.png)`);
}

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
    assert.equal(s.accent, '#a879ff');
    assert.notEqual(s.emphasis, '#a879ff', 'neutral emphasis must not become the accent');
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
    assert.equal((await state(await openGitHub(context, 'acme/another'))).bgDefault, '#fff8fb');
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
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#0d1c10');
    await page.click('#toTurbo');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#33194a');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/acme/other' && getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#0d1c10');
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

async function openStudioFor(context, gh) {
  const helper = await extPage(context);
  const tabId = await helper.evaluate(() => chrome.tabs.query({ url: 'https://github.com/*' }).then(t => t[0].id));
  await helper.close();
  const studio = await extPage(context, `studio.html?target=${tabId}`);
  await studio.waitForFunction(() => document.getElementById('previewState').textContent.includes('connected'));
  return studio;
}

test('studio live preview survives soft navigation, reverts on close, persists on save', async () => {
  const { context, errors, close } = await launch();
  try {
    const gh = await openGitHub(context);
    let studio = await openStudioFor(context, gh);
    assert.equal(await studio.textContent('#targetLabel'), 'acme/project');
    await studio.click('.gallery-card >> text=Galaxy');
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#17183d');
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
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === '#223344');
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

test('wallpaper upload is compressed, previewed, saved and rendered', async () => {
  const { context, errors, close } = await launch();
  try {
    const gh = await openGitHub(context);
    const studio = await openStudioFor(context, gh);
    const pngBase64 = await studio.evaluate(async () => {
      const c = new OffscreenCanvas(2400, 1400); const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 2400, 1400); grad.addColorStop(0, '#ff0080'); grad.addColorStop(1, '#00c0ff');
      g.fillStyle = grad; g.fillRect(0, 0, 2400, 1400);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await blob.arrayBuffer()); let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    });
    const file = path.join(OUT_DIR, 'wallpaper.png');
    fs.writeFileSync(file, Buffer.from(pngBase64, 'base64'));
    await studio.click('.sidebar-link[data-view="background"]');
    await studio.setInputFiles('#wallpaperInput', file);
    await studio.waitForFunction(() => document.getElementById('backgroundMode').value === 'image');
    await gh.waitForFunction(() => getComputedStyle(document.body, '::before').backgroundImage.startsWith('url("data:image/jpeg'));
    await studio.evaluate(() => { const r = document.getElementById('wallpaperBlur'); r.value = '6'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await gh.waitForFunction(() => getComputedStyle(document.body, '::before').filter === 'blur(6px)');
    await studio.click('#saveButton');
    const config = await getConfig(context);
    const theme = config.customThemes[config.repoAssignments['acme/project']];
    assert.equal(theme.backgroundMode, 'image');
    assert.ok(theme.wallpaper.length <= 750000, `wallpaper stored at ${theme.wallpaper.length} chars`);
    await studio.close();
    await gh.reload(); await gh.waitForTimeout(250);
    assert.match((await state(gh)).wallpaper, /^url\("data:image\/jpeg/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

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
