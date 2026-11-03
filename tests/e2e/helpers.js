'use strict';
/* Shared E2E harness: loads the unpacked extension into real Chromium (new headless mode) and
   serves an offline GitHub-shaped fixture for https://github.com/* via request interception,
   so the content script injects exactly as it would on github.com. This is NOT live GitHub. */
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

async function openStudioFor(context, gh) {
  const helper = await extPage(context);
  const tabId = await helper.evaluate(() => chrome.tabs.query({ url: 'https://github.com/*' }).then(t => t[0].id));
  await helper.close();
  const studio = await extPage(context, `studio.html?target=${tabId}`);
  await studio.waitForFunction(() => document.getElementById('previewState').textContent.includes('connected'));
  return studio;
}

async function pixelAt(context, png, x, y) {
  const page = await context.newPage();
  const rgb = await page.evaluate(async ([src, px, py]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return [...g.getImageData(px, py, 1, 1).data.slice(0, 3)];
  }, [`data:image/png;base64,${png.toString('base64')}`, x, y]);
  await page.close();
  return rgb;
}

module.exports = { EXT, EXT_ID, KEY, OUT_DIR, launch, extPage, setConfig, getConfig, openGitHub, state, hexToRgb, diffRatio, matchSnapshot, openStudioFor, pixelAt };
