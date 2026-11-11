// @lib2d
// @sprites palmA:480x640, palmB:420x600, cloudA:640x240, cloudB:520x200, gull:160x96, cube:160x160, crab:200x120
// Pixel Paradise — a sunset archipelago in hand-built pixel art (original). Every shape is evaluated on one pixel grid (N cells per scene
// height) with a limited palette and 4x4 ordered (Bayer) dithering for gradients, so the image stays crisp at any size; no blur anywhere.
// Honest label: layered 2.5D pixel-art illustration, not real-time 3D.
// uLayer: 1 far (dithered sky, sun, stars, cloud banks, mountain ranges, sea with the sun's reflection) · 2 mid (jungle cliff island with a
// waterfall and a lit hut, palm islet) · 3 near (beach, rocks, shells) · 4 front (framing palm silhouettes, grass) · 5 sun glow · 10+ sprites.
const float N = 104.0;                  // pixel cells per scene height
vec2 q(vec2 uv) { return (floor(uv * N) + 0.5) / N; }
vec2 cellOf(vec2 uv) { return floor(uv * N); }
const float HZ = -0.06;                 // horizon (sea line)
const vec2 SUN = vec2(0.34, 0.06);
float bayer(vec2 c) {                   // 4x4 ordered dither threshold in [0,1)
  vec2 p = mod(c, 4.0);
  int i = int(p.x) + int(p.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
// dithered pick in a palette ramp: t in [0, n-1]
vec3 ramp(vec3 p[8], float t, vec2 cell) { float f = clamp(t, 0.0, 6.999); int i = int(floor(f)); float fr = f - float(i); return fr > bayer(cell) ? p[min(i + 1, 7)] : p[i]; }
vec3 H(int h) { return vec3(float((h >> 16) & 255), float((h >> 8) & 255), float(h & 255)) / 255.0; }

// ---------------- far: sky, sun, stars, clouds, mountains, sea
vec3 skyCol(vec2 c, vec2 cell) {
  vec3 P[8] = vec3[8](H(0x1a1238), H(0x2e1a57), H(0x522474), H(0x86307e), H(0xc54679), H(0xf26b62), H(0xffa05a), H(0xffd27a));
  float t = SAT((c.y - HZ) / 0.56);
  vec3 col = ramp(P, (1.0 - pow(t, 0.8)) * 7.0, cell);
  // stars in the top band
  if (t > 0.78 && hash12(cell) > 0.993) col = mix(col, H(0xfff3d6), 0.6 + 0.4 * hash12(cell + 3.0));
  return col;
}
float cloudShape(vec2 c, vec2 ctr, vec2 sz, float seed) {
  vec2 p = (c - ctr) / sz;
  float d = p.y < -0.25 ? 1.0 : 0.0; // flat bottom
  float s = 1e9;
  for (int i = 0; i < 6; i++) { float fi = float(i); vec2 o = vec2(-0.75 + fi * 0.3, 0.05 * sin(fi * 2.1 + seed) + 0.18 * hash11(fi + seed)); float r = 0.32 + 0.22 * hash11(fi * 3.7 + seed); s = min(s, length((p - o) * vec2(1.0, 1.6)) - r); }
  return max(s, -(p.y + 0.25)) ;
}
vec4 cloudBank(vec2 c, vec2 cell, vec2 ctr, vec2 sz, float seed) {
  float d = cloudShape(c, ctr, sz, seed);
  if (d > 0.0) return vec4(0.0);
  vec2 p = (c - ctr) / sz;
  // lit from the sun (right and below): warm rim, mauve body, violet underside
  float lit = SAT(0.5 + (p.x - 0.0) * 0.6 * sign(SUN.x - ctr.x) - p.y * 0.4) + (d > -0.08 ? 0.3 : 0.0);
  vec3 P[8] = vec3[8](H(0x3b2163), H(0x5c2c7a), H(0x8a3a86), H(0xb64c86), H(0xe06b80), H(0xff9474), H(0xffbe7c), H(0xffe0a0));
  return vec4(ramp(P, 1.0 + lit * 5.5, cell), 1.0);
}
float ridge(float x, float base, float amp, float freq, float seed) { return base + amp * (0.55 * abs(noise(vec2(x * freq, seed))) + 0.3 * noise(vec2(x * freq * 2.3, seed + 4.0)) + 0.15 * noise(vec2(x * freq * 5.1, seed + 9.0))); }
vec3 seaCol(vec2 c, vec2 cell) {
  vec3 P[8] = vec3[8](H(0x140f30), H(0x1e1745), H(0x2c1d5a), H(0x40246c), H(0x5c2b78), H(0x8a3a82), H(0xc0507e), H(0xf07a70));
  float t = SAT((HZ - c.y) / 0.44);
  vec3 col = ramp(P, 7.0 - pow(t, 0.55) * 6.5, cell);
  // wave dashes: short horizontal highlights, longer and sparser toward the viewer
  float row = cell.y, len = 2.0 + floor(t * 6.0);
  float seg = floor((cell.x + hash11(row) * 40.0) / len);
  float on = step(0.83, hash12(vec2(seg, row)));
  col = mix(col, ramp(P, 7.6 - pow(t, 0.55) * 6.0, cell + 1.0), on);
  // the sun's reflection: a column of broken golden dashes widening toward the viewer
  float w = 0.03 + 0.11 * t;
  float inCol = step(abs(c.x - SUN.x + 0.02 * sin(row * 1.7)), w * (0.55 + 0.45 * hash12(vec2(row, 7.0))));
  float dash = step(0.35, hash12(vec2(floor((cell.x) / (1.0 + floor(t * 3.0))), row + 11.0)));
  col = mix(col, mix(H(0xffe39a), H(0xff9a5c), SAT(t * 1.6 + 0.2 * hash12(cell))), inCol * dash * (1.0 - t * 0.35));
  return col;
}
vec4 farLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  vec3 col;
  if (c.y >= HZ) {
    col = skyCol(c, cell);
    // sun: banded disc with a dithered halo
    float r = length(c - SUN);
    float halo = SAT(1.0 - (r - 0.1) / 0.12);
    if (halo > bayer(cell) * 1.3 && r > 0.1) col = mix(col, H(0xffb36b), 0.45);
    if (r < 0.1) col = c.y > SUN.y + 0.03 ? H(0xfff2c0) : c.y > SUN.y - 0.02 ? H(0xffe08a) : H(0xffc06a);
    // far cloud banks
    vec4 cl = cloudBank(c, cell, vec2(-0.48, 0.3), vec2(0.36, 0.07), 1.0); col = mix(col, cl.rgb, cl.a);
    cl = cloudBank(c, cell, vec2(0.05, 0.22), vec2(0.26, 0.05), 4.0); col = mix(col, cl.rgb, cl.a);
    cl = cloudBank(c, cell, vec2(0.66, 0.34), vec2(0.3, 0.06), 7.0); col = mix(col, cl.rgb, cl.a);
    // long stratus streaks across the sun
    float st = step(abs(c.y - (SUN.y - 0.005)), 0.006) * step(abs(c.x - SUN.x - 0.05), 0.24) + step(abs(c.y - (SUN.y + 0.045)), 0.004) * step(abs(c.x - SUN.x + 0.12), 0.18);
    col = mix(col, H(0xe06b80), SAT(st));
    // mountain ranges: far (hazy violet) then nearer (deeper), sunlit right-facing slopes
    float m1 = ridge(c.x, HZ + 0.02, 0.2, 2.2, 3.0) * step(c.x, 0.2) + (c.x > 0.2 ? HZ + 0.02 + 0.2 * 0.3 * SAT(1.0 - (c.x - 0.2) * 4.0) : 0.0);
    if (c.y < m1) { float sl = ridge(c.x + 0.01, HZ + 0.02, 0.2, 2.2, 3.0) - ridge(c.x - 0.01, HZ + 0.02, 0.2, 2.2, 3.0); col = sl < 0.0 && c.y > m1 - 0.03 ? H(0x8c4a8e) : (bayer(cell) < 0.3 ? H(0x6a3884) : H(0x5a307a)); }
    float m2 = HZ + 0.015 + 0.08 * SAT(1.0 - abs(c.x + 0.05) * 3.0) * (0.6 + 0.4 * noise(vec2(c.x * 8.0, 2.0)));
    if (c.y < m2 && c.x > -0.4 && c.x < 0.3) col = c.y > m2 - 0.012 ? H(0x7a3f86) : H(0x43256a);
  } else col = seaCol(c, cell);
  return vec4(col, 1.0);
}

// ---------------- mid: jungle cliff island (left) with waterfall and hut, palm islet (right)
float cliffTop(float x) { return HZ + 0.25 + 0.05 * noise(vec2(x * 9.0, 1.0)) - 0.5 * pow(SAT((x + 0.36) / 0.3), 2.0) * 0.4; }
vec4 bush(vec2 c, vec2 cell, vec2 ctr, float r, float seed) {
  vec2 p = c - ctr;
  float d = 1e9; for (int i = 0; i < 5; i++) { float fi = float(i); vec2 o = vec2((fi - 2.0) * r * 0.55, r * 0.25 * hash11(fi + seed)); d = min(d, length(p - o) - r * (0.45 + 0.25 * hash11(fi * 2.0 + seed))); }
  if (d > 0.0) return vec4(0.0);
  vec3 P[8] = vec3[8](H(0x10241f), H(0x173a2c), H(0x1f5236), H(0x2f6d3a), H(0x4f8a3c), H(0x86a442), H(0xc2b452), H(0xf0c860));
  float lit = SAT(0.45 + (p.x / r) * 0.35 + (p.y / r) * 0.45) * (d > -0.012 && p.x > 0.0 ? 1.25 : 1.0);
  return vec4(ramp(P, 0.5 + lit * 5.6, cell), 1.0);
}
vec4 midLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  vec4 acc = vec4(0.0);
  // cliff body (x < -0.22): strata in warm stone, lit edge toward the sun
  float top = cliffTop(c.x);
  float edgeX = -0.24 - 0.025 * noise(vec2(floor(c.y * 26.0), 5.0)) - 0.05 * SAT((c.y - HZ) / 0.25);
  if (c.x < edgeX && c.y < top && c.y > HZ - 0.02) {
    float strata = floor((c.y + 0.02 * noise(vec2(c.x * 12.0, 1.0))) * 38.0);
    vec3 P[8] = vec3[8](H(0x231633), H(0x33203f), H(0x4a2c4c), H(0x63395a), H(0x7f4a62), H(0xa5606a), H(0xd07d6e), H(0xf2a073));
    float lit = (c.x > edgeX - 0.014 ? 1.1 : c.x > edgeX - 0.045 ? 0.62 : 0.3) + 0.12 * hash11(strata);
    acc = vec4(P[int(clamp(floor(1.0 + lit * 5.0 + (mod(strata, 3.0) == 0.0 ? -0.8 : 0.0)), 0.0, 7.0))], 1.0); // flat tones, no dither: a crisp rock face
    // waterfall
    float wx = -0.47;
    if (abs(c.x - wx) < 0.022 && c.y < top - 0.01) {
      float s = fract(cell.y * 0.37 + floor((c.x - wx) * N) * 0.21);
      acc.rgb = mix(H(0xa9d8f2), H(0xe9fbff), step(0.55, s)); acc.rgb = mix(acc.rgb, H(0x7fb0dc), step(0.017, abs(c.x - wx)));
    }
    // hut on the cliff with a lit window
    vec2 hp = c - vec2(-0.62, top + 0.0);
  }
  // foam at the waterfall's foot
  if (abs(c.x + 0.47) < 0.05 && abs(c.y - (HZ - 0.008)) < 0.012 && hash12(cell) > 0.25) acc = vec4(mix(H(0xffffff), H(0xd6eefa), hash12(cell + 1.0)), 1.0);
  // jungle canopy on the cliff
  for (int i = 0; i < 7; i++) { float fi = float(i); float bx = -0.86 + fi * 0.095; vec4 b = bush(c, cell, vec2(bx, cliffTop(bx) + 0.005), 0.05 + 0.015 * hash11(fi), fi * 3.1); if (b.a > 0.0) acc = b; }
  // hut: stilted, palm-thatch roof, warm window
  vec2 hp = c - vec2(-0.63, cliffTop(-0.63) + 0.035);
  if (abs(hp.x) < 0.035 && abs(hp.y) < 0.02) acc = vec4(abs(hp.x) < 0.01 && abs(hp.y + 0.002) < 0.009 ? H(0xffd27a) : H(0x6b3f3a), 1.0);
  if (hp.y >= 0.02 && hp.y < 0.05 && abs(hp.x) < 0.05 - (hp.y - 0.02) * 1.5) acc = vec4(mix(H(0xc98a4a), H(0x8a5a36), step(0.5, fract(cell.y * 0.5))), 1.0);
  // palm islet (right, mid-distance): sand mound with a lit crest and a dark waterline
  float ix = (c.x - 0.6) / 0.16;
  float mound = HZ + 0.03 * SAT(1.0 - ix * ix);
  if (abs(ix) < 1.0 && c.y < mound && c.y > HZ - 0.012) acc = vec4(c.y > mound - 0.008 ? H(0xffc27a) : (bayer(cell) < 0.5 ? H(0xd88a5c) : H(0xb86e52)), 1.0);
  if (abs(ix) < 1.05 && abs(c.y - (HZ - 0.012)) < 0.005) acc = vec4(H(0xffe0c0), hash12(cell) > 0.3 ? 1.0 : 0.0);
  return acc;
}

// ---------------- near: beach, rocks, shells
float shore(float x) { return -0.37 + 0.035 * noise(vec2(x * 4.0, 2.0)) + 0.04 * x; }
vec4 nearLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  float s = shore(c.x);
  vec4 acc = vec4(0.0);
  if (c.y < s) {
    vec3 P[8] = vec3[8](H(0x5a2e3e), H(0x7a3c46), H(0x9c4e4e), H(0xbf6a56), H(0xdc8a62), H(0xf0aa72), H(0xffc888), H(0xffe2a8));
    float t = SAT((s - c.y) / 0.15);
    acc = vec4(ramp(P, 6.6 - t * 3.6 + 0.6 * noise(c * 30.0), cell), 1.0);
    if (s - c.y < 0.012) acc.rgb = mix(H(0xffe9c8), H(0xffffff), step(0.6, hash12(cell)));                 // foam line
    else if (s - c.y < 0.022) acc.rgb = H(0xa85a58);                                                       // wet sand
    // shells and pebbles
    if (hash12(cell * 0.5) > 0.992) acc.rgb = H(0xfff0e0);
  }
  // boulders at both ends: chunky stones with lit tops
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 ctr = vec2(i == 0 ? -0.78 : i == 1 ? -0.66 : 0.8, -0.4 - 0.02 * fi); vec2 r = vec2(0.09 - 0.025 * fi, 0.06 - 0.012 * fi);
    vec2 p = (c - ctr) / r; float d = length(p * vec2(1.0, 1.0 + 0.3 * step(0.0, -p.y))) - 1.0 + 0.12 * noise(c * 40.0);
    if (d < 0.0) { float lit = SAT(0.5 + p.x * 0.35 + p.y * 0.5); vec3 R[8] = vec3[8](H(0x1d1430), H(0x2d1d40), H(0x40284e), H(0x58345c), H(0x744466), H(0x965a70), H(0xbd7476), H(0xe8987a)); acc = vec4(ramp(R, lit * 6.5, cell), 1.0); }
  }
  return acc;
}

// ---------------- front: framing palm silhouettes and grass (dark, sunset rim light)
float frond(vec2 p, vec2 a, float ang, float len, float droop) {
  // arched leaf along a drooping rib: full width mid-frond, tapering to the tip, notched edge (leaflets)
  vec2 d = vec2(cos(ang), sin(ang));
  float best = 1e9;
  for (int i = 0; i <= 10; i++) {           // nearest point on the drooping rib (sampled)
    float t = float(i) / 10.0; vec2 pt = a + d * t * len + vec2(0.0, -droop * t * t);
    float w = 0.034 * pow(sin(3.1416 * min(t * 1.15, 1.0)), 0.7) + 0.004;
    float notch = 0.65 + 0.35 * step(0.4, fract(t * 11.0 + dot(p - pt, vec2(d.y, -d.x)) * 30.0));
    best = min(best, length(p - pt) - w * notch);
  }
  return best;
}
vec4 frontLayer(vec2 uv) {
  vec2 c = q(uv), cell = cellOf(uv);
  float d = 1e9; float rim = 0.0;
  for (int s = 0; s < 2; s++) {
    float sg = s == 0 ? -1.0 : 1.0;
    vec2 base = vec2(sg * 0.95, -0.55), crown = vec2(sg * 0.8, 0.33 - 0.06 * float(s));
    vec2 mid = mix(base, crown, 0.5) + vec2(sg * 0.08, 0.0);
    float h; float tr = min(sdTaper(c, base, mid, 0.035, 0.026, h), sdTaper(c, mid, crown, 0.026, 0.016, h));
    d = min(d, tr);
    for (int k = 0; k < 9; k++) { float fk = float(k); float ang = (s == 0 ? 0.0 : 3.1416) + sg * (-1.1 + fk * 0.36); d = min(d, frond(c, crown, ang, 0.15 + 0.05 * hash11(fk + float(s)), 0.05 + 0.04 * hash11(fk * 2.0))); }
    if (d < 0.0 && sg * (crown.x - c.x) > 0.0 && c.y > crown.y - 0.15) rim = 1.0;
  }
  // grass tufts along the bottom edge
  float g = c.y - (-0.5 + 0.03 + 0.03 * abs(sin(c.x * 140.0)) * step(0.4, hash11(floor(c.x * 30.0))));
  if (d < 0.0) return vec4(H(0x150c24), 1.0);
  if (g < 0.0 && (c.x < -0.55 || c.x > 0.55)) return vec4(mix(H(0x1a0f2a), H(0x5a2e5a), step(-0.012, g)), 1.0);
  return vec4(0.0);
}
vec4 raysLayer(vec2 uv) { float d = length(uv - SUN); return vec4(vec3(1.0, 0.78, 0.5), SAT(exp(-d * 4.0) * 0.4)); }

// ---------------- sprites (one pixel grid per sprite)
vec4 palmV(vec2 uv, float lean, float seed) {
  float n = 64.0; vec2 c = (floor(uv * n) + 0.5) / n; vec2 cl = floor(uv * n);
  vec2 base = vec2(-0.05 * lean, -0.48), crown = vec2(0.06 * lean, 0.18);
  float h; float tr = sdTaper(c, base, crown, 0.03, 0.02, h);
  vec4 acc = vec4(0.0);
  if (tr < 0.0) acc = vec4(mod(floor(h * 14.0), 2.0) == 0.0 ? H(0x8a4a3a) : H(0x5e3030), 1.0);
  float d = 1e9; float lit = 0.0;
  for (int k = 0; k < 8; k++) { float fk = float(k); float ang = 3.1416 * (-0.02 + fk * 0.145) + 0.2 * (hash11(fk + seed) - 0.5); float dd = frond(c, crown, ang, 0.3, 0.1 + 0.06 * hash11(fk * 3.0 + seed)); if (dd < d) { d = dd; lit = cos(ang) * 0.5 + 0.5; } }
  if (d < 0.0) { vec3 P[8] = vec3[8](H(0x10241f), H(0x173a2c), H(0x1f5236), H(0x2f6d3a), H(0x4f8a3c), H(0x86a442), H(0xc2b452), H(0xf0c860)); acc = vec4(ramp(P, 1.5 + lit * 4.0 + (d > -0.006 ? 1.2 : 0.0), cl), 1.0); }
  float co = length(c - crown - vec2(0.0, -0.035)) - 0.026; if (co < 0.0) acc = vec4(c.x > crown.x ? H(0x8a5a36) : H(0x5a3826), 1.0);
  return acc;
}
vec4 cloudV(vec2 uv, float s) {
  float n = 40.0; vec2 c = (floor(uv * n) + 0.5) / n; vec2 cl = floor(uv * n); float asp = uRes.x / uRes.y;
  vec4 r = cloudBank(c, cl, vec2(0.0, -0.05), vec2(0.4 * asp, 0.28), s * 3.0);
  return r;
}
vec4 gullV(vec2 uv) { vec2 c = (floor(uv * 16.0) + 0.5) / 16.0; float w = abs(c.x); float y = c.y + 0.12 - w * 0.5 + (w > 0.25 ? (w - 0.25) * 0.8 : 0.0); return vec4(H(0x2a163e), step(abs(y), 0.5 / 16.0) * step(w, 0.4)); }
vec4 cubeV(vec2 uv) { // floating pixel gem: faceted, highlighted
  float n = 20.0; vec2 c = (floor(uv * n) + 0.5) / n;
  float d = abs(c.x) + abs(c.y) * 0.8 - 0.36;
  if (d > 0.0) return vec4(0.0);
  vec3 col = c.y > 0.0 ? (c.x > 0.0 ? H(0x9ff3ff) : H(0x5cc8f0)) : (c.x > 0.0 ? H(0x3a8fd8) : H(0x2a5cb0));
  if (d > -0.05) col = H(0xe8fcff) * (c.y > 0.0 ? 1.0 : 0.7);
  if (length(c - vec2(-0.08, 0.12)) < 0.05) col = H(0xffffff);
  return vec4(col, 1.0);
}
vec4 crabV(vec2 uv) { vec2 c = (floor(uv * 18.0) + 0.5) / 18.0; float body = sdBox(c, vec2(0.2, 0.09)); float claws = min(sdBox(c - vec2(-0.26, 0.1), vec2(0.06, 0.06)), sdBox(c - vec2(0.26, 0.1), vec2(0.06, 0.06))); float legs = min(sdBox(c - vec2(-0.14, -0.12), vec2(0.04, 0.04)), sdBox(c - vec2(0.14, -0.12), vec2(0.04, 0.04))); float d = min(min(body, claws), legs); vec3 col = mix(H(0xff6a4a), H(0xb83a3a), step(c.y, 0.0)); if (length(c - vec2(-0.06, 0.1)) < 0.03 || length(c - vec2(0.06, 0.1)) < 0.03) col = H(0x1a0f20); return vec4(col, step(d, 0.0)); }
// palette colours are exact sRGB: undo finish()'s gamma and ACES tone curve so every pixel lands on its palette colour
float invAces(float y) { y = min(y, 0.985); float a = 2.43 * y - 2.51, b = 0.59 * y - 0.03, cc = 0.14 * y; return (-b - sqrt(max(b * b - 4.0 * a * cc, 0.0))) / (2.0 * a); }
vec3 px(vec3 c) { vec3 l = pow(c, vec3(2.2)); return vec3(invAces(l.r), invAces(l.g), invAces(l.b)); }
vec4 px(vec4 c) { return vec4(px(c.rgb), c.a); }
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
  // flat composite
  vec3 col = farLayer(uv).rgb;
  vec4 m = midLayer(uv); col = mix(col, m.rgb, m.a);
  vec4 n = nearLayer(uv); col = mix(col, n.rgb, n.a);
  vec4 f = frontLayer(uv); col = mix(col, f.rgb, f.a);
  return px(col);
}
