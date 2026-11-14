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

const EXT = process.env.REPOVIBE_EXT ? path.resolve(process.env.REPOVIBE_EXT) : path.resolve(__dirname, '../..'); // REPOVIBE_EXT: load another build (before/after evidence)
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const HOME_FIXTURE = fs.readFileSync(path.join(__dirname, 'fixture-home.html'), 'utf8');
const LAYOUT_FIXTURE = fs.readFileSync(path.join(__dirname, 'fixture-layout.html'), 'utf8');
const HOME_REACT_FIXTURE = fs.readFileSync(path.join(__dirname, 'fixture-home-react.html'), 'utf8');
// Signed-in Home variants (GitHub has served both): 'react' = div[role=listitem] rows whose inner wrapper paints an opaque
// surface, heading inside a span; 'anchor' = each row IS the repository link.
const HOME_ROW = {
  react: n => { const [o, r] = n.split('/'); return `<div role="listitem" class="ListItem__q"><div class="ActionRow__x RowWrapper__bg"><a href="/${n}" data-hovercard-type="repository" aria-label="${n}"><span class="avatar"></span></a><a class="Link__b markdown-title" href="/${n}"><span>${o}</span><span class="color-fg-muted">/</span><span>${r}</span></a></div></div>`; },
  anchor: n => { const [o, r] = n.split('/'); return `<a class="TopRepoLink__z RowWrapper__bg markdown-title" href="/${n}" style="display:flex;align-items:center;gap:8px;padding:6px 0"><span class="avatar"></span><span>${o}<span class="color-fg-muted">/</span>${r}</span></a>`; }
};
const homeVariant = (variant, mode) => HOME_REACT_FIXTURE
  .replace('__REACT_LIST__', `<div role="list" class="List__a${variant === 'anchor' ? ' AnchorList' : ''}">${HOME_REPOS.map(HOME_ROW[variant]).join('')}</div>`)
  .replace('__ROWFN__', HOME_ROW[variant].toString()).replace('__VARIANT__', variant).replace('__MODE__', mode);
// Signed-in Home "Top repositories" rows (the four mapped repositories plus unconfigured ones).
const HOME_REPOS = ['naman-dev-00/tradPro', 'naman-dev-00/RepoVibe', 'naman-dev-00/Pool-Souls', 'naman-dev-00/ai-powered-inbox-assistant', 'naman-dev-00/notes', 'octocat/Hello-World'];
const homeRow = name => { const [o, r] = name.split('/'); return `<li class="public source"><div class="width-full d-flex mt-2"><a class="mr-2 d-flex flex-items-center" href="/${name}" aria-label="Repository"><span class="avatar"></span></a><div class="wb-break-word"><a class="color-fg-default lh-0 mb-2 markdown-title" href="/${name}">${o}<span class="color-fg-muted">/</span>${r}</a></div></div></li>`; };
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
async function launch({ extension = true, mode = 'dark', fixture = true, colorScheme = 'light', userDataDir, recordVideo } = {}) {
  const dir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'repovibe-e2e-'));
  // Pin text rasterization so screenshots do not depend on the host's fontconfig antialiasing/subpixel
  // settings (these differed between the authoring machine and GitHub's runners).
  const RENDER_ARGS = ['--disable-lcd-text', '--font-render-hinting=none'];
  const args = [...RENDER_ARGS, ...(extension ? [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] : ['--disable-extensions'])];
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium', headless: true, viewport: VIEWPORT, deviceScaleFactor: 1, args, acceptDownloads: true, colorScheme, ...(recordVideo ? { recordVideo } : {}),
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
    // /<owner>/<repo>/layout: GitHub's current React repository layout (full-width PageLayout wrappers, file table, list).
    if (/^\/[^/]+\/[^/]+\/layout$/.test(url.pathname)) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: LAYOUT_FIXTURE.replaceAll('__TITLE__', title).replace('__MODE__', mode) });
    }
    if ((url.pathname === '/' || url.pathname === '/dashboard') && HOME_ROW[url.searchParams.get('variant')]) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: homeVariant(url.searchParams.get('variant'), mode) });
    }
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HOME_FIXTURE.replace('__ROWS__', HOME_REPOS.map(homeRow).join('\n')).replace('__MODE__', mode) });
    }
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
// Configs without a version are written as v2 with automatic assignment OFF and live-wallpaper motion Static,
// preserving the semantics the earlier tests were written for (unassigned repos stay native; pixel measurements are
// not disturbed by ambient motion). Auto-assignment and motion tests opt in explicitly.
async function setConfig(context, config) {
  // Legacy-style configs (baseline tests) get Static motion and no pop-out layer (its placement is deferred until images
  // load, which would make pixel baselines timing-dependent); depth tests set these explicitly.
  if (config && config.version === undefined) config = { version: 2, autoAssign: false, motionMode: 'static', depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 0 }, ...config };
  const page = await extPage(context);
  // The service worker seeds the default repository mappings once at install; wait for it so it cannot race
  // (and overwrite) the configuration a test writes. Tests that want the seeded mappings read them before this.
  await page.waitForFunction(k => chrome.storage.local.get(k).then(o => o[k] && o[k].seededMappings === true), KEY, { timeout: 5000 }).catch(() => {});
  if (config && config.seededMappings === undefined) config = { ...config, seededMappings: true };
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
    wallpaper: getComputedStyle(root).backgroundImage.slice(0, 200) // the scene is painted as the root background
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
  // Live-wallpaper layers animate forever; 'disabled' renders them at their initial frame so baselines are stable.
  // Depth-scene images (layers are CSS backgrounds, objects are <img>) load asynchronously: wait until every one has
  // decoded so a baseline never catches a half-loaded scene.
  await page.evaluate(async () => {
    const urls = [...document.querySelectorAll('#repovibe-depth .repv-l > i')].map(i => /url\("([^"]+)"\)/.exec(i.style.backgroundImage)?.[1]).filter(u => u && !u.startsWith('data:'));
    const imgs = [...document.querySelectorAll('#repovibe-depth img, #repovibe-popout img')];
    await Promise.all([...urls.map(u => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); }), ...imgs.map(i => i.decode().catch(() => {}))]);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }).catch(() => {});
  const shot = await withSnapshotFonts(page, () => page.screenshot({ animations: 'disabled' }));
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
// GitHub uses smooth scrolling: wait until scroll position and document height are stable before measuring, so text
// positions captured for the measurement match the screenshot taken a moment later.
async function settleLayout(page) {
  let prev = null;
  for (let i = 0; i < 25; i++) {
    const now = await page.evaluate(() => `${scrollX},${scrollY},${document.documentElement.scrollHeight}`);
    if (now === prev) return; prev = now; await page.waitForTimeout(120);
  }
}
async function visualContrast(context, page, limit = 150, retry = 1) {
  await settleLayout(page);
  const pos0 = await page.evaluate(() => `${scrollX},${scrollY}`);
  const items = await page.evaluate(lim => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (out.length >= lim) break;
      if (!(el instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(el.tagName)) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      // Screen-reader-only text (clipped to 1 px) is never painted visibly: not a contrast target.
      if (el.closest('.sr-only, [class*="VisuallyHidden"], .visually-hidden')) continue;
      // WCAG 1.4.3 exempts inactive (disabled) UI components, e.g. GitHub's aria-disabled "Previous" pagination link on the first page.
      if (el.closest('[aria-disabled="true"], [disabled], [inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.4) continue;
      // Occluded text (e.g. a file row scrolled underneath GitHub's pinned sticky header) is not visible: not a target.
      // RepoVibe's own overlays (pop-out objects) are pointer-events:none, so text beneath them IS measured.
      // Only an element that actually paints over the text counts (GitHub's code view lays a TRANSPARENT read-only
      // textarea over the code lines: that text is visible and must be measured).
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !el.contains(top) && !top.contains(el)) {
        let opaque = false;
        for (let e = top; e && !e.contains(el); e = e.parentElement) { if (Number(getComputedStyle(e).opacity) < 0.05) break; const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(/[ ,/]+/).filter(Boolean).map(Number) : []; if (p.length && (p.length > 3 ? p[3] : 1) >= 0.5) { opaque = true; break; } }
        if (opaque) continue;
      }
      out.push({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), color: cs.color, text: el.textContent.trim().slice(0, 30), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0].slice(0, 30) : ''), fs: parseFloat(cs.fontSize) || 16, fw: parseInt(cs.fontWeight, 10) || 400 });
    }
    return out;
  }, limit);
  const hide = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } img, svg { visibility: hidden !important; }' });
  await page.waitForTimeout(100);
  const shot = await page.screenshot();
  await hide.evaluate(el => el.remove());
  // the page moved between capturing text positions and the screenshot: measure again rather than compare mismatched pixels
  if (retry > 0 && await page.evaluate(() => `${scrollX},${scrollY}`) !== pos0) return visualContrast(context, page, limit, retry - 1);
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
      // WCAG 2.x 1.4.3: 4.5:1 for normal text; 3:1 only for large text (>= 24 px, or >= 18.66 px and bold)
      const large = it.fs >= 24 || (it.fs >= 18.66 && it.fw >= 700);
      return { ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), text: it.text, at: `${it.x},${it.y} ${it.w}x${it.h}`, tag: it.tag, fs: it.fs, fw: it.fw, large, required: large ? 3 : 4.5 };
    });
  }, [`data:image/png;base64,${shot.toString('base64')}`, items]);
  await helper.close();
  const sorted = ratios.map(r => r.ratio).sort((a, b) => a - b);
  return { count: ratios.length, min: sorted[0], p10: sorted[Math.floor(sorted.length * 0.1)], median: sorted[Math.floor(sorted.length / 2)],
    below3: ratios.filter(r => r.ratio < 3), below45: ratios.filter(r => r.ratio < 4.5).length, low: ratios.filter(r => r.ratio < 4.5),
    /* WCAG AA verdict per element: normal text must reach 4.5:1, only large text may stop at 3:1. Gate on `fails`, not on below3. */
    fails: ratios.filter(r => r.ratio < r.required), failSummary: ratios.filter(r => r.ratio < r.required).slice(0, 5).map(r => `"${r.text}" <${r.tag}> ${r.ratio.toFixed(2)}:1 (needs ${r.required}, ${r.fs}px/${r.fw}) @${r.at}`).join('; ') };
}

/** Scene metrics on the current page.
    transmission: per sample point, the share of the scene that reaches the eye = Π(1 − α) over every element above the
    root that paints a background colour (the root itself paints the scene).
    correlation: Pearson correlation of 16 px block luminance between the page screenshot and the wallpaper rendered
    alone at the same size/position — high when the scene's actual shapes are visible, low for a colour wash. */
async function sceneMetrics(context, page) {
  const transmission = await page.evaluate(() => {
    const alphaOf = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
    const out = [];
    for (let y = 20; y < innerHeight; y += 30) for (let x = 15; x < innerWidth; x += 30)
    {
      const stack = document.elementsFromPoint(x, y).filter(e => e !== document.documentElement);
      // Intentionally opaque UI (menus, dialogs, form controls, buttons, badges) is not "glass over the scene".
      if (stack.some(e => e.matches('[role="menu"], [role="dialog"], [role="listbox"], .Overlay, [popover], input, textarea, select, button, .btn, [class*="ButtonBase"], .Label, [class*="TextInputWrapper"]'))) continue;
      out.push(stack.reduce((t, e) => t * (1 - alphaOf(getComputedStyle(e).backgroundColor)), 1));
    }
    return out;
  });
  // Blocks (16 px) whose centre shows the scene with nothing painted above it: where sharpness is measured.
  const exposed = await page.evaluate(() => {
    const alphaOf = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
    const out = [];
    for (let y = 0; y + 16 <= innerHeight; y += 16) for (let x = 0; x + 16 <= innerWidth; x += 16) {
      // Exposed = nothing painted above the scene AND no text, image, icon or control in the block (glyph edges would
      // otherwise count as scene detail). Checked at the centre and four inner corners of the block.
      const pts = [[x + 8, y + 8], [x + 2, y + 2], [x + 14, y + 2], [x + 2, y + 14], [x + 14, y + 14]];
      const clean = pts.every(([px, py]) => {
        const st = document.elementsFromPoint(px, py).filter(e => e !== document.documentElement);
        const top = st[0];
        if (top && (top.matches('a, button, input, textarea, select, img, svg, path, label, code, pre, span, h1, h2, h3, h4, p, li, td, th, summary') || [...top.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) return false;
        return st.every(e => alphaOf(getComputedStyle(e).backgroundColor) < 0.02 && getComputedStyle(e).backdropFilter === 'none');
      });
      out.push(clean ? 1 : 0);
    }
    return out;
  });
  const shot = await page.screenshot({ animations: 'disabled' });
  const scene = await page.evaluate(() => {
    const r = getComputedStyle(document.documentElement);
    const m = r.getPropertyValue('--repv-wallpaper').match(/url\("([^"]+)"\)/);
    const onRoot = /url\(/.test(r.backgroundImage);
    return m && { url: m[1], size: onRoot ? r.backgroundSize.split(', ').at(-2) : 'cover', pos: onRoot ? r.backgroundPosition.split(', ').at(-2) : 'center', w: innerWidth, h: innerHeight };
  });
  let correlation = null, sharpness = null, exposedCorrelation = null;
  if (scene) {
    const helper = await extPage(context); // extension origin: bundled wallpapers are loadable there
    await helper.setViewportSize({ width: scene.w, height: scene.h });
    await helper.setContent(`<body style="margin:0;width:100vw;height:100vh;background:url('${scene.url}') ${scene.pos} / ${scene.size} no-repeat #000"></body>`);
    await helper.waitForTimeout(400);
    const ref = await helper.screenshot();
    [correlation, sharpness, exposedCorrelation] = await helper.evaluate(async ([a, b, mask]) => {
      const load = async src => { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(i.width, i.height); const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
      const A = await load(a), B = await load(b), S = 16, xs = [], ys = [];
      for (let y = 0; y + S <= A.height; y += S) for (let x = 0; x + S <= A.width; x += S) {
        let la = 0, lb = 0;
        for (let yy = 0; yy < S; yy += 4) for (let xx = 0; xx < S; xx += 4) { const i = ((y + yy) * A.width + x + xx) * 4; la += A.data[i] * .2126 + A.data[i + 1] * .7152 + A.data[i + 2] * .0722; lb += B.data[i] * .2126 + B.data[i + 1] * .7152 + B.data[i + 2] * .0722; }
        xs.push(la); ys.push(lb);
      }
      const pearson = (P, Q) => {
        const mean = v => v.reduce((s, x) => s + x, 0) / v.length, ma = mean(P), mb = mean(Q);
        let n = 0, da = 0, db = 0; for (let i = 0; i < P.length; i++) { n += (P[i] - ma) * (Q[i] - mb); da += (P[i] - ma) ** 2; db += (Q[i] - mb) ** 2; }
        return da && db ? n / Math.sqrt(da * db) : 0;
      };
      // over exposed blocks only (where the scene is meant to be seen; same 16 px grid as the mask)
      const ex = xs.map((_, i) => i).filter(i => mask[i]);
      const exposedCorr = ex.length >= 8 ? pearson(ex.map(i => xs[i]), ex.map(i => ys[i])) : null;
      // Sharpness: Laplacian edge energy of the page vs the source wallpaper inside exposed blocks (1 ≈ native sharpness,
      // blur → much lower). Text never sits in exposed blocks by construction.
      const L = (D, x, y) => { const i = (y * D.width + x) * 4; return D.data[i] * .2126 + D.data[i + 1] * .7152 + D.data[i + 2] * .0722; };
      let ea = 0, eb = 0, blocks = 0, k = 0;
      for (let y = 0; y + 16 <= A.height; y += 16) for (let x = 0; x + 16 <= A.width; x += 16, k++) {
        if (!mask[k]) continue; blocks++;
        for (let yy = 1; yy < 15; yy++) for (let xx = 1; xx < 15; xx++) {
          const X = x + xx, Y = y + yy;
          ea += Math.abs(4 * L(A, X, Y) - L(A, X - 1, Y) - L(A, X + 1, Y) - L(A, X, Y - 1) - L(A, X, Y + 1));
          eb += Math.abs(4 * L(B, X, Y) - L(B, X - 1, Y) - L(B, X + 1, Y) - L(B, X, Y - 1) - L(B, X, Y + 1));
        }
      }
      return [pearson(xs, ys), blocks >= 8 && eb > 0 ? ea / eb : null, exposedCorr];
    }, [`data:image/png;base64,${shot.toString('base64')}`, `data:image/png;base64,${ref.toString('base64')}`, exposed]);
    await helper.close();
  }
  const sorted = [...transmission].sort((x, y) => x - y);
  return { median: sorted[sorted.length >> 1], min: sorted[0], clear: transmission.filter(t => t >= 0.9).length / transmission.length, correlation, exposedCorrelation, sharpness,
    exposedShare: exposed.reduce((s, v) => s + v, 0) / exposed.length };
}

module.exports = { sceneMetrics, HOME_REPOS, visualContrast, EXT, EXT_ID, KEY, OUT_DIR, launch, extPage, setConfig, getConfig, openGitHub, state, hexToRgb, diffRatio, matchSnapshot, openStudioFor, pixelAt };
