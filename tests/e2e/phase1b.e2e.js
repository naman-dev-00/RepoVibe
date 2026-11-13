'use strict';
/* Phase 1B E2E: wallpapers, glass layering, automatic per-repository themes, IndexedDB storage.
   Offline GitHub fixture + real Chromium + unpacked extension (live github.com coverage is in tests/live). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { OUT_DIR, launch, extPage, setConfig, getConfig, openGitHub, openStudioFor, diffRatio, matchSnapshot, pixelAt, visualContrast } = require('./helpers');

const panel = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim());
const wallpaperVar = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').trim().slice(0, 60));
const PRESET = id => ({ 'preset-1': '#1b1538', 'preset-3': '#f3d6e3', 'preset-12': '#cfe0ef', 'preset-19': '#17183d', 'preset-20': '#33194a' })[id];

async function idbList(context) {
  const p = await extPage(context, 'studio.html');
  await p.waitForFunction(() => !!globalThis.RepoVibeWallpapers);
  const list = await p.evaluate(() => RepoVibeWallpapers.list());
  await p.close();
  return list;
}
async function makePng(context, w, h, seed = 1, type = 'image/png') {
  const p = await extPage(context);
  const b64 = await p.evaluate(async ([w, h, seed, type]) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff3366'); gr.addColorStop(1, '#3366ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    let a = seed; for (let i = 0; i < 4000; i++) { a = (a * 16807) % 2147483647; g.fillStyle = `hsl(${a % 360},70%,${30 + (a % 40)}%)`; g.fillRect(a % w, (a >> 3) % h, 3 + (a % 40), 3 + (a % 30)); }
    const bytes = new Uint8Array(await (await c.convertToBlob({ type, quality: 0.92 })).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, [w, h, seed, type]);
  await p.close();
  const file = path.join(OUT_DIR, `upload-${w}x${h}-${seed}.${type === 'image/jpeg' ? 'jpg' : 'png'}`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return file;
}

test('bundled wallpaper is visible across the page, behind translucent panels, with opaque menus and clickable links', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-18' }); // Sunset Boulevard: vivid village artwork
    const page = await openGitHub(context);
    await page.setViewportSize({ width: 1600, height: 900 }); // desktop width: artwork in margins + behind guarded glass
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('sunset-coast.webp'));
    await page.waitForTimeout(400);
    const withArt = await page.screenshot();
    await setConfig(context, { enabled: true, defaultThemeId: 'custom-flat', customThemes: { 'custom-flat': { id: 'custom-flat', name: 'flat', bg: '#301b32', surface: '#4c294a', text: '#fff1f1', backgroundMode: 'solid' } } });
    await page.waitForFunction(() => !getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').trim());
    await page.waitForTimeout(300);
    const flat = await page.screenshot();
    const visible = await diffRatio(context, withArt, flat);
    assert.ok(visible > 0.25, `wallpaper should change a large share of the rendered page; changed ${(visible * 100).toFixed(1)}%`);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-18' });
    await page.waitForTimeout(400);
    const layer = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const box = getComputedStyle(document.querySelector('.Box')).backgroundColor;
      const menu = getComputedStyle(document.querySelector('#overlay')).backgroundColor;
      const link = document.querySelector('#toOther').getBoundingClientRect();
      const hit = document.elementFromPoint(link.left + 5, link.top + link.height / 2);
      return { image: root.backgroundImage, attach: root.backgroundAttachment, before: getComputedStyle(document.body, '::before').content, box, menu, hitIsLink: hit && hit.id === 'toOther',
        panelOpacity: Number(root.getPropertyValue('--repv-panel-opacity')) };
    });
    // v0.2.1 model: the scene is the ROOT background (on the canvas, under every element, no negative z-index).
    assert.match(layer.image, /sunset-coast\.webp/, 'scene painted as the root background');
    assert.match(layer.attach, /fixed/, 'root scene layer is fixed to the viewport');
    assert.equal(layer.before, 'none', 'no extra layer without blur/cinematic');
    assert.equal(layer.box, `rgba(76, 41, 74, ${layer.panelOpacity})`, `panels are ONE layer of guarded glass: ${layer.box}`);
    assert.ok(layer.panelOpacity >= 0.4 && layer.panelOpacity < 1, `panel glass stays translucent (${layer.panelOpacity})`);
    assert.equal(layer.menu, 'rgb(76, 41, 74)', 'menus/overlays stay opaque');
    assert.ok(layer.hitIsLink, 'links remain clickable above the wallpaper');
    await page.evaluate(() => window.scrollTo(0, 400));
    const [r, g, b] = await pixelAt(context, await page.screenshot(), 640, 700);
    assert.ok(r + g + b > 40, 'wallpaper still painted after scrolling (fixed layer)');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width: 1280, height: 800 });
    await matchSnapshot(context, page, 'p1b-github-sunset-wallpaper', 0.02);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1' });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('neon-city-3d.webp'));
    await page.waitForTimeout(300);
    await matchSnapshot(context, page, 'p1b-github-cyberpunk-wallpaper', 0.02);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('text stays readable over wallpapers (screenshot-measured contrast) for dark and light themes', async () => {
  for (const [id, mode] of [['preset-1', 'dark'], ['preset-3', 'light'], ['preset-12', 'dark'], ['preset-20', 'dark']]) {
    const { context, errors, close } = await launch({ mode });
    try {
      await setConfig(context, { enabled: true, defaultThemeId: id });
      const page = await openGitHub(context);
      await page.waitForTimeout(500);
      const c = await visualContrast(context, page);
      assert.ok(c.count >= 8, `measured ${c.count} text elements`);
      assert.equal(c.fails.length, 0, `${id}: text below WCAG AA: ${c.failSummary}`);
      assert.ok(c.p10 >= 4.5, `${id}: 10th percentile contrast ${c.p10.toFixed(2)}:1 should meet AA`);
      assert.deepEqual(errors, []);
    } finally { await close(); }
  }
});

test('wallpaper controls update the live preview: opacity, brightness, blur, overlay, position, scaling, glass', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    const gh = await openGitHub(context);
    const studio = await openStudioFor(context, gh);
    await studio.click('.sidebar-link[data-view="background"]');
    await studio.click('.wallpaper-tile[data-ref="builtin:aurora-lake"]');
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('aurora-lake.webp'));
    const slide = (id, v) => studio.evaluate(([id, v]) => { const r = document.getElementById(id); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
    await slide('wallpaperOpacity', 60); await slide('wallpaperBrightness', 80); await slide('wallpaperBlur', 5); await slide('wallpaperOverlay', 50);
    await studio.selectOption('#wallpaperPosition', 'top'); await studio.selectOption('#wallpaperSize', 'contain');
    await studio.click('.sidebar-link[data-view="customize"]');
    await slide('glassOpacity', 55); await slide('glass', 20);
    await gh.waitForFunction(() => getComputedStyle(document.body, '::before').filter === 'blur(5px)');
    const s = await gh.evaluate(() => { const r = getComputedStyle(document.documentElement); const box = getComputedStyle(document.querySelector('.Box')); return { image: r.backgroundImage, size: r.backgroundSize, pos: r.backgroundPosition, boxBg: box.backgroundColor, boxBlur: box.backdropFilter, panel: r.getPropertyValue('--repv-panel-opacity').trim() }; });
    // Every slider is a visible layer of the root scene stack: opacity veil, overlay, brightness veil, image (Midnight bg).
    assert.match(s.image, /^linear-gradient\(rgba\(11, 18, 32, 0\.4\)[^)]*\)\), linear-gradient\(rgba\(11, 18, 32, 0\.5\)[^)]*\)\), linear-gradient\(rgba\(0, 0, 0, 0\.2\)[^)]*\)\), url\("chrome-extension:\/\/[^"]+aurora-lake\.webp"\)(, none)?$/, `scene stack: ${s.image}`);
    assert.match(s.size, /, contain(, auto)?$/); assert.match(s.pos, /, 50% 0%(, [^,]+)?$/);
    assert.equal(s.boxBg, Number(s.panel) >= 1 ? 'rgb(21, 30, 48)' : `rgba(21, 30, 48, ${s.panel})`, 'panel glass = the guarded opacity');
    assert.ok(Number(s.panel) >= 0.55, 'never below the chosen panel opacity'); assert.match(s.boxBlur, /blur\(20px\)/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('automatic per-repository themes: distinct, persisted, stable across reloads, SPA navigation and browser restart', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'repovibe-restart-'));
  try {
    let first;
    {
      const { context, errors, close } = await launch({ userDataDir: profile });
      try {
        const page = await openGitHub(context, 'acme/project'); // fresh install: no config at all
        await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
        const a = await panel(page);
        await page.click('#toOther'); // client-side navigation to acme/other
        await page.waitForFunction(prev => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() !== prev, a);
        const b = await panel(page);
        assert.notEqual(a, b, 'two repositories of the same owner get different automatic themes');
        await page.waitForTimeout(300);
        const cfg = await getConfig(context);
        assert.deepEqual(Object.keys(cfg.autoAssignments).sort(), ['acme/other', 'acme/project'], 'automatic picks are persisted');
        // Only the four seeded default mappings (fresh install) are manual; automatic picks never become manual assignments.
        assert.deepEqual(cfg.repoAssignments, { 'naman-dev-00/tradpro': 'preset-1', 'naman-dev-00/repovibe': 'preset-8', 'naman-dev-00/pool-souls': 'preset-19', 'naman-dev-00/ai-powered-inbox-assistant': 'preset-15' }, 'automatic picks never become manual assignments');
        await page.reload(); await page.waitForTimeout(300);
        assert.equal(await panel(page), b, 'stable across reload');
        first = { a, b, auto: cfg.autoAssignments };
        assert.deepEqual(errors, []);
      } finally { await close(); }
    }
    {
      const { context, errors, close } = await launch({ userDataDir: profile }); // browser restart
      try {
        const page = await openGitHub(context, 'acme/project');
        assert.equal(await panel(page), first.a, 'same theme after browser restart');
        assert.deepEqual((await getConfig(context)).autoAssignments, first.auto);
        assert.deepEqual(errors, []);
      } finally { await close(); }
    }
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
});

test('manual repository choice beats automatic and is never overwritten; reset returns to the automatic theme', async () => {
  const { context, errors, close } = await launch();
  try {
    const gh = await openGitHub(context, 'me/repovibe');
    await gh.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    const auto = await panel(gh);
    const popup = await extPage(context); await popup.setViewportSize({ width: 384, height: 640 });
    await gh.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
    assert.match(await popup.textContent('#scopeInfo'), /Automatic theme/);
    await popup.locator('.theme-tile').nth(1).click(); // tile 0 is the current (automatic) theme
    await popup.waitForFunction(() => /Manually assigned/.test(document.getElementById('scopeInfo').textContent));
    const manual = await panel(gh);
    assert.notEqual(manual, auto);
    let cfg = await getConfig(context);
    assert.ok(cfg.repoAssignments['me/repovibe']);
    // Simulate a later automatic pass (e.g. another tab) — the manual choice must still win.
    await gh.reload(); await gh.waitForTimeout(300);
    await gh.goto('https://github.com/me/other'); await gh.waitForTimeout(300); await gh.goBack(); await gh.waitForTimeout(300);
    assert.equal(await panel(gh), manual, 'manual choice persists across navigation and reloads');
    assert.equal((await getConfig(context)).repoAssignments['me/repovibe'], cfg.repoAssignments['me/repovibe']);
    await popup.click('#resetRepo');
    await popup.waitForFunction(() => /Automatic theme/.test(document.getElementById('scopeInfo').textContent));
    await gh.waitForFunction(v => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === v, auto);
    await popup.click('#resetCurrent'); // Restore GitHub appearance for this repo
    await gh.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
    await gh.reload(); await gh.waitForTimeout(300);
    assert.equal(await gh.evaluate(() => document.documentElement.classList.contains('repv-active')), false, 'explicit "Restore GitHub" is not replaced by an automatic theme');
    cfg = await getConfig(context);
    assert.equal(cfg.repoAssignments['me/repovibe'], 'native');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('turning automatic themes off falls back to the shared global theme', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { version: 2, enabled: true, autoAssign: true, defaultThemeId: 'preset-19' });
    const gh = await openGitHub(context, 'zz/alpha');
    const auto = await panel(gh);
    const studio = await openStudioFor(context, gh);
    await studio.click('.sidebar-link[data-view="settings"]');
    await studio.uncheck('#autoAssignToggle');
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#17183d');
    assert.equal((await getConfig(context)).autoAssign, false);
    assert.ok(auto !== '' );
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('IndexedDB wallpaper upload: compressed, deduplicated, referenced (not inlined), previewed, saved, survives restart', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'repovibe-idb-'));
  try {
    let ref;
    {
      const { context, errors, close } = await launch({ userDataDir: profile });
      try {
        await setConfig(context, { enabled: true, defaultThemeId: 'native' });
        const gh = await openGitHub(context);
        const studio = await openStudioFor(context, gh);
        await studio.click('.sidebar-link[data-view="background"]');
        const file = await makePng(context, 2400, 1400, 7);
        await studio.setInputFiles('#wallpaperInput', file);
        await studio.waitForSelector('.wallpaper-tile.uploaded.selected');
        await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('data:image/webp'));
        await studio.setInputFiles('#wallpaperInput', file); // same image again → deduplicated
        await studio.waitForTimeout(500);
        const list = await idbList(context);
        assert.equal(list.length, 1, 'identical uploads are stored once');
        assert.equal(list[0].type, 'image/webp'); assert.ok(list[0].width <= 3840);
        await studio.click('#saveButton');
        await studio.waitForTimeout(300);
        const cfg = await getConfig(context);
        const theme = cfg.customThemes[cfg.repoAssignments['acme/project']];
        ref = theme.wallpaperRef;
        assert.equal(ref, `idb:${list[0].id}`);
        assert.equal(theme.wallpaper, '', 'no image data in theme settings');
        assert.ok(JSON.stringify(cfg).length < 20000, `config stays small (${JSON.stringify(cfg).length} chars)`);
        assert.deepEqual(errors, []);
      } finally { await close(); }
    }
    {
      const { context, errors, close } = await launch({ userDataDir: profile });
      try {
        const gh = await openGitHub(context);
        await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('data:image/webp'), null, { timeout: 10000 });
        assert.equal((await idbList(context)).length, 1, 'IndexedDB asset persisted across restart');
        assert.deepEqual(errors, []);
      } finally { await close(); }
    }
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
});

test('v1 inline wallpapers migrate to IndexedDB; missing assets degrade gracefully; unused assets are cleaned up', async () => {
  const { context, errors, close } = await launch();
  try {
    const legacyPng = fs.readFileSync(await makePng(context, 300, 200, 3)).toString('base64');
    await setConfig(context, { enabled: true, defaultThemeId: 'native', repoAssignments: { 'acme/project': 'custom-old', 'acme/other': 'custom-gone' },
      customThemes: { 'custom-old': { name: 'Old v1', backgroundMode: 'image', wallpaper: `data:image/png;base64,${legacyPng}` },
        'custom-gone': { name: 'Gone', backgroundMode: 'image', wallpaperRef: 'idb:wdeadbeefdeadbeefdeadbeef', bg: '#203040' } } });
    const helper = await extPage(context);
    const status = await helper.evaluate(() => new Promise(r => chrome.runtime.sendMessage({ type: 'WALLPAPER_MIGRATE' }, r)));
    assert.equal(status.migrated, 1); assert.deepEqual(status.failed, []);
    let cfg = await getConfig(context);
    assert.match(cfg.customThemes['custom-old'].wallpaperRef, /^idb:w[0-9a-f]{24}$/);
    assert.equal(cfg.customThemes['custom-old'].wallpaper, '');
    const gh = await openGitHub(context);
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('data:image/png'));
    // Missing asset: theme still applies (no wallpaper, opaque surfaces), no errors.
    await gh.goto('https://github.com/acme/other'); await gh.waitForTimeout(600);
    assert.equal(await panel(gh), '#151e30', 'theme with a missing wallpaper still applies its colours');
    assert.equal(await wallpaperVar(gh), '');
    assert.doesNotMatch(await gh.evaluate(() => getComputedStyle(document.documentElement).backgroundImage), /url\(/, 'no image layer for a missing asset');
    // Cleanup: an extra unreferenced upload is removed; the migrated, referenced one is kept.
    const studio = await extPage(context, 'studio.html');
    await studio.waitForFunction(() => !!globalThis.RepoVibeWallpapers);
    await studio.evaluate(async () => { const c = new OffscreenCanvas(64, 64); c.getContext('2d').fillRect(0, 0, 9, 9); await RepoVibeWallpapers.put(await c.convertToBlob({ type: 'image/webp' })); });
    assert.equal((await idbList(context)).length, 2);
    const res = await studio.evaluate(() => new Promise(r => chrome.runtime.sendMessage({ type: 'WALLPAPER_CLEANUP', keep: [], minAgeMs: 0 }, r)));
    assert.equal(res.ok, true); assert.equal(res.removed.length, 1);
    const left = await idbList(context);
    assert.deepEqual(left.map(x => `idb:${x.id}`), [cfg.customThemes['custom-old'].wallpaperRef]);
    // Corrupted/invalid bytes are rejected on the way in.
    const rejected = await studio.evaluate(() => RepoVibeWallpapers.put(new Blob(['not an image'], { type: 'image/png' })).then(() => 'stored', e => e.message));
    assert.match(rejected, /Only PNG, JPEG and WebP/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('large wallpaper performance: 8000×4500 upload is downscaled and stored quickly; navigation stays fast', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    const gh = await openGitHub(context);
    const studio = await openStudioFor(context, gh);
    await studio.click('.sidebar-link[data-view="background"]');
    const tooBig = await makePng(context, 8000, 4500, 11); // ~29 MB lossless PNG: over the 25 MB input limit
    assert.ok(fs.statSync(tooBig).size > 25 * 1048576);
    await studio.setInputFiles('#wallpaperInput', tooBig);
    await studio.waitForFunction(() => /under 25 MB/.test(document.getElementById('toast').textContent));
    const file = await makePng(context, 8000, 4500, 11, 'image/jpeg');
    const inputBytes = fs.statSync(file).size;
    const t0 = Date.now();
    await studio.setInputFiles('#wallpaperInput', file);
    await studio.waitForSelector('.wallpaper-tile.uploaded.selected', { timeout: 60000 });
    const processMs = Date.now() - t0;
    const [item] = await idbList(context);
    assert.ok(Math.max(item.width, item.height) <= 3840, `downscaled to ${item.width}×${item.height}`);
    assert.ok(processMs < 20000, `processing took ${processMs} ms`);
    await studio.click('#saveButton'); await studio.close();
    await gh.reload();
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('data:image/webp'), null, { timeout: 10000 });
    const navMs = [];
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      await gh.click(i % 2 ? '#toTurbo' : '#toOther');
      await gh.waitForTimeout(50);
      await gh.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      navMs.push(Date.now() - t);
    }
    const heap = await gh.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
    fs.writeFileSync(path.join(OUT_DIR, 'perf-large-wallpaper.json'), JSON.stringify({ inputBytes, processMs, stored: item, navMs, pageHeapMB: heap }, null, 2));
    console.log(`# perf: input ${(inputBytes / 1048576).toFixed(1)} MB → ${item.width}×${item.height} WebP ${(item.size / 1024).toFixed(0)} KB in ${processMs} ms; soft-nav frames ${navMs.join('/')} ms; page JS heap ${heap} MB`);
    assert.ok(Math.max(...navMs) < 1500, `soft navigation with a large wallpaper took ${navMs.join('/')} ms`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('gallery shows real artwork previews with Apply and Customize; Apply saves to the current repository', async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    const gh = await openGitHub(context, 'user/poolsouls');
    const studio = await openStudioFor(context, gh);
    await studio.setViewportSize({ width: 1400, height: 1000 });
    await studio.waitForFunction(() => [...document.querySelectorAll('.gallery-card .art-image')].filter(i => i.complete && i.naturalWidth > 0).length >= 8);
    const cards = await studio.evaluate(() => [...document.querySelectorAll('.gallery-card')].map(c => ({ img: !!c.querySelector('.art-image'), apply: !!c.querySelector('.card-actions .primary-button'), customize: !!c.querySelector('.card-actions .outline-button') })));
    assert.equal(cards.length, 14, '20 built-ins minus the six archived themes'); assert.ok(cards.every(c => c.img && c.apply && c.customize));
    await studio.evaluate(() => Promise.all([...document.querySelectorAll('.gallery-card .art-image')].map(i => i.decode().catch(() => {}))));
    const broken = await studio.evaluate(() => [...document.querySelectorAll('.gallery-card .art-image')].filter(i => !i.naturalWidth).length);
    assert.equal(broken, 0, 'every gallery artwork loads');
    await matchSnapshot(context, studio, 'p1b-studio-gallery', 0.02);
    const galaxy = studio.locator('.gallery-card', { hasText: 'Galaxy' });
    await galaxy.locator('.primary-button').click();
    await gh.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === '#17183d');
    assert.equal((await getConfig(context)).repoAssignments['user/poolsouls'], 'preset-19');
    assert.match(await studio.textContent('#themeSource'), /Manually assigned/);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('disabling RepoVibe removes wallpaper, glass and every RepoVibe DOM artifact', async () => {
  const { context, errors, close } = await launch({ mode: 'dark' });
  try {
    const plain = await launch({ extension: false, mode: 'dark' });
    const ref = await (await openGitHub(plain.context)).screenshot();
    await plain.close();
    const gh = await openGitHub(context); // automatic theme with wallpaper
    await gh.waitForFunction(() => !!document.getElementById('repovibe-wallpaper-v1'));
    await setConfig(context, { version: 2, enabled: false });
    await gh.waitForFunction(() => !document.documentElement.classList.contains('repv-active'));
    const left = await gh.evaluate(() => [...document.querySelectorAll('[id^="repovibe-"], [class*="repv"]')].map(e => e.id || e.className).concat([...document.documentElement.attributes].filter(a => a.name.startsWith('data-repv')).map(a => a.name)));
    assert.deepEqual(left, []);
    assert.equal(await diffRatio(context, ref, await gh.screenshot()), 0, 'pixel-identical to GitHub without the extension');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('popup shows repository, active theme and source; visual baseline', async () => {
  const { context, errors, close } = await launch();
  try {
    // Fresh install: wait for the service worker to seed the default mappings (naman-dev-00/RepoVibe → Enchanted Forest).
    const sw = await extPage(context);
    await sw.waitForFunction(() => chrome.storage.local.get('repovibe.v1').then(o => o['repovibe.v1']?.seededMappings === true));
    await sw.close();
    const gh = await openGitHub(context, 'naman-dev-00/RepoVibe');
    const popup = await extPage(context); await popup.setViewportSize({ width: 384, height: 640 });
    await gh.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
    assert.equal(await popup.textContent('#repoName'), 'naman-dev-00/RepoVibe');
    assert.equal(await popup.textContent('#activeTheme'), 'Active theme: Enchanted Forest');
    assert.match(await popup.textContent('#scopeInfo'), /Manually assigned to this repo/);
    assert.equal(await popup.textContent('#motionNote'), 'Fireflies · ambient');
    // an unconfigured repository shows its automatic source
    const other = await openGitHub(context, 'naman-dev-00/notes');
    await other.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
    assert.match(await popup.textContent('#scopeInfo'), /Automatic theme for this repo/);
    await gh.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
    await matchSnapshot(context, popup, 'p1b-popup', 0.02);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
