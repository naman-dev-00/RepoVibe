'use strict';
/* Where does the depth renderer spend its time? Measures frame rate (rAF), main-thread and compositor work for a world while hiding one
   group of the scene at a time (display:none), in Ambient or Cinematic. Software-rendered Chromium unless a GPU exists (see `gpu` in the output).
   node scripts/perf-breakdown.js <presetId> [ambient|cinematic] [WxH]   → docs/perf-breakdown-<slug>-<mode>.json */
const fs = require('node:fs'), path = require('node:path');
const { launch, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const [id = 'preset-7', mode = 'ambient', size = '1366x768'] = process.argv.slice(2); const [W, H] = size.split('x').map(Number);
const GROUPS = {
  'baseline': '',
  'tile planes (caustics/clouds/snow/bubbles)': '#repovibe-depth > .repv-l[data-tw] { display:none !important }',
  'plane pfar (caustics A)': '#repovibe-depth > [data-l="pfar"] { display:none !important }',
  'plane mist (caustics B)': '#repovibe-depth > [data-l="mist"] { display:none !important }',
  'plane pmid (marine snow / petals)': '#repovibe-depth > [data-l="pmid"] { display:none !important }',
  'plane pnear (bubbles / big petals)': '#repovibe-depth > [data-l="pnear"] { display:none !important }',
  'masked planes only (caustics)': '#repovibe-depth > .repv-l[data-tw] { }  #repovibe-depth > .repv-l[style*="mask"] { display:none !important }',
  'scene sprites (wind + swim + rise)': '#repovibe-depth .repv-b { display:none !important }',
  'wind sprites only': '#repovibe-depth img[data-wind] { visibility:hidden !important }',
  'pop-out layer': '#repovibe-popout { display:none !important }',
  'light shafts (rays)': '#repovibe-depth > [data-l="rays"] { display:none !important }',
  'vignette (near)': '#repovibe-depth > [data-l="near"] { display:none !important }',
  'animations paused (compositing cost of layers only)': '#repovibe-depth *, #repovibe-popout * { animation-play-state:paused !important }'
};
async function measure(page, client, ms) {
  const m = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m();
  const ft = await page.evaluate(d => new Promise(r => { const t = []; let last = performance.now(); const t0 = last; const f = now => { t.push(now - last); last = now; if (now - t0 < d) requestAnimationFrame(f); else r(t.slice(1)); }; requestAnimationFrame(f); }), ms);
  const b = await m(); const sec = b.Timestamp - a.Timestamp; ft.sort((x, y) => x - y);
  return { fps: +(1000 / (ft.reduce((s, x) => s + x, 0) / ft.length)).toFixed(1), p95: +ft[Math.floor(ft.length * 0.95)].toFixed(1), mainMsPerS: +(((b.TaskDuration - a.TaskDuration) / sec) * 1000).toFixed(1) };
}
(async () => {
  const out = { id, mode, size, groups: {} };
  const { context, close } = await launch({ colorScheme: 'dark' });
  try {
    if (SNAP) await R.serve(context, R.load(SNAP));
    await setConfig(context, { enabled: true, defaultThemeId: id, motionMode: mode, depthQuality: 'full', depthEffects: true, depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 100 } });
    const page = await context.newPage(); await page.setViewportSize({ width: W, height: H });
    await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout'); await page.waitForSelector('#repovibe-depth .repv-l[data-l="far"]', { state: 'attached' });
    await page.waitForFunction(() => [...document.querySelectorAll('#repovibe-depth img')].every(i => i.complete)); await page.waitForTimeout(2500);
    out.gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl'); const i = gl && gl.getExtension('WEBGL_debug_renderer_info'); return i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    out.scene = await page.evaluate(() => document.getElementById('repovibe-depth').dataset.scene);
    const client = await context.newCDPSession(page); await client.send('Performance.enable');
    for (const [name, css] of Object.entries(GROUPS)) {
      const st = css ? await page.addStyleTag({ content: css }) : null; await page.waitForTimeout(700);
      const runs = []; for (let i = 0; i < 2; i++) runs.push(await measure(page, client, 3500));
      out.groups[name] = { fps: +((runs[0].fps + runs[1].fps) / 2).toFixed(1), p95: Math.max(...runs.map(r => r.p95)), mainMsPerS: +((runs[0].mainMsPerS + runs[1].mainMsPerS) / 2).toFixed(1) };
      console.log(name.padEnd(54), JSON.stringify(out.groups[name]));
      if (st) await st.evaluate(el => el.remove());
    }
  } finally { await close(); }
  fs.writeFileSync(path.join(__dirname, `../docs/perf-breakdown-${out.scene}-${mode}${process.env.PERF_TAG ? '-' + process.env.PERF_TAG : ''}.json`), JSON.stringify(out, null, 2) + '\n'); console.log('GPU:', out.gpu);
})();
