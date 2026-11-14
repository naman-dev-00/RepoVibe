// @lib2d
// @lib3d
// @sprites sprayA:1500x1000, sprayB:1200x860, treeL:2160x1080, treeR:1620x1080, petalA:256x256, petalB:256x256, petalC:256x256, koi:640x300
// Sakura Dreams — a Japanese garden at sunrise (RepoVibe immersive world). Painted with signed-distance shapes and layered
// shading (honest label: layered 2.5D art, not real-time 3D). uLayer: 1 far (sky, Fuji, ridges, pagoda hill, far shore, pond with
// reflections) · 2 mid (torii in the water, arched bridge, bank trees) · 3 near (trunk bases, bank, stone path) · 4 front (sharp
// foreground grass, stones, fallen petals) · 5 sun shafts · 10+ sprites (tree heads that sway, boughs, petals, koi, lantern).
const float HZ = -0.05;
const vec2 SUN = vec2(-0.10, 0.14);
const vec2 TOLIGHT = vec2(-0.6, 0.55);

vec3 sky(vec2 uv) {
  float y = SAT((uv.y - HZ) / 0.62);
  vec3 col = mix(vec3(1.0, 0.66, 0.36), vec3(0.96, 0.40, 0.52), smoothstep(0.0, 0.34, y));
  col = mix(col, vec3(0.34, 0.30, 0.66), smoothstep(0.22, 0.95, y));
  float sd = length(uv - SUN);
  col += vec3(1.0, 0.6, 0.28) * (0.5 * exp(-sd * 3.5) + 1.3 * exp(-sd * 16.0));
  col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.052, 0.044, sd));
  float cl = fbm(vec2(uv.x * 2.2 + 3.0, uv.y * 9.0), 5);
  float cm = SAT(cl * 1.3 - 0.12) * smoothstep(HZ, 0.12, uv.y) * (1.0 - smoothstep(0.35, 0.6, uv.y));
  vec3 ccol = mix(vec3(0.95, 0.42, 0.50), vec3(1.0, 0.78, 0.55), SAT(1.0 - sd * 2.2));
  return mix(col, ccol, cm * 0.55);
}
vec3 haze(vec3 c, float y) { return mix(c, vec3(1.0, 0.66, 0.56), SAT(1.0 - (y - HZ) / 0.12) * 0.4); }
float ridge(float x, float base, float amp, float f, float s) { return base + amp * (0.5 + 0.5 * fbm(vec2(x * f + s, s), 5)); }

float pagoda(vec2 p, out float lit) {
  float d = 1e9; lit = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i), w = 0.034 * (1.0 - 0.14 * fi), y0 = fi * 0.03;
    float body = sdBox(vec2(p.x, p.y - y0 - 0.011), vec2(w * 0.62, 0.011));
    vec2 q = vec2(p.x, p.y - y0 - 0.026 + 0.55 * p.x * p.x / max(w, 0.01) * 0.2);
    float roof = max(sdBox(q, vec2(w, 0.0045)), -1.0);
    d = min(d, min(body, roof));
  }
  d = min(d, sdBox(vec2(p.x, p.y - 0.157), vec2(0.0025, 0.022)));
  lit = SAT(0.5 - p.x * 8.0);
  return d;
}
vec3 farScene(vec2 uv) {
  vec3 col = sky(uv);
  // Mt. Fuji
  float fx = uv.x - 0.30;
  float fuji = HZ + 0.31 * pow(SAT(1.0 - abs(fx) / 0.6), 1.5) + 0.005 * fbm(vec2(uv.x * 16.0, 1.0), 4);
  if (uv.y < fuji) {
    float down = fuji - uv.y;
    vec3 body = mix(vec3(0.26, 0.24, 0.50), vec3(0.42, 0.34, 0.58), SAT(down * 3.0));
    body = mix(body, vec3(0.9, 0.42, 0.42), SAT(-fx * 2.4 + 0.15) * 0.55);                 // sunlit flank facing the sun
    float snowEdge = 0.035 + 0.05 * fbm(vec2(uv.x * 34.0, 2.0), 4) * (0.5 + 0.5 * sin(uv.x * 60.0)) + 0.008 * sin(uv.x * 160.0 + fbm(vec2(uv.x * 20.0, 0.0), 3) * 6.0);
    float snow = smoothstep(snowEdge + 0.006, snowEdge - 0.006, down) * smoothstep(HZ + 0.12, HZ + 0.2, uv.y);
    vec3 sc = mix(vec3(0.78, 0.68, 0.9), vec3(1.0, 0.82, 0.78), SAT(-fx * 3.0 + 0.4));
    col = mix(body, sc, snow);
    col = haze(col, uv.y);
  }
  // misty ridges
  float r1 = ridge(uv.x, HZ + 0.01, 0.05, 3.0, 4.0), r2 = ridge(uv.x, HZ + 0.004, 0.03, 5.0, 11.0);
  if (uv.y < r1) col = haze(mix(vec3(0.62, 0.50, 0.72), vec3(0.8, 0.6, 0.72), SAT((r1 - uv.y) * 6.0)), uv.y);
  if (uv.y < r2) col = haze(mix(vec3(0.55, 0.43, 0.62), vec3(0.72, 0.5, 0.62), SAT((r2 - uv.y) * 7.0)), uv.y);
  // pagoda on a wooded hill (right)
  float hill = HZ + 0.055 * exp(-pow((uv.x - 0.70) * 5.0, 2.0)) + 0.01 * fbm(vec2(uv.x * 20.0, 5.0), 3);
  if (uv.y < hill) col = mix(vec3(0.34, 0.30, 0.42), vec3(0.5, 0.36, 0.5), SAT((hill - uv.y) * 14.0));
  float pl; float pd = pagoda(uv - vec2(0.70, HZ + 0.048), pl);
  col = mix(col, mix(vec3(0.30, 0.18, 0.24), vec3(0.62, 0.34, 0.34), pl * 0.7), cov(pd));
  // far shore: a band of blossom trees and dark pines
  float sh = HZ + 0.018 + 0.03 * (0.5 + 0.5 * fbm(vec2(uv.x * 7.0 + 7.0, 2.0), 4)) - 0.02 * smoothstep(0.1, 0.5, abs(uv.x - 0.1));
  if (uv.y < sh && uv.y > HZ - 0.002) {
    float m = (sh - uv.y) * 22.0 - 0.1;
    vec4 b = blossomMass(uv, m, 0.55 + 0.4 * (uv.y - HZ) / 0.05, 0.016, 0.013, 3.0, vec3(1.0, 0.92, 0.95), vec3(0.62, 0.30, 0.45), vec3(1.0, 0.7, 0.8));
    float pine = step(0.62, fbm(vec2(uv.x * 11.0, 9.0), 3) + 0.5);
    b.rgb = mix(b.rgb, vec3(0.1, 0.22, 0.2) * (0.7 + 0.5 * SAT((uv.y - HZ) * 20.0)), pine * 0.8);
    col = mix(col, b.rgb, b.a);
  }
  return col;
}
vec3 pond(vec2 uv) {
  float depth = HZ - uv.y;
  float wob = fbm(vec2(uv.x * 5.0, uv.y * 70.0), 5);
  vec2 ruv = vec2(uv.x + wob * 0.012 * (0.4 + depth * 2.0), 2.0 * HZ - uv.y);
  vec3 refl = farScene(ruv);
  vec3 deep = mix(vec3(0.20, 0.22, 0.40), vec3(0.06, 0.09, 0.20), SAT(depth * 2.0));
  float fres = 0.62 + 0.3 * SAT(1.0 - depth * 2.0);
  vec3 col = mix(deep, refl, fres);
  float g = pow(SAT(wob * 1.7 + 0.1), 2.0) * exp(-abs(uv.x - SUN.x) * 3.6) * exp(-depth * 2.0);
  col += vec3(1.0, 0.66, 0.34) * g * 1.3;
  // fallen petals drifting on the surface
  vec2 gp = uv * vec2(34.0, 62.0); vec2 ci = floor(gp); vec2 h = hash22(ci);
  float pet = step(0.72, h.x) * smoothstep(0.22, 0.12, length((fract(gp) - 0.5 + (h - 0.5) * 0.4) * vec2(1.0, 1.9)));
  col = mix(col, vec3(1.0, 0.8, 0.88), pet * 0.85 * (0.4 + 0.6 * SAT(depth * 5.0)));
  return col;
}
vec4 farLayer(vec2 uv) { return vec4(uv.y > HZ ? farScene(uv) : pond(uv), 1.0); }

// ---- mid layer
vec4 torii(vec2 uv, vec2 c, float w, float h, bool refl) {
  vec2 p = uv - c; if (refl) p.y = -p.y - 0.0;
  float pillars = min(sdBox(p - vec2(-w, h * 0.5), vec2(0.011, h * 0.5)), sdBox(p - vec2(w, h * 0.5), vec2(0.011, h * 0.5)));
  float nuki = sdBox(p - vec2(0.0, h * 0.72), vec2(w + 0.02, 0.008));
  vec2 q = vec2(p.x, p.y - h - 0.012 - 0.6 * p.x * p.x * 0.3);
  float kasa = sdBox(q, vec2(w + 0.06, 0.012)); kasa = max(kasa, -sdBox(q - vec2(0.0, 0.016), vec2(w + 0.07, 0.006)) + 0.0);
  float shima = sdBox(p - vec2(0.0, h + 0.03), vec2(w + 0.03, 0.007));
  float d = min(min(pillars, nuki), min(kasa, shima));
  if (d > aaw()) return vec4(0.0);
  float lit = SAT(0.5 + 0.5 * sin(p.x * 40.0) * 0.0 + (-p.x / w) * 0.25);
  vec3 col = mix(vec3(0.42, 0.06, 0.05), vec3(0.88, 0.2, 0.1), lit);
  col = mix(col, vec3(0.1, 0.07, 0.08), step(h + 0.002, p.y) * step(p.y, h + 0.02) * 0.9);       // black kasagi cap
  col *= 0.88 + 0.12 * noise(vec2(p.y * 90.0, p.x * 8.0));
  float a = cov(d);
  return vec4(col, refl ? a * 0.45 : a);
}
float bridgeCurve(float x) { float t = (x - 0.56) / 0.27; return -0.108 + 0.082 * (1.0 - t * t); }
vec4 bridge(vec2 uv, bool refl) {
  vec2 p = uv; if (refl) p.y = 2.0 * -0.118 - p.y;
  if (abs(p.x - 0.56) > 0.3) return vec4(0.0);
  float yc = bridgeCurve(p.x);
  float deck = max(abs(p.y - yc) - 0.007, abs(p.x - 0.56) - 0.27);
  float under = max(max(p.y - yc, -(p.y - (yc - 0.05 * (1.0 - pow(abs(p.x - 0.56) / 0.27, 2.0)))) ), abs(p.x - 0.56) - 0.27);
  float rail = max(abs(p.y - (yc + 0.034)) - 0.0035, abs(p.x - 0.56) - 0.27);
  float posts = max(abs(fract((p.x - 0.29) / 0.045 + 0.5) - 0.5) * 0.045 - 0.0028, max(p.y - (yc + 0.036), (yc - 0.0) - p.y)); posts = max(posts, abs(p.x - 0.56) - 0.27);
  float d = min(min(deck, rail), min(posts, under));
  if (d > aaw()) return vec4(0.0);
  vec3 col = mix(vec3(0.5, 0.08, 0.06), vec3(0.95, 0.26, 0.14), SAT(0.5 - (p.x - 0.56) * 1.4));
  if (under < deck && under < rail) col = mix(vec3(0.16, 0.06, 0.06), vec3(0.4, 0.14, 0.1), SAT((p.y - (yc - 0.03)) * 20.0));
  return vec4(col, cov(d) * (refl ? 0.4 : 1.0));
}
vec4 stoneLantern(vec2 uv, vec2 c, float s, float on) { return vec4(0.0); }
vec4 midLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // reflections first (fade with depth below the waterline)
  if (uv.y < HZ) {
    float wob = fbm(vec2(uv.x * 5.0, uv.y * 70.0), 4) * 0.01;
    vec4 rt = torii(uv + vec2(wob, 0.0), vec2(0.06, -0.13), 0.1, 0.22, true); rt.a *= 0.8; r = over(rt, r);
    vec4 rb = bridge(uv + vec2(wob, 0.0), true); r = over(rb, r);
  }
  // bank trees on the right bank, behind the bridge
  {
    vec2 p = uv;
    float m = 1.0 - length((p - vec2(0.78, 0.13)) / vec2(0.23, 0.17));
    m = max(m, 1.0 - length((p - vec2(0.60, 0.08)) / vec2(0.13, 0.1)));
    m += 0.16 * fbm(p * 7.0 + 3.0, 4);
    float lit = SAT(0.55 - 5.0 * ((1.0 - length((p + TOLIGHT * 0.03 - vec2(0.78, 0.13)) / vec2(0.23, 0.17))) - (1.0 - length((p - vec2(0.78, 0.13)) / vec2(0.23, 0.17)))));
    float trunk; float th;
    float td = sdTaper(p, vec2(0.80, -0.1), vec2(0.78, 0.07), 0.016, 0.01, th);
    r = over(vec4(mix(vec3(0.17, 0.09, 0.09), vec3(0.4, 0.22, 0.2), SAT(0.5 - p.x * 3.0)), cov(td)), r);
    vec4 b = blossomMass(p, m, SAT(lit + 0.15), 0.026, 0.022, 5.0, vec3(1.0, 0.94, 0.96), vec3(0.6, 0.28, 0.44), vec3(1.0, 0.74, 0.84));
    r = over(b, r);
  }
  r = over(bridge(uv, false), r);
  r = over(torii(uv, vec2(0.06, -0.13), 0.1, 0.22, false), r);
  return r;
}

// ---- trees (near layer holds only the trunk bases; the swaying heads are sprites)
const vec2 FORK_L = vec2(-0.60, -0.12), FORK_R = vec2(0.72, -0.10);
vec3 barkCol(vec2 p, float h, float side) {
  float grain = fbm(vec2(p.x * 90.0, p.y * 14.0), 4);
  vec3 c = mix(vec3(0.13, 0.07, 0.07), vec3(0.42, 0.25, 0.22), SAT(0.5 + side * 0.9));
  c *= 0.78 + 0.5 * grain;
  float lenticel = step(0.9, noise(vec2(p.x * 120.0, p.y * 40.0)) * 0.5 + 0.5);                // pale horizontal cherry-bark marks
  return mix(c, vec3(0.62, 0.5, 0.46), lenticel * 0.35);
}
vec4 trunkBase(vec2 uv, vec2 base, vec2 fork, float r0, float r1) {
  float h; vec2 mid = (base + fork) * 0.5 + vec2(-0.02, 0.0);
  float d = min(sdTaper(uv, base, mid, r0, (r0 + r1) * 0.5, h), sdTaper(uv, mid, fork, (r0 + r1) * 0.5, r1, h));
  float flare = exp(-max(uv.y - base.y, 0.0) * 12.0) * 0.03; d -= flare * step(base.y - 0.02, uv.y);
  if (d > aaw()) return vec4(0.0);
  float side = dot(normalize(vec2(uv.x - (base.x + fork.x) * 0.5, 0.0) + 1e-5), vec2(TOLIGHT.x, 0.0)) * -1.0 * SAT(-d / r1 * 1.4);
  vec3 c = barkCol(uv, h, clamp(-(uv.x - (base.x + fork.x) * 0.5) / r0, -1.0, 1.0));
  return vec4(c, cov(d));
}
vec4 nearLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // left bank: a grassy slope with stones along the bottom
  float bankL = -0.5 + 0.2 * smoothstep(-0.9, -0.3, -uv.x) * 0.0 + 0.11 * exp(-pow((uv.x + 0.78) * 2.2, 2.0)) + 0.035 * fbm(vec2(uv.x * 7.0, 3.0), 4) + 0.02;
  float bankR = -0.5 + 0.09 * exp(-pow((uv.x - 0.80) * 2.4, 2.0)) + 0.03 * fbm(vec2(uv.x * 8.0, 8.0), 4) + 0.02;
  float bank = max(bankL, bankR);
  if (uv.y < bank) {
    float d = bank - uv.y;
    vec3 gcol = mix(vec3(0.07, 0.17, 0.10), vec3(0.26, 0.42, 0.18), SAT(d * 12.0 + 0.4 * fbm(uv * 30.0, 3)));
    gcol = mix(gcol, vec3(0.8, 0.5, 0.42), 0.22 * SAT(fbm(uv * 14.0 + 2.0, 4) + 0.3));
    r = vec4(gcol * (0.7 + 0.35 * SAT(0.6 + (uv.x < 0.0 ? 0.0 : -0.1))), cov(uv.y - bank));
    r.a = cov(uv.y - bank) < 0.5 ? 1.0 : 1.0;
  }
  r = over(trunkBase(uv, vec2(-0.72, -0.52), FORK_L, 0.07, 0.036), r);
  r = over(trunkBase(uv, vec2(0.78, -0.52), FORK_R, 0.055, 0.03), r);
  return r;
}
vec4 frontLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // sharp foreground grass blades and fallen petals along the very bottom
  float edge = -0.5 + 0.06 + 0.05 * fbm(vec2(uv.x * 6.0, 1.0), 3);
  float blades = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i); float sc = 55.0 + fi * 30.0;
    vec2 g = vec2(uv.x * sc + fi * 3.1, 0.0); float id = floor(g.x), fx = fract(g.x) - 0.5; float hh = hash11(id + fi * 17.0);
    float topY = -0.5 + 0.035 + 0.075 * hh * (1.0 - fi * 0.2);
    float lean = (hash11(id * 1.3 + fi) - 0.5) * 0.018 * (uv.y + 0.5) * 40.0;
    float w = 0.34 * SAT(1.0 - (uv.y + 0.5) / (topY + 0.5 + 1e-4)) ;
    float inside = step(uv.y, topY) * smoothstep(w, w - 0.06, abs(fx - lean * 0.0));
    vec3 c = mix(vec3(0.05, 0.16, 0.08), vec3(0.45, 0.62, 0.22), SAT((uv.y + 0.5) / (topY + 0.5)));
    c *= 0.65 + 0.4 * fi * 0.4;
    r = over(vec4(c, inside), r); blades += inside;
  }
  vec2 gp = uv * vec2(26.0, 14.0); vec2 ci = floor(gp); vec2 h = hash22(ci * 1.9);
  vec2 lp = rot2(h.y * 6.0) * ((fract(gp) - 0.5 + (h - 0.5) * 0.5) * vec2(1.0, 1.8));
  float pet = step(0.6, h.x) * step(uv.y, -0.38) * smoothstep(0.17, 0.1, length(lp * vec2(1.0, 2.0)));
  r = over(vec4(mix(vec3(0.98, 0.52, 0.7), vec3(1.0, 0.8, 0.88), h.y), pet * 0.9), r);
  return r;
}
vec4 raysLayer(vec2 uv) {
  vec2 p = uv - SUN; float a = atan(p.y, p.x), d = length(p);
  float beams = 0.5 + 0.5 * sin(a * 23.0 + 3.0 * sin(a * 7.0)); beams = pow(beams, 3.0) * (0.6 + 0.4 * noise(vec2(a * 15.0, 2.0)));
  float fade = exp(-d * 1.4) * SAT(1.0 - d * 0.7);
  float al = beams * fade * 0.7;
  return vec4(vec3(1.0, 0.86, 0.62), SAT(al));
}

// ---- sprites (local uv; scene = c + uv * span)
vec2 toScene(vec2 uv, vec2 c, float span) { return c + uv * span; }
float limbs(vec2 p, int tree0, out float h) {   // tree0 >= 2: boughs only (no trunk), used for the blossom mask
  float d = 1e9; h = 0.0; float th; int tree = tree0 % 2; bool trunk = tree0 < 2;
  if (tree == 0) {
    if (trunk) { d = min(d, sdTaper(p, FORK_L, vec2(-0.55, 0.06), 0.034, 0.026, th)); h = th;
    d = min(d, sdTaper(p, vec2(-0.55, 0.06), vec2(-0.50, 0.2), 0.026, 0.018, th)); }
    d = min(d, sdTaper(p, vec2(-0.56, 0.02), vec2(-0.30, 0.095), 0.02, 0.014, th));
    d = min(d, sdTaper(p, vec2(-0.30, 0.095), vec2(-0.12, 0.15), 0.014, 0.008, th));
    d = min(d, sdTaper(p, vec2(-0.12, 0.15), vec2(0.0, 0.1), 0.008, 0.003, th));
    d = min(d, sdTaper(p, vec2(-0.52, 0.12), vec2(-0.78, 0.2), 0.016, 0.008, th));
    d = min(d, sdTaper(p, vec2(-0.78, 0.2), vec2(-0.93, 0.31), 0.008, 0.004, th));
    d = min(d, sdTaper(p, vec2(-0.50, 0.2), vec2(-0.3, 0.32), 0.016, 0.008, th));
    d = min(d, sdTaper(p, vec2(-0.3, 0.32), vec2(-0.12, 0.42), 0.008, 0.003, th));
  } else {
    if (trunk) { d = min(d, sdTaper(p, FORK_R, vec2(0.68, 0.1), 0.03, 0.024, th));
    d = min(d, sdTaper(p, vec2(0.68, 0.1), vec2(0.62, 0.24), 0.024, 0.016, th)); }
    d = min(d, sdTaper(p, vec2(0.68, 0.08), vec2(0.42, 0.14), 0.016, 0.01, th));
    d = min(d, sdTaper(p, vec2(0.42, 0.14), vec2(0.28, 0.1), 0.01, 0.003, th));
    d = min(d, sdTaper(p, vec2(0.64, 0.2), vec2(0.4, 0.3), 0.014, 0.007, th));
    d = min(d, sdTaper(p, vec2(0.4, 0.3), vec2(0.2, 0.4), 0.007, 0.003, th));
  }
  return d;
}
float canopy(vec2 p, int tree) {
  float m = -1.0, h;
  m = max(m, 0.55 - limbs(p, tree + 2, h) / 0.075 + 0.5 * fbm(p * 22.0, 3));                               // blossoms hug the limbs: boughs read as flowering wood
  if (tree == 0) {
    m = max(m, 1.0 - length((p - vec2(-0.70, 0.37)) / vec2(0.2, 0.12)));
    m = max(m, 1.0 - length((p - vec2(-0.45, 0.40)) / vec2(0.14, 0.08)));
    m = max(m, 1.0 - length((p - vec2(-0.88, 0.27)) / vec2(0.1, 0.14)));
    m = max(m, 1.0 - length((p - vec2(-0.55, 0.16)) / vec2(0.09, 0.09)));
    m = max(m, 1.0 - length((p - vec2(0.0, 0.07)) / vec2(0.05, 0.06)));       // hanging cluster over the water
  } else {
    m = max(m, 1.0 - length((p - vec2(0.58, 0.37)) / vec2(0.18, 0.11)));
    m = max(m, 1.0 - length((p - vec2(0.84, 0.30)) / vec2(0.1, 0.18)));
    m = max(m, 1.0 - length((p - vec2(0.28, 0.07)) / vec2(0.05, 0.06)));
  }
  return m + 0.22 * fbm(p * 8.0 + float(tree) * 5.0, 4) - 0.07;
}
vec4 treeHead(vec2 uv, vec2 c, float span, int tree) {
  vec2 p = toScene(uv, c, span);
  float h; float d = limbs(p, tree, h);
  vec4 r = vec4(0.0);
  if (d < aaw()) { float side = clamp((p.x - (tree == 0 ? -0.55 : 0.66)) * -6.0, -1.0, 1.0); r = vec4(barkCol(p, h, side * 0.5), cov(d)); }
  float m = canopy(p, tree);
  float lit = SAT(0.42 - 5.0 * (canopy(p + TOLIGHT * 0.035, tree) - m) + 0.25 * (p.y - 0.15));
  // back-lit blossoms glow where the sun shines through them (sprite is closer to the sun side on the left tree)
  vec4 b = blossomMass(p, m, lit, 0.033, 0.029, 1.0 + float(tree) * 7.0, vec3(1.0, 0.9, 0.95), vec3(0.58, 0.26, 0.42), vec3(1.0, 0.76, 0.86));
  return over(b, r);
}
vec4 bough(vec2 uv, float seed, float flip) {
  vec2 p = uv * vec2(flip, 1.0);
  vec4 r = vec4(0.0); float bd = 1e9, th;
  vec2 prev = vec2(0.78, 0.06);
  for (int i = 1; i <= 14; i++) {
    float t = float(i) / 14.0;
    vec2 q = mix(vec2(0.78, 0.06), vec2(-0.66, -0.16), t) + vec2(0.0, 0.1 * sin(PI * t) + 0.03 * sin(t * 17.0 + seed));
    bd = min(bd, sdTaper(p, prev, q, mix(0.026, 0.006, float(i - 1) / 14.0), mix(0.026, 0.006, t), th)); prev = q;
  }
  // twigs
  for (int k = 0; k < 6; k++) {
    float t = 0.14 + 0.13 * float(k); float sgn = (k % 2 == 0) ? 1.0 : -1.0;
    vec2 a = mix(vec2(0.78, 0.06), vec2(-0.66, -0.16), t) + vec2(0.0, 0.1 * sin(PI * t) + 0.03 * sin(t * 17.0 + seed));
    bd = min(bd, sdTaper(p, a, a + vec2(-0.06, 0.1 * sgn * (0.8 + hash11(seed + float(k)))), 0.007, 0.002, th));
  }
  if (bd < aaw()) r = vec4(barkCol(p, th, 0.2) * 1.1, cov(bd));
  float m = -1.0;
  for (int k = 0; k < 9; k++) {
    float t = 0.1 + 0.1 * float(k); float sgn = (k % 2 == 0) ? 1.0 : -1.0;
    vec2 a = mix(vec2(0.78, 0.06), vec2(-0.66, -0.16), t) + vec2(0.0, 0.1 * sin(PI * t) + 0.03 * sin(t * 17.0 + seed)) + vec2(-0.03, 0.1 * sgn * (0.6 + hash11(seed + 3.0 * float(k))));
    m = max(m, 1.0 - length((p - a) / vec2(0.1 + 0.05 * hash11(seed + float(k)), 0.085)));
  }
  m += 0.34 * fbm(p * 10.0 + seed, 4) - 0.1;
  float lit = SAT(0.62 - 5.0 * ((m) - (m)) + 0.25 * p.y + 0.1);
  vec4 b = blossomMass(p, m, SAT(lit + 0.2 * noise(p * 11.0)), 0.036, 0.032, seed, vec3(1.0, 0.95, 0.97), vec3(0.6, 0.27, 0.44), vec3(1.0, 0.78, 0.88));
  return over(b, r);
}
vec4 petal(vec2 uv, float k) {
  vec2 p = uv * 1.0; p = rot2(0.2 + k * 0.4) * p; p.x += (0.5 + 0.4 * k) * p.y * p.y * 0.8;
  float d = sdEll(p, vec2(0.17 - 0.015 * k, 0.3));
  d = max(d, -(length(p - vec2(0.0, 0.31)) - 0.055));
  if (d > aaw()) return vec4(0.0);
  float t = SAT((p.y + 0.3) / 0.6);
  vec3 col = mix(vec3(1.0, 0.62, 0.76), vec3(1.0, 0.94, 0.96), smoothstep(0.0, 1.0, t));
  col = mix(col, vec3(1.0, 0.55, 0.7), smoothstep(0.5, 0.0, abs(p.x) / 0.17) * (1.0 - t) * 0.6);
  col *= 0.9 + 0.12 * sin(p.x * 70.0 * (1.0 - t * 0.5)) * (1.0 - t);
  col *= 0.88 + 0.18 * (p.x * -2.0 + 0.5);
  return vec4(col, cov(d));
}
vec4 koi(vec2 uv) {
  vec2 p = uv * 0.62; // 640x300: the fish fills the sprite
  float th; float bend = 0.03 * sin(p.x * 5.0);
  vec2 q = p - vec2(0.0, bend);
  float body = min(sdTaper(q, vec2(0.42, 0.0), vec2(-0.1, 0.0), 0.085, 0.07, th), sdTaper(q, vec2(-0.1, 0.0), vec2(-0.3, 0.0), 0.07, 0.014, th));
  vec2 tp = q + vec2(0.32, 0.0); float tail = max(abs(tp.y) - 0.1 * (1.0 - SAT(tp.x / -0.35)) - 0.01, max(-tp.x, tp.x + 0.35) ) ;
  tail = max(abs(tp.y) - 0.04 - 0.14 * SAT(-tp.x / 0.3), max(tp.x - 0.0, -tp.x - 0.32)) + 0.02 * sin(tp.y * 40.0);
  float fin = min(sdEll(rot2(0.6) * (q - vec2(0.25, 0.1)), vec2(0.1, 0.03)), sdEll(rot2(-0.6) * (q - vec2(0.25, -0.1)), vec2(0.1, 0.03)));
  float d = min(body, min(tail, fin));
  if (d > aaw()) return vec4(0.0);
  float n = fbm(q * 6.0 + 4.0, 3);
  vec3 col = mix(vec3(1.0, 0.95, 0.9), vec3(1.0, 0.36, 0.08), smoothstep(-0.05, 0.1, n));
  col = mix(col, vec3(0.08, 0.06, 0.07), step(0.55, noise(q * 11.0 + 9.0) * 0.5 + 0.5) * step(q.x, 0.2) * 0.9);
  col = mix(col, vec3(0.95, 0.4, 0.2), step(0.0, -q.x - 0.28) * 0.0);
  col *= 0.9 + 0.12 * SAT(1.0 - abs(q.y) / 0.08);
  float a = cov(d); if (min(tail, fin) < body) a *= 0.75;
  return vec4(col, a);
}
vec4 lantern(vec2 uv) {
  vec2 p = uv; float d = 1e9;
  float base = sdBox(p - vec2(0.0, -0.44), vec2(0.2, 0.05));
  float post = sdBox(p - vec2(0.0, -0.22), vec2(0.07, 0.17));
  float mid = sdBox(p - vec2(0.0, -0.02), vec2(0.17, 0.035));
  float fire = sdBox(p - vec2(0.0, 0.1), vec2(0.12, 0.09));
  vec2 rq = vec2(p.x, p.y - 0.25 - 0.4 * p.x * p.x);
  float roof = max(sdBox(rq, vec2(0.3, 0.07)), -(p.y - 0.18) * 0.0);
  float cap = sdEll(p - vec2(0.0, 0.34), vec2(0.07, 0.07));
  d = min(min(base, post), min(mid, min(fire, min(roof, cap))));
  if (d > aaw()) return vec4(0.0);
  vec3 stone = mix(vec3(0.30, 0.27, 0.28), vec3(0.86, 0.78, 0.7), SAT(0.5 - p.x * 1.3)) * (0.82 + 0.3 * fbm(p * 40.0, 4));
  stone = mix(stone, vec3(0.2, 0.3, 0.18), SAT(fbm(p * 12.0, 3) - 0.1) * 0.5 * step(p.y, 0.0));  // moss
  vec3 col = stone;
  float win = sdBox(p - vec2(0.0, 0.1), vec2(0.07, 0.055));
  col = mix(col, vec3(1.0, 0.72, 0.32) * (1.2 - 2.0 * length(p - vec2(0.0, 0.1))), cov(win));
  vec4 r = vec4(col, cov(d));
  float g = exp(-length((p - vec2(0.0, 0.1)) * vec2(1.0, 1.1)) * 5.0) * 0.5;
  return vec4(mix(r.rgb, vec3(1.0, 0.8, 0.45), g * (1.0 - r.a)), max(r.a, g));
}


// ================= raymarched 3D sprites: blossom boughs (0,1), petals (4..6), koi (7) =================

float sdPetal3(vec3 q, float L, float W) {
  vec3 pq = q - vec3(0.5 * L, 0.0, 0.0);
  float curl = 0.9 * pq.y * pq.y / W + 1.1 * q.x * q.x / L * 0.35;
  float d = sdE(vec3(pq.x, pq.y, pq.z - curl), vec3(L * 0.56, W, 0.0105 * L / 0.13));
  d = max(d, -(length(vec2(q.x - L * 1.04, q.y)) - 0.016 * L / 0.13) );          // the notch at the petal tip
  return d * 0.7;
}
float flower3(vec3 p, vec3 c, float R, mat3 rot, out float mat) {
  vec3 q = rot * (p - c); mat = 1.0; float bound = length(q) - R * 1.5; if (bound > 0.06) return bound;
  float d = 1e9;
  for (int i = 0; i < 5; i++) { float a = float(i) * 1.2566 + 0.2; d = min(d, sdPetal3(rotZ(-a) * q, 0.125 * R / 0.1, 0.052 * R / 0.1)); }
  float stamens = 1e9;
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.047 + 0.5; vec3 e = vec3(cos(a), sin(a), 0.35) * 0.065 * R / 0.1; stamens = min(stamens, sdCap3(q, vec3(0.0, 0.0, 0.0), e, 0.004 * R / 0.1, 0.002 * R / 0.1)); stamens = min(stamens, sdSph(q - e, 0.0065 * R / 0.1)); }
  float ctr = sdSph(q - vec3(0.0, 0.0, 0.01), 0.018 * R / 0.1);
  float ds = min(stamens, ctr); if (ds < d) { d = ds; mat = 2.0; }
  return d;
}
vec2 boughPt(float t, float seed) { return mix(vec2(0.78, 0.06), vec2(-0.66, -0.16), t) + vec2(0.0, 0.1 * sin(PI * t) + 0.03 * sin(t * 17.0 + seed)); }
vec3 gC = vec3(0.0);
float mapBough(vec3 p, float seed) {
  float d = 1e9; gM = 3.0; vec2 prev = boughPt(0.0, seed);
  for (int i = 1; i <= 14; i++) { float t = float(i) / 14.0; vec2 q = boughPt(t, seed); float r0 = mix(0.026, 0.006, float(i - 1) / 14.0), r1 = mix(0.026, 0.006, t);
    d = min(d, sdCap3(p, vec3(prev, 0.0), vec3(q, 0.0), r0, r1)); prev = q; }
  d += 0.004 * noise(p.xy * 90.0);
  float mt;
  for (int i = 0; i < 12; i++) { float fi = float(i); float t = 0.06 + 0.078 * fi; float sg = (i % 2 == 0) ? 1.0 : -1.0; float h = hash11(seed + fi * 3.7);
    vec2 a = boughPt(t, seed); vec2 off = vec2(-0.03 + 0.05 * h, sg * (0.05 + 0.07 * h));
    // twig to the flower
    d = min(d, sdCap3(p, vec3(a, 0.0), vec3(a + off, 0.02), 0.006, 0.003));
    vec3 c = vec3(a + off, 0.03 + 0.04 * hash11(seed + fi));
    mat3 rot = rotZ(h * 6.28) * rotX((hash11(seed + fi * 1.3) - 0.5) * 1.0) * rotY((hash11(seed + fi * 2.1) - 0.5) * 0.9);
    float R = 0.85 + 0.5 * hash11(seed + fi * 5.0);
    float fd = flower3(p, c, R * 0.1, rot, mt); if (fd < d) { d = fd; gM = mt; gC = c; } }
  return d * 0.8;
}
vec2 koiPt(float t) { return vec2(0.42 - 0.95 * t, 0.06 * sin(t * 6.0)); }
float mapKoi(vec3 p) {
  p = rotX(-0.9) * p; gP = p; float d = 1e9; vec2 prev = koiPt(0.0); gM = 1.0;
  for (int i = 1; i <= 10; i++) { float t = float(i) / 10.0; vec2 q = koiPt(t); float r0 = 0.075 * sin(PI * (0.12 + 0.82 * (t - 0.1))) + 0.012, r1 = 0.075 * sin(PI * (0.12 + 0.82 * t)) + 0.012; if (t < 0.12) { r0 = 0.045; r1 = 0.06; }
    d = min(d, sdCap3(vec3(p.x, p.y * 1.15, p.z), vec3(prev, 0.0), vec3(q, 0.0), max(r0, 0.01), max(r1, 0.01))); prev = q; }
  float tail = sdE(vec3(p.x + 0.58, p.y * 0.9 - 0.06 * sin(-0.58 * 6.0 * 0.0), p.z * 5.0), vec3(0.2, 0.17, 0.12)) ; tail = max(tail, -(p.x + 0.38)); if (tail < d) { d = tail; gM = 2.0; }
  for (int s2 = 0; s2 < 2; s2++) { float sg = s2 == 0 ? 1.0 : -1.0; vec3 q = vec3(p.x, p.y * sg, p.z * 6.0);
    float fin = sdE(rotZ(0.7) * (q - vec3(0.2, sg * 0.1 * 6.0 / 6.0, 0.0) * 1.0 * vec3(1.0, 1.0, 1.0)) , vec3(0.11, 0.04, 0.1)); fin = sdE(rotZ(sg * 0.7) * (vec3(p.x, p.y, p.z * 6.0) - vec3(0.2, sg * 0.1, 0.0)), vec3(0.11, 0.035, 0.1)); if (fin < d) { d = fin; gM = 2.0; } }
  float eyeS = min(sdSph(p - vec3(0.4, 0.045, 0.045), 0.014), sdSph(p - vec3(0.4, -0.045, 0.045), 0.014)); if (eyeS < d) { d = eyeS; gM = 4.0; }
  return d * 0.7;
}
float map3(vec3 p) {
  int k = uLayer - 10;
  if (k == 0) return mapBough(p, 3.0); if (k == 1) return mapBough(vec3(p.x * 1.15, p.yz), 11.0);
  if (k == 7) return mapKoi(p);
  // petals 4..6: a single curved shell
  float kk = float(k - 4); vec3 q = rotX(0.5 + kk * 0.4) * rotY(0.3 - kk * 0.5) * p; gP = q; gM = 1.0;
  float curl = 0.7 * q.y * q.y + 0.35 * q.x * q.x * (1.0 + kk * 0.3);
  float d = sdE(vec3(q.x, q.y, q.z - curl), vec3(0.17 - 0.015 * kk, 0.3, 0.012)); d = max(d, -(length(vec2(q.x, q.y - 0.32)) - 0.045)); return d * 0.7;
}
vec3 shade3(vec3 p, vec3 n, vec3 rd, float m, float ao, out float alpha) {
  alpha = 1.0; int k = uLayer - 10; vec3 L = normalize(vec3(-0.5, 0.75, -0.6));
  float diff = SAT(dot(n, L) * 0.5 + 0.5); float back = SAT(dot(-n, L)); float fr = pow(1.0 - SAT(abs(dot(n, rd))), 3.0);
  vec3 sky = mix(vec3(0.6, 0.45, 0.65), vec3(1.0, 0.85, 0.8), n.y * 0.5 + 0.5);
  if (k == 7) { vec3 q = gP;
    if (m == 4.0) return vec3(0.02);
    float patch1 = smoothstep(-0.05, 0.1, fbm(q.xy * vec2(5.0, 9.0) + 2.0, 4)); float sumi = step(0.62, noise(q.xy * vec2(7.0, 12.0) + 9.0) * 0.5 + 0.5);
    vec3 base = mix(vec3(0.98, 0.96, 0.93), vec3(0.95, 0.32, 0.06), patch1); base = mix(base, vec3(0.05, 0.04, 0.05), sumi * 0.8 * step(q.x, 0.25));
    if (m == 2.0) { base = mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.95, 0.9), 0.5); alpha = 0.8; }
    base *= 0.92 + 0.12 * noise(q.xy * 120.0);
    vec3 H = normalize(L - rd); float sp = pow(SAT(dot(n, H)), 60.0) * 0.6;
    return base * (sky * 0.5 + vec3(1.0, 0.95, 0.85) * diff * 0.8) * ao + vec3(1.0) * sp + vec3(1.0, 0.6, 0.5) * back * 0.1; }
  if (k >= 4) { vec3 q = gP; float tip = SAT((q.y + 0.3) / 0.6);
    vec3 base = mix(vec3(0.9, 0.3, 0.55), vec3(1.0, 0.78, 0.88), smoothstep(0.0, 1.0, tip));
    base *= 0.93 + 0.07 * sin(q.x * 90.0 * (1.0 - tip * 0.5));
    vec3 sss = vec3(1.0, 0.45, 0.6) * back * 0.6;
    return base * (sky * 0.55 + vec3(1.0, 0.92, 0.85) * diff * 0.75) * (0.75 + 0.25 * ao) + sss + vec3(1.0, 0.9, 0.9) * fr * 0.15; }
  // bough
  if (m == 3.0) { vec3 bark = mix(vec3(0.13, 0.07, 0.06), vec3(0.45, 0.28, 0.24), SAT(noise(p.xy * 160.0) * 0.5 + 0.5)); bark = mix(bark, vec3(0.62, 0.5, 0.46), step(0.9, noise(p.xy * vec2(240.0, 60.0)) * 0.5 + 0.5) * 0.4);
    return bark * (sky * 0.45 + vec3(1.0, 0.9, 0.8) * diff * 0.9) * ao; }
  if (m == 2.0) return mix(vec3(1.0, 0.8, 0.2), vec3(0.9, 0.2, 0.5), 0.35) * (0.6 + 0.6 * diff) * ao;
  float rad = SAT(length(p.xy - gC.xy) / 0.16); vec3 base = mix(vec3(0.82, 0.14, 0.4), vec3(1.0, 0.62, 0.78), smoothstep(0.1, 0.9, rad) * (0.7 + 0.3 * noise(p.xy * 80.0)));
  return base * (sky * 0.32 + vec3(1.0, 0.9, 0.82) * diff * 0.85) * (0.3 + 0.7 * pow(ao, 1.6)) + vec3(1.0, 0.4, 0.55) * back * 0.45 + vec3(1.0) * fr * 0.08;
}

vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0 || k == 1 || k >= 4) { r = sprite3d(uv, vec3(0.0, 0.0, -3.0), vec3(0.0), (k == 0 || k == 1) ? 2.2 : (k == 7 ? 3.6 : 2.6)); gAlpha = r.a; return r.rgb; }
    if (k == 0) r = bough(uv, 3.0, 1.0);
    else if (k == 1) r = bough(uv * 1.15, 11.0, 1.0);
    else if (k == 2) r = treeHead(uv, vec2(-0.345, 0.1925), 0.625, 0);
    else if (k == 3) r = treeHead(uv, vec2(0.42, 0.1925), 0.625, 1);
    else if (k == 4) r = petal(uv, 0.0);
    else if (k == 5) r = petal(uv, 1.0);
    else if (k == 6) r = petal(uv, 2.0);
    else r = koi(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  // flat composite: everything, including the tree heads at rest
  r = farLayer(uv);
  r = over(midLayer(uv), r); r = over(nearLayer(uv), r);
  r = over(treeHead((uv - vec2(-0.345, 0.1925)) / 0.625, vec2(-0.345, 0.1925), 0.625, 0), r);
  r = over(treeHead((uv - vec2(0.42, 0.1925)) / 0.625, vec2(0.42, 0.1925), 0.625, 1), r);
  r = over(frontLayer(uv), r);
  vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.3;
  return r.rgb;
}
