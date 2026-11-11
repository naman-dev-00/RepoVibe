// @lib2d
// @sprites pineA:640x900, pineB:520x760, pineC:560x800, fox:520x300, crystal:600x760, flake:192x192, shard:256x256
// Arctic Frost — a golden-hour alpine valley with a frozen lake (light theme). The mountain range is a raymarched eroded heightfield
// (real 3D terrain: snow by slope and altitude, exposed rock, soft shadows, aerial perspective) and the lake reflects it; the conifer
// forest is painted with a tiered-branch tree model (drooping boughs, snow loading on the upper faces, blue shadow sides).
// Honest label: layered 2.5D wallpaper (the terrain is rendered once, not in real time).
// uLayer: 1 far (sky, mountains, frozen lake) · 2 mid (shore forest) · 3 near (snowbanks, rocks) · 4 front (frosted corner boughs) · 5 sun haze · 10+ sprites.
const vec3 L = normalize(vec3(0.75, 0.32, 0.45));            // low sun, from the right
const vec3 RO = vec3(0.0, 1.05, -2.0);
const vec3 TA = vec3(0.0, 1.6, 20.0);
const float FOCAL = 1.45;
vec3 camRay(vec2 uv) { return camera(RO, TA, 0.0) * normalize(vec3(uv, FOCAL)); }
float mountH(vec2 p) {
  float back = SAT((p.y - 9.0) / 11.0), side = SAT((abs(p.x) - 6.0) / 6.0) * SAT((p.y - 1.0) / 9.0);
  float m = max(back, side);
  float n = terrainH(p * 0.11 + vec2(3.1, 1.7), 9) * 0.5 + 0.5;
  return m * (0.6 + 6.5 * n * n) * (0.65 + 0.35 * smoothstep(-20.0, 20.0, p.y + 10.0)) - 0.03;
}
vec3 skyC(vec3 rd) {
  float y = rd.y;
  vec3 c = mix(vec3(0.95, 0.78, 0.62), vec3(0.45, 0.62, 0.88), SAT(y * 3.0 + 0.05));
  c = mix(c, vec3(0.12, 0.28, 0.6), SAT(y * 2.4 - 0.1));
  float s = max(dot(rd, L), 0.0);
  c += vec3(1.0, 0.82, 0.55) * (pow(s, 12.0) * 0.5 + pow(s, 400.0) * 3.0);
  // high thin cirrus
  vec2 cp = rd.xz / max(rd.y, 0.04) * 0.6;
  float ci = smoothstep(0.1, 0.7, fbm(cp * vec2(1.0, 3.0) + 2.0, 5)) * SAT(rd.y * 6.0);
  c = mix(c, vec3(1.0, 0.95, 0.9) + vec3(0.2, 0.1, 0.0) * pow(s, 4.0), ci * 0.45);
  return c;
}
float traceT(vec3 ro, vec3 rd, float tmax) {
  float t = 0.4;
  for (int i = 0; i < 260; i++) { vec3 p = ro + rd * t; float h = p.y - mountH(p.xz); if (h < 0.0006 * t) break; t += max(0.004 * t, h * 0.4); if (t > tmax) return -1.0; }
  // refine: bisect between the last two samples (no contour banding)
  float a = t - max(0.004 * t, 0.01), b = t;
  for (int i = 0; i < 8; i++) { float m = 0.5 * (a + b); vec3 p = ro + rd * m; if (p.y - mountH(p.xz) < 0.0) b = m; else a = m; }
  return b;
}
vec3 terrainN(vec3 p, float t) { float e = 0.004 * t + 0.002; return normalize(vec3(mountH(p.xz - vec2(e, 0.0)) - mountH(p.xz + vec2(e, 0.0)), 2.0 * e, mountH(p.xz - vec2(0.0, e)) - mountH(p.xz + vec2(0.0, e)))); }
float softShadow(vec3 p) { float r = 1.0, t = 0.08; for (int i = 0; i < 48; i++) { vec3 q = p + L * t; float h = q.y - mountH(q.xz); r = min(r, 10.0 * h / t); if (r < 0.01) break; t += clamp(h, 0.06, 0.8); if (t > 30.0) break; } return SAT(r); }
vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t) {
  float slope = n.y;
  float snow = smoothstep(0.62, 0.78, slope + 0.12 * fbm(p.xz * 1.6, 4) + 0.05 * p.y / 6.0);
  vec3 rock = mix(vec3(0.08, 0.09, 0.12), vec3(0.2, 0.18, 0.18), fbm(p.xz * 3.0 + p.y, 4) * 0.5 + 0.5);
  // strata streaks on the rock faces
  rock *= 0.8 + 0.25 * smoothstep(0.3, 0.7, noise(vec2(p.y * 9.0 + p.x * 2.0, p.z)));
  vec3 alb = mix(rock, vec3(0.9, 0.92, 0.95), snow);
  float sh = softShadow(p + n * 0.02);
  float dif = SAT(dot(n, L)) * sh;
  vec3 sun = vec3(1.0, 0.84, 0.64) * 1.45, skyAmb = vec3(0.22, 0.33, 0.58) * (0.3 + 0.3 * n.y);
  vec3 c = alb * (sun * dif + skyAmb);
  c += snow * vec3(1.0, 0.9, 0.75) * pow(SAT(dot(reflect(rd, n), L)), 18.0) * 0.4 * sh;           // snow sheen
  // aerial perspective: distant ridges fade to the bright haze
  float fog = 1.0 - exp(-t * 0.011);
  return mix(c, vec3(0.62, 0.72, 0.88) + vec3(0.25, 0.14, 0.02) * pow(max(dot(rd, L), 0.0), 6.0), fog);
}
vec3 farScene(vec2 uv) {
  vec3 rd = camRay(uv);
  if (rd.y < 0.0) {           // frozen lake (y = 0) in front of the range
    float tl = -RO.y / rd.y; vec3 p = RO + rd * tl;
    if (mountH(p.xz) < 0.0) {
      // ice: polished with drifted snow; reflection of the range, softened by the ice's micro-roughness
      vec2 w = vec2(noise(p.xz * 2.2), noise(p.xz * 2.2 + 7.0)) * 0.025;
      vec3 n = normalize(vec3(w.x, 1.0, w.y)); vec3 rr = reflect(rd, n);
      float t2 = traceT(p + vec3(0.0, 0.01, 0.0), rr, 90.0);
      vec3 refl = t2 > 0.0 ? shadeTerrain(p + rr * t2, terrainN(p + rr * t2, t2), rr, t2 + tl) : skyC(rr);
      float fres = 0.25 + 0.75 * pow(1.0 - SAT(-rd.y), 5.0);
      vec3 ice = mix(vec3(0.16, 0.34, 0.5), refl, 0.45 + fres * 0.5);
      // cracks and pressure lines in the clear ice
      vec2 g = p.xz * 1.7; vec2 cell = floor(g); float md = 8.0, md2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 r = o + hash22(cell + o) - fract(g); float d = dot(r, r); if (d < md) { md2 = md; md = d; } else if (d < md2) md2 = d; }
      float crack = smoothstep(0.025, 0.0, sqrt(md2) - sqrt(md)) * exp(-tl * 0.12) * smoothstep(0.0, 0.3, noise(p.xz * 1.3 + 5.0));
      ice = mix(ice, vec3(0.92, 0.97, 1.0), crack * 0.45);
      float drift = smoothstep(0.3, 0.65, fbm(p.xz * vec2(0.35, 0.9) + 4.0, 5)) * 0.7;                      // wind-drifted snow on the ice
      vec3 snowC = vec3(0.86, 0.84, 0.82);
      vec3 c = mix(ice, snowC, drift * 0.85);
      float fog = 1.0 - exp(-tl * 0.03);
      return mix(c, vec3(0.62, 0.72, 0.88), fog * 0.6);
    }
  }
  float t = traceT(RO, rd, 120.0);
  if (t < 0.0) return skyC(rd);
  vec3 p = RO + rd * t;
  return shadeTerrain(p, terrainN(p, t), rd, t);
}
vec4 farLayer(vec2 uv) { return vec4(farScene(uv), 1.0); }

// ---------- conifer painter: tiered drooping boughs with snow on their upper faces
// p: local coords (base at 0, height h). Returns straight colour + coverage. lit side: +x (sun from the right).
vec4 conifer(vec2 p, float h, float seed, float haze) {
  vec2 q = p / h;                                     // v: 0 base → 1 tip
  if (q.y < -0.02 || q.y > 1.05 || abs(q.x) > 0.55) return vec4(0.0);
  float T = 8.0 + floor(hash11(seed) * 4.0);
  float v = q.y, ax = abs(q.x);
  float tierF = fract((1.0 - v) * T + 0.15 * noise(vec2(q.x * 9.0, seed))), tierI = floor((1.0 - v) * T);
  float env = 0.42 * pow(SAT(1.0 - v), 0.9) + 0.025;
  // each tier: boughs fan out and droop, their tips ragged; the lower edge of a tier hangs below the next tier's start
  float side = sign(q.x) + 0.001;
  float tipN = noise(vec2(ax * 24.0 + tierI * 3.7 + seed + step(0.0, q.x) * 11.0, tierF * 3.0));
  float w = env * (0.5 + 0.5 * pow(tierF, 0.8)) * (0.85 + 0.3 * (hash11(tierI * 7.1 + seed + step(0.0, q.x)) - 0.5)) + 0.03 * tipN * tierF;
  float needles = 0.012 * noise(vec2(q.x * 140.0, v * 160.0 + seed));
  float sd = (ax - w - needles) * h;
  float trunk = sdBox(q - vec2(0.0, 0.04), vec2(0.024, 0.06)) * h;
  float d = q.y < 0.08 ? min(trunk, max(sd, (0.08 - q.y) * h)) : sd;
  d = min(d, trunk);
  float a = cov(d);
  if (a <= 0.0) return vec4(0.0);
  float rel = ax / max(w, 0.01);
  // needle mass: near-black spruce, slightly lighter on the sunlit (right) side and toward bough tips
  vec3 fol = mix(vec3(0.015, 0.045, 0.045), vec3(0.05, 0.12, 0.1), SAT(0.5 + q.x / max(w, 0.01) * 0.5) * (0.6 + 0.4 * rel));
  fol *= 0.7 + 0.5 * noise(q * vec2(90.0, 110.0) + seed);
  // snow: lumps resting on the upper face of each tier, thickness varying along the bough, patchy, heavier near the top of the tree
  float th = (0.1 + 0.28 * noise(vec2(q.x * 16.0 + tierI * 5.3, seed))) * (0.7 + 0.5 * v);
  float onTop = step(tierF, th) * step(rel, 0.92 + 0.08 * tipN);
  float patchy = step(0.38 - 0.25 * v, noise(q * vec2(46.0, 34.0) + seed * 3.0) * 0.5 + 0.5);
  float snowM = onTop * patchy;
  snowM = max(snowM, step(0.93, v) * step(0.3, noise(q * 30.0 + seed)));             // capped tip
  float lit = SAT(0.45 + q.x / max(w, 0.01) * 0.55 - tierF * 0.6);
  vec3 snow = mix(vec3(0.46, 0.56, 0.76), vec3(0.96, 0.91, 0.84), lit);
  vec3 col = mix(fol, snow, snowM);
  col *= 1.0 - 0.35 * step(tierF, th + 0.06) * (1.0 - snowM);                      // shadow just under the snow lumps
  if (q.y < 0.08 && trunk < sd) col = vec3(0.16, 0.1, 0.08);
  col = mix(col, vec3(0.62, 0.72, 0.88), haze);
  return vec4(col, a);
}
vec4 forest(vec2 uv, float baseY, float hMin, float hMax, float spacing, float seed, float haze, float gapC, float gapW) {
  vec4 acc = vec4(0.0);
  float cell = floor(uv.x / spacing);
  for (int k = 2; k >= -2; k--) {                       // neighbours (taller trees overlap)
    float c = cell + float(k), s = hash11(c * 1.37 + seed);
    if (abs((c + 0.5) * spacing - gapC) < gapW * (0.7 + 0.6 * s)) continue;   // clearings
    float x = (c + 0.2 + 0.6 * hash11(c * 3.1 + seed)) * spacing;
    float h = mix(hMin, hMax, pow(hash11(c * 7.7 + seed), 1.5));
    vec4 t = conifer(uv - vec2(x, baseY - 0.004 * hash11(c + seed)), h, c + seed, haze);
    acc = over(t, acc);
  }
  return acc;
}
float shoreY(float x) { return -0.075 + 0.006 * noise(vec2(x * 30.0, 1.0)); }
vec4 midLayer(vec2 uv) {
  vec4 acc = vec4(0.0);
  // far shore: a long band of small hazy trees with snow ground under them
  float sy = shoreY(uv.x);
  if (uv.y < sy + 0.004 && uv.y > sy - 0.012) acc = vec4(mix(vec3(0.95, 0.94, 0.95), vec3(0.8, 0.86, 0.94), SAT((sy - uv.y) / 0.012)), cov((uv.y - sy - 0.004) * 1.0));
  acc = over(forest(uv, sy, 0.03, 0.07, 0.012, 3.0, 0.45, 0.1, 0.12), acc);
  // middle shore groves left and right
  acc = over(forest(uv, -0.115, 0.1, 0.24, 0.032, 11.0, 0.12, 0.0, 0.46), acc);
  return acc;
}
vec4 nearLayer(vec2 uv) {
  // foreground snowbank: sculpted drifts with wind ripples (sastrugi), blue in shadow, warm where lit; sparkles; snow-capped rocks
  float y = -0.37 + 0.06 * fbm(vec2(uv.x * 1.5, 3.0), 4) + 0.09 * pow(abs(uv.x) / 0.9, 2.0);
  float d = uv.y - y;
  vec4 acc = vec4(0.0);
  if (d < aaw() * 2.0) {
    float e = 0.01;
    float slope = (fbm(vec2((uv.x + e) * 1.5, 3.0), 4) - fbm(vec2((uv.x - e) * 1.5, 3.0), 4)) * 0.06 / (2.0 * e) + 0.2 * sign(uv.x) * abs(uv.x) / 0.9;
    float depth = y - uv.y;
    float ripple = sin((uv.x * 3.0 + depth * 18.0 + 0.6 * noise(uv * 6.0)) * 9.0);
    float lit = SAT(0.62 - slope * 1.8 - depth * 1.6 + 0.12 * ripple);
    vec3 col = mix(vec3(0.42, 0.52, 0.72), vec3(0.97, 0.92, 0.86), lit);
    col = mix(col, vec3(0.98, 0.95, 0.9), smoothstep(0.012, 0.0, -d) * 0.6);                       // bright crest along the top
    col *= 0.95 + 0.05 * noise(uv * 120.0);
    float sp = step(0.997, hash12(floor(uv * 560.0))) * lit; col += vec3(1.0) * sp * 0.9;
    acc = vec4(col, cov(d));
  }
  return acc;
}
vec4 frontLayer(vec2 uv) { return vec4(0.0); } // nothing in front: the scene stays open (the forest and snowbank carry the depth)
vec4 raysLayer(vec2 uv) {
  vec3 rd = camRay(uv); float s = max(dot(rd, L), 0.0);
  return vec4(vec3(1.0, 0.88, 0.7), SAT(pow(s, 8.0) * 0.5 + pow(s, 60.0) * 0.4));
}
vec4 pine(vec2 uv, float seed) { return conifer(uv + vec2(0.0, 0.48), 0.96, seed, 0.0); }
vec4 crystals(vec2 uv, vec2 c, float s, float seed) {
  vec4 r = vec4(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i); float a = (hash11(seed + fi) - 0.5) * 1.1; float len = s * (0.5 + 0.6 * hash11(seed + 3.0 + fi)); float w = s * 0.11 * (0.7 + hash11(seed + 7.0 + fi));
    vec2 q = rot2(-a) * (uv - c - vec2((fi - 2.5) * s * 0.17, 0.0));
    float body = sdBox(q - vec2(0.0, len * 0.5), vec2(w, len * 0.5));
    float tip = max(abs(q.x) - w * (1.0 - SAT((q.y - len) / (w * 1.4))), q.y - len - w * 1.4);
    float d = min(body, max(tip, q.y - len + 0.0));
    d = max(d, -q.y);
    if (d > aaw()) continue;
    float facet = step(0.0, q.x); vec3 col = mix(vec3(0.55, 0.82, 1.0), vec3(0.88, 0.97, 1.0), facet);
    col = mix(col, vec3(0.3, 0.6, 0.95), SAT(1.0 - q.y / len) * 0.5);
    col += vec3(1.0) * smoothstep(0.012, 0.0, abs(q.x)) * 0.35;
    r = over(vec4(col, cov(d) * 0.92), r);
  }
  return r;
}

vec4 flake(vec2 uv) {
  float r = length(uv); float a = atan(uv.y, uv.x); float arms = abs(cos(3.0 * a)); float d = max(r - 0.42 * (0.35 + 0.65 * pow(arms, 8.0)), -1.0);
  float core = smoothstep(0.09, 0.0, r);
  float branch = smoothstep(0.03, 0.0, abs(sin(3.0 * a) * r) - 0.0) * smoothstep(0.45, 0.2, r);
  float al = SAT(max(core, branch * 0.9)); return vec4(vec3(0.9, 0.97, 1.0), al);
}

vec4 fox(vec2 uv) {
  vec2 p = uv * 0.6; float th;
  float body = sdEll(p - vec2(0.0, 0.0), vec2(0.3, 0.12)), head = sdEll(p - vec2(0.33, 0.07), vec2(0.1, 0.075));
  float ear = sdEll(rot2(-0.3) * (p - vec2(0.36, 0.16)), vec2(0.03, 0.05));
  float tail = sdEll(rot2(0.4) * (p - vec2(-0.37, 0.04)), vec2(0.17, 0.065));
  float legs = min(sdBox(p - vec2(0.18, -0.15), vec2(0.018, 0.075)), min(sdBox(p - vec2(0.05, -0.15), vec2(0.018, 0.075)), min(sdBox(p - vec2(-0.14, -0.15), vec2(0.018, 0.075)), sdBox(p - vec2(-0.25, -0.15), vec2(0.018, 0.075)))));
  float d = min(min(body, head), min(min(ear, tail), legs));
  if (d > aaw()) return vec4(0.0);
  vec3 c = mix(vec3(0.9, 0.93, 0.98), vec3(1.0), SAT(0.5 - p.y * 3.0)); c *= 0.9 + 0.12 * noise(p * 90.0);
  c = mix(c, vec3(0.2), smoothstep(0.012, 0.0, length(p - vec2(0.39, 0.09)) - 0.006) + step(0.37, p.x) * smoothstep(0.012, 0.0, length(p - vec2(0.43, 0.065)) - 0.012));
  return vec4(c, cov(d));
}

vec4 shard(vec2 uv) { float d = sdBox(rot2(0.6) * uv, vec2(0.08, 0.3)); return vec4(mix(vec3(0.6, 0.85, 1.0), vec3(1.0), SAT(uv.x * 3.0 + 0.5)), cov(d) * 0.9); }

vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = pine(uv, 1.0); else if (k == 1) r = pine(uv, 5.0); else if (k == 2) r = pine(uv, 9.0);
    else if (k == 3) r = fox(uv);
    else if (k == 4) r = crystals(uv, vec2(0.0, -0.45), 0.9, 21.0);
    else if (k == 5) r = flake(uv);
    else r = shard(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  vec3 col = farScene(uv);
  vec4 m = midLayer(uv); col = mix(col, m.rgb, m.a);
  vec4 n = nearLayer(uv); col = mix(col, n.rgb, n.a);
  vec4 f = frontLayer(uv); col = mix(col, f.rgb, f.a);
  vec4 ry = raysLayer(uv); col = mix(col, ry.rgb, ry.a * 0.6);
  return col;
}
