// Cosmic galaxy: volumetric nebula, a giant banded planet with atmospheric rim and rings, a smaller moon,
// lit asteroids in the foreground for depth, a distant spiral galaxy and stars.
const vec3 STAR = normalize(vec3(0.85, 0.25, 0.45)); // key light (off-screen sun)
const vec3 P1 = vec3(-38.0, -6.0, 120.0); const float R1 = 44.0;
const vec3 P2 = vec3(46.0, 22.0, 150.0); const float R2 = 9.0;

vec2 sphere(vec3 ro, vec3 rd, vec3 c, float r) { vec3 oc = ro - c; float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r; return h < 0.0 ? vec2(-1.0) : vec2(-b - sqrt(h), -b + sqrt(h)); }
vec3 nebula(vec3 ro, vec3 rd) {
  vec3 acc = vec3(0.0); float trans = 1.0;
  for (int i = 0; i < 40; i++) {
    float t = 160.0 + float(i) * 12.0;
    vec3 p = ro + rd * t;
    float d = fbm3(p * 0.012 + vec3(0.0, 0.0, 3.0));
    d = SAT(d * 1.8 + 0.05) * SAT(1.0 - abs(p.y - 20.0 - 30.0 * sin(p.x * 0.006)) * 0.012);
    vec3 c = mix(vec3(0.55, 0.15, 0.85), vec3(0.15, 0.45, 1.0), SAT(fbm3(p * 0.02) + 0.5));
    c = mix(c, vec3(1.0, 0.45, 0.6), pow(SAT(d), 3.0));
    acc += trans * c * d * 0.05;
    trans *= 1.0 - d * 0.05;
  }
  return acc;
}
vec3 background(vec3 rd) {
  vec3 col = vec3(0.004, 0.003, 0.012);
  vec3 s = floor(rd * 1200.0);
  float st = step(0.996, hash12(s.xy + s.z * 1.7));
  col += st * mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.8, 0.7), hash12(s.yz)) * (0.3 + 2.5 * pow(hash12(s.zx), 3.0));
  // distant spiral galaxy
  vec3 gd = normalize(vec3(0.42, 0.33, 1.0));
  vec3 gu = normalize(cross(gd, vec3(0.2, 1.0, 0.1))), gv = cross(gd, gu);
  vec2 g = vec2(dot(rd, gu), dot(rd, gv)) / max(dot(rd, gd), 0.01) * vec2(1.0, 2.6);
  float gr = length(g), ga = atan(g.y, g.x);
  float arms = pow(SAT(0.5 + 0.5 * cos(ga * 2.0 - log(gr + 0.001) * 6.0)), 3.0);
  col += vec3(0.85, 0.75, 1.0) * (exp(-gr * 40.0) * 2.0 + arms * exp(-gr * 9.0) * 0.6) * step(0.0, dot(rd, gd));
  return col;
}
vec3 planet(vec3 ro, vec3 rd, vec3 c, float r, vec2 hit, float big) {
  vec3 p = ro + rd * hit.x, n = normalize(p - c);
  float lat = n.y, bands = fbm(vec2(lat * (big > 0.5 ? 12.0 : 5.0), n.x * 2.0 + n.z), 6);
  vec3 alb = big > 0.5 ? mix(vec3(0.25, 0.18, 0.55), vec3(0.75, 0.55, 0.85), bands * 0.5 + 0.5) : mix(vec3(0.5, 0.5, 0.55), vec3(0.8, 0.78, 0.75), bands * 0.5 + 0.5);
  float dif = SAT(dot(n, STAR));
  float term = smoothstep(-0.15, 0.25, dot(n, STAR));
  vec3 col = alb * (dif * 1.8 + 0.02) + alb * vec3(0.25, 0.15, 0.5) * 0.15 * (1.0 - term); // nebula fill light
  float rim = pow(1.0 - SAT(dot(n, -rd)), 4.0);
  col += (big > 0.5 ? vec3(0.45, 0.6, 1.0) : vec3(0.6, 0.6, 0.7)) * rim * (0.4 + 1.2 * term);
  return col;
}
float rings(vec3 ro, vec3 rd, out float tr) {
  vec3 rn = normalize(vec3(0.18, 1.0, -0.3));
  tr = dot(P1 - ro, rn) / dot(rd, rn);
  if (tr < 0.0) return 0.0;
  float r = length(ro + rd * tr - P1);
  float band = 0.55 + 0.45 * sin(r * 0.9) * sin(r * 0.37 + 1.0);
  return band * smoothstep(R1 * 1.3, R1 * 1.42, r) * smoothstep(R1 * 2.25, R1 * 2.05, r);
}
vec3 asteroids(vec3 ro, vec3 rd, out float tA) {
  tA = 1e9; vec3 col = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec3 c = vec3((hash11(fi) - 0.5) * 60.0, (hash11(fi + 5.0) - 0.6) * 26.0, 18.0 + hash11(fi + 9.0) * 70.0);
    float r = 0.4 + 1.6 * pow(hash11(fi + 2.0), 2.0);
    vec2 h = sphere(ro, rd, c, r * 1.15);
    if (h.x > 0.0 && h.x < tA) {
      // march the bumpy surface inside the bounding sphere
      float t = h.x;
      for (int k = 0; k < 24; k++) { vec3 q = ro + rd * t - c; float d = length(q) - r * (1.0 + 0.22 * noise3(q * 2.2 / r + fi)); if (d < 0.002) break; t += d * 0.7; if (t > h.y) break; }
      if (t < h.y) {
        vec3 q = ro + rd * t - c; vec2 e = vec2(0.01 * r, 0.0);
        float f0 = length(q) - r * (1.0 + 0.22 * noise3(q * 2.2 / r + fi));
        vec3 n = normalize(vec3(length(q + e.xyy) - r * (1.0 + 0.22 * noise3((q + e.xyy) * 2.2 / r + fi)) - f0, length(q + e.yxy) - r * (1.0 + 0.22 * noise3((q + e.yxy) * 2.2 / r + fi)) - f0, length(q + e.yyx) - r * (1.0 + 0.22 * noise3((q + e.yyx) * 2.2 / r + fi)) - f0));
        tA = t;
        col = vec3(0.32, 0.27, 0.28) * (SAT(dot(n, STAR)) * 1.6 + 0.03) + vec3(0.35, 0.2, 0.6) * pow(1.0 - SAT(dot(n, -rd)), 3.0) * 0.4;
      }
    }
  }
  return col;
}
// Big close asteroids for the decorative front layer (3D-shaded, near the scene window's edges).
vec3 bigRocks(vec3 ro, vec3 rd, out float tA) {
  tA = 1e9; vec3 col = vec3(0.0);
  // small, close rocks framing the scene window's edges (kept clear of the repository title area)
  vec3 C[3] = vec3[3](vec3(-7.6, 3.1, 9.5), vec3(7.7, 2.3, 11.0), vec3(5.2, 3.9, 16.0));
  float Rr[3] = float[3](0.95, 1.1, 0.42);
  for (int i = 0; i < 3; i++) {
    float fi = float(i) + 20.0; vec3 c = C[i]; float r = Rr[i];
    vec2 h = sphere(ro, rd, c, r * 1.2);
    if (h.x <= 0.0 || h.x > tA) continue;
    float t = h.x;
    for (int k = 0; k < 32; k++) { vec3 q = ro + rd * t - c; float d = length(q) - r * (1.0 + 0.16 * noise3(q * 2.0 / r + fi) + 0.08 * noise3(q * 7.0 / r)); if (d < 0.002) break; t += d * 0.6; if (t > h.y) break; }
    if (t >= h.y) continue;
    vec3 q = ro + rd * t - c; vec2 e = vec2(0.01 * r, 0.0);
    float f0 = length(q) - r * (1.0 + 0.16 * noise3(q * 2.0 / r + fi) + 0.08 * noise3(q * 7.0 / r));
    vec3 n = normalize(vec3(
      length(q + e.xyy) - r * (1.0 + 0.16 * noise3((q + e.xyy) * 2.0 / r + fi) + 0.08 * noise3((q + e.xyy) * 7.0 / r)) - f0,
      length(q + e.yxy) - r * (1.0 + 0.16 * noise3((q + e.yxy) * 2.0 / r + fi) + 0.08 * noise3((q + e.yxy) * 7.0 / r)) - f0,
      length(q + e.yyx) - r * (1.0 + 0.16 * noise3((q + e.yyx) * 2.0 / r + fi) + 0.08 * noise3((q + e.yyx) * 7.0 / r)) - f0));
    tA = t;
    float cav = 0.6 + 0.4 * noise3(q * 5.0 / r + fi);
    col = vec3(0.30, 0.26, 0.27) * cav * (SAT(dot(n, STAR)) * 1.8 + 0.03) + vec3(0.45, 0.28, 0.85) * pow(1.0 - SAT(dot(n, -rd)), 3.0) * 0.7;
  }
  return col;
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 0.0, 0.0);
  vec3 rd = camera(ro, vec3(-0.05, 0.08, 1.0), 0.06) * normalize(vec3(uv, 1.1));
  if (uLayer == 4) { float tb; vec3 c = bigRocks(ro, rd, tb); gAlpha = tb < 1e8 ? 1.0 : 0.0; return c; }
  if (uLayer == 5) { // starlight shafts from the off-screen sun
    vec3 sv = vec3(dot(STAR, camera(ro, vec3(-0.05, 0.08, 1.0), 0.06)[0]), dot(STAR, camera(ro, vec3(-0.05, 0.08, 1.0), 0.06)[1]), 1.0);
    vec2 sp = vec2(1.15, 0.45); vec2 d = uv - sp; float ang = atan(d.y, d.x), r = length(d);
    float shafts = pow(SAT(noise(vec2(ang * 7.0, 2.0)) * 0.5 + 0.5), 4.0) + 0.5 * pow(SAT(noise(vec2(ang * 19.0, 5.0)) * 0.5 + 0.5), 7.0);
    float a = SAT(shafts * exp(-r * 0.9) * 1.1);
    gAlpha = a * 0.7; return vec3(1.0, 0.86, 0.75);
  }
  vec2 h1 = sphere(ro, rd, P1, R1), h2 = sphere(ro, rd, P2, R2);
  float tr; float ring = rings(ro, rd, tr);
  if (uLayer == 1 || uLayer == 0) {
    vec3 col = background(rd) + nebula(ro, rd);
    if (h2.x > 0.0) col = planet(ro, rd, P2, R2, h2, 0.0);
    if (uLayer == 1) return col + vec3(1.0, 0.85, 0.7) * pow(SAT(dot(rd, STAR)), 60.0) * 1.5;
    // flat composite: everything (as before)
    if (h1.x > 0.0) col = planet(ro, rd, P1, R1, h1, 1.0);
    vec3 oc = P1 - ro; float dd = length(cross(rd, oc)) - R1;
    if (dot(rd, oc) > 0.0 && dd > 0.0) col += vec3(0.35, 0.5, 1.0) * exp(-dd * 0.35) * 0.6;
    if (ring > 0.0 && (h1.x < 0.0 || tr < h1.x)) { vec3 rp = ro + rd * tr; float shadowP = sphere(rp, STAR, P1, R1).x > 0.0 ? 0.25 : 1.0; col = mix(col, vec3(0.85, 0.75, 0.95) * 0.9 * shadowP, ring * 0.75); }
    float tA; vec3 ac = asteroids(ro, rd, tA); if (tA < 1e8) col = ac;
    float tb; vec3 bc = bigRocks(ro, rd, tb); if (tb < 1e8) col = bc;
    return col + vec3(1.0, 0.85, 0.7) * pow(SAT(dot(rd, STAR)), 60.0) * 1.5;
  }
  if (uLayer == 2) { // giant planet + atmosphere halo + rings, with alpha
    vec3 col = vec3(0.0); float a = 0.0;
    vec3 oc = P1 - ro; float dd = length(cross(rd, oc)) - R1;
    if (dot(rd, oc) > 0.0 && dd > 0.0) { float hal = SAT(exp(-dd * 0.35) * 0.6); col = vec3(0.35, 0.5, 1.0) * 1.6; a = hal; }
    if (h1.x > 0.0) { col = planet(ro, rd, P1, R1, h1, 1.0); a = 1.0; }
    if (ring > 0.0 && (h1.x < 0.0 || tr < h1.x)) { vec3 rp = ro + rd * tr; float shadowP = sphere(rp, STAR, P1, R1).x > 0.0 ? 0.25 : 1.0;
      float ra = ring * 0.75; col = mix(col * a, vec3(0.85, 0.75, 0.95) * 0.9 * shadowP, ra) / max(a + ra - a * ra, 1e-3); a = a + ra - a * ra; }
    gAlpha = a; return col;
  }
  // near: asteroid field
  float tA; vec3 ac = asteroids(ro, rd, tA);
  gAlpha = tA < 1e8 ? 1.0 : 0.0; return ac;
}
