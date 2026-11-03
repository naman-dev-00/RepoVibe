'use strict';
/* LIVE DIAGNOSTICS for the "wallpaper invisible on real GitHub" defect (P0).
   On real github.com (logged out) this:
   1. captures MHTML snapshots of real repository pages (Code, Issues, Pull requests) without RepoVibe and logs them
      gzip+base64 in chunks ([mhtml] name i/n ...), so the rendering can be reproduced offline against GitHub's real
      DOM and CSS (tests/e2e/real-snapshots/);
   2. applies a flagship theme with a DIAGNOSTIC configuration (wallpaper opacity 100 %, brightness 100 %, blur 0,
      overlay 0) and records, on a grid of sample points, every element that paints a background above the wallpaper
      layer and the combined coverage, plus whether the wallpaper image actually loaded;
   3. logs screenshots (diagnostic config, production defaults, solid colour) for visual inspection.
   It records INFO only; acceptance assertions live in github.live.js. */
const zlib = require('node:zlib');
const { launch, extPage, setConfig, getConfig } = require('../e2e/helpers');
const L = require('./live-helpers');

const REPO = 'actions/checkout';
const PAGES = [['code', `https://github.com/${REPO}`], ['issues', `https://github.com/${REPO}/issues`], ['pulls', `https://github.com/${REPO}/pulls`]];

function logChunks(tag, name, b64) {
  const n = Math.ceil(b64.length / 60000);
  for (let i = 0; i < n; i++) console.log(`[${tag}] ${name} ${i + 1}/${n} ${b64.slice(i * 60000, (i + 1) * 60000)}`);
}

// Every element at (x, y) from the top down to the wallpaper layer, with its own background alpha.
const coverageScript = () => {
  const alphaOf = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
  const points = [];
  for (const fy of [0.15, 0.35, 0.55, 0.75, 0.92]) for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) points.push([Math.round(innerWidth * fx), Math.round(innerHeight * fy)]);
  return points.map(([x, y]) => {
    const stack = document.elementsFromPoint(x, y).map(el => {
      const cs = getComputedStyle(el);
      return { el: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`,
        bg: cs.backgroundColor, a: alphaOf(cs.backgroundColor), img: cs.backgroundImage !== 'none', bf: cs.backdropFilter };
    });
    const painters = stack.filter(s => s.a > 0 || s.img);
    const through = painters.filter(s => s.el !== 'html' && !s.img).reduce((t, s) => t * (1 - s.a), 1);
    return { x, y, wallpaperShare: Math.round(through * 1000) / 1000, painters: painters.map(s => `${s.el} ${s.bg}${s.img ? ' +img' : ''}${s.bf && s.bf !== 'none' ? ' bf' : ''}`) };
  });
};

L.liveTest('LIVE DIAG: wallpaper layer, coverage stack and real-page snapshots', async (t, ctx) => {
  const { context, close } = await launch({ fixture: false, colorScheme: 'dark' });
  try {
    const page = await context.newPage(); ctx.pages.push(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await setConfig(context, { enabled: true, defaultThemeId: 'native', motionMode: 'static' });
    const cdp = await context.newCDPSession(page);
    for (const [name, url] of PAGES) {
      await L.gotoLive(page, url);
      await page.waitForTimeout(1500);
      const { data } = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
      const gz = zlib.gzipSync(Buffer.from(data, 'utf8'), { level: 9 }).toString('base64');
      console.log(`[diag] mhtml ${name}: ${data.length} chars, gzip+base64 ${gz.length}`);
      logChunks('mhtml', name, gz);
    }
    const flags = [['forest', 'preset-8'], ['galaxy', 'preset-19']];
    for (const [label, id] of flags) {
      for (const [mode, overrides] of [['diagnostic', { wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperBlur: 0, wallpaperOverlay: 0 }], ['production', null]]) {
        const ext = await extPage(context);
        const theme = await ext.evaluate(([pid, o]) => { const p = RepoVibeCore.PRESETS.find(x => x.id === pid); return o ? { ...p, ...o, id: 'custom-diag', name: 'diag' } : null; }, [id, overrides]);
        await ext.close();
        await setConfig(context, theme
          ? { enabled: true, motionMode: 'static', defaultThemeId: 'custom-diag', customThemes: { 'custom-diag': theme } }
          : { enabled: true, motionMode: 'static', defaultThemeId: id });
        for (const [name, url] of PAGES) {
          await L.gotoLive(page, url);
          await page.waitForTimeout(1200);
          const layer = await page.evaluate(async () => {
            const root = getComputedStyle(document.documentElement), before = getComputedStyle(document.body, '::before');
            const m = (root.getPropertyValue('--repv-wallpaper') || '').match(/url\("([^"]+)"\)/);
            let loaded = null;
            if (m) { const i = new Image(); i.src = m[1]; try { await i.decode(); loaded = `${i.naturalWidth}x${i.naturalHeight}`; } catch (e) { loaded = `FAILED ${e.message}`; } }
            return { active: document.documentElement.classList.contains('repv-active'), url: m ? m[1].slice(0, 80) : null, loaded,
              rootBg: root.backgroundColor, rootImg: root.backgroundImage.slice(0, 80), before: { img: before.backgroundImage.slice(0, 120), z: before.zIndex, pos: before.position, op: before.opacity, filter: before.filter, w: before.width, h: before.height },
              panel: root.getPropertyValue('--repv-panel-opacity'), bodyBg: getComputedStyle(document.body).backgroundColor };
          });
          const cov = await page.evaluate(coverageScript);
          const shares = cov.map(c => c.wallpaperShare).sort((a, b) => a - b);
          console.log(`[diag] ${label} ${mode} ${name} layer ${JSON.stringify(layer)}`);
          console.log(`[diag] ${label} ${mode} ${name} wallpaperShare median ${shares[12]} min ${shares[0]} max ${shares[24]}`);
          for (const c of cov) console.log(`[diag] ${label} ${mode} ${name} @${c.x},${c.y} share ${c.wallpaperShare} :: ${c.painters.join(' > ')}`);
          await L.logShot(context, page, `diag-${label}-${mode}-${name}`);
        }
      }
    }
    t.diagnostic('diagnostics logged');
  } finally { await close(); }
});
