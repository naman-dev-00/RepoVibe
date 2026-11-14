// @lib2d
// @sprites palmA:480x640, palmB:420x600, cloudA:640x240, cloudB:520x200, gull:160x96, cube:160x160, crab:200x120
// Pixel Paradise — a sunny tropical lagoon in classic clean pixel art (original). One pixel grid (N cells per scene height), a limited
// palette, flat stepped shading (3–5 tones per material) with dark outlines, and only small ordered-dither seams between sky bands —
// crisp at any size, no blur. Honest label: layered 2.5D pixel-art illustration, not real-time 3D.
// uLayer: 1 far (banded sky, sun, puffy clouds, distant islands, lagoon) · 2 mid (jungle cliff with waterfall, stilt hut and pier,
// palm islet) · 3 near (beach, foam, shells, rocks) · 4 front (framing fronds and beach plants) · 5 sun glow · 10+ sprites.
const float N = 150.0;                    // pixel cells per scene height
vec2 q(vec2 uv) { return (floor(uv * N) + 0.5) / N; }
vec2 cellOf(vec2 uv) { return floor(uv * N); }
const float HZ = -0.02;                   // horizon (sea line)
const vec2 SUN = vec2(0.62, 0.32);
const float PX = 1.0 / 150.0;             // one pixel in scene units
float bayer(vec2 c) { vec2 p = mod(c, 4.0); int i = int(p.x) + int(p.y) * 4; int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(m[i]) + 0.5) / 16.0; }
vec3 H(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0; }
// stepped tone from a palette of 5 (no dither): t in [0,1]
vec3 tone5(vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, float t) { t = clamp(t, 0.0, 0.999); return t < 0.2 ? a : t < 0.4 ? b : t < 0.6 ? c : t < 0.8 ? d : e; }
vec4 overP(vec4 top, vec4 under) { return top.a > 0.0 ? top : under; }
// shape with a one-pixel dark outline: d is a signed distance in scene units
vec4 outlined(float d, vec3 fill, vec3 line) { if (d > 0.0) return d < PX * 1.05 ? vec4(line, 1.0) : vec4(0.0); return vec4(fill, 1.0); }

// ---------------- far: sky, sun, clouds, distant islands, lagoon
vec3 skyCol(vec2 c, vec2 cell) {
  vec3 B[6] = vec3[6](H(0x2f6fd0), H(0x3f86e0), H(0x55a0ee), H(0x72baf6), H(0x96d2fb), H(0xc4ecff));
  float t = SAT((c.y - HZ) / 0.52);
  float f = (1.0 - t) * 5.0; int i = int(floor(f)); float fr = f - float(i);
  // a two-row dither seam between bands (classic look), flat elsewhere
  bool seam = fr > 0.86 && bayer(cell) < (fr - 0.86) / 0.14;
  return seam ? B[min(i + 1, 5)] : B[min(i, 5)];
}
vec4 puffy(vec2 c, vec2 ctr, float s, float seed) {
  vec2 p = (c - ctr) / s;
  float d = 1e9;
  for (int i = 0; i < 7; i++) { float fi = float(i); vec2 o = vec2(-0.9 + fi * 0.3, 0.12 * sin(fi * 1.7 + seed) + 0.25 * step(1.5, fi) * step(fi, 4.5)); float r = 0.28 + 0.16 * hash11(fi + seed) + 0.12 * step(1.5, fi) * step(fi, 4.5); d = min(d, length(p - o) - r); }
  d = max(d, -(p.y + 0.18));
  d *= s;
  if (d > PX * 1.05) return vec4(0.0);
  if (d > 0.0) return vec4(H(0x8fb6dc), 1.0);                       // soft blue outline
  float sh = p.y + 0.18;                                           // height above the flat base
  vec3 col = sh < 0.1 ? H(0xb9d4ee) : (sh < 0.22 && p.x < 0.3 ? H(0xdbe9f8) : H(0xffffff));
  if (d > -PX * 2.0 && p.y > 0.1 && p.x > -0.2) col = H(0xffffff);
  return vec4(col, 1.0);
}
float islandH(float x, float c, float w, float h) { float t = (x - c) / w; return h * SAT(1.0 - t * t) * (0.8 + 0.2 * noise(vec2(x * 40.0, c))); }
vec3 seaCol(vec2 c, vec2 cell) {
  float t = SAT((HZ - c.y) / 0.36);                                // 0 at the horizon → 1 near the beach
  vec3 col = tone5(H(0x1f5fb0), H(0x2a7ccc), H(0x2f9bd8), H(0x34bdd6), H(0x46d9cf), t);
  // wave highlights: short light dashes, longer toward the viewer
  float row = cell.y, len = 2.0 + floor(t * 8.0);
  float seg = floor((cell.x + hash11(row) * 50.0) / len);
  if (hash12(vec2(seg, row)) > 0.86 - t * 0.04 && mod(row, 2.0) == 0.0) col = mix(col, H(0xd9fbff), 0.75);
  // sun glitter column
  if (abs(c.x - SUN.x) < 0.02 + 0.12 * t && hash12(cell * vec2(0.5, 1.0)) > 0.8) col = H(0xffffff);
  return col;
}
vec4 farLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  vec3 col;
  if (c.y >= HZ) {
    col = skyCol(c, cell);
    float r = length(c - SUN);
    if (r < 0.11) col = mix(col, H(0xfff6c8), 0.35);
    if (r < 0.085) col = mix(col, H(0xfff6c8), 0.45);
    if (r < 0.055) col = r < 0.045 ? H(0xfffbe6) : H(0xffe98a);
    vec4 cl = puffy(c, vec2(-0.55, 0.3), 0.12, 1.0); if (cl.a > 0.0) col = cl.rgb;
    cl = puffy(c, vec2(-0.1, 0.38), 0.08, 4.0); if (cl.a > 0.0) col = cl.rgb;
    cl = puffy(c, vec2(0.32, 0.22), 0.1, 7.0); if (cl.a > 0.0) col = cl.rgb;
    cl = puffy(c, vec2(0.82, 0.12), 0.07, 9.0); if (cl.a > 0.0) col = cl.rgb;
    // distant islands on the horizon: hazy blue-green with a lit crest
    for (int i = 0; i < 3; i++) {
      float fi = float(i); float cx = i == 0 ? -0.15 : i == 1 ? 0.18 : 0.52, w = 0.12 + 0.05 * fi, h = 0.035 + 0.01 * fi;
      float top = HZ + islandH(c.x, cx, w, h);
      if (c.y < top) col = c.y > top - PX * 2.0 ? H(0x9fd8c8) : H(0x6fb7b3);
    }
  } else col = seaCol(c, cell);
  return vec4(col, 1.0);
}

// ---------------- mid: jungle cliff with waterfall (left), stilt hut + pier + palm islet (right)
float cliffTop(float x) { return HZ + 0.27 - 0.25 * pow(SAT((x + 0.62) / 0.42), 2.2) + 0.012 * noise(vec2(x * 30.0, 2.0)); }
vec4 canopy(vec2 c, vec2 ctr, float r, float seed) {
  float d = 1e9; vec2 best = vec2(0.0);
  for (int i = 0; i < 6; i++) { float fi = float(i); vec2 o = ctr + vec2((fi - 2.5) * r * 0.5, r * 0.3 * hash11(fi + seed)); float rr = r * (0.42 + 0.2 * hash11(fi * 3.0 + seed)); float dd = length(c - o) - rr; if (dd < d) { d = dd; best = (c - o) / rr; } }
  if (d > PX * 1.05) return vec4(0.0);
  if (d > 0.0) return vec4(H(0x0f3a24), 1.0);
  float lit = SAT(0.5 + best.y * 0.45 + best.x * 0.25);
  vec3 col = tone5(H(0x15532f), H(0x1f7a3c), H(0x2f9a45), H(0x52bd4f), H(0x9be06a), lit);
  if (hash12(floor(c * N)) > 0.93) col = mix(col, H(0x0f3a24), 0.6);          // leaf texture specks
  return vec4(col, 1.0);
}
vec4 midLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  vec4 acc = vec4(0.0);
  // cliff: banded rock with lit ledges
  float top = cliffTop(c.x);
  if (c.x < -0.18 && c.y < top && c.y > HZ - 0.03) {
    float band = floor((c.y + 0.006 * noise(vec2(c.x * 50.0, 1.0))) * 60.0);
    float ledge = fract((c.y + 0.006 * noise(vec2(c.x * 50.0, 1.0))) * 60.0);
    vec3 col = mod(band, 3.0) == 0.0 ? H(0x8a6a52) : mod(band, 3.0) == 1.0 ? H(0xa07c5c) : H(0x7a5a46);
    if (ledge > 0.82) col = H(0xc79c70);                                      // lit ledge
    if (ledge < 0.12) col = H(0x5a4034);                                      // shadow under ledge
    if (c.x > -0.22 - 0.01 * noise(vec2(c.y * 40.0, 3.0))) col = H(0x5a4034); // cliff edge outline
    acc = vec4(col, 1.0);
    // mossy patches
    if (noise(c * 22.0) > 0.45 && ledge > 0.5) acc.rgb = H(0x4f9a46);
    // waterfall
    float wx = -0.44, ww = 0.03;
    if (abs(c.x - wx) < ww && c.y < top - 0.005) {
      float s = fract(cell.y * 0.19 + floor((c.x - wx) * N) * 0.37);
      acc.rgb = s < 0.5 ? H(0xe9fbff) : (s < 0.8 ? H(0xb5e8fb) : H(0x86d0f2));
      if (abs(c.x - wx) > ww - PX * 1.5) acc.rgb = H(0x6fb7e0);
    }
  }
  // splash pool at the waterfall's foot
  if (abs(c.x + 0.44) < 0.08 && abs(c.y - (HZ - 0.022)) < 0.012 && hash12(cell) > 0.3) acc = vec4(hash12(cell + 2.0) > 0.5 ? H(0xffffff) : H(0xc9f2ff), 1.0);
  // jungle canopy along the cliff top
  for (int i = 0; i < 9; i++) { float fi = float(i); float bx = -0.88 + fi * 0.075; vec4 b = canopy(c, vec2(bx, cliffTop(bx) + 0.012), 0.06 + 0.012 * hash11(fi), fi * 2.3); if (b.a > 0.0) acc = b; }
  // palm islet (right): sand mound, stilt hut with thatched roof, pier into the lagoon
  float ix = (c.x - 0.58) / 0.2; float mound = HZ - 0.012 + 0.035 * SAT(1.0 - ix * ix);
  if (abs(ix) < 1.0 && c.y < mound && c.y > HZ - 0.03) acc = vec4(c.y > mound - PX * 2.0 ? H(0xfff3c8) : (c.y > mound - 0.012 ? H(0xf6dca0) : H(0xe2bd7a)), 1.0);
  if (abs(ix) < 1.05 && abs(c.y - (HZ - 0.03)) < PX * 1.2) acc = vec4(H(0xffffff), 1.0);
  vec2 hp = c - vec2(0.7, HZ + 0.03);
  if (abs(hp.x) < 0.05 && hp.y > -0.03 && hp.y < 0.0 && (abs(fract(hp.x * 30.0) - 0.5) < 0.18)) acc = vec4(H(0x6a4a32), 1.0);   // stilts
  if (abs(hp.x) < 0.045 && hp.y >= 0.0 && hp.y < 0.035) acc = vec4(abs(hp.x) < 0.012 && hp.y < 0.024 ? H(0x3a2a1e) : (fract(hp.y * 90.0) < 0.5 ? H(0xb07a4a) : H(0x9a683e)), 1.0);   // walls + door
  if (hp.y >= 0.035 && hp.y < 0.075 && abs(hp.x) < 0.07 - (hp.y - 0.035) * 1.6) acc = vec4(hp.y < 0.04 ? H(0x8a6a2a) : (fract(hp.x * 60.0 + hp.y * 30.0) < 0.5 ? H(0xe2c060) : H(0xc9a24a)), 1.0);  // thatch
  if (c.x > 0.55 && c.x < 0.66 && abs(c.y - (HZ - 0.005)) < 0.004) acc = vec4(fract(c.x * 75.0) < 0.8 ? H(0xa77a4c) : H(0x6a4a32), 1.0);   // pier planks
  return acc;
}

// ---------------- near: beach with foam, shells, rocks
float shore(float x) { return -0.33 + 0.02 * sin(x * 7.0) + 0.015 * noise(vec2(x * 10.0, 4.0)); }
vec4 nearLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  float s = shore(c.x);
  vec4 acc = vec4(0.0);
  if (c.y < s + 0.012 && c.y > s - 0.002) acc = vec4(hash12(cell) > 0.25 ? H(0xffffff) : H(0xd9fbff), 1.0);      // foam line
  else if (c.y < s - 0.002) {
    float t = SAT((s - c.y) / 0.17);
    vec3 col = t < 0.08 ? H(0xd8b778) : tone5(H(0xf2d394), H(0xf6dca0), H(0xf8e2ac), H(0xfae8b8), H(0xfcefc8), t);   // wet line, then dry sand
    if (hash12(cell) > 0.965) col = H(0xe2bd7a);                          // grain
    if (hash12(floor(cell / 3.0)) > 0.992 && t > 0.3) col = H(0xffb6a0);   // shells
    acc = vec4(col, 1.0);
  }
  for (int i = 0; i < 3; i++) {                                            // rocks
    float fi = float(i); vec2 ctr = vec2(i == 0 ? -0.8 : i == 1 ? -0.7 : 0.78, -0.41 - 0.02 * fi); vec2 rr = vec2(0.07 - 0.02 * fi, 0.045 - 0.01 * fi);
    vec2 p = (c - ctr) / rr; float d = (length(p) - 1.0) * rr.y;
    vec4 rk = outlined(d, p.y > 0.3 ? H(0xb7b0a8) : (p.x > 0.2 ? H(0x948d86) : H(0x77716c)), H(0x3e3a38));
    if (rk.a > 0.0) acc = rk;
  }
  return acc;
}

// ---------------- front: framing fronds (top corners) and beach plants (bottom corners)
float leafD(vec2 p, vec2 a, float ang, float len, float droop) {
  float best = 1e9;
  for (int i = 0; i <= 8; i++) { float t = float(i) / 8.0; vec2 pt = a + vec2(cos(ang), sin(ang)) * t * len + vec2(0.0, -droop * t * t);
    float w = 0.03 * sin(3.1416 * min(t * 1.1, 1.0)) + 0.003; float notch = 0.7 + 0.3 * step(0.5, fract(t * 12.0)); best = min(best, length(p - pt) - w * notch); }
  return best;
}
vec4 frontLayer(vec2 uv) {
  vec2 c = q(uv);
  vec4 acc = vec4(0.0);
  for (int s = 0; s < 2; s++) {
    float sg = s == 0 ? -1.0 : 1.0; vec2 a = vec2(sg * 0.93, 0.47);
    for (int k = 0; k < 5; k++) { float fk = float(k); float ang = (s == 0 ? 0.0 : 3.1416) + sg * (-0.95 + fk * 0.22);
      float d = leafD(c, a, ang, 0.26 + 0.05 * hash11(fk + float(s)), 0.07 + 0.03 * hash11(fk * 2.0));
      vec4 l = outlined(d, d > -PX * 2.5 ? H(0x52bd4f) : H(0x2f9a45), H(0x0f3a24)); if (l.a > 0.0) acc = l; }
    for (int k = 0; k < 6; k++) { float fk = float(k); vec2 b = vec2(sg * (0.86 - 0.025 * fk), -0.52);   // beach grass blades
      float ang = 1.5708 - sg * (0.15 + 0.12 * fk); float d = leafD(c, b, ang, 0.08 + 0.03 * hash11(fk + 7.0 * float(s)), -0.01);
      vec4 l = outlined(d, H(0x4fa84a), H(0x174a26)); if (l.a > 0.0) acc = l; }
  }
  return acc;
}
vec4 raysLayer(vec2 uv) { float d = length(uv - SUN); return vec4(vec3(1.0, 0.95, 0.75), SAT(exp(-d * 5.0) * 0.35)); }

// ---------------- sprites (each on its own pixel grid)
vec4 palmV(vec2 uv, float lean, float seed) {
  float n = 72.0; vec2 c = (floor(uv * n) + 0.5) / n; float px1 = 1.0 / n;
  vec2 base = vec2(-0.05 * lean, -0.48), crown = vec2(0.07 * lean, 0.16);
  float h; float tr = sdTaper(c, base, crown, 0.032, 0.022, h);
  vec4 acc = vec4(0.0);
  if (tr < px1) acc = tr > 0.0 ? vec4(H(0x3a2618), 1.0) : vec4(mod(floor(h * 16.0), 2.0) == 0.0 ? H(0xa77a4c) : H(0x84603a), 1.0);
  for (int k = 0; k < 7; k++) { float fk = float(k); float ang = 3.1416 * (0.02 + fk * 0.16) + 0.15 * (hash11(fk + seed) - 0.5);
    float d = leafD(c, crown, ang, 0.32, 0.12 + 0.06 * hash11(fk * 3.0 + seed));
    if (d < px1) acc = d > 0.0 ? vec4(H(0x0f3a24), 1.0) : vec4(d > -0.012 ? H(0x7ad65a) : (cos(ang) > 0.0 ? H(0x3aa64a) : H(0x2a8a3e)), 1.0); }
  float co = length(c - crown - vec2(0.0, -0.035)) - 0.028; if (co < 0.0) acc = vec4(c.x > crown.x + 0.005 ? H(0x8a6a3a) : H(0x5a4026), 1.0);
  return acc;
}
vec4 cloudV(vec2 uv, float s) { float n = 60.0; vec2 c = (floor(uv * n) + 0.5) / n; float asp = uRes.x / uRes.y; vec2 p = c / vec2(asp * 0.45, 0.42);
  float d = 1e9; for (int i = 0; i < 6; i++) { float fi = float(i); vec2 o = vec2(-0.8 + fi * 0.32, 0.1 * sin(fi * 1.7 + s) + 0.2 * step(1.5, fi) * step(fi, 3.5)); d = min(d, length(p - o) - (0.3 + 0.15 * hash11(fi + s))); }
  d = max(d, -(p.y + 0.25)); if (d > 0.04) return vec4(0.0); if (d > 0.0) return vec4(H(0x8fb6dc), 1.0);
  return vec4(p.y < -0.12 ? H(0xb9d4ee) : (p.y < 0.0 && p.x < 0.4 ? H(0xdbe9f8) : H(0xffffff)), 1.0); }
vec4 gullV(vec2 uv) { vec2 c = (floor(uv * 20.0) + 0.5) / 20.0; float w = abs(c.x); float y = c.y + 0.1 - w * 0.55 + (w > 0.25 ? (w - 0.25) * 0.9 : 0.0); float on = step(abs(y), 0.6 / 20.0) * step(w, 0.42); return vec4(w > 0.32 ? H(0x3a4a5a) : H(0xffffff), on); }
vec4 cubeV(vec2 uv) { // floating pixel gem
  float n = 22.0; vec2 c = (floor(uv * n) + 0.5) / n;
  float d = abs(c.x) + abs(c.y) * 0.8 - 0.36;
  if (d > 0.05) return vec4(0.0);
  if (d > 0.0) return vec4(H(0x1a3a6a), 1.0);
  vec3 col = c.y > 0.0 ? (c.x > 0.0 ? H(0x9ff3ff) : H(0x5cc8f0)) : (c.x > 0.0 ? H(0x3a8fd8) : H(0x2a5cb0));
  if (length(c - vec2(-0.08, 0.12)) < 0.05) col = H(0xffffff);
  return vec4(col, 1.0);
}
vec4 crabV(vec2 uv) { vec2 c = (floor(uv * 20.0) + 0.5) / 20.0; float body = sdBox(c, vec2(0.2, 0.09)); float claws = min(sdBox(c - vec2(-0.26, 0.1), vec2(0.06, 0.06)), sdBox(c - vec2(0.26, 0.1), vec2(0.06, 0.06))); float legs = min(sdBox(c - vec2(-0.14, -0.12), vec2(0.04, 0.04)), sdBox(c - vec2(0.14, -0.12), vec2(0.04, 0.04))); float d = min(min(body, claws), legs); vec3 col = mix(H(0xff6a4a), H(0xc83a32), step(c.y, 0.0)); if (length(c - vec2(-0.06, 0.12)) < 0.035 || length(c - vec2(0.06, 0.12)) < 0.035) col = H(0x1a0f20); if (d > -0.05 && d <= 0.0) col = H(0x8a1f1f); return vec4(col, step(d, 0.0)); }
// palette colours are exact sRGB: undo finish()'s gamma and ACES tone curve so every pixel lands on its palette colour
float invAces(float y) { y = min(y, 0.985); float a = 2.43 * y - 2.51, b = 0.59 * y - 0.03, cc = 0.14 * y; return (-b - sqrt(max(b * b - 4.0 * a * cc, 0.0))) / (2.0 * a); }
vec3 px(vec3 c) { vec3 l = pow(c, vec3(2.2)); return vec3(invAces(l.r), invAces(l.g), invAces(l.b)); }
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = palmV(uv, 1.0, 1.0); else if (k == 1) r = palmV(uv, -1.2, 2.0); else if (k == 2) r = cloudV(uv, 1.0); else if (k == 3) r = cloudV(uv * 1.1, 2.0);
    else if (k == 4) r = gullV(uv); else if (k == 5) r = cubeV(uv); else r = crabV(uv);
    gAlpha = r.a; return px(r.rgb);
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  vec3 col = farLayer(uv).rgb;
  vec4 m = midLayer(uv); col = mix(col, m.rgb, m.a);
  vec4 n = nearLayer(uv); col = mix(col, n.rgb, n.a);
  vec4 f = frontLayer(uv); col = mix(col, f.rgb, f.a);
  return px(col);
}
