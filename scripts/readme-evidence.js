'use strict';
/* Before/after evidence for the README "large tinted surface" regression and the stronger borders.
   GitHub's current markup wraps the README tab bar and article in one rounded, bordered card (a CSS-module Box, no #readme id); the captured
   page is adapted the same way (border added) so the old and the new build can be compared on identical markup.
   node scripts/readme-evidence.js <beforeExtDir>   → docs/screenshots/readme/<world>-{before,after}-{readme,sidebar}.jpg + comparison sheets */
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const OUT = path.join(__dirname, '../docs/screenshots/readme');
const WORLDS = { 'preset-8': 'enchanted-forest', 'preset-19': 'cosmic-galaxy', 'preset-1': 'cyberpunk-neon', 'preset-3': 'sakura-garden', 'preset-7': 'ocean-kingdom', 'preset-15': 'futuristic-scifi' };
if (process.argv[2] === '--capture') {
  const { launch, setConfig } = require('../tests/e2e/helpers');
  const R = require('../tests/e2e/real-snapshot');
  (async () => {
    const [, , , id, tag] = process.argv; const snap = R.load('actions-checkout-code');
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      await R.serve(context, snap);
      await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, motionMode: 'static', defaultThemeId: id });
      await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'div:has(> div > article.markdown-body) { border: 1px solid #3d444d !important; }'; document.head.appendChild(st); }));
      const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(snap.main); await page.waitForTimeout(800);
      // current github.com: the README card (the rounded Box wrapping the tab bar and the article) draws a 1 px border; the July capture's CSS
      // did not, so the same border is added here to reproduce what the live run showed
      await page.evaluate(() => { const e = document.querySelector('article.markdown-body').parentElement.parentElement; e.setAttribute('data-was-readme', ''); });
      await page.waitForTimeout(1600);
      const card = await page.evaluate(() => { const r = document.querySelector('[data-was-readme]'); const cs = r && getComputedStyle(r); return r && { bg: cs.backgroundColor, frame: r.hasAttribute('data-repv-frame'), panel: r.hasAttribute('data-repv-panel'), radius: cs.borderTopLeftRadius, border: cs.borderTopWidth }; });
      await page.evaluate(() => { const a = document.querySelector('article.markdown-body'); window.scrollTo({ top: a.getBoundingClientRect().top + scrollY - 140, behavior: 'instant' }); });
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `${WORLDS[id]}-${tag}-readme.jpg`), type: 'jpeg', quality: 88 });
      await page.evaluate(() => window.scrollTo({ top: 380, behavior: 'instant' })); await page.waitForTimeout(500);
      const sb = await page.evaluate(() => { const s = [...document.querySelectorAll('[class*="sidebarSection"]')].find(e => e.getBoundingClientRect().width > 100); const r = s.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: Math.min(r.height, 560) }; });
      await page.screenshot({ path: path.join(OUT, `${WORLDS[id]}-${tag}-sidebar.png`), clip: { x: sb.x - 30, y: Math.max(0, sb.y - 30), width: sb.w + 60, height: sb.h + 60 } });
      fs.writeFileSync(path.join(OUT, `${WORLDS[id]}-${tag}.json`), JSON.stringify({ card }, null, 1));
    } finally { await close(); }
  })();
} else {
  const before = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  (async () => {
    for (const id of Object.keys(WORLDS)) for (const [tag, ext] of [['before', before], ['after', '']]) spawnSync(process.execPath, [__filename, '--capture', id, tag], { stdio: 'inherit', env: { ...process.env, ...(ext ? { REPOVIBE_EXT: ext } : {}) } });
    const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1640, height: 900 } });
    for (const w of Object.values(WORLDS)) {
      const img = f => `data:image/${f.endsWith('png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}`;
      const info = t => JSON.parse(fs.readFileSync(path.join(OUT, `${w}-${t}.json`), 'utf8')).card;
      await page.setContent(`<body style="margin:0;background:#0d1117;color:#e6edf3;font:600 14px sans-serif"><div style="padding:8px">${w} · README (GitHub's current card markup, real page replay, Static, 1600 px)</div><table style="border-spacing:8px"><tr><td>BEFORE (3f0a1a4): card ${JSON.stringify(info('before'))}</td><td>AFTER: card ${JSON.stringify(info('after'))}</td></tr><tr><td><img style="width:800px" src="${img(`${w}-before-readme.jpg`)}"></td><td><img style="width:800px" src="${img(`${w}-after-readme.jpg`)}"></td></tr><tr><td><img style="max-width:800px" src="${img(`${w}-before-sidebar.png`)}"></td><td><img style="max-width:800px" src="${img(`${w}-after-sidebar.png`)}"></td></tr></table></body>`);
      await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${w}-comparison.jpg`), type: 'jpeg', quality: 84, fullPage: true });
      console.log('wrote', w);
    }
    await browser.close();
  })();
}
