'use strict';
/* Performance profile of the depth engine on a real github.com page replay (or the offline fixture), per world and mode.
   Reports: frame-time distribution (rAF), CDP main-thread metrics, trace-based paint / raster / composite time,
   composited layer count and area, JS heap. Records whether the GPU is hardware or software (SwiftShader).
   node scripts/perf-profile.js [WxH] [presetIds...]      → docs/perf-profile.json */
const fs = require('node:fs');
const path = require('node:path');
const { launch, setConfig } = require('../tests/e2e/helpers');
const R = require('../tests/e2e/real-snapshot');

const NAMES = { 'preset-19': 'cosmic-galaxy', 'preset-8': 'enchanted-forest', 'preset-1': 'cyberpunk-neon', 'preset-15': 'futuristic-scifi' };
const MODES = [
  ['static', { motionMode: 'static' }],
  ['depth off', { motionMode: 'ambient', depthEffects: false }],
  ['ambient full', { motionMode: 'ambient', depthQuality: 'full' }],
  ['ambient lite', { motionMode: 'ambient', depthQuality: 'lite' }],
  ['cinematic full', { motionMode: 'cinematic', depthQuality: 'full' }]
];
const SNAP = R.available().includes('actions-checkout-code') ? 'actions-checkout-code' : null;
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
// Whole-browser CPU (all Chromium processes of the test profile: browser, renderer, GPU/viz, utility), from /proc.
function chromeCpuSeconds() {
  let pids = [];
  try { pids = require('node:child_process').execSync('pgrep -f repovibe-e2e', { encoding: 'utf8' }).split('\n').filter(Boolean); } catch {}
  return pids.reduce((s, pid) => { try { const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return s + (+f[11] + +f[12]) / 100; } catch { return s; } }, 0);
}

async function profile(context, page, ms) {
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  // composited layers (count + painted area relative to the viewport)
  let layers = null;
  client.on('LayerTree.layerTreeDidChange', e => { if (e.layers) layers = e.layers; });
  await client.send('LayerTree.enable'); await page.waitForTimeout(300);
  // trace: paint / raster / composite on all threads
  const events = []; client.on('Tracing.dataCollected', e => events.push(...e.value));
  const done = new Promise(r => client.once('Tracing.tracingComplete', r));
  await client.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,cc,viz,gpu', transferMode: 'ReportEvents' });
  const a = await metrics(); const cpu0 = chromeCpuSeconds();
  const frames = page.evaluate(d => new Promise(r => { const t = []; let last = performance.now(); const t0 = last; const f = now => { t.push(now - last); last = now; if (now - t0 < d) requestAnimationFrame(f); else r(t.slice(1)); }; requestAnimationFrame(f); }), ms);
  const { width, height } = page.viewportSize();
  for (let i = 0; i < ms / 50; i++) { await page.mouse.move(width * (0.5 + 0.45 * Math.sin(i / 12)), height * (0.45 + 0.2 * Math.cos(i / 17))); await page.waitForTimeout(50); }
  const ft = (await frames).sort((x, y) => x - y);
  const b = await metrics(); const cpu1 = chromeCpuSeconds();
  await client.send('Tracing.end'); await done;
  await client.send('LayerTree.disable').catch(() => {});
  const sec = b.Timestamp - a.Timestamp, per = k => +(((b[k] - a[k]) / sec) * 1000).toFixed(1);
  const dur = re => +(events.filter(e => re.test(e.name) && e.ph === 'X').reduce((s, e) => s + (e.dur || 0), 0) / 1000 / sec).toFixed(1);
  const vw = width * height;
  const drawn = (layers || []).filter(l => l.drawsContent);
  return {
    fps: +(1000 / (ft.reduce((s, x) => s + x, 0) / ft.length)).toFixed(1),
    frameMs: { p50: +pct(ft, 0.5).toFixed(1), p95: +pct(ft, 0.95).toFixed(1), p99: +pct(ft, 0.99).toFixed(1), over33: +(ft.filter(x => x > 33.4).length / ft.length * 100).toFixed(1) },
    mainMsPerS: { task: per('TaskDuration'), script: per('ScriptDuration'), style: per('RecalcStyleDuration'), layout: per('LayoutDuration') },
    traceMsPerS: { paint: dur(/^Paint$/), raster: dur(/Raster|RasterTask/), composite: dur(/^(CompositeLayers|Commit|UpdateLayerTree|DrawFrame|Display::DrawAndSwap|SkiaOutputSurface)/) },
    layers: { composited: drawn.length, areaViewports: +(drawn.reduce((s, l) => s + l.width * l.height, 0) / vw).toFixed(1) },
    heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(1),
    cpuCores: +((cpu1 - cpu0) / sec).toFixed(2) // all Chromium processes, CPU-seconds per second (includes tracing overhead)
  };
}

(async () => {
  const [size = '1366x768', ...ids] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number);
  const out = { source: SNAP ? `real github.com page replay (${SNAP}, logged out; local snapshot, not committed)` : 'offline fixture', viewport: size, worlds: {} };
  for (const id of ids.length ? ids : Object.keys(NAMES)) {
    out.worlds[NAMES[id]] = {};
    for (const [label, cfg] of MODES) {
      const { context, close } = await launch({ colorScheme: 'dark' });
      try {
        if (SNAP) await R.serve(context, R.load(SNAP));
        await setConfig(context, { enabled: true, defaultThemeId: id, depthTuning: { parallax: 100, motion: 100, particles: 100, foreground: 100 }, ...cfg });
        const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
        await page.goto(SNAP ? R.load(SNAP).main : 'https://github.com/acme/project/layout'); await page.waitForTimeout(2500);
        if (!out.gpu) out.gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl'); const i = gl && gl.getExtension('WEBGL_debug_renderer_info'); return i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
        const r = await profile(context, page, 5000);
        out.worlds[NAMES[id]][label] = r;
        console.log(`${NAMES[id].padEnd(17)} ${label.padEnd(15)} fps ${String(r.fps).padStart(5)}  p95 ${String(r.frameMs.p95).padStart(5)} ms  >33ms ${String(r.frameMs.over33).padStart(5)}%  main ${r.mainMsPerS.task} (style ${r.mainMsPerS.style}) ms/s  paint ${r.traceMsPerS.paint} raster ${r.traceMsPerS.raster} composite ${r.traceMsPerS.composite} ms/s  layers ${r.layers.composited} (${r.layers.areaViewports} vp)  CPU ${r.cpuCores} cores  heap ${r.heapMB} MB`);
      } finally { await close(); }
    }
  }
  console.log('GPU:', out.gpu);
  fs.writeFileSync(path.join(__dirname, '../docs/perf-profile.json'), JSON.stringify(out, null, 2) + '\n');
})();
