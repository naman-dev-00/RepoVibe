'use strict';
/* Motion evidence: the Ocean Depths turtle swims head first. Four frames 1.5 s apart (Ambient, pointer parked) with the turtle's measured
   x position; a turtle facing left must move left. node scripts/turtle-evidence.js → docs/screenshots/rework4/motion/ocean-turtle-forward.jpg */
const fs = require('node:fs'), path = require('node:path');
const { launch, extPage, setConfig } = require('../tests/e2e/helpers');
const OUT = path.join(__dirname, '../docs/screenshots/rework4/motion'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { context, close } = await launch({ colorScheme: 'dark' });
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-7', motionMode: 'ambient', depthQuality: 'full', depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 100 }, readingBacking: 'text' });
    const page = await context.newPage(); await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForSelector('#repovibe-depth .repv-s[data-sprite="turtle"] img', { state: 'attached' }); await page.waitForTimeout(1500);
    // seek the turtle's crossing to mid-screen so it is in view, then let it swim
    await page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect?.target?.parentElement?.dataset.sprite === 'turtle' && a.animationName === 'repv-cross-rev') { const delay = parseFloat(getComputedStyle(a.effect.target).animationDelay) * 1000 || 0; a.currentTime = 0.4 * 120000 - delay; } });  // local time = currentTime − delay: ~40 % of the crossing ≈ mid-screen
    const frames = [];
    for (let i = 0; i < 4; i++) {
      const r = await page.evaluate(() => { const b = document.querySelector('#repovibe-depth .repv-s[data-sprite="turtle"] img').getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; });
      const clip = { x: Math.max(0, Math.min(1600 - 900, r.x + r.w / 2 - 450)), y: Math.max(0, Math.min(900 - 260, r.y + r.h / 2 - 130)), width: 900, height: 260 };
      if (!frames.length) frames.clipX = clip.x; frames.push({ r, img: (await page.screenshot({ clip: { x: frames.clipX, y: clip.y, width: 900, height: 260 } })).toString('base64') });
      await page.waitForTimeout(1500);
    }
    const sheet = await extPage(context); await sheet.setViewportSize({ width: 900, height: 4 * 294 });
    await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 16px system-ui">${frames.map((f, i) => `<div style="padding:6px 10px">t = ${(i * 1.5).toFixed(1)} s · turtle x = ${f.r.x}px${i ? ` (${f.r.x - frames[i - 1].r.x} px: ${f.r.x < frames[i - 1].r.x ? 'forward, head first' : 'BACKWARDS'})` : ''}</div><img src="data:image/png;base64,${f.img}" width=900 height=260 style="display:block">`).join('')}</body>`);
    await sheet.waitForTimeout(300); await sheet.screenshot({ path: path.join(OUT, 'ocean-turtle-forward.jpg'), type: 'jpeg', quality: 82 });
    console.log(frames.map(f => f.r.x).join(' → '));
  } finally { await close(); }
})();
