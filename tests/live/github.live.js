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
const themed = (s, t) => s.active && s.style && s.bgDefault === t.surface && s.bodyColor === hexToRgb(t.text);
const waitTheme = (page, surface) => page.waitForFunction(v => getComputedStyle(document.documentElement).getPropertyValue('--bgColor-default').trim() === v, surface, { timeout: 8000 }).catch(() => {});
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
      c.check(themed(s, T.cyber), name, `Cyberpunk applied: --bgColor-default ${s.bgDefault}, body color ${s.bodyColor}, gradient ${s.htmlBgImage.slice(0, 30)}`);
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
      c.check(themed(s, T.arctic), name, `Arctic Frost (light) applied on dark GitHub: --bgColor-default ${s.bgDefault}, body ${s.bodyColor}`);
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
    c.check(s.bgDefault === custom.surface && s.bodyColor === hexToRgb(custom.text), 'Repository overview', `custom colors applied: surface ${s.bgDefault}, text ${s.bodyColor}, accent ${s.accent}`);
    c.check(/linear-gradient/.test(s.htmlBgImage), 'Repository overview', `gradient background on <html>: ${s.htmlBgImage.slice(0, 45)}`);
    c.check(/^url\("data:image\/png/.test(s.wallpaper) && s.wallpaperFilter === 'blur(4px)', 'Repository overview', `wallpaper layer present with blur: ${s.wallpaper.slice(0, 25)} ${s.wallpaperFilter}`);
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
