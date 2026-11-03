'use strict';
/* LIVE acceptance tests against the real github.com (logged out, no credentials, no cookies).
   Run: npm run test:live   (requires network access to github.com; BLOCKED otherwise).
   These are intentionally NOT part of `npm run test:e2e`; GitHub's live UI changes without notice. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, extPage, setConfig, getConfig, hexToRgb } = require('../e2e/helpers');
const L = require('./live-helpers');

const A = 'actions/checkout';      // public, has issues, PRs, Actions runs, code, commits
const B = 'octocat/Hello-World';   // second public repository for switching
const PAGES = [
  ['Repository overview', `https://github.com/${A}`],
  ['Code browsing (file view)', `https://github.com/${A}/blob/main/action.yml`],
  ['Issues', `https://github.com/${A}/issues`],
  ['Pull requests', `https://github.com/${A}/pulls`],
  ['Actions', `https://github.com/${A}/actions`],
  ['Commit history', `https://github.com/${A}/commits/main`]
];
const T = { // preset surface/text/bg used for assertions
  cyber: { id: 'preset-1', surface: '#1b1538', text: '#f3edff', bg: '#100c25' },
  arctic: { id: 'preset-12', surface: '#fbfdff', text: '#213952', bg: '#eaf5fc' },
  synth: { id: 'preset-20', surface: '#33194a', text: '#fff1ff', bg: '#210c37' },
  aurora: { id: 'preset-17', surface: '#122b34', text: '#e8fff8', bg: '#0c1724' },
  galaxy: { id: 'preset-19', surface: '#17183d', text: '#f0edff', bg: '#0b0b25' }
};
const shared = { nativeLight: {} };

/** Records every check as a matrix row; failures are collected and thrown at the end of the scenario. */
function checker(scenario) {
  const failures = [];
  return {
    check(ok, target, detail) { L.record(scenario, target, ok ? 'PASS' : 'FAIL', detail); if (!ok) failures.push(`${target}: ${detail}`); return ok; },
    info(target, detail) { L.record(scenario, target, 'INFO', detail); },
    done() { if (failures.length) assert.fail(`${failures.length} live check(s) failed:\n- ${failures.join('\n- ')}`); }
  };
}
// --repv-panel records the applied theme's surface (GitHub's --bgColor-default is translucent glass in wallpaper mode).
const themed = (s, t) => s.active && s.style && s.surface === t.surface && s.bodyColor === hexToRgb(t.text);
const waitTheme = (page, surface) => page.waitForFunction(v => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim() === v, surface, { timeout: 8000 }).catch(() => {});
const waitInactive = page => page.waitForFunction(() => !document.documentElement.classList.contains('repv-active'), null, { timeout: 8000 }).catch(() => {});
async function readable(c, page, name, nativeAudit, theme) {
  const audit = await L.readability(page, hexToRgb(theme.bg));
  const allowed = nativeAudit.low + Math.max(5, Math.round(audit.checked * 0.03));
  c.check(audit.low <= allowed, name, `readability: ${audit.low}/${audit.checked} text elements < 3:1 (native GitHub: ${nativeAudit.low}/${nativeAudit.checked}, allowed ${allowed})${audit.low > nativeAudit.low ? ` — e.g. ${audit.samples.slice(0, 6).join('; ')}` : ''}`);
}
function errorCheck(c, errors) {
  c.check(errors.extension.length === 0, 'Console', `RepoVibe-attributed console/page errors: ${errors.extension.length}${errors.extension.length ? ` → ${errors.extension.slice(0, 3).join(' | ')}` : ''}`);
  c.info('Console', `GitHub's own console errors (not attributed to RepoVibe): ${errors.github.length}`);
}

L.liveTest('LIVE 1: native baseline, theme application, readability and exact restoration on six page types (light mode)', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'light' });
  const errors = L.watchErrors(context);
  const c = checker('Page types (light)');
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' }); // fresh installs default to automatic themes
    const page = await context.newPage(); ctx.pages.push(page);
    for (const [name, url] of PAGES) {
      const response = await L.gotoLive(page, url);
      const ev = await L.liveEvidence(page, response, new URL(url).pathname, A);
      c.check(ev.ok, name, `real github.com evidence: ${ev.detail}`);
      const native = await L.themeState(page);
      c.check(!native.active && !native.style && !native.writtenMode, name, `native (default settings): no RepoVibe class/style/attributes; GitHub data-color-mode="${native.mode}"`);
      const nativePrint = await L.fingerprint(page);
      const nativeAudit = await L.readability(page, native.bodyBg);
      shared.nativeLight[name] = { fgDanger: native.fgDanger, audit: nativeAudit };
      await L.shot(page, `light-native-${name}`);

      await setConfig(context, { enabled: true, defaultThemeId: T.cyber.id });
      await waitTheme(page, T.cyber.surface);
      const s = await L.themeState(page);
      c.check(themed(s, T.cyber), name, `Cyberpunk applied: surface ${s.surface}, glass --bgColor-default ${s.bgDefault}, body color ${s.bodyColor}, wallpaper ${s.wallpaperVar.slice(0, 50)}`);
      c.check(s.mode === 'dark' && s.writtenMode === 'dark' && s.colorScheme === 'dark', name, `dark theme on light GitHub switches base mode: data-color-mode=${s.mode} (was ${native.mode}), color-scheme=${s.colorScheme}`);
      c.check(s.fgDanger !== native.fgDanger, name, `GitHub's own (non-overridden) tokens follow the switched mode: --fgColor-danger ${native.fgDanger} → ${s.fgDanger}`);
      if (s.headerFound) c.check(s.headerBg !== native.headerBg, name, `signed-in .AppHeader themed: ${native.headerBg} → ${s.headerBg}`);
      else c.info(name, `logged-out page: GitHub's marketing header has its own fixed data-color-mode="${s.loggedOutHeader?.mode}" (bg ${s.loggedOutHeader?.bg}, text ${s.loggedOutHeader?.color}) and is intentionally not themed; signed-in .AppHeader theming needs a logged-in session (manual)`);
      await readable(c, page, name, nativeAudit, T.cyber);
      await L.shot(page, `light-cyberpunk-${name}`);

      await setConfig(context, { enabled: true, defaultThemeId: 'native' });
      await waitInactive(page);
      const cmp = L.sameAppearance(nativePrint, await L.fingerprint(page)); // fingerprint waits for transitions first
      c.check(cmp.same, name, `computed styles restored exactly after transitions settled (${cmp.compared} pinned elements compared)${cmp.same ? '' : `: ${cmp.diffs.slice(0, 4).join('; ')}`}`);
      const leftovers = await L.extensionDom(page);
      c.check(leftovers.length === 0, name, `no RepoVibe-owned DOM left (style tag, repv* classes, data-repv* attributes, wallpaper layer): ${leftovers.length ? leftovers.join(', ') : 'none'}`);
      await page.evaluate(() => { delete window.__repvFpNodes; });
    }
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 2: GitHub dark mode on six page types — light theme switches base tokens; disabling restores the user\'s mode', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  const errors = L.watchErrors(context);
  const c = checker('Dark mode (system dark, GitHub auto)');
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    const page = await context.newPage(); ctx.pages.push(page);
    for (const [name, url] of PAGES) {
      const response = await L.gotoLive(page, url);
      const ev = await L.liveEvidence(page, response, new URL(url).pathname, A);
      c.check(ev.ok, name, `real github.com evidence: ${ev.detail}`);
      const native = await L.themeState(page);
      const nativePrint = await L.fingerprint(page);
      const nativeAudit = await L.readability(page, native.bodyBg);
      c.check(!native.active, name, `native dark: data-color-mode="${native.mode}", color-scheme=${native.colorScheme}, --fgColor-danger ${native.fgDanger}`);
      await setConfig(context, { enabled: true, defaultThemeId: T.arctic.id });
      await waitTheme(page, T.arctic.surface);
      const s = await L.themeState(page);
      c.check(themed(s, T.arctic), name, `Arctic Frost (light) applied on dark GitHub: surface ${s.surface}, body ${s.bodyColor}`);
      c.check(s.mode === 'light' && s.originalMode === (native.mode ?? ''), name, `base mode switched to light, original "${s.originalMode}" remembered`);
      const lightDanger = shared.nativeLight[name]?.fgDanger;
      if (lightDanger) c.check(s.fgDanger === lightDanger, name, `GitHub light token set is active: --fgColor-danger ${s.fgDanger} (native light ${lightDanger})`);
      await readable(c, page, name, nativeAudit, T.arctic);
      await L.shot(page, `dark-arctic-${name}`);
      await setConfig(context, { enabled: false, defaultThemeId: T.arctic.id });
      await waitInactive(page);
      const restoredPrint = await L.fingerprint(page);
      const cmp = L.sameAppearance(nativePrint, restoredPrint);
      c.check(cmp.same, name, `disable restores original dark appearance and data-color-mode="${restoredPrint.mode}" after transitions settled (${cmp.compared} pinned elements compared)${cmp.same ? '' : `: ${cmp.diffs.slice(0, 4).join('; ')}`}`);
      const leftovers = await L.extensionDom(page);
      c.check(leftovers.length === 0, name, `no RepoVibe-owned DOM left after disable: ${leftovers.length ? leftovers.join(', ') : 'none'}`);
      await page.evaluate(() => { delete window.__repvFpNodes; });
    }
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 3: repository identification, popup quick theme + toggle, switching between repositories, persistence across reloads', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'light' });
  const errors = L.watchErrors(context);
  const c = checker('Repos, popup, persistence');
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    const gh = await context.newPage(); ctx.pages.push(gh);
    await L.gotoLive(gh, `https://github.com/${A}`);
    // The popup resolves the *active* tab: load it in a background tab, focus GitHub, then reload the popup.
    const popup = await extPage(context); ctx.pages.push(popup);
    await popup.setViewportSize({ width: 384, height: 600 });
    await gh.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
    c.check((await popup.textContent('#repoName')) === A, 'Popup', `identifies the active real repository: "${await popup.textContent('#repoName')}"`);
    await popup.click('.theme-tile >> text=Synthwave');
    await waitTheme(gh, T.synth.surface);
    c.check((await getConfig(context)).repoAssignments[A.toLowerCase()] === T.synth.id && themed(await L.themeState(gh), T.synth), 'Popup', 'quick theme "This repo" assigns Synthwave to actions/checkout and applies it live');
    await popup.click('.switch span');
    await waitInactive(gh);
    c.check(!(await L.themeState(gh)).active, 'Popup', 'popup toggle disables RepoVibe on the live page');
    await popup.click('.switch span');
    await waitTheme(gh, T.synth.surface);
    c.check(themed(await L.themeState(gh), T.synth), 'Popup', 'popup toggle re-enables RepoVibe');
    await popup.close();

    await setConfig(context, { enabled: true, defaultThemeId: 'native', repoAssignments: { [A.toLowerCase()]: T.cyber.id, [B.toLowerCase()]: T.synth.id } });
    await gh.reload(); await L.settle(gh);
    c.check(themed(await L.themeState(gh), T.cyber), A, 'per-repository theme (Cyberpunk) applied');
    await L.gotoLive(gh, `https://github.com/${B}`);
    c.check(themed(await L.themeState(gh), T.synth), B, 'switching to another repository applies its own theme (Synthwave)');
    await gh.reload(); await L.settle(gh);
    c.check(themed(await L.themeState(gh), T.synth), B, 'theme persists across a full reload');
    await gh.goBack(); await L.settle(gh);
    c.check(themed(await L.themeState(gh), T.cyber), A, 'browser back returns to the first repository and its theme');
    await L.gotoLive(gh, 'https://github.com/actions');
    c.check(!(await L.themeState(gh)).active, 'github.com/actions (org page)', 'non-repository page with global "native" stays unmodified');
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 4: GitHub client-side navigation between repository tabs keeps the right theme', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'light' });
  const errors = L.watchErrors(context);
  const c = checker('Client-side navigation');
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'native', repoAssignments: { [A.toLowerCase()]: T.aurora.id } });
    const gh = await context.newPage(); ctx.pages.push(gh);
    await L.gotoLive(gh, `https://github.com/${A}`);
    c.check(themed(await L.themeState(gh), T.aurora), 'Repository overview', 'Aurora applied before navigating');
    // Only links inside the repository navigation (GitHub's global header has marketing links like /features/actions).
    const repoNav = 'nav[aria-label="Repository"], .js-repo-nav, #repository-container-header nav';
    const tabs = [
      ['Issues', `#issues-tab, :is(${repoNav}) a[href="/${A}/issues"]`, /^\/actions\/checkout\/issues\/?$/],
      ['Pull requests', `#pull-requests-tab, :is(${repoNav}) a[href="/${A}/pulls"]`, /^\/actions\/checkout\/pulls\/?$/],
      ['Actions', `#actions-tab, :is(${repoNav}) a[href="/${A}/actions"]`, /^\/actions\/checkout\/actions\/?$/],
      ['Code', `#code-tab, :is(${repoNav}) a[href="/${A}"]`, /^\/actions\/checkout\/?$/]
    ];
    for (const [name, selector, re] of tabs) {
      await gh.evaluate(() => { window.__repvMarker = 1; });
      const link = gh.locator(selector).first();
      if (!(await link.count())) { c.check(false, name, `repository tab link not found (${selector})`); continue; }
      await link.click();
      await gh.waitForURL(u => re.test(new URL(u).pathname), { timeout: 20000 }).catch(() => {});
      await L.settle(gh, 1200);
      const soft = await gh.evaluate(() => window.__repvMarker === 1).catch(() => false);
      const s = await L.themeState(gh);
      c.check(re.test(new URL(s.url).pathname) && themed(s, T.aurora), name, `${soft ? 'client-side (no reload)' : 'full'} navigation to ${new URL(s.url).pathname}: theme ${themed(s, T.aurora) ? 'kept' : `LOST (${s.bgDefault})`}`);
      await L.shot(gh, `nav-${name}`);
    }
    const commits = gh.locator(`a[href*="/${A}/commits/"]`).first();
    if (await commits.count()) {
      await gh.evaluate(() => { window.__repvMarker = 1; });
      await commits.click();
      await gh.waitForURL(/\/commits\//, { timeout: 20000 }).catch(() => {});
      await L.settle(gh, 1200);
      const s = await L.themeState(gh);
      const soft = await gh.evaluate(() => window.__repvMarker === 1).catch(() => false);
      c.check(/\/commits\//.test(s.url) && themed(s, T.aurora), 'Commit history', `${soft ? 'client-side' : 'full'} navigation to commits: theme ${themed(s, T.aurora) ? 'kept' : 'LOST'}`);
    } else c.check(false, 'Commit history', 'commits link not found on overview');
    // Leave the repository via the owner link: the repo theme must be removed (global is native).
    const owner = gh.locator('#repository-container-header a[href="/actions"], a[rel="author"][href="/actions"], [itemprop="author"] a[href="/actions"], a[data-hovercard-type="organization"][href="/actions"], .AppHeader-context-item[href="/actions"]').first();
    if (await owner.count()) {
      await owner.click();
      await gh.waitForURL(u => new URL(u).pathname.replace(/\/$/, '') === '/actions', { timeout: 20000 }).catch(() => {});
      await L.settle(gh, 1200);
      const s = await L.themeState(gh);
      c.check(new URL(s.url).pathname.replace(/\/$/, '') === '/actions' && !s.active, 'Owner page (left repo)', `navigating out of the repository removes the repo theme (active=${s.active}, url=${new URL(s.url).pathname})`);
    } else c.info('Owner page (left repo)', 'owner link not found; not tested');
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 5: background, colors, wallpaper, layout and code customization on real pages; Studio preview and save', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'light' });
  const errors = L.watchErrors(context);
  const c = checker('Customization & Studio');
  try {
    const helper = await extPage(context);
    const wallpaper = await helper.evaluate(async () => {
      const cv = new OffscreenCanvas(320, 200); const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 320, 200); gr.addColorStop(0, '#ff3366'); gr.addColorStop(1, '#3366ff'); g.fillStyle = gr; g.fillRect(0, 0, 320, 200);
      const b = new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x);
      return `data:image/png;base64,${btoa(s)}`;
    });
    await helper.close();
    const custom = { id: 'custom-live', name: 'Live custom', bg: '#102030', surface: '#1d2b3a', surface2: '#26384a', text: '#f2f6fa', muted: '#b4c2d0', accent: '#7cc4ff', border: '#3b5168', codeBg: '#0e1822',
      gradientTo: '#203a50', gradientThird: '#301a40', gradientAngle: 90, backgroundMode: 'image', wallpaper, wallpaperOpacity: 70, wallpaperBlur: 4, codeFontSize: 17, layout: 'standard', radius: 6 };
    const gh = await context.newPage(); ctx.pages.push(gh);
    await gh.setViewportSize({ width: 1600, height: 900 }); // wide enough for "wide" to differ from GitHub's 1280px container
    await L.gotoLive(gh, `https://github.com/${A}`);
    const container = () => gh.evaluate(() => { const el = document.querySelector('.container-xl, .container-lg'); return el ? { sel: el.className.split(' ').find(c => c.startsWith('container')), width: Math.round(el.getBoundingClientRect().width), max: getComputedStyle(el).maxWidth } : null; });
    const nativeContainer = await container();
    await setConfig(context, { enabled: true, defaultThemeId: 'custom-live', customThemes: { 'custom-live': custom } });
    await waitTheme(gh, custom.surface);
    let s = await L.themeState(gh);
    c.check(s.surface === custom.surface && s.bodyColor === hexToRgb(custom.text), 'Repository overview', `custom colors applied: surface ${s.surface}, text ${s.bodyColor}, accent ${s.accent}`);
    c.check(/^url\("data:image\/png/.test(s.wallpaperVar) && /^blur\(4px\)/.test(s.wallpaperFilter), 'Repository overview', `legacy inline wallpaper layer present with blur: ${s.wallpaperVar.slice(0, 25)} ${s.wallpaperFilter}`);
    const standard = await container();
    c.check(!nativeContainer || standard?.max === nativeContainer.max, 'Layout: standard', `standard layout keeps GitHub's container width (native ${JSON.stringify(nativeContainer)}, themed ${JSON.stringify(standard)})`);
    await setConfig(context, { enabled: true, defaultThemeId: 'custom-live', customThemes: { 'custom-live': { ...custom, layout: 'wide' } } });
    await gh.waitForTimeout(500);
    const wide = await container();
    if (nativeContainer) c.check(wide.width > nativeContainer.width, 'Layout: wide (1600px viewport)', `wide layout widens ${wide.sel}: ${nativeContainer.width}px → ${wide.width}px`);
    else c.info('Layout: wide', 'no .container-xl/.container-lg on the live overview page; wide layout not measurable here');
    await L.shot(gh, 'custom-overview');

    await gh.setViewportSize({ width: 1280, height: 800 });
    await L.gotoLive(gh, `https://github.com/${A}/blob/main/action.yml`);
    const code = await gh.evaluate(() => {
      const q = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontSize : null; };
      return { codeText: q('.react-code-text'), codeLine: q('.react-code-line, .react-file-line'), textarea: q('#read-only-cursor-text-area'), blobCode: q('.blob-code') };
    });
    c.check(code.codeText === '17px' || code.blobCode === '17px', 'Code browsing (file view)', `code font size applied to live code view: ${JSON.stringify(code)}`);
    c.check(code.textarea === null || code.textarea === (code.codeText || code.blobCode), 'Code browsing (file view)', `cursor/selection textarea font matches code lines (${code.textarea ?? 'textarea not present'})`);
    await L.shot(gh, 'custom-code');

    // Studio live preview + save on the real page.
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    await gh.goto(`https://github.com/${A}`); await L.settle(gh);
    const finder = await extPage(context);
    const tabId = await finder.evaluate(() => chrome.tabs.query({ url: 'https://github.com/*' }).then(t => t[0].id));
    await finder.close();
    const studio = await extPage(context, `studio.html?target=${tabId}`); ctx.pages.push(studio);
    await studio.waitForFunction(() => document.getElementById('previewState').textContent.includes('connected'), null, { timeout: 10000 });
    c.check((await studio.textContent('#targetLabel')) === A, 'Studio', `Studio targets the real repository: ${await studio.textContent('#targetLabel')}`);
    await studio.click('.gallery-card >> text=Galaxy');
    await waitTheme(gh, T.galaxy.surface);
    c.check(themed(await L.themeState(gh), T.galaxy), 'Studio', 'live preview applies Galaxy to the real page before saving');
    await studio.click('#saveButton');
    await studio.close();
    await gh.reload(); await L.settle(gh);
    c.check(themed(await L.themeState(gh), T.galaxy), 'Studio', 'saved theme persists after reload');
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

/* ---------------------------------------------------------------- Phase 1B */
const { visualContrast, diffRatio, openStudioFor, sceneMetrics } = require('../e2e/helpers');
const os = require('node:os');
const VIVID = { id: 'preset-18', surface: '#4c294a', text: '#fff1f1', bg: '#301b32' }; // Sunset Boulevard (village artwork)

L.liveTest('LIVE 6: wallpapers are visibly rendered on real GitHub pages (bundled + IndexedDB), readable, menus opaque', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'light' });
  const errors = L.watchErrors(context);
  const c = checker('Wallpaper visibility (pixels)');
  try {
    const page = await context.newPage(); ctx.pages.push(page);
    await page.setViewportSize({ width: 1600, height: 1000 }); // typical desktop: artwork in margins + behind glass
    for (const [name, url] of PAGES.filter(([n]) => ['Repository overview', 'Issues', 'Code browsing (file view)', 'Pull requests'].includes(n))) {
      await setConfig(context, { enabled: true, defaultThemeId: 'native' });
      const response = await L.gotoLive(page, url);
      const ev = await L.liveEvidence(page, response, new URL(url).pathname, A);
      c.check(ev.ok, name, `real github.com evidence: ${ev.detail}`);
      const nativeContrast = await visualContrast(context, page);
      if (name === 'Repository overview') await L.logShot(context, page, 'before-native-overview');
      await setConfig(context, { enabled: true, defaultThemeId: 'custom-flat', customThemes: { 'custom-flat': { id: 'custom-flat', name: 'flat', bg: VIVID.bg, surface: VIVID.surface, text: VIVID.text, muted: '#d5b0c7', accent: '#ff9d82', border: '#7d4d73', backgroundMode: 'solid' } } });
      await waitTheme(page, VIVID.surface); await L.settleAnimations(page);
      const flat = await page.screenshot();
      await setConfig(context, { enabled: true, defaultThemeId: VIVID.id });
      await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('sunset-village.webp'), null, { timeout: 8000 }).catch(() => {});
      await page.waitForFunction(() => { const u = getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').match(/url\("([^"]+)"\)/); if (!u) return false; const i = new Image(); i.src = u[1]; return i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
      await L.settleAnimations(page); await page.waitForTimeout(300);
      const art = await page.screenshot();
      const changed = await diffRatio(context, flat, art);
      c.check(changed > 0.15, name, `bundled wallpaper visibly rendered (chrome-extension:// image allowed by GitHub CSP): ${(changed * 100).toFixed(1)}% of pixels differ from the same theme without artwork`);
      const vc = await visualContrast(context, page);
      const okC = vc.below3.length <= nativeContrast.below3.length + 2 && vc.p10 >= 4.5;
      c.check(okC, name, `screenshot-measured text contrast over wallpaper: min ${vc.min.toFixed(2)}, p10 ${vc.p10.toFixed(2)}, median ${vc.median.toFixed(2)} across ${vc.count} elements; <3:1 ${vc.below3.length} (native ${nativeContrast.below3.length})${vc.below3.length ? ` e.g. ${vc.below3.slice(0, 4).map(x => `"${x.text}" ${x.ratio.toFixed(2)}`).join('; ')}` : ''}`);
      await L.logShot(context, page, `after-sunset-${name}`);
    }
    // Screenshot evidence of the 3D cinematic themes on the real site (logged to the job log, 1600px desktop width).
    for (const [id, slug, label] of [['preset-1', 'neon-city-3d', 'cyberpunk-3d'], ['preset-19', 'cosmic-galaxy', 'galaxy-3d'], ['preset-17', 'aurora-fjord', 'aurora-3d']]) {
      await setConfig(context, { enabled: true, defaultThemeId: id });
      for (const [pageName, url] of [['overview', `https://github.com/${A}`], ['issues', `https://github.com/${A}/issues`]]) {
        const response = await L.gotoLive(page, url);
        const ev = await L.liveEvidence(page, response, new URL(url).pathname, A);
        await page.waitForFunction(s => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(`${s}.webp`), slug, { timeout: 8000 }).catch(() => {});
        await L.settleAnimations(page); await page.waitForTimeout(400);
        const vc = await visualContrast(context, page);
        c.check(ev.ok && vc.below3.length === 0, `3D theme ${slug} · ${pageName}`, `3D wallpaper on real github.com: evidence ${ev.ok ? 'ok' : 'FAILED'}; screenshot contrast min ${vc.min.toFixed(2)}, p10 ${vc.p10.toFixed(2)}, <3:1 ${vc.below3.length}`);
        await L.logShot(context, page, `${label}-${pageName}`);
      }
    }
    // Opaque floating UI on the real page: open the repository "Code" menu (available logged out).
    await setConfig(context, { enabled: true, defaultThemeId: VIVID.id });
    await L.gotoLive(page, `https://github.com/${A}`);
    await waitTheme(page, VIVID.surface);
    const codeButton = page.locator('button:has-text("Code")').filter({ has: page.locator('svg') }).first();
    if (await codeButton.count()) {
      await codeButton.click().catch(() => {});
      await page.waitForTimeout(800);
      const menu = await page.evaluate(() => {
        const el = [...document.querySelectorAll('[role="dialog"], .Overlay, [role="menu"], [popover]')].find(e => e.getBoundingClientRect().height > 40 && getComputedStyle(e).visibility === 'visible');
        if (!el) return null;
        const bg = getComputedStyle(el).backgroundColor; return { bg, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40) };
      });
      if (menu) c.check(/^rgb\(/.test(menu.bg), 'Code menu (overlay)', `floating menu is opaque over the wallpaper: ${menu.tag}.${menu.cls} background ${menu.bg}`);
      else c.info('Code menu (overlay)', 'menu did not open logged out; not measured');
      await L.logShot(context, page, 'after-sunset-code-menu');
      await page.keyboard.press('Escape').catch(() => {});
    } else c.info('Code menu (overlay)', 'Code button not found; not measured');
    // IndexedDB wallpaper uploaded in the Studio renders on the real page.
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    await page.goto(`https://github.com/${A}`); await L.settle(page);
    const studio = await openStudioFor(context, page); ctx.pages.push(studio);
    const file = path.join(L.OUT, 'live-upload.jpg');
    const b64 = await studio.evaluate(async () => { const cv = new OffscreenCanvas(1920, 1080); const g = cv.getContext('2d'); const gr = g.createRadialGradient(960, 540, 50, 960, 540, 900); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(1, '#14532d'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); const b = new Uint8Array(await (await cv.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); });
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    await studio.click('.sidebar-link[data-view="background"]');
    const before = await page.screenshot();
    await studio.setInputFiles('#wallpaperInput', file);
    await studio.waitForSelector('.wallpaper-tile.uploaded.selected', { timeout: 20000 });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('data:image/webp'), null, { timeout: 10000 }).catch(() => {});
    await L.settleAnimations(page); await page.waitForTimeout(400);
    const idbChanged = await diffRatio(context, before, await page.screenshot());
    c.check(idbChanged > 0.15, 'IndexedDB wallpaper', `uploaded wallpaper (IndexedDB → service worker → data: URL) visibly rendered on github.com: ${(idbChanged * 100).toFixed(1)}% of pixels changed`);
    await studio.click('#saveButton'); await studio.close();
    await page.reload(); await L.settle(page);
    const persisted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('data:image/webp'));
    c.check(persisted, 'IndexedDB wallpaper', 'saved IndexedDB wallpaper is applied again after reload');
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 7: automatic per-repository themes on real repositories, SPA navigation, manual override, browser restart', async (t, ctx) => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'repovibe-live-restart-'));
  const c = checker('Automatic themes (real repos)');
  const surfaces = {};
  try {
    {
      const { context, close } = await launch({ fixture: false, colorScheme: 'dark', userDataDir: profile });
      const errors = L.watchErrors(context);
      try {
        const page = await context.newPage(); ctx.pages.push(page);
        for (const repo of ['actions/checkout', 'actions/setup-node', 'octocat/Hello-World']) {
          await L.gotoLive(page, `https://github.com/${repo}`); // fresh install: no settings at all
          await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'), null, { timeout: 8000 }).catch(() => {});
          const s = await L.themeState(page);
          surfaces[repo] = s.surface;
          c.check(s.active && !!s.surface && !!s.wallpaperVar, repo, `automatic theme applied on first visit (surface ${s.surface}, wallpaper ${s.wallpaperVar.slice(0, 40)})`);
          if (repo === 'actions/checkout') await L.logShot(context, page, 'auto-actions-checkout');
          if (repo === 'octocat/Hello-World') await L.logShot(context, page, 'auto-octocat-hello-world');
        }
        c.check(surfaces['actions/checkout'] !== surfaces['actions/setup-node'], 'actions/*', `two repositories of the same owner get different themes (${surfaces['actions/checkout']} vs ${surfaces['actions/setup-node']})`);
        const cfg = await getConfig(context);
        c.check(['actions/checkout', 'actions/setup-node', 'octocat/hello-world'].every(k => cfg.autoAssignments[k]) && ['actions/checkout', 'actions/setup-node', 'octocat/hello-world'].every(k => !Object.hasOwn(cfg.repoAssignments, k)), 'Storage', `automatic picks persisted separately from manual choices: auto ${JSON.stringify(cfg.autoAssignments)}; manual ${JSON.stringify(cfg.repoAssignments)} (fresh installs hold only the four seeded default mappings)`);
        // SPA navigation between repository tabs keeps the repo's automatic theme.
        await L.gotoLive(page, `https://github.com/${A}`);
        const issues = page.locator(`#issues-tab, nav[aria-label="Repository"] a[href="/${A}/issues"]`).first();
        if (await issues.count()) {
          await issues.click(); await page.waitForURL(u => /\/issues\/?$/.test(new URL(u).pathname), { timeout: 20000 }).catch(() => {}); await L.settle(page, 1000);
          c.check((await L.themeState(page)).surface === surfaces[A], 'Client-side navigation', 'automatic theme kept after navigating to Issues');
        }
        // Manual override via the popup wins and survives.
        const popup = await extPage(context); await popup.setViewportSize({ width: 384, height: 640 });
        await page.bringToFront(); await popup.reload(); await popup.waitForSelector('.theme-tile');
        await popup.locator('.theme-tile').nth(1).click();
        await popup.waitForFunction(() => /Manually assigned/.test(document.getElementById('scopeInfo').textContent), null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        const manual = (await L.themeState(page)).surface;
        c.check(manual !== surfaces[A] && (await getConfig(context)).repoAssignments[A], 'Manual override', `popup choice overrides the automatic theme (${surfaces[A]} → ${manual})`);
        surfaces.manual = manual;
        await popup.close();
        c.check(errors.extension.length === 0, 'Console', `RepoVibe-attributed errors: ${errors.extension.length}${errors.extension.length ? ` → ${errors.extension.slice(0, 2).join(' | ')}` : ''}`);
      } finally { await close(); }
    }
    {
      const { context, close } = await launch({ fixture: false, colorScheme: 'dark', userDataDir: profile }); // browser restart
      try {
        const page = await context.newPage(); ctx.pages.push(page);
        await L.gotoLive(page, 'https://github.com/actions/setup-node');
        await page.waitForTimeout(500);
        c.check((await L.themeState(page)).surface === surfaces['actions/setup-node'], 'Browser restart', 'automatic theme identical after restarting the browser');
        await L.gotoLive(page, `https://github.com/${A}`);
        await page.waitForTimeout(500);
        c.check((await L.themeState(page)).surface === surfaces.manual, 'Browser restart', 'manual override still applied after restart (never overwritten by automatic)');
      } finally { await close(); }
    }
    c.done();
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
});

const FLAGSHIPS = [
  ['naman-dev-00/tradPro', 'preset-1', 'neon-city-3d', 'rain', 'cyberpunk-neon'],
  ['naman-dev-00/RepoVibe', 'preset-8', 'enchanted-forest', 'fireflies', 'enchanted-forest'],
  ['naman-dev-00/Pool-Souls', 'preset-19', 'cosmic-galaxy', 'stars', 'cosmic-galaxy'],
  ['naman-dev-00/ai-powered-inbox-assistant', 'preset-15', 'scifi-ai', 'holo', 'futuristic-scifi']
];
const freeze = page => page.evaluate(() => document.getAnimations().forEach(a => { if (a.animationName) { a.pause(); a.currentTime = 1500; } })).catch(() => {});
L.liveTest('LIVE 8: four flagship worlds with live wallpapers on real pages; default mappings; logged-out Home untouched', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  const errors = L.watchErrors(context);
  const c = checker('Flagship worlds');
  try {
    const p = await extPage(context);
    const seededOk = await p.waitForFunction(() => chrome.storage.local.get('repovibe.v1').then(o => o['repovibe.v1']?.seededMappings === true), null, { timeout: 10000 }).then(() => true, () => false);
    await p.close();
    const cfg = await getConfig(context);
    c.check(seededOk && FLAGSHIPS.every(([r, id]) => cfg.repoAssignments[r.toLowerCase()] === id), 'Default mappings', `fresh install seeds the four repository mappings: ${FLAGSHIPS.map(([r]) => `${r}→${cfg.repoAssignments[r.toLowerCase()]}`).join(', ')}; motion mode ${cfg.motionMode}`);
    const page = await context.newPage(); ctx.pages.push(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    // 1. The mapped repositories themselves (only if publicly visible: the suite never signs in).
    for (const [repo, id, slug, motion, label] of FLAGSHIPS) {
      const response = await page.goto(`https://github.com/${repo}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
      if (!response || response.status() === 404) { c.info(`${repo}`, `not publicly visible (HTTP ${response ? response.status() : 'n/a'}; private or nonexistent) — live UNVERIFIED for this repository; the same theme is verified on a public repository below and offline`); continue; }
      await L.gotoLive(page, `https://github.com/${repo}`);
      await page.waitForFunction(s => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(`${s}.webp`), slug, { timeout: 8000 }).catch(() => {});
      const cls = await page.evaluate(() => document.documentElement.className);
      await freeze(page); await page.waitForTimeout(400);
      const vc = await visualContrast(context, page);
      c.check(cls.includes(`repv-motion-${motion}`) && vc.below3.length === 0, `${repo}`, `mapped world ${id} (${slug}) with live layer ${motion}: classes "${cls}"; contrast min ${vc.min.toFixed(2)}, p10 ${vc.p10.toFixed(2)}, <3:1 ${vc.below3.length}`);
      await L.logShot(context, page, `flagship-own-${label}`);
    }
    // 2. Each world on the same real public repository (overview + issues) — visible art, live layer, readable, links clickable.
    for (const [, id, slug, motion, label] of FLAGSHIPS) {
      await setConfig(context, { version: 2, enabled: true, autoAssign: false, motionMode: 'ambient', seededMappings: true, defaultThemeId: 'native', repoAssignments: { [A.toLowerCase()]: id } });
      for (const [pageName, url] of [['overview', `https://github.com/${A}`], ['issues', `https://github.com/${A}/issues`]]) {
        const response = await L.gotoLive(page, url);
        const ev = await L.liveEvidence(page, response, new URL(url).pathname, A);
        await page.waitForFunction(s => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(`${s}.webp`), slug, { timeout: 8000 }).catch(() => {});
        const st = await page.evaluate(() => ({ cls: document.documentElement.className, anims: document.getAnimations().filter(a => /^repv-/.test(a.animationName || '') && a.playState === 'running').map(a => a.animationName),
          layers: [getComputedStyle(document.documentElement, '::after'), getComputedStyle(document.body, '::after')].map(s => s.pointerEvents) }));
        await freeze(page); await page.waitForTimeout(400);
        const vc = await visualContrast(context, page);
        const link = await page.evaluate(() => { const a = [...document.querySelectorAll('main a[href]')].find(x => { const r = x.getBoundingClientRect(); return r.width > 20 && r.top > 80 && r.bottom < innerHeight; }); if (!a) return null; const r = a.getClientRects()[0]; return document.elementFromPoint(r.left + 3, r.top + r.height / 2)?.closest('a') === a; });
        c.check(ev.ok && st.cls.includes(`repv-motion-${motion}`) && st.anims.length > 0 && st.layers.every(v => v === 'none') && vc.below3.length === 0 && link !== false, `${label} · ${pageName}`,
          `evidence ${ev.ok ? 'ok' : 'FAILED'}; live layer ${motion} running (${[...new Set(st.anims)].join(', ')}), pointer-events ${st.layers.join('/')}; contrast min ${vc.min.toFixed(2)}, p10 ${vc.p10.toFixed(2)}, <3:1 ${vc.below3.length}; link hit-test ${link}`);
        await L.logShot(context, page, `flagship-${label}-${pageName}`);
      }
    }
    // 3. Reduced motion and Static mode on the real page.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    // Only RepoVibe's own keyframes count: GitHub runs its own CSS animations (e.g. prc-UnderlineNav-detect-overflow).
    const rm = await page.evaluate(() => ({ cls: [...document.documentElement.classList].filter(c => c.startsWith('repv-motion')), anims: document.getAnimations().map(a => a.animationName).filter(n => /^repv-/.test(n || '')) }));
    c.check(rm.cls.length === 0 && rm.anims.length === 0, 'Reduced motion', `prefers-reduced-motion: RepoVibe motion classes [${rm.cls}] and animations [${rm.anims}] (both must be empty)`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await setConfig(context, { version: 2, enabled: true, autoAssign: false, motionMode: 'static', seededMappings: true, defaultThemeId: 'native', repoAssignments: { [A.toLowerCase()]: 'preset-1' } });
    await page.waitForTimeout(500);
    c.check(await page.evaluate(() => !document.documentElement.className.includes('repv-motion') && getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('neon-city-3d')), 'Static mode', 'Static: wallpaper kept, motion removed');
    // 4. Logged-out Home (marketing page): the Top repositories feature must be a safe no-op.
    await L.gotoLive(page, 'https://github.com/');
    await page.waitForTimeout(800);
    const home = await page.evaluate(() => ({ cards: document.querySelectorAll('[data-repv-card]').length, style: !!document.getElementById('repovibe-cards-v1'), top: /top repositories/i.test(document.body.innerText) }));
    c.check(home.cards === 0 && !home.style, 'Home (logged out)', `no Top repositories list logged out (${home.top ? 'heading found' : 'absent'}); RepoVibe added ${home.cards} card attributes and ${home.style ? 'a' : 'no'} card stylesheet`);
    c.info('Home (signed in)', 'Themed Top repositories cards on the signed-in dashboard are UNVERIFIED live: the suite never signs in or uses credentials. Covered by the authenticated-page fixture (tests/e2e/flagship.e2e.js).');
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

/* LIVE 9 — P0 regression "wallpapers invisible on real GitHub". Real github.com (logged out), Code / Issues / Pull requests,
   1366×768 and 1920×1080, each flagship world: scene visible and recognisable (luminance-structure correlation with the
   wallpaper itself, unobstructed area, single glass layer), compared with the same theme in solid colour, text at
   WCAG AA (screenshot-measured, never below native GitHub), diagnostic configuration, live motion over the scene. */
L.liveTest('LIVE 9: the four scenes are visible and recognisable on real repository pages; text stays AA', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  const errors = L.watchErrors(context);
  const c = checker('Scene visibility');
  const pages = [['code', `https://github.com/${A}`], ['issues', `https://github.com/${A}/issues`], ['pulls', `https://github.com/${A}/pulls`]];
  try {
    const page = await context.newPage(); ctx.pages.push(page);
    const presetOf = async id => { const p = await extPage(context); const v = await p.evaluate(i => RepoVibeCore.PRESETS.find(x => x.id === i), id); await p.close(); return v; };
    const native = {};
    await setConfig(context, { enabled: true, defaultThemeId: 'native', motionMode: 'static' });
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [name, url] of pages) { await L.gotoLive(page, url); await L.settleAnimations(page); native[name] = await visualContrast(context, page, 300); }
    for (const [, id, slug, motion, label] of FLAGSHIPS) {
      const preset = await presetOf(id);
      for (const [w, h] of [[1366, 768], [1920, 1080]]) {
        await page.setViewportSize({ width: w, height: h });
        for (const [name, url] of pages) {
          if (w === 1920 && name !== 'code' && label !== 'cosmic-galaxy' && label !== 'enchanted-forest') continue; // bound runtime: 1920 = all code pages + 2 worlds on lists
          await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-solid', customThemes: { 'custom-solid': { ...preset, id: 'custom-solid', backgroundMode: 'solid' } } });
          await L.gotoLive(page, url); await L.settleAnimations(page); await page.waitForTimeout(300);
          const solid = await page.screenshot();
          await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: id });
          const response = await L.gotoLive(page, url);
          const ev = await L.liveEvidence(page, response, new URL(url).pathname, A);
          await page.waitForFunction(s => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(`${s}.webp`), slug, { timeout: 8000 }).catch(() => {});
          await page.waitForFunction(() => document.querySelectorAll('[data-repv-panel]').length > 0, null, { timeout: 5000 }).catch(() => {});
          await L.settleAnimations(page); await page.waitForTimeout(500);
          const art = await page.screenshot();
          const changed = await diffRatio(context, solid, art);
          const m = await sceneMetrics(context, page);
          const vc = await visualContrast(context, page, 300);
          const nat = native[name];
          const okText = vc.below3.length === 0 && (vc.below45 === 0 || vc.below45 <= nat.below45);
          c.check(ev.ok && m.correlation >= 0.25 && m.clear >= 0.1 && m.median >= 0.3 && changed >= 0.1 && okText, `${label} · ${name} · ${w}×${h}`,
            `scene: correlation with the wallpaper ${m.correlation.toFixed(2)} (pre-fix renderer −0.03…0.50), unobstructed ${(m.clear * 100).toFixed(0)}% of viewport (pre-fix 0%), median transmission ${m.median.toFixed(2)}; ${(changed * 100).toFixed(1)}% of pixels differ from the same theme in solid colour; text min ${vc.min.toFixed(2)}, <4.5:1 ${vc.below45} (native ${nat.below45}), <3:1 ${vc.below3.length}${vc.low.length ? ` e.g. ${vc.low.slice(0, 3).map(x => `"${x.text}" ${x.ratio.toFixed(2)}`).join('; ')}` : ''}`);
          if (name === 'code' || w === 1366) await L.logShot(context, page, `scene-${label}-${name}-${w}`);
        }
      }
      // Diagnostic configuration (opacity 100 %, brightness 100 %, blur 0, overlay 0) on the Code page.
      await page.setViewportSize({ width: 1366, height: 768 });
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-diag', customThemes: { 'custom-diag': { ...preset, id: 'custom-diag', wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperBlur: 0, wallpaperOverlay: 0 } } });
      await L.gotoLive(page, `https://github.com/${A}`); await L.settleAnimations(page); await page.waitForTimeout(500);
      const d = await sceneMetrics(context, page);
      c.check(d.correlation >= 0.3 && d.clear >= 0.1, `${label} · diagnostic config`, `opacity 100 / brightness 100 / blur 0 / overlay 0: correlation ${d.correlation.toFixed(2)}, unobstructed ${(d.clear * 100).toFixed(0)}%`);
      // Live motion over the visible scene (after static visibility).
      await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id });
      await L.gotoLive(page, `https://github.com/${A}`); await page.waitForTimeout(600);
      const mv = await page.evaluate(() => ({ cls: document.documentElement.className, anims: [...new Set(document.getAnimations().map(a => a.animationName).filter(n => /^repv-/.test(n || '')))] }));
      c.check(mv.cls.includes(`repv-motion-${motion}`) && mv.anims.length > 0, `${label} · live layer`, `ambient ${motion}: ${mv.anims.join(', ')}`);
    }
    // Disabling restores GitHub: no RepoVibe classes, styles or panel markers remain.
    await setConfig(context, { enabled: false, defaultThemeId: 'preset-8' });
    await L.gotoLive(page, `https://github.com/${A}`); await page.waitForTimeout(500);
    const left = await page.evaluate(() => ({ cls: [...document.documentElement.classList].filter(x => x.startsWith('repv')), styles: document.querySelectorAll('[id^="repovibe-"]').length, panels: document.querySelectorAll('[data-repv-panel]').length, bg: getComputedStyle(document.documentElement).backgroundImage }));
    c.check(!left.cls.length && !left.styles && !left.panels && !/url\(/.test(left.bg), 'Disable', `after disabling: classes [${left.cls}], styles ${left.styles}, panel markers ${left.panels}, root image ${/url\(/.test(left.bg) ? 'present' : 'none'}`);
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});
