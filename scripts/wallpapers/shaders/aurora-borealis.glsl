// @lib2d
// @sprites curtainA:2200x900, curtainB:2000x800, curtainC:1800x700, pineL:900x1300, pineR:760x1200, cabin:420x300, bough:1100x760, meteor:512x64
// Aurora — a still lake under northern lights. Layered 2.5D art painted with signed-distance shapes (not real-time 3D).
// uLayer: 1 far (star sky, glacier range, lake with reflections) · 2 mid (far shore forest, cabin) · 3 near (snow bank) · 4 front (sharp grass/frost) ·
// 5 faint aurora wash · 10+ sprites (three independently drifting aurora curtains, swaying pines, cabin glow, bough, meteor).
const float HZ = -0.1;
vec3 skyBase(vec2 uv) {
  float y = SAT((uv.y - HZ) / 0.65);
  vec3 col = mix(vec3(0.05, 0.1, 0.2), vec3(0.01, 0.015, 0.07), pow(y, 0.7));
  col += vec3(0.04, 0.14, 0.2) * exp(-(uv.y - HZ) * 7.0);
  vec2 g = uv * 140.0; vec2 ci = floor(g); vec2 h = hash22(ci); float star = step(0.985, h.x) * smoothstep(0.35, 0.0, length(fract(g) - 0.5 + (h - 0.5) * 0.5)) ;
  col += vec3(0.85, 0.92, 1.0) * star * (0.5 + 0.7 * h.y);
  vec2 g2 = uv * 55.0; vec2 c2 = floor(g2); vec2 h2 = hash22(c2 * 1.7); col += vec3(1.0, 0.95, 0.85) * step(0.97, h2.x) * smoothstep(0.3, 0.0, length(fract(g2) - 0.5)) * 0.9;
  return col;
}
float ridge(float x, float base, float amp, float f, float s) { return base + amp * pow(0.5 + 0.5 * fbm(vec2(x * f + s, s * 2.0), 6), 1.2); }
vec3 farScene(vec2 uv) {
  vec3 col = skyBase(uv);
  float h1 = ridge(uv.x, HZ + 0.02, 0.2, 2.6, 5.0), h2 = ridge(uv.x, HZ, 0.1, 4.0, 11.0);
  if (uv.y < h1) { float n = fbm(vec2(uv.x * 14.0, uv.y * 20.0), 4); col = mix(vec3(0.06, 0.1, 0.17), vec3(0.45, 0.58, 0.72), SAT((uv.y - (HZ + 0.06)) / 0.14 + n * 0.4) * 0.9); }
  if (uv.y < h2) col = mix(vec3(0.02, 0.04, 0.09), vec3(0.1, 0.17, 0.26), SAT((uv.y - HZ) * 9.0));
  return col;
}
vec3 auroraWash(vec2 uv) {
  float x = uv.x; float band = exp(-pow((uv.y - (0.22 + 0.06 * sin(x * 3.0))) * 4.0, 2.0)); return vec3(0.1, 0.9, 0.6) * band * (0.3 + 0.4 * noise(vec2(x * 6.0, 1.0)));
}
vec3 lake(vec2 uv) {
  float depth = HZ - uv.y;
  vec2 ruv = vec2(uv.x + 0.004 * noise(vec2(uv.x * 40.0, uv.y * 120.0)), 2.0 * HZ - uv.y);
  vec3 refl = farScene(ruv) + auroraWash(ruv) * 0.8;
  vec3 deep = mix(vec3(0.02, 0.06, 0.12), vec3(0.005, 0.02, 0.06), SAT(depth * 2.0));
  return mix(deep, refl, 0.72 - 0.25 * SAT(depth * 1.8)) + vec3(0.6, 0.9, 1.0) * pow(SAT(noise(vec2(uv.x * 80.0, uv.y * 300.0))), 8.0) * 0.12;
}
vec4 farLayer(vec2 uv) { return vec4(uv.y > HZ ? farScene(uv) : lake(uv), 1.0); }
vec4 treeLine(vec2 uv, float baseY, float h, float spacing, float seed, float edgeFade) {
  vec4 r = vec4(0.0); float cell = floor(uv.x / spacing);
  for (int j = -1; j <= 1; j++) { float c = cell + float(j); float hh = hash11(c * 3.1 + seed); if (hh < 0.18) continue;
    float cx = (c + 0.5 + (hash11(c + seed * 2.0) - 0.5) * 0.7) * spacing;
    vec4 t = pine(uv - vec2(cx, baseY), h * (0.65 + 0.6 * hh), vec3(0.01, 0.03, 0.05), vec3(0.05, 0.12, 0.14), 0.0, c + seed);
    r = over(t, r); }
  r.a *= edgeFade; return r;
}
vec4 midLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  r = over(treeLine(uv, HZ - 0.005, 0.13, 0.05, 2.0, SAT(abs(uv.x) * 2.2 - 0.3)), r);
  // cabin on the far shore (right)
  vec2 c = uv - vec2(0.5, HZ - 0.004);
  float wall = sdBox(c - vec2(0.0, 0.022), vec2(0.04, 0.022)); float roof = max(abs(c.x) - 0.05 * (1.0 - (c.y - 0.044) / 0.03), max(-(c.y - 0.044), c.y - 0.074));
  vec4 cab = vec4(vec3(0.07, 0.05, 0.05), max(cov(wall), cov(roof)));
  float win = cov(sdBox(c - vec2(-0.01, 0.025), vec2(0.009, 0.01))); cab.rgb = mix(cab.rgb, vec3(1.0, 0.75, 0.35), win); r = over(cab, r);
  r = over(treeLine(uv, HZ - 0.015, 0.2, 0.08, 7.0, SAT(abs(uv.x) * 2.0 - 0.15)), r);
  return r;
}
vec4 nearLayer(vec2 uv) {
  float bank = -0.5 + 0.13 * smoothstep(0.1, 0.9, abs(uv.x)) + 0.04 * fbm(vec2(uv.x * 4.0, 7.0), 4);
  if (uv.y > bank) return vec4(0.0);
  float d = bank - uv.y; vec3 c = mix(vec3(0.22, 0.3, 0.42), vec3(0.04, 0.07, 0.12), SAT(d * 6.0)); c += vec3(0.1, 0.5, 0.4) * 0.15 * SAT(1.0 - d * 20.0);
  c *= 0.9 + 0.2 * noise(uv * 220.0); return vec4(c, 1.0);
}
vec4 frontLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  for (int k = 0; k < 2; k++) { float fk = float(k); float sc = 48.0 + fk * 26.0; float id = floor(uv.x * sc + fk * 5.0), fx = fract(uv.x * sc + fk * 5.0) - 0.5; float hh = hash11(id + fk * 21.0);
    float top = -0.5 + 0.04 + 0.08 * hh; float t = SAT((uv.y + 0.5) / (top + 0.5)); float w = 0.4 * (1.0 - t); float ins = step(uv.y, top) * smoothstep(w, w - 0.1, abs(fx - 0.15 * sin(t * 3.0 + hh * 6.0) * t));
    vec3 c = mix(vec3(0.02, 0.05, 0.08), vec3(0.5, 0.75, 0.9), pow(t, 2.0)); r = over(vec4(c, ins), r); }
  return r;
}
vec4 raysLayer(vec2 uv) { return vec4(vec3(0.2, 1.0, 0.7), SAT(auroraWash(uv).g * 0.25)); }

// ---- sprites. curtains: a wavy ribbon with vertical streak texture and a bright lower hem, premultiplied by its own fade.
vec4 curtain(vec2 uv, float seed, vec3 c1, vec3 c2) {
  float x = uv.x * 2.0; float y = uv.y + 0.5;                          // 0 bottom, 1 top
  float wave = 0.14 * sin(x * 2.4 + seed) + 0.07 * sin(x * 5.3 + seed * 2.0) + 0.03 * sin(x * 11.0 + seed * 3.0);
  float hem = 0.22 + wave * 0.5;
  float streak = pow(0.5 + 0.5 * sin(x * 38.0 + 4.0 * sin(x * 3.0 + seed) + y * 3.0), 2.0);
  float vert = smoothstep(hem - 0.05, hem + 0.04, y) * exp(-(y - hem) * 3.2);
  float body = vert * (0.35 + 0.65 * streak) * smoothstep(1.0, 0.82, abs(uv.x) * 2.0);
  float low = exp(-pow((y - hem) * 10.0, 2.0)) * 0.9;
  vec3 c = mix(c1, c2, SAT((y - hem) * 2.4));
  float a = SAT(body * 1.25 + low * 0.6);
  return vec4(c * (0.8 + 0.7 * low), a);
}
vec4 meteor(vec2 uv) { float x = (uv.x + 0.5); float d = abs(uv.y) - 0.012 * x; return vec4(vec3(0.9, 0.97, 1.0), SAT(x * x * x) * cov(d * 4.0) * smoothstep(0.0, 0.05, 1.0 - x + 0.02) ); }
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = curtain(uv, 1.0, vec3(0.1, 0.95, 0.55), vec3(0.4, 0.5, 1.0));
    else if (k == 1) r = curtain(uv, 4.0, vec3(0.2, 0.9, 0.8), vec3(0.75, 0.3, 0.95));
    else if (k == 2) r = curtain(uv, 9.0, vec3(0.5, 1.0, 0.4), vec3(0.1, 0.7, 0.9));
    else if (k == 3) r = pine(uv + vec2(0.0, 0.48), 0.96, vec3(0.01, 0.03, 0.05), vec3(0.08, 0.17, 0.2), 0.12, 2.0);
    else if (k == 4) r = pine(uv + vec2(0.0, 0.48), 0.96, vec3(0.01, 0.025, 0.045), vec3(0.07, 0.15, 0.18), 0.12, 8.0);
    else if (k == 5) { vec2 c = uv; float wall = sdBox(c - vec2(0.0, -0.1), vec2(0.34, 0.2)); float roof = max(abs(c.x) - 0.42 * (1.0 - (c.y - 0.1) / 0.3), max(-(c.y - 0.1), c.y - 0.4)); r = vec4(mix(vec3(0.1, 0.07, 0.06), vec3(0.3, 0.2, 0.14), SAT(0.5 - c.x)), max(cov(wall), cov(roof))); r = over(vec4(vec3(1.0, 0.72, 0.3) * (1.1 - length(c - vec2(-0.1, -0.1))), cov(sdBox(c - vec2(-0.1, -0.1), vec2(0.1, 0.09)))), r); }
    else if (k == 6) { r = pine(uv * vec2(1.0, 1.0) + vec2(0.0, 0.0), 0.4, vec3(0.01, 0.03, 0.05), vec3(0.1, 0.2, 0.22), 0.7, 3.0); r = over(pine(rot2(1.2) * (uv - vec2(0.4, -0.2)) + vec2(0.0, 0.2), 0.5, vec3(0.01, 0.03, 0.05), vec3(0.1, 0.2, 0.22), 0.7, 6.0), r); }
    else r = meteor(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  r = farLayer(uv);
  r.rgb += curtain(vec2((uv.x) / 1.0, (uv.y - 0.12) / 0.9 * 1.0), 1.0, vec3(0.1, 0.95, 0.55), vec3(0.4, 0.5, 1.0)).rgb * curtain(vec2(uv.x, (uv.y - 0.12) / 0.9), 1.0, vec3(0.1, 0.95, 0.55), vec3(0.4, 0.5, 1.0)).a;
  r = over(midLayer(uv), r); r = over(nearLayer(uv), r); r = over(frontLayer(uv), r); return r.rgb;
}
