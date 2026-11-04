'use strict';
/* Before/after evidence for the themed border & glow system: the same real-page replay, theme and Static frame, with
   the previous build (REPOVIBE_EXT=<dir of the old build>) vs the current one. Crops: sidebar, README, button group.
   node scripts/border-evidence.js <beforeExtDir>      → docs/screenshots/borders/<world>.jpg */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const OUT = path.join(__dirname, '../docs/screenshots/borders');
const WORLDS = { 'preset-8': 'enchanted-forest', 'preset-19': 'cosmic-galaxy', 'preset-1': 'cyberpunk-neon', 'preset-15': 'futuristic-scifi' };

if (process.argv[2] === '--capture') {
  // child: capture crops with the build in REPOVIBE_EXT (or the working tree)
  const { launch, setConfig } = require('../tests/e2e/helpers');
  const R = require('../tests/e2e/real-snapshot');
  (async () => {
    const [, , , id, outDir] = process.argv;
    const snap = R.load('actions-checkout-code');
    const { context, close } = await launch({ colorScheme: 'dark' });
    try {
      await R.serve(context, snap);
      await setConfig(context, { version: 2, enabled: true, autoAssign: false, seededMappings: true, motionMode: 'static', defaultThemeId: id });
      const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(snap.main); await page.waitForTimeout(1800);
      const rect = sel => page.evaluate(s => { const els = [...document.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 0); if (!els.length) return null; const r = els.map(e => e.getBoundingClientRect()); return { x: Math.min(...r.map(q => q.left)), y: Math.min(...r.map(q => q.top)) + scrollY, w: Math.max(...r.map(q => q.right)) - Math.min(...r.map(q => q.left)), h: Math.max(...r.map(q => q.bottom)) - Math.min(...r.map(q => q.top)) }; }, sel);
      const shot = async (r, name, pad = 24, maxH = 520) => {
        if (!r) return;
        await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 40)), r.y); await page.waitForTimeout(400);
        const top = await page.evaluate(y => y - scrollY, r.y);
        await page.screenshot({ path: path.join(outDir, `${name}.png`), clip: { x: Math.max(0, r.x - pad), y: Math.max(0, top - pad), width: Math.min(1366 - Math.max(0, r.x - pad), r.w + 2 * pad), height: Math.min(768 - Math.max(0, top - pad), Math.min(maxH, r.h + 2 * pad)) } });
      };
      await shot(await rect('[class*="sidebarSection"]'), 'sidebar', 20, 560);
      await shot(await rect('article.markdown-body'), 'readme', 30, 420);
      const tb = await rect('button[data-testid="anchor-button"], [class*="ButtonBase"][aria-haspopup], a[href*="branches"], a[href*="tags"]');
      if (tb) await shot({ x: 60, y: tb.y - 10, w: 940, h: 200 }, 'buttons', 10, 230);
    } finally { await close(); }
  })();
} else {
  const before = process.argv[2];
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'repv-borders-'));
  const { chromium } = require('playwright');
  (async () => {
    const browser = await chromium.launch({ channel: 'chromium' });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    for (const [id, world] of Object.entries(WORLDS)) {
      for (const [tag, ext] of [['before', before], ['after', '']]) {
        const dir = path.join(tmp, `${world}-${tag}`); fs.mkdirSync(dir, { recursive: true });
        spawnSync(process.execPath, [__filename, '--capture', id, dir], { stdio: 'inherit', env: { ...process.env, ...(ext ? { REPOVIBE_EXT: ext } : {}) } });
      }
      const img = (tag, n) => { const f = path.join(tmp, `${world}-${tag}`, `${n}.png`); return fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` : ''; };
      const row = n => `<tr><td><img src="${img('before', n)}"></td><td><img src="${img('after', n)}"></td></tr>`;
      await page.setContent(`<body style="margin:0;background:#0d1117;color:#e6edf3;font:600 14px sans-serif"><div style="padding:8px 10px">${world} · themed border &amp; glow · real github.com page replay, Static, 1366 px</div><table style="border-spacing:10px"><tr><td>BEFORE (cd7165d)</td><td>AFTER</td></tr>${row('sidebar')}${row('readme')}${row('buttons')}</table><style>img{display:block;max-width:660px}td{vertical-align:top}</style></body>`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${world}.jpg`), type: 'jpeg', quality: 84, fullPage: true });
      console.log('wrote', world);
    }
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  })();
}
