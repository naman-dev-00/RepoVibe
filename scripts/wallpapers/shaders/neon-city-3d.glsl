// Rainy cyberpunk street canyon: SDF towers on both sides, emissive windows and neon signs, wet reflective road,
// distant skyline in neon fog, rain streaks.
const float CELL = 16.0;

float towerH(float id, float side) { return 40.0 + 120.0 * pow(hash11(id * 3.17 + side * 11.0), 1.6); }
// returns distance; mat via out param: 0 road, 1 building, 2 sign
float map(vec3 p, out float mat, out vec3 info) {
  mat = 0.0; info = vec3(0.0);
  float d = p.y; // road
  // buildings on both sides of a 18-wide street
  float side = sign(p.x);
  float id = floor(p.z / CELL);
  vec3 q = vec3(abs(p.x), p.y, p.z - (id + 0.5) * CELL);
  float w = 5.5 + 2.5 * hash11(id + side * 7.0);
  float h = towerH(id, side);
  float b = sdBox(q - vec3(10.5 + w, h * 0.5, 0.0), vec3(w, h * 0.5, CELL * 0.5 - 1.2));
  if (b < d) { d = b; mat = 1.0; info = vec3(id, side, h); }
  // vertical neon signs hanging over the street
  float sid = hash11(id * 1.7 + side * 3.0);
  if (sid > 0.2) {
    float sh = 6.0 + 10.0 * hash11(id + 4.0 + side);
    float sy = 8.0 + 14.0 * hash11(id * 2.3 + side);
    float s = sdBox(q - vec3(10.1, sy + sh * 0.5, CELL * 0.2 * (hash11(id + 9.0) - 0.5)), vec3(0.25, sh * 0.5, 1.1));
    if (s < d) { d = s; mat = 2.0; info = vec3(id, side, sid); }
  }
  return d;
}
float mapD(vec3 p) { float m; vec3 i; return map(p, m, i); }
vec3 neonCol(float k) {
  k = fract(k * 7.13);
  return k < 0.25 ? vec3(1.0, 0.15, 0.6) : k < 0.5 ? vec3(0.1, 0.85, 1.0) : k < 0.75 ? vec3(1.0, 0.75, 0.15) : vec3(0.6, 0.3, 1.0);
}
vec3 skyline(vec3 rd) {
  vec3 col = mix(vec3(0.05, 0.02, 0.09), vec3(0.18, 0.04, 0.22), pow(SAT(1.0 - rd.y * 2.5), 3.0));
  // distant towers silhouettes with lit windows
  float x = atan(rd.x, rd.z) * 60.0;
  float hb = 0.04 + 0.16 * pow(hash11(floor(x)), 2.0);
  if (rd.y < hb) {
    vec2 g = vec2(x * 6.0, rd.y * 300.0);
    float lit = step(0.72, hash12(floor(g))) * step(0.3, fract(g.x)) * step(0.4, fract(g.y));
    col = vec3(0.04, 0.02, 0.07) + lit * vec3(1.0, 0.7, 0.4) * 0.5;
  }
  return col;
}
vec3 shadeBuilding(vec3 p, vec3 n, vec3 info, float t) {
  vec3 col = vec3(0.02, 0.018, 0.03);
  // windows on street-facing facades
  if (abs(n.x) > 0.5) {
    vec2 g = vec2(p.z * 1.6, p.y * 0.9);
    vec2 cid = floor(g), f = fract(g);
    float win = step(0.3, f.x) * step(f.x, 0.7) * step(0.35, f.y) * step(f.y, 0.7);
    float on = step(0.72, hash12(cid + info.x * 13.0));
    vec3 wc = mix(vec3(1.0, 0.75, 0.45), vec3(0.45, 0.85, 1.0), step(0.7, hash12(cid * 1.3)));
    col += win * on * wc * 0.55 * (0.4 + 0.6 * hash12(cid + 3.0));
    // neon trim bands
    float band = smoothstep(0.035, 0.0, abs(fract(p.y / 9.0) - 0.5)); // thin neon trim line every 9 m
    col += band * neonCol(info.x + info.y) * 2.2 * step(0.55, hash11(info.x * 5.1 + info.y));
  }
  return col;
}
vec3 trace(vec3 ro, vec3 rd, out float tHit, out vec3 glow) {
  float t = 0.1, mat = 0.0; vec3 info; glow = vec3(0.0);
  for (int i = 0; i < 220; i++) {
    vec3 p = ro + rd * t;
    float d = map(p, mat, info);
    if (mat == 2.0) glow += neonCol(info.x * 1.3 + info.y) * min(0.0018 / (0.25 + d * d), 0.006); // neon halo through fog (bounded)
    if (d < 0.002 * t) break;
    t += d * 0.8;
    if (t > 600.0) break;
  }
  tHit = t;
  if (t > 600.0) return skyline(rd);
  vec3 p = ro + rd * t;
  vec2 e = vec2(0.01 * t, 0.0);
  vec3 n = normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx)));
  map(p, mat, info);
  if (mat == 2.0) return neonCol(info.x * 1.3 + info.y) * 4.0;
  if (mat == 1.0) return shadeBuilding(p, n, info, t);
  return vec3(0.015, 0.012, 0.02);
}
vec3 fogIt(vec3 col, vec3 rd, float t) {
  vec3 fogCol = vec3(0.16, 0.05, 0.22) + vec3(0.05, 0.12, 0.2) * SAT(rd.y * 3.0);
  return mix(col, fogCol, 1.0 - exp(-t * 0.009));
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(-2.0, 2.6, -8.0);
  vec3 ta = vec3(0.5, 11.0, 70.0);
  vec3 rd = camera(ro, ta, 0.02) * normalize(vec3(uv, 1.25));
  float t; vec3 glow;
  vec3 col = trace(ro, rd, t, glow);
  vec3 p = ro + rd * t;
  if (t < 600.0 && p.y < 0.05) {
    // wet asphalt: rippled mirror reflection + puddles
    vec2 w = vec2(noise(p.xz * 1.7), noise(p.xz * 1.7 + 5.0)) * 0.035;
    float puddle = smoothstep(0.0, 0.3, fbm(p.xz * 0.15, 4));
    vec3 n = normalize(vec3(w.x, 1.0, w.y) + (1.0 - puddle) * vec3(w.x, 0.0, w.y) * 4.0);
    vec3 rr = reflect(rd, n);
    float t2; vec3 g2;
    vec3 rc = trace(p + n * 0.05, rr, t2, g2);
    rc = fogIt(rc + g2, rr, t2);
    float fres = 0.08 + 0.92 * pow(1.0 - SAT(dot(-rd, n)), 4.0);
    col = mix(vec3(0.01, 0.008, 0.015), rc, SAT(fres * (0.55 + 0.45 * puddle)));
    // lane markings
    col += vec3(0.5, 0.45, 0.35) * 0.06 * step(abs(p.x - 0.0), 0.08) * step(0.5, fract(p.z * 0.08));
  }
  col = fogIt(col, rd, t) + glow;
  // rain streaks (screen-space, depth-faded)
  vec2 g = vec2(uv.x * 140.0 + uv.y * 12.0, uv.y * 7.0);
  float r = step(0.985, hash12(floor(g))) * smoothstep(0.0, 0.6, fract(g.y + hash12(floor(g) + 1.0)));
  col += r * vec3(0.4, 0.5, 0.7) * 0.18;
  return col;
}
