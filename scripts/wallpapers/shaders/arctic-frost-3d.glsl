// @lib2d
// @sprites pineA:640x900, pineB:520x760, pineC:560x800, fox:520x300, crystal:600x760, flake:192x192, shard:256x256
// Arctic Frost — a bright frozen valley (light theme). Layered 2.5D art painted with signed-distance shapes (not real-time 3D).
// uLayer: 1 far (sky, glaciated range, frozen lake, ice sheet) · 2 mid (snow forest, ice formations) · 3 near (snow banks, ice) · 4 front
// (sharp icicles and crystal clusters) · 5 sun haze · 10+ sprites (swaying pines, ice crystal, fox, flakes).
const float HZ = -0.1;
const vec2 SUN = vec2(0.45, 0.12);
vec3 sky(vec2 uv) {
  float y = SAT((uv.y - HZ) / 0.6);
  vec3 col = mix(vec3(0.86, 0.94, 1.0), vec3(0.2, 0.5, 0.92), pow(y, 0.7));
  float sd = length(uv - SUN);
  col += vec3(1.0, 0.95, 0.8) * (0.5 * exp(-sd * 4.0) + 1.2 * exp(-sd * 24.0));
  float cl = fbm(vec2(uv.x * 2.5 + 3.0, uv.y * 7.0), 5);
  col = mix(col, vec3(1.0), SAT(cl * 1.4 - 0.25) * smoothstep(HZ, 0.15, uv.y) * 0.5);
  return col;
}
float ridgeH(float x, float base, float amp, float f, float s) { return base + amp * pow(0.5 + 0.5 * fbm(vec2(x * f + s, s * 2.0), 6), 1.3); }
vec3 mountain(vec2 uv, vec3 col, float base, float amp, float f, float s, vec3 rock, vec3 snow, float hz) {
  float h = ridgeH(uv.x, base, amp, f, s);
  if (uv.y > h) return col;
  float down = h - uv.y; float n = fbm(vec2(uv.x * f * 6.0, uv.y * 14.0 + s), 4);
  float lit = SAT(0.5 + 3.0 * (fbm(vec2(uv.x * f + s + 0.04, s * 2.0), 6) - fbm(vec2(uv.x * f + s - 0.04, s * 2.0), 6)) * -6.0 + n * 0.3);
  vec3 c = mix(rock * 0.6, rock, lit);
  float sn = smoothstep(0.1 + 0.08 * n, 0.0, down * -1.0 + 0.0) ; 
  float snowCover = SAT((uv.y - (base + amp * 0.38)) / (amp * 0.2) + 0.5 * n);
  c = mix(c, mix(snow * vec3(0.78, 0.86, 1.0), snow, lit), SAT(snowCover + 0.3 * lit * 0.0));
  c = mix(c, sky(vec2(uv.x, HZ + 0.02)) * 0.95 + 0.05, SAT(1.0 - (uv.y - HZ) / 0.22) * hz);   // aerial haze
  return c;
}
vec3 farScene(vec2 uv) {
  vec3 col = sky(uv);
  col = mountain(uv, col, HZ + 0.04, 0.34, 2.2, 3.0, vec3(0.26, 0.36, 0.55), vec3(1.0), 0.3);
  col = mountain(uv, col, HZ + 0.0, 0.2, 3.4, 9.0, vec3(0.22, 0.32, 0.5), vec3(0.97, 0.99, 1.0), 0.2);
  return col;
}
vec3 lake(vec2 uv) {
  float depth = HZ - uv.y;
  vec2 ruv = vec2(uv.x + 0.006 * noise(vec2(uv.x * 30.0, uv.y * 90.0)), 2.0 * HZ - uv.y);
  vec3 refl = farScene(ruv);
  vec3 ice = mix(vec3(0.62, 0.84, 0.96), vec3(0.3, 0.56, 0.8), SAT(depth * 2.0));
  vec3 col = mix(ice, refl, 0.5 * (1.0 - SAT(depth * 1.5)) + 0.18);
  // cracks: thin dark-blue lines from a Voronoi-like field
  vec2 g = uv * vec2(7.0, 11.0); vec2 ci = floor(g), f = fract(g); float md = 1e9, md2 = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)); vec2 h = hash22(ci + o); float d = length(o + h - f); if (d < md) { md2 = md; md = d; } else if (d < md2) md2 = d; }
  float crack = smoothstep(0.035, 0.0, md2 - md) * 0.55;
  col = mix(col, vec3(0.1, 0.3, 0.55), crack);
  col += vec3(1.0) * pow(SAT(noise(vec2(uv.x * 60.0, uv.y * 240.0))), 6.0) * 0.4;           // glints
  return col;
}
vec4 farLayer(vec2 uv) { return vec4(uv.y > HZ ? farScene(uv) : lake(uv), 1.0); }
vec4 forestRow(vec2 uv, float baseY, float h, float spacing, float seed, vec3 dark, vec3 light) {
  vec4 r = vec4(0.0); float cell = floor(uv.x / spacing);
  for (int j = -1; j <= 1; j++) {
    float c = cell + float(j); float hh = hash11(c * 3.1 + seed);
    if (hh < 0.22) continue;
    float cx = (c + 0.5 + (hash11(c + seed * 2.0) - 0.5) * 0.6) * spacing;
    r = over(pine(uv - vec2(cx, baseY - 0.02 * hash11(c + 9.0)), h * (0.7 + 0.5 * hh), dark, light, 0.9, c + seed), r);
  }
  return r;
}
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
vec4 midLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  float shore = HZ - 0.01 + 0.02 * fbm(vec2(uv.x * 5.0, 2.0), 3);
  if (uv.y < shore && uv.y > HZ - 0.16) { /* snow shore band is drawn in the near layer */ }
  r = over(forestRow(uv, HZ + 0.005, 0.17, 0.09, 3.0, vec3(0.1, 0.25, 0.3), vec3(0.3, 0.55, 0.58)), r);
  r = over(forestRow(uv, HZ - 0.03, 0.26, 0.15, 11.0, vec3(0.08, 0.2, 0.26), vec3(0.28, 0.5, 0.56)) * vec4(1.0, 1.0, 1.0, SAT(abs(uv.x) * 1.8 - 0.5)), r);
  r = over(crystals(uv, vec2(0.2, HZ - 0.12), 0.26, 4.0), r);
  return r;
}
vec4 nearLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  float bank = -0.5 + 0.16 * smoothstep(0.2, 0.9, abs(uv.x)) + 0.05 * fbm(vec2(uv.x * 4.0, 7.0), 4);
  if (uv.y < bank) { float d = bank - uv.y; vec3 c = mix(vec3(1.0, 1.0, 1.0), vec3(0.7, 0.82, 0.96), SAT(d * 5.0 + 0.3 * fbm(uv * 20.0, 3))); c *= 0.96 + 0.06 * noise(uv * 260.0); r = vec4(c, 1.0); }
  r = over(crystals(uv, vec2(-0.78, bank - 0.01), 0.34, 8.0), r);
  r = over(crystals(uv, vec2(0.84, bank - 0.01), 0.3, 15.0), r);
  return r;
}
vec4 frontLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // icicles along the very top edge
  for (int k = 0; k < 2; k++) { float fk = float(k); float sc = 22.0 + fk * 11.0; float id = floor(uv.x * sc), fx = fract(uv.x * sc) - 0.5; float hh = hash11(id + fk * 9.0); float len = (0.03 + 0.08 * hh) * (0.6 + 0.4 * fk);
    float y = 0.5 - uv.y; float w = 0.4 * SAT(1.0 - y / len); float ins = step(y, len) * smoothstep(w, w - 0.12, abs(fx)); vec3 c = mix(vec3(0.7, 0.88, 1.0), vec3(1.0), SAT(0.5 - fx)); r = over(vec4(c, ins * 0.85), r); }
  return r;
}
vec4 raysLayer(vec2 uv) {
  vec2 p = uv - SUN; float d = length(p); float a = atan(p.y, p.x);
  float beams = pow(0.5 + 0.5 * sin(a * 14.0 + 2.0 * sin(a * 5.0)), 3.0);
  return vec4(vec3(1.0, 0.96, 0.85), SAT(beams * exp(-d * 1.8) * 0.4 + exp(-d * 6.0) * 0.35));
}
vec4 flake(vec2 uv) {
  float r = length(uv); float a = atan(uv.y, uv.x); float arms = abs(cos(3.0 * a)); float d = max(r - 0.42 * (0.35 + 0.65 * pow(arms, 8.0)), -1.0);
  float core = smoothstep(0.09, 0.0, r);
  float branch = smoothstep(0.03, 0.0, abs(sin(3.0 * a) * r) - 0.0) * smoothstep(0.45, 0.2, r);
  float al = SAT(max(core, branch * 0.9)); return vec4(vec3(0.9, 0.97, 1.0), al);
}
vec4 shard(vec2 uv) { float d = sdBox(rot2(0.6) * uv, vec2(0.08, 0.3)); return vec4(mix(vec3(0.6, 0.85, 1.0), vec3(1.0), SAT(uv.x * 3.0 + 0.5)), cov(d) * 0.9); }
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
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = pine(uv + vec2(0.0, 0.48), 0.96, vec3(0.08, 0.22, 0.27), vec3(0.3, 0.55, 0.6), 0.95, 1.0);
    else if (k == 1) r = pine(uv + vec2(0.0, 0.48), 0.96, vec3(0.1, 0.25, 0.3), vec3(0.34, 0.6, 0.62), 0.85, 5.0);
    else if (k == 2) r = pine(uv + vec2(0.0, 0.48), 0.96, vec3(0.07, 0.19, 0.25), vec3(0.28, 0.5, 0.58), 1.0, 9.0);
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
  r = farLayer(uv); r = over(midLayer(uv), r); r = over(nearLayer(uv), r); r = over(frontLayer(uv), r);
  vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.4; return r.rgb;
}
