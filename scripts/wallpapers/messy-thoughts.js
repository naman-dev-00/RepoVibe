'use strict';
/* Messy Thoughts (preset-21): original vector line art — a calm figure in clean white outline on black whose head is a tangle of scribbled
   lines. Everything is generated here from seeded maths (no external assets): the figure is hand-placed Bézier curves, every scribble is a
   Catmull-Rom spline through chaotic points inside the head region.

   Output:
     shared/worlds.js              the data block between MESSY-BEGIN / MESSY-END: the figure (still strokes), the resting tangle (still) and
                                   the live strokes that draw themselves and fade; the page renders them as inline SVG, so the lines stay sharp
                                   at any monitor size
     wallpapers/depth/messy-thoughts/far.webp   3840×2160: the black ground with a barely visible lift behind the figure
     wallpapers/messy-thoughts.webp + thumbs    3840×2160 flat render of the complete drawing (Static mode, gallery, previews)
   node scripts/wallpapers/messy-thoughts.js */
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'wallpapers/depth/messy-thoughts');
const VB = [1600, 900], HEAD = { x: 800, y: 292, rx: 118, ry: 112 };

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const f1 = n => +n.toFixed(1);
// Catmull-Rom spline through pts → cubic Bézier path
function spline(pts, tension = 0.5) {
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) * tension / 3)} ${f1(p1[1] + (p2[1] - p0[1]) * tension / 3)} ${f1(p2[0] - (p3[0] - p1[0]) * tension / 3)} ${f1(p2[1] - (p3[1] - p1[1]) * tension / 3)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}
/* one scribbled stroke: the pen swings around the head centre in large uneven turns (chords and loops), reach = how far outside the head
   outline it may stray (1 = stays inside) */
function scribble(seed, n, reach = 1, spin = 1) {
  const r = rng(seed); let ang = r() * Math.PI * 2; const pts = [];
  for (let i = 0; i < n; i++) {
    ang += spin * (1.1 + r() * 2.3) * (r() < 0.12 ? -1 : 1);
    const rad = (0.3 + 0.7 * Math.pow(r(), 0.38)) * (r() < 0.16 ? reach : 1);   // biased outward: open loops around the rim, not a solid knot
    pts.push([HEAD.x + Math.cos(ang) * HEAD.rx * rad + (r() - 0.5) * 14, HEAD.y + Math.sin(ang) * HEAD.ry * rad + (r() - 0.5) * 14]);
  }
  return spline(pts, 0.62);
}
// a loose wisp that escapes the tangle and curls away (a thought getting loose)
function wisp(seed, ang, len) {
  const r = rng(seed), pts = []; let x = HEAD.x + Math.cos(ang) * HEAD.rx * 0.7, y = HEAD.y + Math.sin(ang) * HEAD.ry * 0.7, a = ang;
  for (let i = 0; i < 9; i++) { pts.push([x, y]); a += (r() - 0.5) * 1.5 + 0.34 * Math.sin(i * 1.3); const st = len / 9 * (0.7 + r() * 0.6); x += Math.cos(a) * st; y += Math.sin(a) * st; }
  const cx = x, cy = y; for (let k = 0; k < 7; k++) { const t = k / 6 * Math.PI * 2.6; const rr = 15 * (1 - k / 8); pts.push([cx + Math.cos(a + t) * rr, cy + Math.sin(a + t) * rr]); }   // ends in a small curl
  return spline(pts, 0.6);
}

/* The figure: shoulders, arms and a hooded top, drawn as a few long confident lines (stage units, 1600 × 900). Symmetric halves are mirrored
   with a slight asymmetry so it reads as drawn by hand. */
const mirror = d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f1(1600 - +x + 3)} ${f1(+y + 2)}`);
const HALF = [
  'M772 398C770 414 767 427 754 436',                                                                       // neck
  'M754 436C704 444 652 458 630 498C614 528 606 590 600 668C595 736 592 812 588 900',                         // shoulder and outer arm
  'M668 566C664 646 660 742 657 900',                                                                         // inner arm / side of the body
  'M754 436C760 462 776 478 800 484',                                                                         // hood collar
  'M781 474C779 506 783 538 779 572',                                                                         // drawstring
];
const FIGURE = [...HALF, ...HALF.map(mirror), 'M779 572C777 578 781 584 779 590', 'M824 574C822 581 826 587 824 594', 'M702 772C730 754 770 749 802 749C836 749 874 755 902 774'].map(d => ({ d, sw: 3.2 }));

function build() {
  const still = [...FIGURE,
    // the resting tangle: three dense long strokes plus a faint under-layer, always there (Static shows exactly this)
    { d: scribble(11, 26), sw: 2.2 }, { d: scribble(12, 22, 1.15), sw: 1.8 }, { d: scribble(13, 18), sw: 1.4, op: 0.75 },
    { d: wisp(31, -2.3, 150), sw: 1.6, op: 0.7 }];
  // live strokes: each draws itself, rests and fades (or flows through), on its own duration and phase
  const r = rng(77), draw = [];
  for (let i = 0; i < 11; i++) {
    const dur = +(11 + r() * 12).toFixed(1);
    draw.push({ d: scribble(100 + i, 7 + Math.floor(r() * 7), 1 + r() * 0.45, r() < 0.5 ? 1 : -1), sw: +(1.2 + r() * 1.0).toFixed(1), dur, delay: +(-r() * dur).toFixed(1), ...(i % 3 === 0 ? { flow: 1 } : {}), ...(i % 4 === 1 ? { op: 0.7 } : {}) });
  }
  [[-0.5, 190], [-1.2, 170], [-2.6, 210], [-1.75, 230], [0.2, 150], [3.3, 160]].forEach(([a, len], i) => { const dur = 15 + i * 2.3; draw.push({ d: wisp(200 + i, a, len), sw: 1.5, dur, delay: +(-dur * (i * 0.17 % 1)).toFixed(1), flow: i % 2, op: 0.8 }); });
  return { still, draw };
}

function svgMarkup({ still, draw }, w, h) {
  const p = s => `<path d="${s.d}" stroke-width="${s.sw}" opacity="${s.op ?? 1}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB[0]} ${VB[1]}" width="${w}" height="${h}" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${[...still, ...draw].map(p).join('')}</svg>`;
}

(async () => {
  const data = build();
  // 1. data block in shared/worlds.js
  const wf = path.join(ROOT, 'shared/worlds.js'); let src = fs.readFileSync(wf, 'utf8');
  const block = `/*MESSY-BEGIN*/\n  const MESSY = ${JSON.stringify(data)};\n  /*MESSY-END*/`;
  if (!/\/\*MESSY-BEGIN\*\/[\s\S]*?\/\*MESSY-END\*\//.test(src)) throw new Error('MESSY markers missing in shared/worlds.js');
  fs.writeFileSync(wf, src.replace(/\/\*MESSY-BEGIN\*\/[\s\S]*?\/\*MESSY-END\*\//, () => block));
  // 2. rasters (3840 × 2160) through headless Chromium, then WebP via Pillow
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'messy-'));
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const ground = 'background:#050506 radial-gradient(60% 70% at 50% 46%, #101014 0%, #08080a 55%, #050506 100%)';
  await page.setContent(`<body style="margin:0;${ground}"></body>`); await page.screenshot({ path: path.join(tmp, 'far.png') });
  await page.setContent(`<body style="margin:0;${ground}">${svgMarkup(data, 1920, 1080)}</body>`); await page.screenshot({ path: path.join(tmp, 'flat.png') });
  await browser.close();
  execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
t, out, root = sys.argv[1:4]
Image.open(t + '/far.png').convert('RGB').save(out + '/far.webp', 'WEBP', quality=92, method=6)
f = Image.open(t + '/flat.png').convert('RGB')
f.save(root + '/wallpapers/messy-thoughts.webp', 'WEBP', lossless=True, method=6)
f.resize((480, 270), Image.LANCZOS).save(root + '/wallpapers/thumbs/messy-thoughts.webp', 'WEBP', quality=86, method=6)
print(f.size)`, tmp, OUT, ROOT], { stdio: 'inherit' });
  console.log(`still ${data.still.length} strokes, live ${data.draw.length} strokes, data ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
