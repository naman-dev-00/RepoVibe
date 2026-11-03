#!/usr/bin/env node
'use strict';
/* Renders RepoVibe's 3D wallpaper scenes (raymarched GLSL in WebGL2, headless Chromium).
   Usage: node scripts/wallpapers/render3d.js [slug ...] [--preview WxH] [--out dir]
   Full renders: 2560x1440, 2x2 supersampled, rendered in strips, saved as WebP + 480x270 thumbnail. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, 'shaders');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const preview = opt('--preview', null);
const outDir = path.resolve(opt('--out', path.join(__dirname, '../../wallpapers')));
const slugs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const all = fs.readdirSync(DIR).filter(f => f.endsWith('.glsl') && f !== 'common.glsl').map(f => f.replace('.glsl', ''));
const list = slugs.length ? slugs : all;
const [W, H] = preview ? preview.split('x').map(Number) : [2560, 1440];
const common = fs.readFileSync(path.join(DIR, 'common.glsl'), 'utf8');

(async () => {
  fs.mkdirSync(path.join(outDir, 'thumbs'), { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
  for (const slug of list) {
    const src = `#version 300 es\n${common}\n${fs.readFileSync(path.join(DIR, `${slug}.glsl`), 'utf8')}`;
    const t0 = Date.now();
    const out = await page.evaluate(async ([src, W, H, seed]) => {
      const strip = 120;
      const gl = new OffscreenCanvas(W, strip).getContext('webgl2', { preserveDrawingBuffer: true });
      const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, src)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), W, H);
      gl.uniform1f(gl.getUniformLocation(pr, 'uSeed'), seed);
      const full = new OffscreenCanvas(W, H); const fctx = full.getContext('2d');
      const px = new Uint8ClampedArray(W * strip * 4);
      for (let y = 0; y < H; y += strip) {
        const h = Math.min(strip, H - y);
        gl.viewport(0, 0, W, strip);
        gl.uniform2f(gl.getUniformLocation(pr, 'uOffset'), 0, y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, W, h, gl.RGBA, gl.UNSIGNED_BYTE, px.subarray(0, W * h * 4));
        // GL rows are bottom-up; image rows top-down: strip covering GL y..y+h maps to image rows H-y-h..H-y.
        const img = new ImageData(W, h);
        for (let r = 0; r < h; r++) img.data.set(px.subarray((h - 1 - r) * W * 4, (h - r) * W * 4), r * W * 4);
        fctx.putImageData(img, 0, H - y - h);
      }
      const enc = async (c, q) => { const b = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: q })).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
      const thumb = new OffscreenCanvas(480, 270); const tc = thumb.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(full, 0, 0, 480, 270);
      return { full: await enc(full, 0.9), thumb: await enc(thumb, 0.82) };
    }, [src, W, H, 7]);
    const name = preview ? `${slug}.preview.webp` : `${slug}.webp`;
    fs.writeFileSync(path.join(outDir, name), Buffer.from(out.full, 'base64'));
    if (!preview) fs.writeFileSync(path.join(outDir, 'thumbs', `${slug}.webp`), Buffer.from(out.thumb, 'base64'));
    console.log(`${slug.padEnd(20)} ${W}x${H} ${((Date.now() - t0) / 1000).toFixed(1)} s  ${(fs.statSync(path.join(outDir, name)).size / 1024).toFixed(0)} KB`);
  }
  await browser.close();
})().catch(e => { console.error(e.message || e); process.exit(1); });
