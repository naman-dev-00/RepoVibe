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

// fixture=false lets requests reach the real network (used only by the live github.com suite).
// userDataDir: reuse a profile across launches (browser-restart persistence tests); it is not deleted on close.
async function launch({ extension = true, mode = 'dark', fixture = true, colorScheme = 'light', userDataDir } = {}) {
  const dir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'repovibe-e2e-'));
  // Pin text rasterization so screenshots do not depend on the host's fontconfig antialiasing/subpixel
  // settings (these differed between the authoring machine and GitHub's runners).
  const RENDER_ARGS = ['--disable-lcd-text', '--font-render-hinting=none'];
  const args = [...RENDER_ARGS, ...(extension ? [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] : ['--disable-extensions'])];
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium', headless: true, viewport: VIEWPORT, deviceScaleFactor: 1, args, acceptDownloads: true, colorScheme,
    env: { ...process.env, FONTCONFIG_FILE: path.join(__dirname, 'fonts', 'fonts.conf') }
  });
  const errors = [];
  const watch = page => {
    page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  };
  context.on('page', watch);
  context.pages().forEach(watch);
  if (fixture) await context.route('https://github.com/**', route => {
    const url = new URL(route.request().url());
    const title = url.pathname.split('/').filter(Boolean).slice(0, 2).join('/') || 'GitHub';
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: FIXTURE.replaceAll('__TITLE__', title).replace('__MODE__', mode) });
  });
  const close = async () => { await context.close(); if (!userDataDir) fs.rmSync(dir, { recursive: true, force: true }); };
  return { context, errors, close };
}

async function extPage(context, file = 'popup.html') {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${EXT_ID}/${file}`);
  return page;
}
// Configs without a version are written as v2 with automatic assignment OFF, preserving the semantics the
// pre-Phase-1B tests were written for (unassigned repos stay native). Auto-assignment tests opt in explicitly.
async function setConfig(context, config) {
  if (config && config.version === undefined) config = { version: 2, autoAssign: false, ...config };
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
    bgDefault: cs.getPropertyValue('--repv-panel').trim(),
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
// Visual baselines must not depend on the host's installed system fonts (they differ between this
// container and GitHub's runners and produced ~14% pixel diffs on text-dense pages). Snapshots are
// rendered with bundled, subset DejaVu fonts (tests/e2e/fonts, see LICENSE-DejaVu.txt); font *choice*
// is asserted separately via computed styles, not via screenshots.
const FONT_DIR = path.join(__dirname, 'fonts');
const fontUrl = file => `data:font/ttf;base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString('base64')}`;
const SNAPSHOT_FONT_CSS = `
@font-face { font-family:RVSnap; font-weight:100 500; src:url("${fontUrl('DejaVuSans.ttf')}") format("truetype"); }
@font-face { font-family:RVSnap; font-weight:501 1000; src:url("${fontUrl('DejaVuSans-Bold.ttf')}") format("truetype"); }
@font-face { font-family:RVSnapMono; src:url("${fontUrl('DejaVuSansMono.ttf')}") format("truetype"); }
*, *::before, *::after { font-family:RVSnap !important; }
:is(code, pre, textarea, .react-code-text, .react-code-line, .blob-code, .code-preview, .code-preview *) { font-family:RVSnapMono !important; }`;
async function withSnapshotFonts(page, fn) {
  const handle = await page.addStyleTag({ content: SNAPSHOT_FONT_CSS });
  await page.evaluate(async () => {
    await Promise.all(['400 16px RVSnap', '700 16px RVSnap', '16px RVSnapMono'].map(f => document.fonts.load(f)));
    await document.fonts.ready;
  });
  try { return await fn(); }
  finally { await handle.evaluate(el => el.remove()); }
}

async function matchSnapshot(context, page, name, tolerance = 0.01) {
  const shot = await withSnapshotFonts(page, () => page.screenshot());
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

/** Screenshot-based readability: hide all text, photograph what is really behind each text element (wallpaper,
    glass, panels), then compare the text colour against the median background pixel. Returns ratios for up to
    `limit` visible text elements. Independent of CSS bookkeeping — it measures rendered pixels. */
async function visualContrast(context, page, limit = 150) {
  const items = await page.evaluate(lim => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (out.length >= lim) break;
      if (!(el instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(el.tagName)) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.4) continue;
      out.push({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), color: cs.color, text: el.textContent.trim().slice(0, 30) });
    }
    return out;
  }, limit);
  const hide = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } img, svg { visibility: hidden !important; }' });
  await page.waitForTimeout(100);
  const shot = await page.screenshot();
  await hide.evaluate(el => el.remove());
  const helper = await context.newPage();
  const ratios = await helper.evaluate(async ([src, list]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lum = ([r, gg, b]) => [r, gg, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    return list.map(it => {
      const d = g.getImageData(it.x, it.y, Math.max(1, it.w), Math.max(1, it.h)).data;
      const ls = []; for (let i = 0; i < d.length; i += 16) ls.push(lum([d[i], d[i + 1], d[i + 2]]));
      ls.sort((a, b) => a - b); const bg = ls[Math.floor(ls.length / 2)];
      const [r, gg, b, a = 1] = parse(it.color);
      const fg = lum([r, gg, b]) * a + bg * (1 - a);
      return { ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), text: it.text };
    });
  }, [`data:image/png;base64,${shot.toString('base64')}`, items]);
  await helper.close();
  const sorted = ratios.map(r => r.ratio).sort((a, b) => a - b);
  return { count: ratios.length, min: sorted[0], p10: sorted[Math.floor(sorted.length * 0.1)], median: sorted[Math.floor(sorted.length / 2)],
    below3: ratios.filter(r => r.ratio < 3), below45: ratios.filter(r => r.ratio < 4.5).length };
}

module.exports = { visualContrast, EXT, EXT_ID, KEY, OUT_DIR, launch, extPage, setConfig, getConfig, openGitHub, state, hexToRgb, diffRatio, matchSnapshot, openStudioFor, pixelAt };
