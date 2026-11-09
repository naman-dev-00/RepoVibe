// @lib2d
// @sprites palmL:760x1100, palmR:660x1000, car:560x240, gull:200x100, cloudA:1400x420, cloudB:1100x360
// Sunset Boulevard — a golden-hour coastal highway. Layered 2.5D art painted with signed-distance shapes (not real-time 3D).
// uLayer: 1 far (sky, low sun, sea with glitter path, distant headland) · 2 mid (cliff road, guard rail, hills) · 3 near (road bank, grass) · 4 front (sharp grass) ·
// 5 sun shafts · 10+ sprites (palms that sway in the sea breeze, a convertible, gulls, drifting clouds).
const float HZ = -0.04;
const vec2 SUN = vec2(0.22, 0.01);
vec3 sky(vec2 uv) {
  float y = SAT((uv.y - HZ) / 0.58);
  vec3 col = mix(vec3(1.0, 0.62, 0.2), vec3(0.95, 0.3, 0.38), smoothstep(0.0, 0.28, y));
  col = mix(col, vec3(0.32, 0.2, 0.55), smoothstep(0.2, 0.95, y));
  float sd = length(uv - SUN);
  col += vec3(1.0, 0.6, 0.2) * (0.5 * exp(-sd * 3.2) + 1.4 * exp(-sd * 14.0));
  col = mix(col, vec3(1.0, 0.92, 0.65), smoothstep(0.06, 0.052, sd));
  float cl = fbm(vec2(uv.x * 2.0 + 5.0, uv.y * 11.0), 5);
  col = mix(col, mix(vec3(1.0, 0.45, 0.3), vec3(1.0, 0.8, 0.5), SAT(1.0 - sd * 1.6)), SAT(cl * 1.5 - 0.15) * smoothstep(HZ, 0.1, uv.y) * 0.6);
  return col;
}
vec3 farScene(vec2 uv) {
  vec3 col = sky(uv);
  float hl = HZ + 0.02 + 0.05 * pow(SAT(1.0 - abs(uv.x + 0.55) / 0.45), 1.5) + 0.008 * fbm(vec2(uv.x * 12.0, 3.0), 3);   // headland on the left
  if (uv.y < hl && uv.x < 0.0) col = mix(vec3(0.5, 0.22, 0.32), vec3(0.85, 0.4, 0.35), SAT((uv.y - HZ) * 8.0)) * 0.95;
  float h2 = HZ + 0.012 + 0.03 * pow(SAT(1.0 - abs(uv.x - 0.78) / 0.3), 1.4);
  if (uv.y < h2 && uv.x > 0.0) col = mix(vec3(0.4, 0.2, 0.34), vec3(0.8, 0.38, 0.32), SAT((uv.y - HZ) * 14.0));
  return col;
}
vec3 sea(vec2 uv) {
  float d = HZ - uv.y;
  vec2 ruv = vec2(uv.x + 0.01 * noise(vec2(uv.x * 20.0, uv.y * 100.0)) * (0.3 + d * 3.0), 2.0 * HZ - uv.y);
  vec3 refl = farScene(ruv);
  vec3 deep = mix(vec3(0.5, 0.22, 0.38), vec3(0.12, 0.1, 0.26), SAT(d * 2.0));
  vec3 col = mix(deep, refl, 0.55 * (1.0 - SAT(d * 1.2)) + 0.15);
  float ripple = noise(vec2(uv.x * 9.0, uv.y * 140.0 / (1.0 + d * 4.0)));
  float g = pow(SAT(ripple * 1.6 + 0.1), 3.0) * exp(-abs(uv.x - SUN.x) * 5.0 * (1.0 + d * 2.0)) * exp(-d * 1.2);
  return col + vec3(1.0, 0.75, 0.35) * g * 1.5;
}
vec4 farLayer(vec2 uv) { return vec4(uv.y > HZ ? farScene(uv) : sea(uv), 1.0); }
float roadY(float x) { return -0.27 - 0.1 * x + 0.05 * sin(x * 2.0 + 1.0); }
vec4 midLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // sea cliff on the near side: dark earth below the road line
  float ry = roadY(uv.x);
  float cliff = ry - 0.03 + 0.012 * fbm(vec2(uv.x * 14.0, 2.0), 3);
  if (uv.y < ry && uv.y > -0.5) {
    float d = ry - uv.y;
    vec3 asphalt = mix(vec3(0.16, 0.1, 0.16), vec3(0.06, 0.04, 0.1), SAT(d * 5.0));
    float dash = smoothstep(0.003, 0.0, abs(uv.y - (ry - 0.05))) * step(0.5, fract(uv.x * 7.0));
    asphalt += vec3(1.0, 0.75, 0.3) * dash * 0.6;
    asphalt += vec3(1.0, 0.6, 0.3) * 0.12 * exp(-abs(uv.x - SUN.x) * 3.0) * SAT(1.0 - d * 7.0);
    r = vec4(asphalt, d > 0.0 ? 1.0 : 0.0);
  }
  // guard rail + posts along the top of the road edge
  float rail = abs(uv.y - (ry + 0.012)) - 0.003; float posts = sdBox(vec2(fract(uv.x * 14.0) - 0.5, uv.y - (ry + 0.006)) * vec2(1.0 / 14.0, 1.0), vec2(0.0018, 0.008));
  r = over(vec4(mix(vec3(0.6, 0.5, 0.5), vec3(1.0, 0.8, 0.6), SAT(0.5 + uv.x * 0.3)), max(cov(rail), cov(posts))), r);
  // bluff and hills behind the road on the left
  float hill = ry + 0.02 + 0.05 * exp(-pow((uv.x + 0.7) * 2.0, 2.0)) + 0.01 * fbm(vec2(uv.x * 10.0, 5.0), 3);
  if (uv.y > ry + 0.012 && uv.y < hill && uv.x < -0.2) r = over(vec4(mix(vec3(0.25, 0.12, 0.2), vec3(0.55, 0.28, 0.3), SAT((uv.y - ry) * 10.0)), 1.0), r);
  return r;
}
vec4 nearLayer(vec2 uv) {
  float bank = -0.5 + 0.1 * smoothstep(-0.2, -0.9, uv.x) + 0.07 * smoothstep(0.3, 0.9, uv.x) + 0.04 * fbm(vec2(uv.x * 5.0, 8.0), 4);
  if (uv.y > bank) return vec4(0.0);
  float d = bank - uv.y; vec3 c = mix(vec3(0.5, 0.38, 0.2), vec3(0.14, 0.1, 0.12), SAT(d * 5.0)); c *= 0.85 + 0.3 * noise(uv * 200.0);
  return vec4(c, 1.0);
}
vec4 frontLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  for (int k = 0; k < 2; k++) { float fk = float(k); float sc = 36.0 + fk * 22.0; float id = floor(uv.x * sc + fk * 3.0), fx = fract(uv.x * sc + fk * 3.0) - 0.5; float hh = hash11(id + fk * 13.0);
    float top = -0.5 + 0.05 + 0.09 * hh; float t = SAT((uv.y + 0.5) / (top + 0.5)); float w = 0.4 * (1.0 - t); float ins = step(uv.y, top) * smoothstep(w, w - 0.1, abs(fx - 0.2 * sin(t * 2.5 + hh * 6.0) * t));
    r = over(vec4(mix(vec3(0.2, 0.15, 0.06), vec3(0.95, 0.75, 0.35), pow(t, 1.5)) * (0.7 + 0.2 * fk), ins), r); }
  return r;
}
vec4 raysLayer(vec2 uv) {
  vec2 p = uv - SUN; float a = atan(p.y, p.x), d = length(p);
  float b = pow(0.5 + 0.5 * sin(a * 19.0 + 2.0 * sin(a * 6.0)), 3.0);
  return vec4(vec3(1.0, 0.72, 0.4), SAT(b * exp(-d * 1.2) * 0.45 + exp(-d * 5.0) * 0.4));
}
vec4 cloud(vec2 uv, float seed) {
  float n = fbm(vec2(uv.x * 4.0 + seed, uv.y * 9.0), 5);
  float shape = 1.0 - length(uv * vec2(1.0, 3.2)) * 1.6; float a = SAT((shape + n * 0.9 - 0.2) * 2.4);
  vec3 c = mix(vec3(1.0, 0.45, 0.35), vec3(1.0, 0.86, 0.6), SAT(0.5 - uv.y * 2.5 + 0.3 * n)); return vec4(c, a * 0.8);
}
vec4 gull(vec2 uv) {
  vec2 p = uv * vec2(1.0, 2.0); float w = abs(p.x); float d = abs(p.y - (0.25 * sqrt(w) * -1.0 + 0.2 * w * 0.0) + 0.0) - 0.03 * (1.0 - w);
  d = max(d, w - 0.45); return vec4(vec3(1.0, 0.95, 0.9), cov(d * 2.0));
}
vec4 car(vec2 uv) {
  vec2 p = uv * vec2(1.0, 1.0); p.x *= 560.0 / 240.0 * 0.5;
  float body = max(sdBox(p - vec2(0.0, -0.05), vec2(0.5, 0.09)), -(p.y + 0.04) + 0.0 * p.x * 0.0 - 0.15);
  float hood = sdEll(p - vec2(0.18, -0.02), vec2(0.34, 0.1)); float trunk = sdEll(p - vec2(-0.3, -0.02), vec2(0.2, 0.1));
  float wind = max(abs(p.x - 0.0) - 0.1 + (p.y - 0.04) * 0.9, max(-(p.y - 0.04), p.y - 0.17));
  float w1 = length(p - vec2(0.3, -0.16)) - 0.075, w2 = length(p - vec2(-0.3, -0.16)) - 0.075;
  float d = min(min(body, min(hood, trunk)), min(min(w1, w2), wind));
  if (d > aaw()) return vec4(0.0);
  vec3 c = mix(vec3(0.5, 0.02, 0.1), vec3(1.0, 0.3, 0.2), SAT(0.5 + p.y * 3.0));
  c = mix(c, vec3(0.02), cov(w1) + cov(w2)); c = mix(c, vec3(1.0, 0.9, 0.7), cov(wind) * 0.5);
  return vec4(c, cov(d));
}
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = palm(uv + vec2(0.0, 0.48), 0.96, -0.1, vec3(0.04, 0.2, 0.12), vec3(0.5, 0.7, 0.2), 3.0);
    else if (k == 1) r = palm(uv + vec2(0.0, 0.48), 0.92, 0.12, vec3(0.05, 0.2, 0.12), vec3(0.55, 0.72, 0.22), 9.0);
    else if (k == 2) r = car(uv);
    else if (k == 3) r = gull(uv);
    else if (k == 4) r = cloud(uv, 2.0);
    else r = cloud(uv, 7.0);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  r = farLayer(uv); r = over(midLayer(uv), r); r = over(nearLayer(uv), r);
  r = over(palm(uv - vec2(-0.62, -0.46), 0.8, -0.1, vec3(0.04, 0.2, 0.12), vec3(0.5, 0.7, 0.2), 3.0), r);
  r = over(palm(uv - vec2(0.7, -0.46), 0.7, 0.12, vec3(0.05, 0.2, 0.12), vec3(0.55, 0.72, 0.22), 9.0), r);
  r = over(frontLayer(uv), r); vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.35; return r.rgb;
}
