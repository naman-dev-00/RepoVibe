'use strict';
/* Review pack for worlds awaiting the owner's visual approval. Per world, into docs/review/<name>/:
     artwork-2560.jpg / artwork-3840.jpg   the scene alone (GitHub's page hidden; the extension still renders it itself), Ambient, full quality
     detail-<n>.jpg                        1:1 crops of the 3840 × 2160 render (no resampling): what a 4K monitor shows
     github-<W>x<H>.jpg                    the themed repository page at 1366×768, 1920×1080, 2560×1440, 3840×2160
     sizes.jpg                             those four side by side (scaled to a common height) to check framing and cropping
     motion.jpg                            artwork-only frames several seconds apart + the share of pixels that changed between them
     static.jpg                            Static mode (nothing moves): the complete, sharp scene
     facts.json                            numbers: natural asset sizes vs displayed size (upscale factor), animations running, text contrast
   Real github.com page replay when the local snapshot exists, otherwise the offline fixture (facts.json says which).
   node scripts/world-review.js [name ...]      names: messy-thoughts eternal-moon aurora */
const fs = require('node:fs'), path = require('node:path');
const { launch, extPage, setConfig, visualContrast } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const ROOT = path.join(__dirname, '..');
const WORLDS = {
  'messy-thoughts': { id: 'preset-21', gap: 2500, crops: [[1440, 300, 'the tangle: individual strokes'], [1240, 1000, 'figure linework: collar and drawstrings']] },
  'eternal-moon': { id: 'preset-22', gap: 3000, crops: [[1700, 350, 'moon surface: maria and craters'], [900, 760, 'spruce silhouettes: boughs and needle hems'], [1500, 1500, 'fog, shoreline and the lake mirror']] },
  aurora: { id: 'preset-17', gap: 2000, crops: [[200, 150, 'the great massif: snow streaks and rim light'], [1500, 420, 'sky: stars and aurora'], [1500, 1250, 'ice lake: cracks and glow']] }
};
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const TUNE = { parallax: 100, motion: 100, particles: 100, foreground: 100 };
const only = process.argv.slice(2);
const b64 = f => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;

async function open(context, w, h) {
  if (SNAP) await R.serve(context, R.load(SNAP));
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout');
  await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => Promise.all([...document.querySelectorAll('#repovibe-depth img')].map(i => i.decode().catch(() => {}))));
  return page;
}
// hide GitHub's own page; #repovibe-depth is a sibling of <body>, so the scene stays exactly as the extension draws it
const artworkOnly = page => page.addStyleTag({ content: 'body, #repovibe-popout { visibility:hidden !important; } html { background:#000 !important; }' });

(async () => {
  for (const [name, w] of Object.entries(WORLDS)) {
    if (only.length && !only.includes(name)) continue;
    const OUT = path.join(ROOT, 'docs/review', name); fs.mkdirSync(OUT, { recursive: true });
    const facts = { source: SNAP ? `real github.com page replay (${SNAP}, logged out)` : 'offline fixture', preset: w.id };
    const base = { enabled: true, defaultThemeId: w.id, depthQuality: 'full', depthTuning: TUNE };
    // --- artwork only, 2560 and 3840, + 1:1 detail crops + motion frames
    for (const [W, H] of [[2560, 1440], [3840, 2160]]) {
      const { context, close } = await launch({ colorScheme: 'dark' });
      try {
        await setConfig(context, { ...base, motionMode: 'ambient' });
        const page = await open(context, W, H); await artworkOnly(page); await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(OUT, `artwork-${W}.jpg`), type: 'jpeg', quality: 92 });
        if (W === 3840) {
          for (const [i, [cx, cy, label]] of w.crops.entries()) await page.screenshot({ path: path.join(OUT, `detail-${i + 1}.jpg`), type: 'jpeg', quality: 94, clip: { x: cx, y: cy, width: 1000, height: 640 } });
          facts.detail = w.crops.map(([cx, cy, label], i) => ({ file: `detail-${i + 1}.jpg`, label, region: `${cx},${cy} 1000×640 of 3840×2160, no resampling` }));
          facts.assets = await page.evaluate(() => {
            const out = [];
            for (const l of document.querySelectorAll('#repovibe-depth > .repv-l:not([data-tile])')) { const u = /url\("(.+?)"\)/.exec(l.firstElementChild.style.backgroundImage || ''); if (u) out.push({ layer: l.dataset.l, url: u[1] }); }
            return Promise.all(out.map(o => new Promise(res => { const i = new Image(); i.onload = () => res({ layer: o.layer, natural: `${i.naturalWidth}×${i.naturalHeight}`, upscaleAt3840: +(Math.max(innerWidth / i.naturalWidth, innerHeight / i.naturalHeight)).toFixed(2) }); i.onerror = () => res({ layer: o.layer, error: true }); i.src = o.url; })));
          });
          facts.vectorStrokes = await page.evaluate(() => document.querySelectorAll('#repovibe-depth svg path').length);
        } else {
          const frames = []; for (let i = 0; i < 4; i++) { frames.push((await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: 480, y: 120, width: 1600, height: 900 } })).toString('base64')); if (i < 3) await page.waitForTimeout(w.gap); }
          facts.running = await page.evaluate(() => [...new Set(document.getAnimations().filter(a => a.playState === 'running' && a.animationName).map(a => a.animationName))].sort());
          const sheet = await extPage(context);
          const motion = await sheet.evaluate(async fr => {
            const load = b => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + b; });
            const imgs = await Promise.all(fr.map(load)); const c = new OffscreenCanvas(1600, 900), g = c.getContext('2d', { willReadFrequently: true });
            const px = imgs.map(i => { g.drawImage(i, 0, 0); return g.getImageData(0, 0, 1600, 900).data; }); const out = [];
            for (let k = 1; k < px.length; k++) { let ch = 0, n = 0; const a = px[k - 1], b = px[k]; for (let i = 0; i < a.length; i += 16) { n++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 18) ch++; } out.push(+(ch / n * 100).toFixed(2)); }
            return out;
          }, frames);
          facts.motion = { secondsBetweenFrames: w.gap / 1000, changedPct: motion, threshold: 'a pixel counts when its R+G+B differs by more than 18 of 765 (JPEG noise is below that)' };
          await sheet.setViewportSize({ width: 1600, height: frames.length * 934 });
          await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 18px system-ui">${frames.map((f, i) => `<div style="padding:6px 12px">t = ${(i * w.gap / 1000).toFixed(0)} s · artwork only · Ambient${i ? ` · ${motion[i - 1]}% of pixels changed since the previous frame` : ''}</div><img src="data:image/jpeg;base64,${f}" width=1600 height=900 style="display:block">`).join('')}</body>`);
          await sheet.waitForTimeout(300); await sheet.screenshot({ path: path.join(OUT, 'motion.jpg'), type: 'jpeg', quality: 84 }); await sheet.close();
        }
      } finally { await close().catch(() => {}); }
    }
    // --- Static mode, artwork only
    { const { context, close } = await launch({ colorScheme: 'dark' });
      try { await setConfig(context, { ...base, motionMode: 'static' }); const page = await open(context, 2560, 1440).catch(async () => { const p = context.pages().at(-1); return p; }); await artworkOnly(page); await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, 'static.jpg'), type: 'jpeg', quality: 92 });
        facts.staticAnimations = await page.evaluate(() => document.getAnimations().filter(a => /^repv-/.test(a.animationName) && a.playState === 'running').length);
      } finally { await close().catch(() => {}); } }
    // --- on GitHub at four sizes
    const shots = [];
    for (const [W, H] of [[1366, 768], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      const { context, errors, close } = await launch({ colorScheme: 'dark' });
      try {
        await setConfig(context, { ...base, motionMode: 'ambient' });
        const page = await open(context, W, H); await page.waitForTimeout(2500);
        const f = path.join(OUT, `github-${W}x${H}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); shots.push([W, H, f]);
        if (W === 1920) { const vc = await visualContrast(context, page); facts.contrast = { min: +vc.min.toFixed(2), aaFailures: vc.fails.length, summary: vc.failSummary }; facts.extensionErrors = errors.filter(e => e.includes('chrome-extension://')).length; }
        if (W === 1366) await page.close();
      } finally { await close().catch(() => {}); }
    }
    { const { context, close } = await launch({ colorScheme: 'dark' });
      try { const sheet = await extPage(context); await sheet.setViewportSize({ width: 1960, height: 1170 });
        await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:600 16px system-ui;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">${shots.map(([W, H, f]) => `<div><div style="padding:4px 2px">${W} × ${H}</div><img src="${b64(f)}" style="width:100%;display:block"></div>`).join('')}</body>`);
        await sheet.waitForTimeout(500); await sheet.screenshot({ path: path.join(OUT, 'sizes.jpg'), type: 'jpeg', quality: 84, fullPage: true });
      } finally { await close().catch(() => {}); } }
    fs.writeFileSync(path.join(OUT, 'facts.json'), JSON.stringify(facts, null, 1) + '\n');
    console.log(name, JSON.stringify({ motion: facts.motion?.changedPct, running: facts.running, assets: facts.assets, strokes: facts.vectorStrokes, contrast: facts.contrast, staticAnimations: facts.staticAnimations }));
  }
})().catch(e => { console.error(e); process.exit(1); });
