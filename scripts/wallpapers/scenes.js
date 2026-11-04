/* RepoVibe original wallpaper scenes — procedurally painted illustrations (no third-party artwork).
   Runs in a browser canvas (see generate.js). Every scene is deterministic for its seed.
   License: same as RepoVibe; original work created for this project. */
(function () {
  'use strict';
  const W = 1920, H = 1080;

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }
  function mix(h1, h2, t) { const a = hex(h1), b = hex(h2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`; }

  function vgrad(ctx, stops, y0 = 0, y1 = H) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function sky(ctx, stops) { ctx.fillStyle = vgrad(ctx, stops); ctx.fillRect(0, 0, W, H); }
  function glow(ctx, x, y, r, color, alpha = 1, op = 'lighter') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
    ctx.save(); ctx.globalCompositeOperation = op; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function stars(ctx, r, n, yMax, color = '#ffffff', maxSize = 1.8) {
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * yMax, s = Math.pow(r(), 3) * maxSize + 0.3;
      ctx.fillStyle = rgba(color, 0.35 + r() * 0.65);
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      if (s > maxSize * 0.75) glow(ctx, x, y, s * 6, color, 0.25);
    }
    ctx.restore();
  }
  /** Midpoint-displacement ridge from x=0..W; returns points. */
  function ridge(r, baseY, amp, rough = 0.55, detail = 9) {
    let pts = [[0, baseY + (r() - 0.5) * amp], [W, baseY + (r() - 0.5) * amp]];
    let disp = amp;
    for (let d = 0; d < detail; d++) {
      const next = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        next.push(pts[i], [(x1 + x2) / 2, (y1 + y2) / 2 + (r() - 0.5) * disp]);
      }
      next.push(pts[pts.length - 1]);
      pts = next; disp *= rough;
    }
    return pts;
  }
  function fillRidge(ctx, pts, fill, bottom = H) {
    ctx.beginPath(); ctx.moveTo(0, bottom);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W, bottom); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function mountains(ctx, r, baseY, amp, top, bottom, rough = 0.55) {
    const pts = ridge(r, baseY, amp, rough);
    const minY = Math.min(...pts.map(p => p[1]));
    fillRidge(ctx, pts, vgrad(ctx, [[0, top], [1, bottom]], minY, H));
    return pts;
  }
  function snowcaps(ctx, pts, color, depth) {
    // Snow on peaks: draw the ridge band and clip to it, then fill near the summits.
    const minY = Math.min(...pts.map(p => p[1]));
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, H); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W, H); ctx.closePath(); ctx.clip();
    ctx.fillStyle = vgrad(ctx, [[0, rgba(color, 0.95)], [1, rgba(color, 0)]], minY, minY + depth);
    ctx.fillRect(0, minY, W, depth);
    ctx.restore();
  }
  function haze(ctx, y, h, color, a) { ctx.fillStyle = vgrad(ctx, [[0, rgba(color, 0)], [0.5, rgba(color, a)], [1, rgba(color, 0)]], y, y + h); ctx.fillRect(0, y, W, h); }
  function pine(ctx, x, y, h, color, snow) {
    const w = h * 0.42;
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const ty = y - h + i * h * 0.2, bw = w * (0.45 + i * 0.2);
      ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x - bw, ty + h * 0.38); ctx.lineTo(x + bw, ty + h * 0.38); ctx.closePath(); ctx.fill();
      if (snow) { ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x - bw * 0.45, ty + h * 0.14); ctx.lineTo(x + bw * 0.4, ty + h * 0.13); ctx.closePath(); ctx.fill(); ctx.fillStyle = color; }
    }
    ctx.fillRect(x - h * 0.03, y - h * 0.08, h * 0.06, h * 0.1);
  }
  function forestRow(ctx, r, baseY, count, hMin, hMax, color, snow, gap) {
    for (let i = 0; i < count; i++) { const x = r() * W, h = lerp(hMin, hMax, r()); if (gap && x > gap[0] && x < gap[1]) continue; pine(ctx, x, baseY + r() * 30, h, color, snow); }
    ctx.fillStyle = color;
    if (gap) { ctx.fillRect(0, baseY + 20, gap[0], H - baseY); ctx.fillRect(gap[1], baseY + 20, W - gap[1], H - baseY); }
    else ctx.fillRect(0, baseY + 20, W, H - baseY);
  }
  function cloud(ctx, r, x, y, s, light, shade) {
    for (let i = 0; i < 9; i++) {
      const cx = x + (r() - 0.5) * s * 2.4, cy = y + (r() - 0.5) * s * 0.35, rad = s * (0.35 + r() * 0.45);
      const g = ctx.createRadialGradient(cx, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
      g.addColorStop(0, light); g.addColorStop(1, shade);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rad * 1.5, rad * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  function noise(ctx, r, amount = 0.035) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 255 * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
  }
  function vignette(ctx, color = '#000000', a = 0.45) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function rain(ctx, r, n, color, a, len = 40, slant = 6) {
    ctx.save(); ctx.strokeStyle = rgba(color, a); ctx.lineWidth = 1.2;
    for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, l = len * (0.5 + r()); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - slant, y + l); ctx.stroke(); }
    ctx.restore();
  }
  function petals(ctx, r, n, colors, yMin = 0) {
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = yMin + r() * (H - yMin), s = 3 + r() * 7;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r() * Math.PI);
      ctx.fillStyle = colors[Math.floor(r() * colors.length)]; ctx.globalAlpha = 0.55 + r() * 0.45;
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  function blossomTree(ctx, r, x, y, scale, trunk, pinks) {
    ctx.save(); ctx.strokeStyle = trunk; ctx.lineCap = 'round';
    const branch = (bx, by, ang, len, w, depth) => {
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(ang + 0.3) * len * 0.5, by + Math.sin(ang + 0.3) * len * 0.5, ex, ey); ctx.stroke();
      if (depth > 0) { branch(ex, ey, ang - 0.35 - r() * 0.3, len * 0.72, w * 0.68, depth - 1); branch(ex, ey, ang + 0.3 + r() * 0.3, len * 0.7, w * 0.66, depth - 1); }
      else for (let i = 0; i < 26; i++) { const px = ex + (r() - 0.5) * 120 * scale, py = ey + (r() - 0.5) * 80 * scale; ctx.fillStyle = pinks[Math.floor(r() * pinks.length)]; ctx.globalAlpha = 0.6 + r() * 0.4; ctx.beginPath(); ctx.arc(px, py, (8 + r() * 18) * scale, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    };
    branch(x, y, -Math.PI / 2 + (r() - 0.5) * 0.3, 190 * scale, 26 * scale, 4);
    ctx.restore();
  }
  function lantern(ctx, x, y, s, color) {
    glow(ctx, x, y, s * 6, color, 0.45);
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, s, s * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,20,0.8)'; ctx.fillRect(x - s * 0.7, y - s * 1.45, s * 1.4, s * 0.25); ctx.fillRect(x - s * 0.7, y + s * 1.2, s * 1.4, s * 0.25);
  }
  function house(ctx, r, x, y, w, h, wall, roof, lit) {
    ctx.fillStyle = wall; ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w * 0.12, y - h); ctx.lineTo(x + w / 2, y - h - h * 0.55); ctx.lineTo(x + w * 1.12, y - h); ctx.closePath(); ctx.fill();
    const cols = Math.max(1, Math.floor(w / 34));
    for (let i = 0; i < cols; i++) if (r() < 0.75) { const wx = x + 8 + i * (w - 16) / cols, wy = y - h * 0.7; ctx.fillStyle = r() < 0.7 ? lit : rgba('#000000', 0.25); ctx.fillRect(wx, wy, Math.min(18, w / cols - 8), h * 0.28); }
  }

  /* ---------------------------------------------------------------- scenes */
  const S = {};

  // Cyberpunk Neon — rainy neon street at night (Japanese-city inspired signs, no text)
  S['neon-rain-street'] = (ctx, r) => {
    sky(ctx, [[0, '#07051a'], [0.45, '#1c0d3a'], [1, '#05020c']]);
    glow(ctx, W * 0.5, H * 0.42, 700, '#ff2fa8', 0.25); glow(ctx, W * 0.5, H * 0.38, 420, '#38e1ff', 0.18);
    const vp = [W * 0.5, H * 0.46];
    // far towers
    for (let i = 0; i < 40; i++) { const x = r() * W, w = 40 + r() * 90, h = 200 + r() * 420; ctx.fillStyle = mix('#140b2c', '#2a1650', r()); ctx.fillRect(x, H * 0.55 - h, w, h); for (let k = 0; k < 30; k++) if (r() < 0.35) { ctx.fillStyle = rgba(r() < 0.5 ? '#ffd27a' : '#7fe8ff', 0.6); ctx.fillRect(x + 4 + r() * (w - 8), H * 0.55 - h + r() * h, 3, 4); } }
    haze(ctx, H * 0.3, H * 0.4, '#a03cff', 0.25);
    // street buildings both sides (perspective)
    const side = (dir) => {
      for (let i = 0; i < 7; i++) {
        const t = i / 7, x0 = dir < 0 ? lerp(0, vp[0] - 120, t * t) : lerp(W, vp[0] + 120, t * t), w = lerp(330, 40, t) * dir;
        const top = lerp(-50, vp[1] - 160, t), bot = lerp(H, vp[1] + 40, t);
        ctx.fillStyle = vgrad(ctx, [[0, mix('#2b1a52', '#3a2368', t)], [1, mix('#140b2a', '#22143f', t)]], top, bot); ctx.fillRect(Math.min(x0, x0 - w), top, Math.abs(w), bot - top);
        ctx.fillStyle = rgba('#ff7ad9', 0.35); ctx.fillRect(dir < 0 ? Math.max(x0, x0 - w) - 3 : Math.min(x0, x0 - w), top, 3, bot - top);
        // vertical neon sign
        const sc = ['#ff2fa8', '#38e1ff', '#ffd23f', '#9b5cff', '#3dff9e'][Math.floor(r() * 5)];
        const sx = x0 - w * (0.3 + r() * 0.4), sy = top + (bot - top) * (0.15 + r() * 0.3), sh = (bot - top) * 0.35, sw = Math.max(8, Math.abs(w) * 0.16);
        ctx.save(); ctx.shadowColor = sc; ctx.shadowBlur = 40 * (1 - t) + 8; ctx.fillStyle = rgba(sc, 0.9); ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = rgba('#ffffff', 0.85); for (let k = 0; k < 4; k++) ctx.fillRect(sx + sw * 0.25, sy + sh * (0.1 + k * 0.22), sw * 0.5, sh * 0.1); ctx.restore();
        // horizontal sign
        if (r() < 0.8) { const hc = ['#ff2fa8', '#38e1ff', '#ffb000'][Math.floor(r() * 3)]; ctx.save(); ctx.shadowColor = hc; ctx.shadowBlur = 30; ctx.strokeStyle = hc; ctx.lineWidth = 4 * (1 - t) + 1; ctx.strokeRect(Math.min(x0, x0 - w) + Math.abs(w) * 0.1, top + (bot - top) * 0.62, Math.abs(w) * 0.8, (bot - top) * 0.08); ctx.restore(); }
        for (let k = 0; k < 18; k++) if (r() < 0.5) { ctx.fillStyle = rgba('#ffcf8a', 0.5); ctx.fillRect(Math.min(x0, x0 - w) + r() * Math.abs(w), top + r() * (bot - top) * 0.9, 4 * (1 - t) + 1, 6 * (1 - t) + 1); }
      }
    };
    side(1); side(-1);
    // wet street with reflections
    ctx.fillStyle = vgrad(ctx, [[0, '#2a1446'], [1, '#0b0616']], vp[1] + 40, H); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(vp[0] - 120, vp[1] + 40); ctx.lineTo(vp[0] + 120, vp[1] + 40); ctx.lineTo(W, H); ctx.fill();
    for (let i = 0; i < 26; i++) { const x = lerp(W * 0.18, W * 0.82, r()), c = ['#ff2fa8', '#38e1ff', '#ffd23f', '#9b5cff'][Math.floor(r() * 4)]; ctx.fillStyle = vgrad(ctx, [[0, rgba(c, 0.35)], [1, rgba(c, 0)]], vp[1] + 60, H); ctx.fillRect(x, vp[1] + 60 + r() * 120, 3 + r() * 10, 200 + r() * 300); }
    glow(ctx, W * 0.5, H * 0.95, 500, '#ff2fa8', 0.12);
    rain(ctx, r, 1400, '#bcd8ff', 0.22, 46, 8);
    vignette(ctx, '#000000', 0.55); noise(ctx, r, 0.03);
  };

  // Midnight Developer — futuristic architecture under a starry night
  S['midnight-skyline'] = (ctx, r) => {
    sky(ctx, [[0, '#030716'], [0.55, '#0b1a3a'], [1, '#14284d']]);
    stars(ctx, r, 900, H * 0.6, '#cfe2ff', 2.2);
    glow(ctx, W * 0.78, H * 0.2, 260, '#9fc3ff', 0.25); ctx.fillStyle = '#e8f0ff'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.2, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b1a3a'; ctx.beginPath(); ctx.arc(W * 0.78 + 22, H * 0.2 - 10, 50, 0, Math.PI * 2); ctx.fill();
    mountains(ctx, r, H * 0.62, 160, '#0d1f3f', '#08142a');
    // sleek towers with light lines
    for (let i = 0; i < 26; i++) {
      const x = 60 + (i / 26) * W + (r() - 0.5) * 40, w = 46 + r() * 70, h = 220 + r() * 480 * (1 - Math.abs(i / 26 - 0.5)), y = H * 0.82 - h;
      ctx.fillStyle = vgrad(ctx, [[0, '#1d3561'], [1, '#081226']], y, H); ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, y + 30); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + 30); ctx.lineTo(x + w, H); ctx.fill();
      ctx.save(); ctx.shadowColor = '#6eacff'; ctx.shadowBlur = 12; ctx.strokeStyle = rgba('#6eacff', 0.7); ctx.lineWidth = 1.5;
      for (let k = 1; k < 8; k++) { const ly = y + 40 + k * h / 9; ctx.beginPath(); ctx.moveTo(x + 4, ly); ctx.lineTo(x + w - 4, ly); ctx.stroke(); }
      ctx.restore(); glow(ctx, x + w / 2, y, 30, '#ff6b9a', 0.5);
    }
    // sky bridge arcs
    ctx.save(); ctx.strokeStyle = rgba('#8fd0ff', 0.55); ctx.shadowColor = '#8fd0ff'; ctx.shadowBlur = 20; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(W * (0.1 + i * 0.3), H * 0.6 + i * 30); ctx.quadraticCurveTo(W * (0.25 + i * 0.3), H * 0.5 + i * 30, W * (0.4 + i * 0.3), H * 0.6 + i * 30); ctx.stroke(); }
    ctx.restore();
    // water reflection
    ctx.fillStyle = vgrad(ctx, [[0, '#0b1a3a'], [1, '#02060f']], H * 0.82, H); ctx.fillRect(0, H * 0.82, W, H);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = rgba('#6eacff', 0.08 + r() * 0.2); ctx.fillRect(r() * W, H * 0.83 + r() * H * 0.17, 20 + r() * 80, 1.5); }
    vignette(ctx, '#000000', 0.5); noise(ctx, r, 0.025);
  };

  // Sakura Dreams — cherry blossom street with traditional houses and lanterns
  S['sakura-street'] = (ctx, r) => {
    sky(ctx, [[0, '#fde3ee'], [0.5, '#fbd3e4'], [1, '#f6c7d9']]);
    glow(ctx, W * 0.3, H * 0.15, 600, '#fff6e8', 0.6, 'source-over');
    mountains(ctx, r, H * 0.42, 140, '#e9bfd6', '#dcb4cf', 0.5);
    haze(ctx, H * 0.35, H * 0.25, '#ffffff', 0.5);
    // street perspective
    ctx.fillStyle = vgrad(ctx, [[0, '#e8c4cf'], [1, '#c99aab']], H * 0.58, H); ctx.beginPath(); ctx.moveTo(W * 0.32, H); ctx.lineTo(W * 0.47, H * 0.58); ctx.lineTo(W * 0.53, H * 0.58); ctx.lineTo(W * 0.68, H); ctx.fill();
    ctx.fillStyle = '#b48a9a'; for (let i = 0; i < 12; i++) { const t = i / 12; ctx.fillRect(lerp(W * 0.47, W * 0.32, t * t), lerp(H * 0.58, H, t * t), lerp(W * 0.06, W * 0.36, t * t), 2); }
    // houses on both sides
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 6; i++) { const t = i / 6, sc = lerp(1, 0.3, t); const x = s < 0 ? lerp(-60, W * 0.42, t * 1.05) : lerp(W - 300 * sc + 60, W * 0.56, t * 1.05); house(ctx, r, x, lerp(H * 0.98, H * 0.6, t), 300 * sc, 220 * sc, mix('#fff3ee', '#e6c9cf', t), mix('#5b3e55', '#9d7d93', t), '#ffd7a0'); }
    for (let i = 0; i < 9; i++) { const t = i / 9; lantern(ctx, lerp(W * 0.3, W * 0.46, t), lerp(H * 0.62, H * 0.56, t), lerp(14, 4, t), '#ff8a6a'); lantern(ctx, lerp(W * 0.7, W * 0.54, t), lerp(H * 0.62, H * 0.56, t), lerp(14, 4, t), '#ff8a6a'); }
    const pinks = ['#ffb7d0', '#ffc8dc', '#ff9fc4', '#ffe0ec', '#f78fb8'];
    blossomTree(ctx, r, W * 0.12, H * 1.02, 1.6, '#5a3a48', pinks); blossomTree(ctx, r, W * 0.9, H * 1.02, 1.7, '#5a3a48', pinks);
    blossomTree(ctx, r, W * 0.3, H * 0.78, 0.8, '#6b4a58', pinks); blossomTree(ctx, r, W * 0.72, H * 0.78, 0.8, '#6b4a58', pinks);
    petals(ctx, r, 420, pinks);
    vignette(ctx, '#7a3a5a', 0.18); noise(ctx, r, 0.02);
  };

  // Cozy Coding — cozy illustrated room at night
  S['cozy-room'] = (ctx, r) => {
    ctx.fillStyle = vgrad(ctx, [[0, '#2b1d1a'], [1, '#1a1210']]); ctx.fillRect(0, 0, W, H);
    // wallpaper stripes
    for (let x = 0; x < W; x += 64) { ctx.fillStyle = rgba('#3c2a24', 0.5); ctx.fillRect(x, 0, 30, H * 0.72); }
    // window with night city
    const wx = W * 0.52, wy = H * 0.12, ww = W * 0.36, wh = H * 0.48;
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    ctx.fillStyle = vgrad(ctx, [[0, '#0d1633'], [1, '#2b2350']], wy, wy + wh); ctx.fillRect(wx, wy, ww, wh);
    stars(ctx, r, 120, H * 0.3, '#ffffff', 1.6);
    ctx.fillStyle = '#f5ecd2'; ctx.beginPath(); ctx.arc(wx + ww * 0.75, wy + wh * 0.25, 34, 0, Math.PI * 2); ctx.fill(); glow(ctx, wx + ww * 0.75, wy + wh * 0.25, 160, '#f5ecd2', 0.25);
    for (let i = 0; i < 24; i++) { const bx = wx + (i / 24) * ww, bh = 60 + r() * 160; ctx.fillStyle = '#141029'; ctx.fillRect(bx, wy + wh - bh, ww / 24 + 2, bh); for (let k = 0; k < 6; k++) if (r() < 0.5) { ctx.fillStyle = '#ffcf7a'; ctx.fillRect(bx + 4 + r() * 20, wy + wh - bh + 10 + r() * (bh - 20), 4, 5); } }
    rain(ctx, r, 160, '#cfd8ff', 0.25, 26, 3);
    ctx.restore();
    ctx.strokeStyle = '#5a3d2f'; ctx.lineWidth = 18; ctx.strokeRect(wx, wy, ww, wh); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    // curtains
    ctx.fillStyle = '#7a3b2c'; ctx.beginPath(); ctx.moveTo(wx - 70, wy - 30); ctx.quadraticCurveTo(wx + 30, wy + wh * 0.5, wx - 40, wy + wh + 60); ctx.lineTo(wx - 110, wy + wh + 60); ctx.lineTo(wx - 110, wy - 30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(wx + ww + 70, wy - 30); ctx.quadraticCurveTo(wx + ww - 30, wy + wh * 0.5, wx + ww + 40, wy + wh + 60); ctx.lineTo(wx + ww + 110, wy + wh + 60); ctx.lineTo(wx + ww + 110, wy - 30); ctx.fill();
    // shelves with books
    for (let s = 0; s < 3; s++) { const sy = H * (0.22 + s * 0.17); ctx.fillStyle = '#4a3226'; ctx.fillRect(W * 0.06, sy, W * 0.3, 12); let bx = W * 0.065; while (bx < W * 0.35) { const bw = 12 + r() * 18, bh = 60 + r() * 50; ctx.fillStyle = ['#a8553f', '#d0a35f', '#5f7f6a', '#8b5d7a', '#c97b4a', '#4e6a8a'][Math.floor(r() * 6)]; ctx.fillRect(bx, sy - bh, bw, bh); bx += bw + 2; } }
    // desk + lamp glow + monitor
    ctx.fillStyle = '#3e2a20'; ctx.fillRect(0, H * 0.72, W, H * 0.06); ctx.fillStyle = '#2a1b15'; ctx.fillRect(0, H * 0.78, W, H);
    glow(ctx, W * 0.3, H * 0.62, 520, '#ffb26b', 0.45);
    ctx.fillStyle = '#22252f'; ctx.fillRect(W * 0.2, H * 0.47, W * 0.2, H * 0.22); ctx.fillStyle = '#2f6f6a'; ctx.fillRect(W * 0.21, H * 0.485, W * 0.18, H * 0.19);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#9fe3c9', '#ffd38a', '#f39bb8', '#a3c7ff'][i % 4]; ctx.fillRect(W * 0.22 + (i % 3) * 18, H * 0.5 + i * 18, 60 + r() * 120, 7); }
    glow(ctx, W * 0.3, H * 0.58, 260, '#7fe0d0', 0.18);
    ctx.fillStyle = '#c98a4b'; ctx.beginPath(); ctx.moveTo(W * 0.43, H * 0.5); ctx.lineTo(W * 0.48, H * 0.5); ctx.lineTo(W * 0.5, H * 0.58); ctx.lineTo(W * 0.41, H * 0.58); ctx.fill(); ctx.fillRect(W * 0.452, H * 0.58, 8, H * 0.14);
    glow(ctx, W * 0.455, H * 0.6, 380, '#ffc480', 0.55);
    // plant + mug
    ctx.fillStyle = '#b2694a'; ctx.fillRect(W * 0.9, H * 0.64, 70, 80); for (let i = 0; i < 14; i++) { ctx.save(); ctx.translate(W * 0.9 + 35, H * 0.64); ctx.rotate(-1.2 + i * 0.18); ctx.fillStyle = i % 2 ? '#4f8a5a' : '#6aa86f'; ctx.beginPath(); ctx.ellipse(0, -60, 14, 60, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#e8d6c0'; ctx.fillRect(W * 0.6, H * 0.67, 46, 52); ctx.strokeStyle = '#e8d6c0'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(W * 0.6 + 52, H * 0.69, 14, -1.4, 1.4); ctx.stroke();
    vignette(ctx, '#000000', 0.55); noise(ctx, r, 0.03);
  };

  // Matrix — abstract digital rain
  S['digital-rain'] = (ctx, r) => {
    sky(ctx, [[0, '#010603'], [1, '#03150a']]);
    ctx.font = '22px monospace'; ctx.textBaseline = 'top';
    const glyphs = '0123456789ABCDEF<>/{}[]=+*#$%&@ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';
    for (let col = 0; col < W / 22; col++) {
      if (r() < 0.25) continue;
      const len = 8 + Math.floor(r() * 34), start = Math.floor(r() * 40) - 10, depth = r();
      ctx.save(); ctx.globalAlpha = 0.45 + depth * 0.55;
      for (let k = 0; k < len; k++) {
        const y = (start + k) * 26; const head = k === len - 1;
        ctx.fillStyle = head ? '#e9ffe9' : mix('#0a5a2a', '#4ad66d', k / len);
        if (head) { ctx.shadowColor = '#7dff9a'; ctx.shadowBlur = 18; }
        ctx.fillText(glyphs[Math.floor(r() * glyphs.length)], col * 22, y); ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
    glow(ctx, W * 0.5, H * 0.5, 900, '#1aff6a', 0.14);
    vignette(ctx, '#000000', 0.45); noise(ctx, r, 0.02);
  };

  // Dracula — gothic castle on a cliff under a blood moon
  S['gothic-castle'] = (ctx, r) => {
    sky(ctx, [[0, '#0d0a1c'], [0.6, '#2a1636'], [1, '#3a1d33']]);
    stars(ctx, r, 500, H * 0.6, '#e9e2ff', 1.8);
    glow(ctx, W * 0.66, H * 0.3, 420, '#ff6b7d', 0.25); ctx.fillStyle = '#f2c6c4'; ctx.beginPath(); ctx.arc(W * 0.66, H * 0.3, 120, 0, Math.PI * 2); ctx.fill(); glow(ctx, W * 0.66, H * 0.3, 160, '#ffdede', 0.35);
    for (let i = 0; i < 6; i++) cloud(ctx, r, r() * W, H * (0.2 + r() * 0.3), 90 + r() * 80, rgba('#5b3a63', 0.55), rgba('#2a1636', 0));
    mountains(ctx, r, H * 0.7, 180, '#251a33', '#120d1c');
    // castle
    const cx = W * 0.6, base = H * 0.66; ctx.fillStyle = '#0e0a16';
    const tower = (x, w, h, spire) => { ctx.fillRect(x, base - h, w, h); ctx.beginPath(); ctx.moveTo(x - 6, base - h); ctx.lineTo(x + w / 2, base - h - spire); ctx.lineTo(x + w + 6, base - h); ctx.fill(); for (let k = 0; k < 3; k++) if (r() < 0.7) { glow(ctx, x + w / 2, base - h + 30 + k * 40, 26, '#ffb35c', 0.5); ctx.fillStyle = '#ffb35c'; ctx.fillRect(x + w / 2 - 4, base - h + 24 + k * 40, 8, 14); ctx.fillStyle = '#0e0a16'; } };
    ctx.fillRect(cx - 260, base - 140, 520, 160);
    for (let i = 0; i < 12; i++) ctx.fillRect(cx - 260 + i * 44, base - 160, 22, 22);
    tower(cx - 300, 70, 260, 120); tower(cx - 120, 60, 340, 160); tower(cx + 40, 90, 420, 200); tower(cx + 200, 64, 300, 140); tower(cx + 290, 50, 220, 100);
    // cliff
    ctx.fillStyle = '#0a0711'; ctx.beginPath(); ctx.moveTo(cx - 420, H); ctx.lineTo(cx - 360, base); ctx.lineTo(cx + 380, base); ctx.lineTo(cx + 460, H); ctx.fill();
    // bats
    ctx.fillStyle = '#0a0711'; for (let i = 0; i < 18; i++) { const bx = W * 0.4 + r() * W * 0.5, by = H * 0.12 + r() * H * 0.3, s = 6 + r() * 10; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - s, by - s * 0.8, bx - s * 2, by); ctx.quadraticCurveTo(bx - s, by - s * 0.2, bx, by + s * 0.3); ctx.quadraticCurveTo(bx + s, by - s * 0.2, bx + s * 2, by); ctx.quadraticCurveTo(bx + s, by - s * 0.8, bx, by); ctx.fill(); }
    haze(ctx, H * 0.7, H * 0.3, '#bd93f9', 0.15);
    vignette(ctx, '#000000', 0.6); noise(ctx, r, 0.03);
  };

  // Ocean Depths — underwater light rays, kelp and fish
  S['ocean-depths'] = (ctx, r) => {
    sky(ctx, [[0, '#0e5f86'], [0.45, '#073a5a'], [1, '#021624']]);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const x = W * (0.1 + r() * 0.8), w = 40 + r() * 140; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba('#bff3ff', 0.22)); g.addColorStop(1, rgba('#bff3ff', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.2 + 200, H); ctx.lineTo(x + w * 0.6 + 150, H); ctx.fill(); }
    ctx.restore();
    // surface shimmer
    for (let i = 0; i < 300; i++) { ctx.fillStyle = rgba('#d9fbff', 0.1 + r() * 0.25); ctx.fillRect(r() * W, r() * 60, 30 + r() * 90, 2); }
    // fish schools
    for (let s = 0; s < 3; s++) { const sx = W * (0.2 + r() * 0.6), sy = H * (0.25 + r() * 0.35); for (let i = 0; i < 40; i++) { const x = sx + (r() - 0.5) * 360, y = sy + (r() - 0.5) * 140, f = 6 + r() * 8; ctx.fillStyle = rgba('#9fe8ff', 0.55); ctx.beginPath(); ctx.ellipse(x, y, f * 1.8, f * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - f * 1.6, y); ctx.lineTo(x - f * 2.6, y - f * 0.6); ctx.lineTo(x - f * 2.6, y + f * 0.6); ctx.fill(); } }
    // kelp
    for (let i = 0; i < 26; i++) { const x = r() * W, h = 250 + r() * 500; ctx.strokeStyle = mix('#0b3b33', '#1f7a5c', r()); ctx.lineWidth = 10 + r() * 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, H); for (let y = 0; y < h; y += 40) ctx.lineTo(x + Math.sin(y / 70 + i) * 26, H - y); ctx.stroke(); }
    // seabed + bubbles
    mountains(ctx, r, H * 0.9, 80, '#0c2b33', '#03121a');
    for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H, s = 1 + r() * 6; ctx.strokeStyle = rgba('#d9fbff', 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.stroke(); }
    vignette(ctx, '#000814', 0.55); noise(ctx, r, 0.02);
  };

  // Forest Retreat — dense misty forest with a waterfall
  S['forest-waterfall'] = (ctx, r) => {
    sky(ctx, [[0, '#cfe8d2'], [0.4, '#a6cfa9'], [1, '#2d4a33']]);
    glow(ctx, W * 0.35, H * 0.05, 700, '#fff7d6', 0.5);
    mountains(ctx, r, H * 0.35, 200, '#8fb79a', '#7aa487');
    haze(ctx, H * 0.3, H * 0.2, '#e6f5e6', 0.6);
    forestRow(ctx, r, H * 0.55, 80, 90, 170, '#5f8a66');
    haze(ctx, H * 0.5, H * 0.15, '#e6f5e6', 0.5);
    // rocky cliffs framing a tall waterfall
    const fx = W * 0.5;
    const cliff = (x0, x1, top, dir) => { ctx.fillStyle = vgrad(ctx, [[0, '#6c7b6c'], [1, '#2c3a30']], top, H); ctx.beginPath(); ctx.moveTo(x0, H); let y = top; ctx.lineTo(x0, y); for (let x = x0; dir > 0 ? x < x1 : x > x1; x += dir * 30) { y = top + (r() - 0.5) * 40; ctx.lineTo(x, y); } ctx.lineTo(x1, top + 20); for (let y2 = top + 20; y2 < H; y2 += 50) ctx.lineTo(x1 + (r() - 0.5) * 18, y2); ctx.lineTo(x1, H); ctx.closePath(); ctx.fill(); for (let k = 0; k < 40; k++) { ctx.strokeStyle = rgba('#1d2820', 0.35); ctx.lineWidth = 2; const sx = lerp(x0, x1, r()), sy = top + r() * (H - top); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (r() - 0.5) * 40, sy + 30 + r() * 50); ctx.stroke(); } };
    cliff(fx - 520, fx - 110, H * 0.3, 1); cliff(fx + 520, fx + 110, H * 0.32, -1);
    ctx.fillStyle = vgrad(ctx, [[0, '#dff6ff'], [1, '#9fd6ea']], H * 0.3, H); ctx.fillRect(fx - 112, H * 0.31, 224, H);
    for (let i = 0; i < 220; i++) { const x = fx - 110 + r() * 220; ctx.fillStyle = rgba(r() < 0.5 ? '#ffffff' : '#bfe7f5', 0.5 + r() * 0.5); ctx.fillRect(x, H * 0.31 + r() * 60, 1.5 + r() * 3, H); }
    ctx.fillStyle = rgba('#ffffff', 0.9); ctx.fillRect(fx - 112, H * 0.3, 224, 8);
    glow(ctx, fx, H * 0.86, 420, '#ffffff', 0.7, 'source-over');
    haze(ctx, H * 0.72, H * 0.28, '#f2fbff', 0.55);
    forestRow(ctx, r, H * 0.8, 50, 200, 360, '#2f5238', null, [fx - 260, fx + 260]);
    forestRow(ctx, r, H * 0.97, 26, 380, 640, '#1a3322', null, [fx - 380, fx + 380]);
    ctx.fillStyle = vgrad(ctx, [[0, '#a9dbe9'], [1, '#4d8a99']], H * 0.9, H); ctx.beginPath(); ctx.ellipse(fx, H * 1.02, 420, 110, 0, 0, Math.PI * 2); ctx.fill();
    // sun rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { const x = W * (0.2 + i * 0.08); ctx.fillStyle = vgrad(ctx, [[0, rgba('#fff4c2', 0.16)], [1, rgba('#fff4c2', 0)]], 0, H); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 340, H); ctx.lineTo(x + 220, H); ctx.fill(); } ctx.restore();
    vignette(ctx, '#0c1a10', 0.45); noise(ctx, r, 0.02);
  };

  function pixelScene(ctx, r, draw, pw = 320, ph = 180) {
    const c = document.createElement('canvas'); c.width = pw; c.height = ph; const p = c.getContext('2d'); p.imageSmoothingEnabled = false;
    draw(p, pw, ph); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
  }
  // Retro Terminal — retro pixel-art mountains at dusk
  S['pixel-dusk'] = (ctx, r) => pixelScene(ctx, r, (p, w, h) => {
    const bands = ['#1d1f12', '#2a2f17', '#3f461f', '#5d6530', '#8a9447', '#bdd774', '#e7f2a8'];
    bands.forEach((c, i) => { p.fillStyle = c; p.fillRect(0, Math.round(i * h * 0.08), w, Math.ceil(h * 0.08) + 1); });
    p.fillStyle = '#f1f3c9'; for (let y = -16; y <= 16; y++) { const hw = Math.floor(Math.sqrt(256 - y * y)); if (y % 4 !== 3) p.fillRect(w * 0.7 - hw, h * 0.42 + y, hw * 2, 1); }
    for (let i = 0; i < 40; i++) { p.fillStyle = '#e7f2a8'; p.fillRect(Math.floor(r() * w), Math.floor(r() * h * 0.3), 1, 1); }
    const layer = (base, amp, color, step) => { p.fillStyle = color; let y = base; for (let x = 0; x < w; x += step) { y += Math.round((r() - 0.5) * amp); y = Math.max(base - amp * 3, Math.min(base + amp, y)); p.fillRect(x, y, step, h - y); } };
    layer(h * 0.55, 6, '#4f5733', 3); layer(h * 0.65, 5, '#363d22', 2); layer(h * 0.76, 4, '#232816', 2);
    p.fillStyle = '#141709'; p.fillRect(0, h * 0.84, w, h);
    for (let i = 0; i < 24; i++) { const x = Math.floor(r() * w), th = 6 + Math.floor(r() * 10); p.fillStyle = '#0d0f06'; for (let k = 0; k < th; k++) p.fillRect(x - Math.floor(k / 3), h * 0.84 - th + k, 1 + Math.floor(k / 3) * 2, 1); }
    for (let i = 0; i < 30; i++) { p.fillStyle = '#bdd774'; p.fillRect(Math.floor(r() * w), Math.floor(h * 0.86 + r() * h * 0.12), 1, 1); }
  });
  // Pixel Paradise — pixel-art island village at twilight
  S['pixel-island'] = (ctx, r) => pixelScene(ctx, r, (p, w, h) => {
    const sk = ['#211a41', '#2f2460', '#4a2f7a', '#7a3f8c', '#b8579a', '#ff9bd5'];
    sk.forEach((c, i) => { p.fillStyle = c; p.fillRect(0, Math.round(i * h * 0.1), w, Math.ceil(h * 0.1) + 1); });
    for (let i = 0; i < 70; i++) { p.fillStyle = r() < 0.2 ? '#ffe9a8' : '#fbf3ff'; p.fillRect(Math.floor(r() * w), Math.floor(r() * h * 0.4), 1, 1); }
    p.fillStyle = '#fff2c4'; for (let y = -10; y <= 10; y++) { const hw = Math.floor(Math.sqrt(100 - y * y)); p.fillRect(w * 0.22 - hw, h * 0.25 + y, hw * 2, 1); }
    p.fillStyle = '#1a2a5a'; p.fillRect(0, h * 0.6, w, h);
    for (let i = 0; i < 90; i++) { p.fillStyle = r() < 0.5 ? '#3a4f9a' : '#ff9bd5'; p.fillRect(Math.floor(r() * w), Math.floor(h * 0.62 + r() * h * 0.38), 2 + Math.floor(r() * 4), 1); }
    // island
    p.fillStyle = '#2d6a4f'; for (let x = 0; x < 150; x++) { const yy = Math.round(Math.sin((x / 150) * Math.PI) * 30); p.fillRect(w * 0.45 + x, h * 0.6 - yy, 1, yy + 2); }
    p.fillStyle = '#e8c27a'; p.fillRect(w * 0.45, h * 0.59, 150, 3);
    for (let i = 0; i < 5; i++) { const hx = Math.floor(w * 0.5 + i * 22), hy = Math.floor(h * 0.56 - Math.sin(((i * 22 + 10) / 150) * Math.PI) * 26); p.fillStyle = '#f2e3d5'; p.fillRect(hx, hy - 8, 12, 8); p.fillStyle = '#c4425f'; for (let k = 0; k < 6; k++) p.fillRect(hx - 1 + k, hy - 9 - k, 14 - 2 * k, 1); p.fillStyle = '#ffd36b'; p.fillRect(hx + 4, hy - 5, 3, 3); }
    for (let i = 0; i < 4; i++) { const tx = Math.floor(w * 0.47 + i * 38); p.fillStyle = '#6b4a2b'; p.fillRect(tx, h * 0.5, 2, 14); p.fillStyle = '#3fa36b'; p.fillRect(tx - 5, h * 0.49, 12, 2); p.fillRect(tx - 3, h * 0.47, 8, 2); }
    p.fillStyle = 'rgba(255,155,213,0.6)'; for (let y = 0; y < 30; y += 2) p.fillRect(w * 0.22 - 6 + (y % 4), h * 0.62 + y, 12 - y / 3, 1);
  });

  // Solar Flare — dramatic sunset over mountains and sea
  S['solar-sunset'] = (ctx, r) => {
    sky(ctx, [[0, '#2a0f2e'], [0.35, '#a8323a'], [0.6, '#ff8a3d'], [0.75, '#ffd27a'], [1, '#ffeec4']]);
    glow(ctx, W * 0.5, H * 0.66, 900, '#ffb347', 0.5); glow(ctx, W * 0.5, H * 0.66, 220, '#fff5d6', 0.9);
    ctx.fillStyle = '#fff3d0'; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.66, 90, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) cloud(ctx, r, r() * W, H * (0.12 + r() * 0.38), 70 + r() * 110, rgba('#ffb38a', 0.75), rgba('#6b2340', 0));
    mountains(ctx, r, H * 0.68, 160, '#5a2232', '#3a1424');
    mountains(ctx, r, H * 0.76, 120, '#3a1424', '#24091a');
    ctx.fillStyle = vgrad(ctx, [[0, '#7a2f3a'], [1, '#1b0812']], H * 0.8, H); ctx.fillRect(0, H * 0.8, W, H);
    for (let i = 0; i < 220; i++) { const y = H * 0.81 + r() * H * 0.19, spread = (y - H * 0.8) * 1.6 + 40; ctx.fillStyle = rgba('#ffd27a', 0.25 + r() * 0.45); ctx.fillRect(W * 0.5 + (r() - 0.5) * spread, y, 20 + r() * 80, 2); }
    for (let i = 0; i < 9; i++) { const bx = W * (0.25 + r() * 0.5), by = H * (0.25 + r() * 0.2), s = 7 + r() * 6; ctx.strokeStyle = '#2a0f2e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx - s, by); ctx.quadraticCurveTo(bx - s / 2, by - s / 2, bx, by); ctx.quadraticCurveTo(bx + s / 2, by - s / 2, bx + s, by); ctx.stroke(); }
    vignette(ctx, '#140410', 0.45); noise(ctx, r, 0.025);
  };

  // Arctic Frost — snow-covered mountains and a frozen lake
  S['snow-peaks'] = (ctx, r) => {
    sky(ctx, [[0, '#a9d4f5'], [0.5, '#d9edfb'], [1, '#f4fbff']]);
    glow(ctx, W * 0.75, H * 0.12, 500, '#ffffff', 0.8, 'source-over');
    for (let i = 0; i < 6; i++) cloud(ctx, r, r() * W, H * (0.1 + r() * 0.15), 60 + r() * 60, rgba('#ffffff', 0.8), rgba('#ffffff', 0));
    let p = mountains(ctx, r, H * 0.36, 420, '#6f8cab', '#9fb6cc', 0.62); snowcaps(ctx, p, '#ffffff', 95);
    haze(ctx, H * 0.48, H * 0.1, '#ffffff', 0.25);
    p = mountains(ctx, r, H * 0.52, 300, '#34506e', '#6d87a3', 0.62); snowcaps(ctx, p, '#f7fbff', 80);
    haze(ctx, H * 0.62, H * 0.08, '#ffffff', 0.25);
    // frozen lake
    ctx.fillStyle = vgrad(ctx, [[0, '#cfe4f4'], [1, '#e9f4fb']], H * 0.66, H); ctx.fillRect(0, H * 0.66, W, H);
    for (let i = 0; i < 120; i++) { ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 1; ctx.beginPath(); const x = r() * W, y = H * 0.68 + r() * H * 0.3; ctx.moveTo(x, y); ctx.lineTo(x + 40 + r() * 120, y + (r() - 0.5) * 8); ctx.stroke(); }
    forestRow(ctx, r, H * 0.86, 40, 120, 260, '#3f5a72', '#ffffff');
    for (let i = 0; i < 300; i++) { ctx.fillStyle = rgba('#ffffff', 0.6 + r() * 0.4); ctx.beginPath(); ctx.arc(r() * W, r() * H, 1 + r() * 2.5, 0, Math.PI * 2); ctx.fill(); }
    vignette(ctx, '#5b7a99', 0.18); noise(ctx, r, 0.015);
  };

  // Lavender Nights — fantasy floating islands over lavender fields
  S['lavender-fantasy'] = (ctx, r) => {
    sky(ctx, [[0, '#120d2e'], [0.5, '#3a2a6a'], [1, '#8e6ac2']]);
    stars(ctx, r, 700, H * 0.6, '#f3e9ff', 2);
    glow(ctx, W * 0.25, H * 0.25, 360, '#e7d1ff', 0.35); ctx.fillStyle = '#f5ecff'; ctx.beginPath(); ctx.arc(W * 0.25, H * 0.25, 80, 0, Math.PI * 2); ctx.fill();
    // floating islands
    const island = (x, y, s) => { ctx.fillStyle = '#3c2f5c'; ctx.beginPath(); ctx.moveTo(x - 160 * s, y); ctx.lineTo(x + 160 * s, y); ctx.lineTo(x + 40 * s, y + 150 * s); ctx.lineTo(x - 20 * s, y + 200 * s); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6f4fa0'; ctx.beginPath(); ctx.ellipse(x, y, 165 * s, 26 * s, 0, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 4; i++) pine(ctx, x - 100 * s + i * 60 * s, y, 70 * s, '#2a1f45'); glow(ctx, x, y + 60 * s, 140 * s, '#d0a6ff', 0.25); for (let i = 0; i < 6; i++) { ctx.strokeStyle = rgba('#d0a6ff', 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + (r() - 0.5) * 120 * s, y + 80 * s); ctx.lineTo(x + (r() - 0.5) * 120 * s, y + 220 * s); ctx.stroke(); } };
    island(W * 0.68, H * 0.28, 1.1); island(W * 0.45, H * 0.42, 0.55); island(W * 0.88, H * 0.47, 0.45);
    mountains(ctx, r, H * 0.62, 140, '#4a3a7a', '#5f4a90');
    haze(ctx, H * 0.58, H * 0.2, '#c9a8ff', 0.35);
    // lavender field rows
    for (let row = 0; row < 26; row++) { const t = row / 26, y = lerp(H * 0.68, H * 1.05, t * t); ctx.fillStyle = mix('#5d3f9a', '#9a6ad6', t); ctx.beginPath(); ctx.ellipse(W / 2, y, W * (0.6 + t), 10 + t * 40, 0, 0, Math.PI * 2); ctx.fill(); for (let k = 0; k < 40 + t * 120; k++) { ctx.fillStyle = rgba(r() < 0.5 ? '#c49bff' : '#e2c7ff', 0.7); ctx.fillRect(r() * W, y - (4 + t * 20) * r(), 2 + t * 3, 4 + t * 10); } }
    for (let i = 0; i < 140; i++) glow(ctx, r() * W, H * (0.3 + r() * 0.7), 6 + r() * 10, '#ffe8a8', 0.6);
    vignette(ctx, '#0a0618', 0.5); noise(ctx, r, 0.025);
  };

  // Dark Academia — candle-lit library with arches
  S['academia-library'] = (ctx, r) => {
    ctx.fillStyle = vgrad(ctx, [[0, '#1c1410'], [1, '#2b1f17']]); ctx.fillRect(0, 0, W, H);
    // arches
    for (let a = 0; a < 3; a++) { const cx = W * (0.2 + a * 0.3), w = 420, top = H * 0.12; ctx.fillStyle = '#120c09'; ctx.beginPath(); ctx.moveTo(cx - w / 2, H); ctx.lineTo(cx - w / 2, top + w / 2); ctx.arc(cx, top + w / 2, w / 2, Math.PI, 0); ctx.lineTo(cx + w / 2, H); ctx.fill();
      // shelves inside arch
      for (let s = 0; s < 8; s++) { const sy = top + w / 2 + s * 92 - 140; if (sy < top + 60) continue; ctx.fillStyle = '#4a3324'; ctx.fillRect(cx - w / 2 + 20, sy, w - 40, 10); let bx = cx - w / 2 + 24; while (bx < cx + w / 2 - 30) { const bw = 10 + r() * 16, bh = 50 + r() * 30; ctx.fillStyle = ['#5c2a22', '#7a5230', '#3f4a33', '#6b5a3c', '#8a6a3a', '#2f3a48', '#5a3a4a'][Math.floor(r() * 7)]; ctx.fillRect(bx, sy - bh, bw, bh); if (r() < 0.4) { ctx.fillStyle = rgba('#d4b47d', 0.7); ctx.fillRect(bx + 2, sy - bh + 8, bw - 4, 2); } bx += bw + 1.5; } }
      ctx.strokeStyle = '#6b4c34'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(cx - w / 2, H); ctx.lineTo(cx - w / 2, top + w / 2); ctx.arc(cx, top + w / 2, w / 2, Math.PI, 0); ctx.lineTo(cx + w / 2, H); ctx.stroke(); }
    // pillars
    for (let i = 0; i < 4; i++) { const x = W * (0.05 + i * 0.3); ctx.fillStyle = vgrad(ctx, [[0, '#3a2a1f'], [1, '#22170f']]); ctx.fillRect(x - 30, 0, 60, H); }
    // reading table + candles
    ctx.fillStyle = '#3b2717'; ctx.fillRect(W * 0.25, H * 0.8, W * 0.5, 22); ctx.fillStyle = '#2a1b10'; ctx.fillRect(W * 0.28, H * 0.82, 16, H); ctx.fillRect(W * 0.71, H * 0.82, 16, H);
    for (let i = 0; i < 5; i++) { const x = W * (0.32 + i * 0.09), h = 40 + r() * 30; ctx.fillStyle = '#efe2c4'; ctx.fillRect(x, H * 0.8 - h, 12, h); glow(ctx, x + 6, H * 0.8 - h - 10, 220, '#ffbf66', 0.45); ctx.fillStyle = '#ffd68a'; ctx.beginPath(); ctx.ellipse(x + 6, H * 0.8 - h - 10, 5, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d9c7a1'; ctx.save(); ctx.translate(W * 0.47, H * 0.79); ctx.rotate(-0.05); ctx.fillRect(-90, -10, 180, 10); ctx.restore();
    // dust motes in light
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = vgrad(ctx, [[0, rgba('#ffd9a0', 0.14)], [1, rgba('#ffd9a0', 0)]]); ctx.beginPath(); ctx.moveTo(W * 0.42, 0); ctx.lineTo(W * 0.58, 0); ctx.lineTo(W * 0.7, H); ctx.lineTo(W * 0.38, H); ctx.fill(); ctx.restore();
    for (let i = 0; i < 160; i++) { ctx.fillStyle = rgba('#ffe2b0', 0.3 + r() * 0.5); ctx.beginPath(); ctx.arc(W * (0.4 + r() * 0.25), r() * H, 0.8 + r() * 1.6, 0, Math.PI * 2); ctx.fill(); }
    vignette(ctx, '#000000', 0.65); noise(ctx, r, 0.03);
  };

  // Minimal White — minimal monochrome line-art mountains
  S['mono-lines'] = (ctx, r) => {
    sky(ctx, [[0, '#ffffff'], [1, '#eef1f6']]);
    ctx.fillStyle = '#e4e8ef'; ctx.beginPath(); ctx.arc(W * 0.7, H * 0.3, 130, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 18; i++) { const pts = ridge(r, H * (0.38 + i * 0.035), 220 - i * 8, 0.5, 8); ctx.strokeStyle = rgba('#2b3240', 0.12 + i * 0.03); ctx.lineWidth = 1.2 + i * 0.08; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    ctx.fillStyle = rgba('#466ce6', 0.9); ctx.beginPath(); ctx.arc(W * 0.7, H * 0.3, 8, 0, Math.PI * 2); ctx.fill();
    noise(ctx, r, 0.012);
  };

  // Obsidian — dark faceted monochrome abstraction
  S['obsidian-shards'] = (ctx, r) => {
    sky(ctx, [[0, '#0d0e11'], [1, '#15161b']]);
    for (let i = 0; i < 90; i++) {
      const cx = r() * W, cy = r() * H, s = 80 + r() * 320, a = r() * Math.PI;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      const g = ctx.createLinearGradient(-s, -s, s, s); const l = Math.floor(18 + r() * 40); g.addColorStop(0, `rgb(${l},${l},${l + 6})`); g.addColorStop(1, `rgb(${l - 10},${l - 10},${l - 6})`);
      ctx.fillStyle = g; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.4, 0); ctx.lineTo(0, s * 0.7); ctx.lineTo(-s * 0.35, s * 0.1); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.strokeStyle = '#a5a9bd'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    glow(ctx, W * 0.3, H * 0.4, 600, '#a5a9bd', 0.08);
    vignette(ctx, '#000000', 0.6); noise(ctx, r, 0.025);
  };

  // Aurora — aurora curtains over a snowy lake
  S['aurora-lake'] = (ctx, r) => {
    sky(ctx, [[0, '#04101c'], [0.6, '#0b2733'], [1, '#123642']]);
    stars(ctx, r, 900, H * 0.7, '#e8fff8', 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const curtain = (y0, amp, freq, color, color2, seed) => { for (let x = 0; x < W; x += 3) { const y = y0 + Math.sin(x / freq + seed) * amp + Math.sin(x / (freq * 0.37) + seed * 2) * amp * 0.3; const h = 180 + Math.sin(x / 90 + seed) * 80 + 120; const g = ctx.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, rgba(color2, 0)); g.addColorStop(0.7, rgba(color, 0.08)); g.addColorStop(1, rgba(color, 0.22)); ctx.fillStyle = g; ctx.fillRect(x, y - h, 3, h); } };
    curtain(H * 0.42, 70, 240, '#5dffb8', '#7a6bff', 1.3); curtain(H * 0.32, 50, 300, '#7eedd7', '#c06bff', 4.1); curtain(H * 0.5, 40, 200, '#3dff9e', '#2db8ff', 2.2);
    ctx.restore();
    mountains(ctx, r, H * 0.62, 150, '#0d2230', '#0a1a25');
    let p = mountains(ctx, r, H * 0.66, 90, '#16303d', '#0c1d27'); snowcaps(ctx, p, '#cfe9ef', 60);
    // lake reflection
    ctx.fillStyle = vgrad(ctx, [[0, '#0d2a33'], [1, '#03121a']], H * 0.7, H); ctx.fillRect(0, H * 0.7, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 260; i++) { ctx.fillStyle = rgba(r() < 0.6 ? '#5dffb8' : '#7a6bff', 0.05 + r() * 0.12); ctx.fillRect(r() * W, H * 0.71 + r() * H * 0.27, 40 + r() * 140, 2); } ctx.restore();
    forestRow(ctx, r, H * 0.94, 34, 120, 240, '#03090e');
    vignette(ctx, '#000000', 0.5); noise(ctx, r, 0.02);
  };

  // Sunset Boulevard — peaceful anime-inspired hillside village at sunset
  S['sunset-village'] = (ctx, r) => {
    sky(ctx, [[0, '#3a2a6e'], [0.35, '#c75a7a'], [0.62, '#ff9d82'], [0.8, '#ffd3a1'], [1, '#ffe6c4']]);
    glow(ctx, W * 0.62, H * 0.62, 700, '#ffc38a', 0.45); ctx.fillStyle = '#fff1d6'; ctx.beginPath(); ctx.arc(W * 0.62, H * 0.6, 70, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 14; i++) cloud(ctx, r, r() * W, H * (0.12 + r() * 0.35), 60 + r() * 90, rgba('#ffd1b3', 0.85), rgba('#8d3f6a', 0));
    mountains(ctx, r, H * 0.6, 120, '#8d4a6a', '#a35a72');
    haze(ctx, H * 0.55, H * 0.15, '#ffc9a8', 0.5);
    // hill with houses
    const hill = ridge(r, H * 0.72, 120, 0.5, 8); fillRidge(ctx, hill, vgrad(ctx, [[0, '#5c2f52'], [1, '#2a1630']], H * 0.6, H));
    for (let i = 0; i < 22; i++) { const x = (i / 22) * W + (r() - 0.5) * 40, idx = Math.max(0, Math.min(hill.length - 1, Math.floor((x / W) * hill.length))), y = hill[idx][1] + 30 + r() * 120; house(ctx, r, x, y, 70 + r() * 70, 50 + r() * 40, mix('#4a2443', '#6a3858', r()), '#2a1430', '#ffcf7a'); }
    // power lines + poles
    ctx.strokeStyle = '#1e0f22'; ctx.lineWidth = 6; const poles = [W * 0.08, W * 0.36, W * 0.66, W * 0.94];
    poles.forEach(x => { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, H * 0.32); ctx.stroke(); ctx.fillStyle = '#1e0f22'; ctx.fillRect(x - 50, H * 0.35, 100, 6); ctx.fillRect(x - 36, H * 0.4, 72, 5); });
    ctx.lineWidth = 2; for (let k = 0; k < 3; k++) for (let i = 0; i < poles.length - 1; i++) { ctx.beginPath(); ctx.moveTo(poles[i] - 40 + k * 40, H * 0.355); ctx.quadraticCurveTo((poles[i] + poles[i + 1]) / 2, H * 0.42 + k * 8, poles[i + 1] - 40 + k * 40, H * 0.355); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { const bx = W * (0.4 + r() * 0.4), by = H * (0.18 + r() * 0.15), s = 6 + r() * 6; ctx.strokeStyle = '#3a1a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - s, by); ctx.quadraticCurveTo(bx - s / 2, by - s / 2, bx, by); ctx.quadraticCurveTo(bx + s / 2, by - s / 2, bx + s, by); ctx.stroke(); }
    vignette(ctx, '#2a0f2a', 0.35); noise(ctx, r, 0.02);
  };

  // Galaxy — nebula, spiral galaxy and a ringed planet
  S['galaxy-planet'] = (ctx, r) => {
    sky(ctx, [[0, '#04041a'], [1, '#0b0b25']]);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const neb = [['#5b3cff', 0.18], ['#ff4fb8', 0.12], ['#3ad6ff', 0.1], ['#979bff', 0.14]];
    for (let i = 0; i < 40; i++) { const [c, a] = neb[i % 4]; glow(ctx, W * (0.2 + r() * 0.7), H * (0.1 + r() * 0.6), 120 + r() * 360, c, a * (0.5 + r()), 'lighter'); }
    // spiral galaxy
    const gx = W * 0.32, gy = H * 0.36;
    for (let i = 0; i < 2600; i++) { const arm = i % 2, t = r() * 6, rad = t * 40 + r() * 30, ang = t + arm * Math.PI + (r() - 0.5) * 0.5; const x = gx + Math.cos(ang) * rad * 1.6, y = gy + Math.sin(ang) * rad * 0.6; ctx.fillStyle = rgba(r() < 0.3 ? '#ffd9f2' : '#c8d2ff', 0.25 + r() * 0.5); ctx.fillRect(x, y, 1.6, 1.6); }
    glow(ctx, gx, gy, 120, '#fff0fa', 0.7, 'lighter');
    ctx.restore();
    stars(ctx, r, 1400, H, '#ffffff', 2.4);
    // planet with rings
    const px = W * 0.74, py = H * 0.66, pr = 230;
    ctx.save(); ctx.strokeStyle = rgba('#c9b8ff', 0.5); ctx.lineWidth = 16; ctx.beginPath(); ctx.ellipse(px, py, pr * 1.9, pr * 0.42, -0.25, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore();
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr); pg.addColorStop(0, '#9fa6ff'); pg.addColorStop(0.6, '#4a3fb0'); pg.addColorStop(1, '#130f3a');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip(); for (let i = 0; i < 12; i++) { ctx.fillStyle = rgba(i % 2 ? '#c6b5ff' : '#2d2580', 0.18); ctx.fillRect(px - pr, py - pr + i * pr / 6 + r() * 10, pr * 2, 10 + r() * 16); } ctx.restore();
    ctx.save(); ctx.strokeStyle = rgba('#e3d8ff', 0.75); ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(px, py, pr * 1.9, pr * 0.42, -0.25, 0, Math.PI); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.beginPath(); ctx.ellipse(px, py, pr * 2.1, pr * 0.5, -0.25, 0, Math.PI); ctx.stroke(); ctx.restore();
    glow(ctx, px - pr * 0.9, py - pr * 0.3, 260, '#7f86ff', 0.2);
    vignette(ctx, '#000000', 0.55); noise(ctx, r, 0.02);
  };

  // Synthwave — retro-futuristic sun, grid and neon mountains
  S['synthwave-grid'] = (ctx, r) => {
    sky(ctx, [[0, '#0d0221'], [0.45, '#3a0a5a'], [0.62, '#a12f8a'], [0.7, '#ff6ac1'], [0.71, '#1a0533'], [1, '#0a0118']]);
    stars(ctx, r, 400, H * 0.5, '#fff1ff', 1.8);
    // sun with stripes
    const sx = W / 2, sy = H * 0.5, sr = 260;
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = vgrad(ctx, [[0, '#ffe46b'], [0.5, '#ff8a5c'], [1, '#ff2fa8']], sy - sr, sy + sr); ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.fillStyle = '#1a0533'; for (let i = 0; i < 9; i++) { const y = sy + i * 26 - 20, h = 3 + i * 2.2; if (y > sy - 40) ctx.fillRect(sx - sr, y, sr * 2, h); }
    ctx.restore(); glow(ctx, sx, sy, 520, '#ff4fb8', 0.35);
    // neon mountains
    const m = ridge(r, H * 0.66, 180, 0.52, 8); fillRidge(ctx, m, vgrad(ctx, [[0, '#2a0b4a'], [1, '#12032a']], H * 0.45, H * 0.72), H * 0.71);
    ctx.save(); ctx.strokeStyle = '#ff65c3'; ctx.shadowColor = '#ff65c3'; ctx.shadowBlur = 18; ctx.lineWidth = 3; ctx.beginPath(); m.forEach(([x, y], k) => (k ? ctx.lineTo(x, Math.min(y, H * 0.71)) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
    // perspective grid
    const hz = H * 0.71; ctx.fillStyle = vgrad(ctx, [[0, '#1a0533'], [1, '#0a0118']], hz, H); ctx.fillRect(0, hz, W, H - hz);
    ctx.save(); ctx.strokeStyle = '#d14bff'; ctx.shadowColor = '#d14bff'; ctx.shadowBlur = 10; ctx.lineWidth = 2;
    for (let i = -24; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 12, hz); ctx.lineTo(W / 2 + i * 160, H); ctx.stroke(); }
    for (let k = 1; k < 16; k++) { const y = hz + Math.pow(k / 16, 2.2) * (H - hz); ctx.globalAlpha = 0.3 + k / 20; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    vignette(ctx, '#000000', 0.5); noise(ctx, r, 0.025);
  };

  // Fallback-free registry in preset order.
  window.REPV_SCENES = S;
})();
