// @lib2d
// @sprites gridLine:2400x32, car:640x300, palmL:700x1000, palmR:620x940, sunGlow:900x900, birdLine:384x64
// Synthwave — a retro-futuristic neon highway. Layered 2.5D art with an animated perspective grid (lines approach and grow toward the viewer).
// uLayer: 1 far (sky, striped sun, wireframe mountains, horizon glow) · 2 mid (grid plain, road with lane markers) · 3 near (road edge barriers, glow) ·
// 4 front (neon posts) · 5 horizon bloom · 10+ sprites (grid lines, car, palms, sun glow).
const float HZ = -0.06;
const vec2 SUN = vec2(0.0, 0.1);
vec3 skyCol(vec2 uv) {
  float y = SAT((uv.y - HZ) / 0.6);
  vec3 col = mix(vec3(0.95, 0.3, 0.2), vec3(0.45, 0.04, 0.32), smoothstep(0.0, 0.3, y));
  col = mix(col, vec3(0.04, 0.01, 0.14), smoothstep(0.15, 0.9, y));
  vec2 g = uv * 120.0; vec2 ci = floor(g); vec2 h = hash22(ci); col += vec3(1.0) * step(0.985, h.x) * smoothstep(0.3, 0.0, length(fract(g) - 0.5)) * SAT(y * 1.5 - 0.2);
  return col;
}
vec3 farScene(vec2 uv) {
  vec3 col = skyCol(uv);
  vec2 p = uv - SUN; float sd = length(p) - 0.27;
  float stripes = step(SAT((SUN.y - uv.y) * 2.6 + 0.04) * 0.6, fract(uv.y * 21.0));
  float sunCov = cov(sd) * (uv.y > SUN.y - 0.02 ? 1.0 : stripes);
  vec3 sunc = mix(vec3(1.0, 0.55, 0.05), vec3(0.95, 0.05, 0.5), SAT((SUN.y + 0.27 - uv.y) / 0.54)) * 0.9;
  col += vec3(0.9, 0.2, 0.35) * exp(-max(sd, 0.0) * 6.0) * 0.45;
  col = mix(col, sunc, sunCov);
  // wireframe mountains: dark fill with neon ridge lines
  for (int i = 0; i < 2; i++) { float fi = float(i); float h = HZ + (0.1 + 0.05 * fi) * pow(0.5 + 0.5 * fbm(vec2(uv.x * (3.0 + fi * 2.0) + 4.0 * fi, 1.0), 5), 1.1) * (1.0 + smoothstep(0.25, 0.55, abs(uv.x)) * 0.4);
    if (uv.y < h) { vec3 f = mix(vec3(0.025, 0.005, 0.07), vec3(0.09, 0.015, 0.17), SAT((uv.y - HZ) * 8.0)); float line = smoothstep(0.004, 0.0, h - uv.y) + 0.5 * smoothstep(0.003, 0.0, abs(fract((uv.x + uv.y * 0.6) * 18.0) - 0.5) * 0.06 - 0.0 + (1.0 - 1.0)) * 0.0; f = mix(f, vec3(0.2, 0.95, 1.0), SAT(smoothstep(0.006, 0.0, h - uv.y)) * 0.9); col = f; } }
  return col;
}
vec4 farLayer(vec2 uv) {
  vec3 col = farScene(uv);
  if (uv.y <= HZ) { float d = HZ - uv.y; col = vec3(0.0, 0.0, 0.01); col += vec3(1.0, 0.2, 0.55) * exp(-d * 25.0) * 0.6; }
  return vec4(col, 1.0);
}
vec4 midLayer(vec2 uv) {
  if (uv.y > HZ) return vec4(0.0);
  float d = HZ - uv.y; float z = 0.9 / max(d, 0.0015); float x = uv.x * z;
  float fade = SAT(1.0 - z * 0.012);
  vec3 col = mix(vec3(0.0, 0.0, 0.006), vec3(0.012, 0.0, 0.04), SAT(d * 2.0));
  float vx = abs(fract(x * 0.5) - 0.5); float lv = smoothstep(0.0034, 0.0, (0.5 - vx) * 2.0 / z);
  float sdz = (0.5 - abs(fract(z * 0.8) - 0.5)) / 0.8; float lh = smoothstep(0.0034, 0.0, sdz * 0.9 / (z * z));
  vec3 grid = vec3(1.0, 0.08, 0.6) * max(lv, lh) * (0.35 + 0.65 * fade) + vec3(0.3, 0.0, 0.5) * max(lv, lh) * 0.5;
  float rw = 1.5; float onRoad = smoothstep(rw + 0.02 * z * 0.3, rw - 0.02 * z * 0.3, abs(x));
  vec3 road = mix(vec3(0.004, 0.0, 0.02), vec3(0.03, 0.008, 0.08), SAT(d * 2.5));
  float edge = smoothstep(0.005, 0.0, abs(abs(x) - rw + 0.04) / z);
  float dash = smoothstep(0.0045, 0.0, abs(x) / z) * step(0.5, fract(z * 0.4));
  col = mix(col + grid, road, onRoad);
  col += vec3(0.1, 0.95, 1.0) * edge * 1.1 * onRoad + vec3(1.0, 0.8, 0.2) * dash * onRoad;
  col += vec3(1.0, 0.2, 0.55) * exp(-d * 26.0) * 0.7;
  return vec4(col, 1.0);
}
vec4 nearLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // neon posts on both sides of the road, decreasing in perspective
  for (int s = 0; s < 2; s++) { float side = s == 0 ? -1.0 : 1.0;
    for (int i = 0; i < 6; i++) { float fi = float(i); float z = 1.0 + fi * 1.1; float sc = 1.0 / z;
      vec2 base = vec2(side * 1.9 * sc * 0.55, HZ - 0.5 * sc * 0.55 + 0.0 * fi);
      float post = sdBox(uv - base - vec2(0.0, 0.18 * sc), vec2(0.004 * sc + 0.0006, 0.18 * sc));
      float head = length(uv - base - vec2(0.0, 0.37 * sc)) - 0.012 * sc;
      r = over(vec4(vec3(0.06, 0.05, 0.12), cov(post)), r);
      r = over(vec4(mix(vec3(0.2, 0.95, 1.0), vec3(1.0, 0.2, 0.7), 0.5 + 0.5 * side), cov(head)), r);
      r.rgb += vec3(0.5, 0.2, 0.7) * exp(-max(head, 0.0) * 80.0) * 0.4 * (1.0 - r.a);
    } }
  return r;
}
vec4 frontLayer(vec2 uv) { return vec4(0.0); }
vec4 raysLayer(vec2 uv) { float d = abs(uv.y - HZ); return vec4(vec3(1.0, 0.35, 0.6), SAT(exp(-d * 18.0) * 0.55)); }

vec4 gridLine(vec2 uv) { float v = smoothstep(0.5, 0.15, abs(uv.y) * 2.0); float g = smoothstep(0.5, 0.0, abs(uv.x) * 2.0 - 0.9); return vec4(vec3(1.0, 0.25, 0.75), v * 0.95 * smoothstep(1.0, 0.7, abs(uv.x) * 0.9 + 0.0 * g)); }
vec4 car(vec2 uv) {
  vec2 p = uv * vec2(1.0, 1.0); p.x *= 640.0 / 300.0 * 0.5;           // rear view of a wedge coupe
  float body = sdBox(p - vec2(0.0, -0.1), vec2(0.5, 0.14)) ;
  float cab = max(abs(p.x) - 0.32 + (p.y - 0.04) * 0.6, max(-(p.y - 0.04), p.y - 0.28));
  float wheelL = sdBox(p - vec2(-0.4, -0.27), vec2(0.1, 0.1)), wheelR = sdBox(p - vec2(0.4, -0.27), vec2(0.1, 0.1));
  float d = min(min(body, cab), min(wheelL, wheelR));
  if (d > aaw() * 2.0) return vec4(0.0);
  vec3 c = mix(vec3(0.1, 0.02, 0.22), vec3(0.8, 0.1, 0.55), SAT(0.5 + p.y * 2.0)); c = mix(c, vec3(0.02, 0.05, 0.2), cov(cab) * 0.0);
  c = mix(c, vec3(0.04, 0.02, 0.08), step(0.0, -(p.y - 0.04)) * 0.0);
  float win = cov(max(abs(p.x) - 0.27 + (p.y - 0.06) * 0.55, max(-(p.y - 0.06), p.y - 0.25))); c = mix(c, vec3(0.04, 0.12, 0.3), win);
  float lights = cov(sdBox(vec2(abs(p.x) - 0.37, p.y + 0.02), vec2(0.1, 0.025))); c = mix(c, vec3(1.0, 0.1, 0.2), lights);
  float glow = exp(-length(vec2(abs(p.x) - 0.37, p.y + 0.02) * vec2(1.0, 2.0)) * 7.0) * 0.5;
  return vec4(c + vec3(1.0, 0.1, 0.3) * glow, max(cov(d), glow * 0.7));
}
vec4 sunGlow(vec2 uv) { float r = length(uv); return vec4(vec3(1.0, 0.4, 0.55), SAT(exp(-r * 4.0) * 0.8 - 0.02)); }
vec4 birdLine(vec2 uv) { float d = abs(uv.y - 0.1 * abs(uv.x) * 0.0) ; return vec4(0.0); }
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = gridLine(uv);
    else if (k == 1) r = car(uv);
    else if (k == 2) r = palm(uv + vec2(0.0, 0.48), 0.9, -0.12, vec3(0.02, 0.0, 0.1), vec3(0.45, 0.05, 0.5), 3.0);
    else if (k == 3) r = palm(uv + vec2(0.0, 0.48), 0.9, 0.14, vec3(0.02, 0.0, 0.1), vec3(0.4, 0.05, 0.45), 8.0);
    else if (k == 4) r = sunGlow(uv);
    else r = birdLine(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  r = farLayer(uv); r = over(midLayer(uv), r); r = over(nearLayer(uv), r);
  vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.5; return r.rgb;
}
