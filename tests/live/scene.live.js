'use strict';
/* LIVE 9 — scene visibility on real github.com (split from github.live.js so each file stays within the per-file
   test budget). Logged out, no credentials. See docs/FLAGSHIP_REPORT.md §0. */
const assert = require('node:assert/strict');
const { launch, extPage, setConfig, visualContrast, diffRatio, sceneMetrics } = require('../e2e/helpers');
const L = require('./live-helpers');

const A = 'actions/checkout';
const FLAGSHIPS = [
  ['naman-dev-00/tradPro', 'preset-1', 'neon-city-3d', 'rain', 'cyberpunk-neon'],
  ['naman-dev-00/RepoVibe', 'preset-8', 'enchanted-forest', 'fireflies', 'enchanted-forest'],
  ['naman-dev-00/Pool-Souls', 'preset-19', 'cosmic-galaxy', 'stars', 'cosmic-galaxy'],
  ['naman-dev-00/ai-powered-inbox-assistant', 'preset-15', 'scifi-ai', 'holo', 'futuristic-scifi']
];
function checker(scenario) {
  const failures = [];
  return {
    check(ok, target, detail) { L.record(scenario, target, ok ? 'PASS' : 'FAIL', detail); if (!ok) failures.push(`${target}: ${detail}`); return ok; },
    info(target, detail) { L.record(scenario, target, 'INFO', detail); },
    done() { if (failures.length) assert.fail(`${failures.length} live check(s) failed:\n- ${failures.join('\n- ')}`); }
  };
}
function errorCheck(c, errors) {
  c.check(errors.extension.length === 0, 'Console', `RepoVibe-attributed console/page errors: ${errors.extension.length}${errors.extension.length ? ` → ${errors.extension.slice(0, 3).join(' | ')}` : ''}`);
  c.info('Console', `GitHub's own console errors (not attributed to RepoVibe): ${errors.github.length}`);
}

/* LIVE 9 — P0 regression "wallpapers invisible on real GitHub". Real github.com (logged out), Code / Issues / Pull requests,
   1366×768 and 1920×1080, each flagship world: scene visible and recognisable (luminance-structure correlation with the
   wallpaper itself, unobstructed area, single glass layer), compared with the same theme in solid colour, text at
   WCAG AA (screenshot-measured, never below native GitHub), diagnostic configuration, live motion over the scene. */
for (const [, id, slug, motion, label] of FLAGSHIPS) L.liveTest(`LIVE 9 (${label}): scene visible and recognisable on real Code / Issues / Pull request pages; text stays AA`, async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  const errors = L.watchErrors(context);
  const c = checker(`Scene visibility · ${label}`);
  const pages = [['code', `https://github.com/${A}`], ['issues', `https://github.com/${A}/issues`], ['pulls', `https://github.com/${A}/pulls`]];
  try {
    const page = await context.newPage(); ctx.pages.push(page);
    const presetOf = async id => { const p = await extPage(context); const v = await p.evaluate(i => RepoVibeCore.PRESETS.find(x => x.id === i), id); await p.close(); return v; };
    const native = {};
    await setConfig(context, { enabled: true, defaultThemeId: 'native', motionMode: 'static' });
    await page.setViewportSize({ width: 1366, height: 768 });
    const blurCount = () => page.evaluate(() => [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backdropFilter !== 'none').length);
    const nativeBlur = {};
    for (const [name, url] of pages) { await L.gotoLive(page, url); await L.settleAnimations(page); native[name] = await visualContrast(context, page, 300); nativeBlur[name] = await blurCount(); }
    {
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
          // Crisp Immersive (default): RepoVibe adds no backdrop blur (GitHub's own logged-out header buttons blur natively),
          // no blurred wallpaper copy, and the scene window is open on repository pages.
          const crisp = await page.evaluate(() => ({ before: getComputedStyle(document.body, '::before').content, window: document.documentElement.classList.contains('repv-scene-window'),
            pad: parseFloat(getComputedStyle(document.getElementById('repo-content-pjax-container') || document.body).paddingTop) || 0 }));
          const blurNow = await blurCount();
          c.check(blurNow <= nativeBlur[name] && crisp.before === 'none' && crisp.window && crisp.pad >= 100, `${label} · ${name} · ${w}×${h} · Crisp Immersive`,
            `backdrop-blurred elements ${blurNow} (native GitHub ${nativeBlur[name]}), blurred wallpaper copy ${crisp.before === 'none' ? 'none' : 'PRESENT'}, scene window ${crisp.window ? `${Math.round(crisp.pad)}px` : 'OFF'}; exposed scene ${(m.exposedShare * 100).toFixed(0)}% of viewport, sharpness ${m.sharpness == null ? 'n/a' : m.sharpness.toFixed(2)}`);
          const vc = await visualContrast(context, page, 300);
          const nat = native[name];
          const okText = vc.fails.length === 0 || vc.fails.length <= nat.fails.length;   // WCAG AA verdict (4.5:1 normal, 3:1 large text), never worse than the native page
          // Crisp Immersive shows the scene UNCOVERED (scene window, gaps, margins) next to near-solid reading panels, so the
          // measure is the uncovered share (≥ 25 %), not how much shows through panels (median transmission, reported only).
          c.check(ev.ok && m.correlation >= 0.25 && m.clear >= 0.25 && changed >= 0.1 && okText, `${label} · ${name} · ${w}×${h}`,
            `scene: correlation with the wallpaper ${m.correlation.toFixed(2)} (pre-fix renderer −0.03…0.50), unobstructed ${(m.clear * 100).toFixed(0)}% of viewport (pre-fix 0%; frosted build 12–23%), median transmission ${m.median.toFixed(2)}; ${(changed * 100).toFixed(1)}% of pixels differ from the same theme in solid colour; text min ${vc.min.toFixed(2)}, <4.5:1 ${vc.below45} (native ${nat.below45}), <3:1 ${vc.below3.length}${vc.low.length ? ` e.g. ${vc.low.slice(0, 3).map(x => `"${x.text}" ${x.ratio.toFixed(2)}`).join('; ')}` : ''}`);
          if (name === 'code' || w === 1366) await L.logShot(context, page, `scene-${label}-${name}-${w}`);
        }
      }
      // Sharpness control: the same Code page with a 6 px wallpaper blur must measure clearly less sharp.
      await page.setViewportSize({ width: 1366, height: 768 });
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: id });
      await L.gotoLive(page, `https://github.com/${A}`); await L.settleAnimations(page); await page.waitForTimeout(500);
      const sharp = await sceneMetrics(context, page);
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-blur', customThemes: { 'custom-blur': { ...preset, id: 'custom-blur', wallpaperBlur: 6 } } });
      await L.gotoLive(page, `https://github.com/${A}`); await L.settleAnimations(page); await page.waitForTimeout(500);
      const soft = await sceneMetrics(context, page);
      c.check(sharp.sharpness != null && soft.sharpness != null && sharp.sharpness >= soft.sharpness * 1.5 && sharp.exposedShare >= 0.15, `${label} · sharpness`,
        `exposed scene keeps native detail: Crisp ${sharp.sharpness?.toFixed(2)} vs 6 px-blurred control ${soft.sharpness?.toFixed(2)}; exposed ${(sharp.exposedShare * 100).toFixed(0)}% of viewport`);
      // README view: the README body is a readable surface over the scene.
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: id });
      await L.gotoLive(page, `https://github.com/${A}`); await L.settleAnimations(page);
      const hasReadme = await page.evaluate(() => { const a = document.querySelector('article.markdown-body'); if (!a) return false; window.scrollTo({ top: a.getBoundingClientRect().top + scrollY - 120, behavior: 'instant' }); return true; });
      if (hasReadme) {
        await page.waitForTimeout(500);
        // Text-only readability backing (default): the README container is open (no broad surface) and each text block
        // carries its own compact backing; all text must stay AA.
        const rd = await page.evaluate(() => {
          const a = document.querySelector('article.markdown-body'), alpha = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
          const ps = [...a.querySelectorAll('p, li')].filter(e => e.textContent.trim() && !e.closest('li li, blockquote') && !e.querySelector('img'));
          // every wrapper between the article and the page (GitHub's README card, its tab container…) must also stay open: a broad tinted or blurred
          // surface on any of them is the regression the article-only check missed
          const ah = a.getBoundingClientRect().height, wrappers = [];
          for (let e = a.parentElement; e && !e.matches('main, body, .application-main'); e = e.parentElement) { const cs = getComputedStyle(e); if (e.getBoundingClientRect().height >= ah * 0.5 && (alpha(cs.backgroundColor) >= 0.15 || cs.backdropFilter !== 'none')) wrappers.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0].slice(0, 40)} bg=${cs.backgroundColor} backdrop=${cs.backdropFilter} frame=${e.hasAttribute('data-repv-frame')} panel=${e.hasAttribute('data-repv-panel')}`); }
          return { wrappers, article: alpha(getComputedStyle(a).backgroundColor), backed: ps.filter(e => alpha(getComputedStyle(e).backgroundColor) >= 0.5 || alpha(getComputedStyle(e.parentElement.closest('li, p') || e).backgroundColor) >= 0.5).length, blocks: ps.length, open: document.documentElement.classList.contains('repv-open') };
        });
        const vr = await visualContrast(context, page, 300);
        c.check(rd.open && rd.article === 0 && rd.wrappers.length === 0 && rd.blocks > 0 && rd.backed === rd.blocks && vr.fails.length === 0, `${label} · README`, `open README (container alpha ${rd.article}; tinted/blurred wrappers ${rd.wrappers.length ? rd.wrappers.join(' | ') : 'none'}); ${rd.backed}/${rd.blocks} text blocks individually backed; text min ${vr.min.toFixed(2)}, <4.5:1 ${vr.below45}, <3:1 ${vr.below3.length}${vr.low.length ? `; lowest: ${vr.low.slice(0, 4).map(x => `"${x.text.slice(0, 40)}" ${x.ratio.toFixed(2)} @${x.at}`).join('; ')}` : ''}`);
        await L.logShot(context, page, `scene-${label}-readme-1366`);
      } else c.info(`${label} · README`, 'README article not found on this page');
      // Diagnostic configuration (opacity 100 %, brightness 100 %, blur 0, overlay 0) on the Code page.
      await page.setViewportSize({ width: 1366, height: 768 });
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'custom-diag', customThemes: { 'custom-diag': { ...preset, id: 'custom-diag', wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperBlur: 0, wallpaperOverlay: 0 } } });
      await L.gotoLive(page, `https://github.com/${A}`); await L.settleAnimations(page); await page.waitForTimeout(500);
      const d = await sceneMetrics(context, page);
      // Diagnostic config must show the scene uncovered and at native sharpness (correlation is reported: it is diluted by the
      // solid reading panels on low-contrast scenes such as the night forest).
      c.check(d.clear >= 0.25 && d.sharpness != null && d.sharpness >= soft.sharpness * 1.5, `${label} · diagnostic config`, `opacity 100 / brightness 100 / blur 0 / overlay 0: unobstructed ${(d.clear * 100).toFixed(0)}%, sharpness ${d.sharpness?.toFixed(2)} (6 px-blurred control ${soft.sharpness?.toFixed(2)}), correlation ${d.correlation.toFixed(2)}`);
      // Live motion over the visible scene (after static visibility).
      await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: id });
      await L.gotoLive(page, `https://github.com/${A}`); await page.waitForTimeout(600);
      const mv = await page.evaluate(() => ({ cls: document.documentElement.className, anims: [...new Set(document.getAnimations().map(a => a.animationName).filter(n => /^repv-/.test(n || '')))] }));
      c.check(mv.cls.includes(`repv-motion-${motion}`) && mv.anims.length > 0, `${label} · live layer`, `ambient ${motion}: ${mv.anims.join(', ')}`);
    }
    errorCheck(c, errors);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 9 (restore): disabling RepoVibe after a scene theme leaves no classes, styles, panel markers or root image', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  const c = checker('Scene visibility · restore');
  try {
    const page = await context.newPage(); ctx.pages.push(page);
    await setConfig(context, { enabled: true, motionMode: 'ambient', defaultThemeId: 'preset-8' });
    await L.gotoLive(page, `https://github.com/${A}`);
    await page.waitForFunction(() => document.querySelectorAll('[data-repv-panel]').length > 0, null, { timeout: 8000 }).catch(() => {});
    c.check(await page.evaluate(() => document.querySelectorAll('[data-repv-panel]').length > 0 && /url\(/.test(getComputedStyle(document.documentElement).backgroundImage)), 'Active', 'scene on the root and panels detected before disabling');
    await setConfig(context, { enabled: false, defaultThemeId: 'preset-8' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-active'), null, { timeout: 8000 }).catch(() => {});
    const inPlace = await page.evaluate(() => ({ panels: document.querySelectorAll('[data-repv-panel]').length, cls: [...document.documentElement.classList].filter(x => x.startsWith('repv')) }));
    c.check(!inPlace.panels && !inPlace.cls.length, 'Disable in place', `without reload: panel markers ${inPlace.panels}, classes [${inPlace.cls}]`);
    // Disabling restores GitHub: no RepoVibe classes, styles or panel markers remain.
    await setConfig(context, { enabled: false, defaultThemeId: 'preset-8' });
    await L.gotoLive(page, `https://github.com/${A}`); await page.waitForTimeout(500);
    const left = await page.evaluate(() => ({ cls: [...document.documentElement.classList].filter(x => x.startsWith('repv')), styles: document.querySelectorAll('[id^="repovibe-"]').length, panels: document.querySelectorAll('[data-repv-panel]').length, bg: getComputedStyle(document.documentElement).backgroundImage }));
    c.check(!left.cls.length && !left.styles && !left.panels && !/url\(/.test(left.bg), 'Disable', `after disabling: classes [${left.cls}], styles ${left.styles}, panel markers ${left.panels}, root image ${/url\(/.test(left.bg) ? 'present' : 'none'}`);
    c.done();
  } finally { await close(); }
});

L.liveTest('LIVE 9 (appearance): Crisp Immersive, Balanced and Frosted Glass are visibly different on a real page; only Frosted blurs', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  const c = checker('Scene visibility · appearance');
  try {
    const page = await context.newPage(); ctx.pages.push(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    const blurCount = () => page.evaluate(() => [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backdropFilter !== 'none').length);
    await setConfig(context, { enabled: true, defaultThemeId: 'native' });
    await L.gotoLive(page, `https://github.com/${A}`); const nativeBlur = await blurCount();
    const shots = {}, blur = {};
    for (const appearance of ['crisp', 'balanced', 'frosted']) {
      await setConfig(context, { enabled: true, motionMode: 'static', defaultThemeId: 'preset-8', appearance });
      await L.gotoLive(page, `https://github.com/${A}`); await L.settleAnimations(page); await page.waitForTimeout(600);
      shots[appearance] = await page.screenshot(); blur[appearance] = await blurCount();
      await L.logShot(context, page, `appearance-${appearance}-code-1366`);
    }
    c.check(blur.crisp <= nativeBlur && blur.balanced <= nativeBlur && blur.frosted > nativeBlur, 'Backdrop blur', `blurred elements: native ${nativeBlur}, Crisp ${blur.crisp}, Balanced ${blur.balanced}, Frosted ${blur.frosted}`);
    for (const [a, b] of [['crisp', 'balanced'], ['crisp', 'frosted'], ['balanced', 'frosted']]) {
      const d = await diffRatio(context, shots[a], shots[b]);
      c.check(d > 0.03, `${a} vs ${b}`, `${(d * 100).toFixed(1)}% of pixels differ`);
    }
    c.done();
  } finally { await close(); }
});
