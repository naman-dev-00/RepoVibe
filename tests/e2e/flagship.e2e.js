'use strict';
/* Focused Phase 1B E2E: four flagship worlds, default repository mappings, live wallpapers, and themed
   "Top repositories" cards on the signed-in GitHub Home dashboard.
   Uses OFFLINE fixtures (tests/e2e/fixture.html, fixture-home.html) in real Chromium with the unpacked extension.
   The Home fixture mirrors the authenticated dashboard markup; real logged-in GitHub visuals are UNVERIFIED. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { HOME_REPOS, launch, extPage, setConfig, getConfig, diffRatio, visualContrast } = require('./helpers');

const SHOTS = path.join(__dirname, '../../docs/screenshots/flagship');
fs.mkdirSync(SHOTS, { recursive: true });
const FLAGSHIP = [
  ['naman-dev-00/tradPro', 'preset-1', 'neon-city-3d', 'rain', 'cyberpunk-neon'],
  ['naman-dev-00/RepoVibe', 'preset-8', 'enchanted-forest', 'fireflies', 'enchanted-forest'],
  ['naman-dev-00/Pool-Souls', 'preset-19', 'cosmic-galaxy', 'stars', 'cosmic-galaxy'],
  ['naman-dev-00/ai-powered-inbox-assistant', 'preset-15', 'scifi-ai', 'holo', 'futuristic-scifi']
];
const seeded = context => extPage(context).then(async p => {
  await p.waitForFunction(() => chrome.storage.local.get('repovibe.v1').then(o => o['repovibe.v1']?.seededMappings === true), null, { timeout: 10000 });
  await p.close();
});
const cards = page => page.$$eval('#topRepos li', lis => lis.map(li => ({
  name: li.querySelector('.markdown-title')?.textContent, theme: li.getAttribute('data-repv-card'),
  image: getComputedStyle(li).backgroundImage, href: li.querySelector('.markdown-title')?.getAttribute('href')
})));
async function openHome(context, size = { width: 1400, height: 860 }) {
  const page = await context.newPage();
  await page.setViewportSize(size);
  await page.goto('https://github.com/');
  return page;
}
const updateConfig = (context, fnSource) => extPage(context).then(async p => {
  await p.waitForFunction(() => !!globalThis.RepoVibeCore);
  await p.evaluate(src => RepoVibeCore.updateConfig(new Function('c', src)), fnSource);
  await p.close();
});

test('fresh install: the four default mappings are seeded and each repository renders its own 3D world with its live layer', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await seeded(context);
    const config = await getConfig(context);
    for (const [repo, id] of FLAGSHIP) assert.equal(config.repoAssignments[repo.toLowerCase()], id, `${repo} mapped`);
    assert.equal(config.motionMode, 'ambient', 'Ambient is the default motion mode');
    const page = await context.newPage();
    await page.setViewportSize({ width: 1600, height: 900 });
    const seen = new Set();
    for (const [repo, id, slug, motion, label] of FLAGSHIP) {
      await page.goto(`https://github.com/${repo}`);
      await page.waitForFunction(s => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(`${s}.webp`), slug);
      const s = await page.evaluate(() => ({ cls: document.documentElement.className, panel: getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim(),
        anim: getComputedStyle(document.documentElement, '::after').animationName, layer: getComputedStyle(document.body, '::before').backgroundImage }));
      assert.ok(s.cls.includes(`repv-motion-${motion}`), `${repo}: live layer ${motion} (${s.cls})`);
      assert.notEqual(s.anim, 'none', `${repo}: ambient layer animates`);
      assert.ok(s.layer.includes(`${slug}.webp`), `${repo}: wallpaper layer`);
      seen.add(`${slug}|${s.panel}`);
      await page.reload(); // persistence across refresh
      await page.waitForFunction(s => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes(`${s}.webp`), slug);
      await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 1500; })); // deterministic frame
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOTS, `repo-${label}.jpg`), type: 'jpeg', quality: 82 });
      // readability over the art: no text element below 3:1 on the rendered page
      const contrast = await visualContrast(context, page);
      assert.equal(contrast.below3.length, 0, `${repo}: low-contrast text ${JSON.stringify(contrast.below3)}`);
      // links stay clickable through the wallpaper/motion layers
      const hit = await page.evaluate(() => { const a = document.querySelector('#toOther'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + 5, r.top + r.height / 2) === a; });
      assert.ok(hit, `${repo}: link is the hit target`);
      assert.ok(!(await page.evaluate(() => document.querySelector('#repovibe-ambient'))), 'motion uses pseudo-elements only (no injected DOM)');
    }
    assert.equal(seen.size, 4, 'four distinct worlds');
    // an unconfigured repository still gets an automatic theme; manual mappings are unaffected by it
    await page.goto('https://github.com/someone/unrelated');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    const after = await getConfig(context);
    assert.ok(after.autoAssignments['someone/unrelated'], 'automatic theme persisted for the unconfigured repository');
    for (const [repo, id] of FLAGSHIP) assert.equal(after.repoAssignments[repo.toLowerCase()], id);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('live wallpapers: Static / Ambient / Cinematic, prefers-reduced-motion, persistence, never blocks input', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1', motionMode: 'ambient' });
    const page = await context.newPage();
    await page.goto('https://github.com/acme/project');
    const cls = () => page.evaluate(() => [...document.documentElement.classList].filter(c => c.startsWith('repv-motion')).sort().join(' '));
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-rain'));
    assert.equal(await cls(), 'repv-motion-rain');
    const animations = await page.evaluate(() => document.getAnimations().filter(a => a.animationName).map(a => a.animationName).sort());
    assert.ok(animations.includes('repv-rain') && animations.includes('repv-flicker'), animations.join());
    // Only compositor-friendly properties are animated.
    const props = await page.evaluate(() => [...new Set(document.getAnimations().filter(a => a.animationName).flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))].sort());
    assert.deepEqual(props, ['opacity', 'transform']);
    await updateConfig(context, "c.motionMode = 'cinematic';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-cinematic'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::before').animationName), 'repv-parallax', 'cinematic adds slow parallax');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-cinematic'));
    assert.equal(await cls(), 'repv-motion-cinematic repv-motion-rain', 'mode persists across refresh');
    await updateConfig(context, "c.motionMode = 'static';");
    await page.waitForFunction(() => !document.documentElement.className.includes('repv-motion'));
    assert.deepEqual(await page.evaluate(() => document.getAnimations().filter(a => a.animationName).map(a => a.animationName)), [], 'Static: no animations');
    assert.ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('neon-city-3d')), 'wallpaper itself stays');
    await updateConfig(context, "c.motionMode = 'ambient';");
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-rain'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.documentElement.className.includes('repv-motion'));
    assert.deepEqual(await page.evaluate(() => document.getAnimations().filter(a => a.animationName).map(a => a.animationName)), [], 'reduced motion: nothing moves');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-motion-rain'));
    // never blocks interaction: the layers are pointer-events:none and below content
    const layers = await page.evaluate(() => [getComputedStyle(document.documentElement, '::after'), getComputedStyle(document.body, '::after')].map(s => [s.pointerEvents, s.zIndex, s.position]));
    assert.deepEqual(layers, [['none', '-1', 'fixed'], ['none', '-1', 'fixed']]);
    await page.click('#toOther');
    await page.waitForURL(/acme\/other$/);
    // non-flagship theme: no live layer; disabling removes everything
    await updateConfig(context, "c.defaultThemeId = 'preset-2';");
    await page.waitForFunction(() => !document.documentElement.className.includes('repv-motion'));
    await updateConfig(context, "c.defaultThemeId = 'preset-19'; c.enabled = false;");
    await page.waitForFunction(() => !document.documentElement.className.includes('repv'));
    assert.deepEqual(await page.evaluate(() => document.getAnimations().filter(a => a.animationName).length), 0, 'no keyframe animations left');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('GitHub Home: Top repositories rows show their own themes; links, sync, dynamic rows, accessibility, restore', async () => {
  // Reference rendering without the extension (pixel baseline for "disable restores the original").
  const base = await launch({ extension: false });
  let original, originalHtml;
  try {
    const page = await openHome(base.context);
    await page.waitForSelector('#topRepos li');
    originalHtml = await page.$eval('#dashboard-repos-container', el => el.outerHTML);
    original = await page.locator('aside').screenshot();
    fs.writeFileSync(path.join(SHOTS, 'home-top-repositories-before.png'), original);
  } finally { await base.close(); }

  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await seeded(context); // fresh install: mappings seeded, automatic themes on, global theme = original GitHub
    const page = await openHome(context);
    await page.waitForFunction(n => document.querySelectorAll('li[data-repv-card]').length === n, HOME_REPOS.length);
    let rows = await cards(page);
    // 1. different rows show different themes (the four mapped worlds)
    const byName = Object.fromEntries(rows.map(r => [r.href.slice(1).toLowerCase(), r]));
    for (const [repo, id, slug] of FLAGSHIP) {
      assert.equal(byName[repo.toLowerCase()].theme, id, `${repo} card theme`);
      assert.ok(byName[repo.toLowerCase()].image.includes(`thumbs/${slug}.webp`), `${repo} card shows its own wallpaper`);
    }
    assert.equal(new Set(rows.map(r => r.theme)).size, rows.length, 'every row has its own world');
    // 4. unconfigured rows get the stable automatic theme, persisted and identical to the repository page
    const config = await getConfig(context);
    for (const repo of ['naman-dev-00/notes', 'octocat/hello-world']) {
      assert.ok(config.autoAssignments[repo], `${repo} automatic pick persisted`);
      assert.equal(byName[repo].theme, config.autoAssignments[repo]);
    }
    // the Home page itself and the feed are untouched (global theme = original GitHub)
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('repv-active')), false);
    assert.equal(await page.$$eval('.feed-main [data-repv-card], #recent [data-repv-card], .AppHeader [data-repv-card]', e => e.length), 0, 'only Top repositories rows are styled');
    // 5. names keep accessible contrast over the art
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    const contrast = await visualContrast(context, page);
    assert.equal(contrast.below3.length, 0, JSON.stringify(contrast.below3));
    const nameRatios = await (async () => {
      const list = await page.$$eval('li[data-repv-card] .markdown-title', els => els.map(e => e.textContent));
      return list;
    })();
    assert.equal(nameRatios.length, HOME_REPOS.length);
    fs.writeFileSync(path.join(SHOTS, 'home-top-repositories-after.png'), await page.locator('aside').screenshot());
    await page.screenshot({ path: path.join(SHOTS, 'home-dashboard.jpg'), type: 'jpeg', quality: 85 });
    // light colour mode (GitHub light) keeps the same per-repository cards
    // 3. updating a theme updates its preview without reload
    await updateConfig(context, "c.repoAssignments['naman-dev-00/repovibe'] = 'preset-20';");
    await page.waitForFunction(() => document.querySelector('a[href="/naman-dev-00/RepoVibe"]').closest('li').getAttribute('data-repv-card') === 'preset-20');
    assert.ok((await cards(page)).find(r => r.href === '/naman-dev-00/RepoVibe').image.includes('synthwave-3d'));
    await updateConfig(context, "c.repoAssignments['naman-dev-00/repovibe'] = 'preset-8';");
    await page.waitForFunction(() => document.querySelector('a[href="/naman-dev-00/RepoVibe"]').closest('li').getAttribute('data-repv-card') === 'preset-8');
    // dynamic rows ("Show more") are themed too
    await page.click('#showMore');
    await page.waitForFunction(n => document.querySelectorAll('li[data-repv-card]').length === n, HOME_REPOS.length + 2);
    // high contrast / forced colours: art removed, plain readable rows
    await page.emulateMedia({ forcedColors: 'active' });
    assert.equal(await page.$eval('li[data-repv-card]', li => getComputedStyle(li).backgroundImage), 'none');
    await page.emulateMedia({ forcedColors: 'none', contrast: 'more' });
    assert.equal(await page.$eval('li[data-repv-card]', li => getComputedStyle(li).backgroundImage), 'none');
    await page.emulateMedia({ contrast: 'no-preference', reducedMotion: 'reduce' });
    assert.equal(await page.$eval('li[data-repv-card]', li => getComputedStyle(li).transitionDuration), '0s', 'reduced motion: no hover animation');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // 7. disabling restores the original exactly
    await updateConfig(context, 'c.enabled = false;');
    await page.waitForFunction(() => !document.querySelector('li[data-repv-card]') && !document.getElementById('repovibe-cards-v1'));
    assert.equal(await page.$$eval('#topRepos li', lis => lis.filter(li => li.attributes.length !== 1 || getComputedStyle(li).backgroundImage !== 'none').length), 0, 'restored in place, without reload');
    await page.reload(); // drop the "Show more" rows so the DOM matches the baseline
    await page.waitForSelector('#topRepos li');
    await page.waitForTimeout(300);
    assert.equal(await page.$eval('#dashboard-repos-container', el => el.outerHTML), originalHtml, 'no attributes left behind');
    assert.equal(await page.$$eval('[data-repv-card], #repovibe-cards-v1', e => e.length), 0);
    const restored = await page.locator('aside').screenshot();
    const diff = await diffRatio(context, original, restored);
    assert.ok(diff < 0.001, `restored sidebar differs from the original by ${(diff * 100).toFixed(2)}%`);
    await updateConfig(context, 'c.enabled = true;');
    await page.waitForFunction(n => document.querySelectorAll('li[data-repv-card]').length === n, HOME_REPOS.length);
    // 2 & 6. links stay clickable; clicking opens the repository with the same theme as its card
    const link = page.locator('a.markdown-title[href="/naman-dev-00/Pool-Souls"]');
    const hitHref = await link.evaluate(a => { const r = a.getClientRects()[0]; const e = document.elementFromPoint(r.left + 4, r.top + r.height / 2); return e?.closest('a')?.getAttribute('href') || e?.outerHTML.slice(0, 120); });
    assert.equal(hitHref, '/naman-dev-00/Pool-Souls', 'name link is the hit target');
    await link.click();
    await page.waitForURL(/naman-dev-00\/Pool-Souls$/);
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-wallpaper').includes('cosmic-galaxy.webp'));
    await page.goBack();
    await page.waitForFunction(() => document.querySelectorAll('li[data-repv-card]').length > 0);
    const back = (await cards(page)).find(r => r.href === '/octocat/Hello-World').theme;
    await page.goto('https://github.com/octocat/Hello-World');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    const pageTheme = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--repv-panel').trim());
    const cfg = await getConfig(context);
    assert.equal(cfg.autoAssignments['octocat/hello-world'], back, 'card and repository page share the automatic theme');
    assert.ok(pageTheme, 'repository page themed');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('GitHub Home in light mode with a light flagship card keeps readable names', async () => {
  const { context, close } = await launch({ mode: 'light' });
  try {
    context.setDefaultTimeout(30000);
    await seeded(context);
    const page = await openHome(context);
    await page.waitForFunction(() => document.querySelectorAll('li[data-repv-card]').length >= 4);
    const sci = await page.$eval('a[href="/naman-dev-00/ai-powered-inbox-assistant"].markdown-title', a => getComputedStyle(a).color);
    assert.equal(sci, 'rgb(18, 35, 58)', 'light world uses its dark text colour');
    const contrast = await visualContrast(context, page);
    assert.equal(contrast.below3.length, 0, JSON.stringify(contrast.below3));
    fs.writeFileSync(path.join(SHOTS, 'home-top-repositories-light.png'), await page.locator('aside').screenshot());
  } finally { await close(); }
});
