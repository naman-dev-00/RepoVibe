// @sprites popA:1280x1280, popB:1024x1024, foreA:1024x1024, foreB:896x896, midA:640x640, midB:560x560, midC:480x480, shard:1024x640
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
// ---- Sprites (uLayer >= 10): individual, highly detailed asteroids rendered alone on transparency, so the runtime
// engine can move, rotate and parallax each one independently (autonomous drift + depth).
mat3 rotXYZ(vec3 a) { vec3 c = cos(a), s = sin(a);
  return mat3(c.y * c.z, c.y * s.z, -s.y, s.x * s.y * c.z - c.x * s.z, s.x * s.y * s.z + c.x * c.z, s.x * c.y, c.x * s.y * c.z + s.x * s.z, c.x * s.y * s.z - s.x * c.z, c.x * c.y); }
float rockSDF(vec3 p, float sd, vec3 sc) {
  vec3 q = p / sc;
  float r = length(q);
  vec3 dir = q / max(r, 1e-4);
  // smooth "potato" body; fine detail is added in shading (bump), not geometry, so silhouettes stay clean
  float n = 0.24 * (noise3(dir * 1.2 + sd) - 0.5) + 0.09 * (noise3(dir * 2.6 + sd * 1.7) - 0.5) + 0.03 * (noise3(dir * 5.5 + sd * 2.3) - 0.5);
  for (int k = 0; k < 5; k++) { // a few craters: shallow bowls with soft raised rims
    float fk = float(k) + sd * 3.0;
    vec3 c = normalize(vec3(hash11(fk * 1.3) - 0.5, hash11(fk * 2.7) - 0.5, hash11(fk * 4.1) - 0.5));
    float rad = 0.2 + 0.25 * hash11(fk * 5.9), x = length(dir - c) / rad;
    float bowl = SAT(1.0 - x * x); n += -0.05 * bowl * bowl + 0.012 * exp(-pow((x - 1.0) * 5.0, 2.0)); // C1-smooth bowl + rim (no outline ring)
  }
  return (r - 1.0 - n) * min(sc.x, min(sc.y, sc.z)) * 0.75;
}
float rockBump(vec3 p, float sd) { return noise3(p * 9.0 + sd) * 0.6 + noise3(p * 23.0 + sd) * 0.3 + noise3(p * 55.0 + sd) * 0.1; }
vec4 rockSprite(vec2 uv, float sd, vec3 sc, vec3 rot) {
  mat3 R = rotXYZ(rot);
  vec3 ro = vec3(0.0, 0.0, -4.2), rd = normalize(vec3(uv * 0.62, 1.0));
  float t = 2.4, d = 0.0; bool hit = false;
  for (int i = 0; i < 160; i++) { d = rockSDF(R * (ro + rd * t), sd, sc); if (d < 0.0005) { hit = true; break; } t += d * 0.6; if (t > 6.0) break; }
  if (!hit) return vec4(0.0);
  vec3 p = R * (ro + rd * t); vec2 e = vec2(0.002, 0.0);
  vec3 nl = normalize(vec3(rockSDF(p + e.xyy, sd, sc) - rockSDF(p - e.xyy, sd, sc), rockSDF(p + e.yxy, sd, sc) - rockSDF(p - e.yxy, sd, sc), rockSDF(p + e.yyx, sd, sc) - rockSDF(p - e.yyx, sd, sc)));
  // bump: perturb the normal by the gradient of fine noise (pitted, sharp surface detail)
  vec2 eb = vec2(0.004, 0.0); float b0 = rockBump(p, sd);
  vec3 g = vec3(rockBump(p + eb.xyy, sd) - b0, rockBump(p + eb.yxy, sd) - b0, rockBump(p + eb.yyx, sd) - b0) / eb.x;
  vec3 ng = transpose(R) * nl; // smooth geometric normal (rim/fresnel: no bump-induced contour artefacts)
  nl = normalize(nl - 0.035 * (g - nl * dot(g, nl)));
  vec3 n = transpose(R) * nl;
  vec3 L = normalize(vec3(0.92, 0.38, 0.1)); // side light: strong day/night terminator
  float dif = SAT(dot(n, L));
  float sh = 1.0; vec3 Lr = R * L;
  for (int i = 0; i < 20; i++) { float tt = 0.03 + float(i) * 0.07; sh = min(sh, SAT(rockSDF(p + nl * 0.01 + Lr * tt, sd, sc) * 10.0 / tt)); }
  float ao = SAT(0.35 + 2.6 * rockSDF(p + nl * 0.1, sd, sc) / 0.1);
  float cav = SAT(0.55 + 1.6 * (b0 - 0.5));
  vec3 alb = mix(vec3(0.16, 0.14, 0.15), vec3(0.33, 0.28, 0.26), noise3(p * 3.0 + sd)) * (0.7 + 0.45 * cav);
  vec3 col = alb * (pow(dif, 1.2) * sh * vec3(2.6, 2.35, 2.1) + vec3(0.025, 0.025, 0.05) * ao);
  float fres = pow(1.0 - SAT(dot(ng, -rd)), 4.0);
  col += vec3(0.5, 0.32, 1.0) * fres * 0.55 * SAT(1.0 - 2.0 * dot(ng, L));            // thin violet rim on the night side
  col += vec3(0.3, 0.5, 1.0) * SAT(dot(n, normalize(vec3(-0.7, -0.5, -0.2)))) * 0.05 * ao; // faint planet bounce
  float ice = step(0.8, noise3(p * 15.0 + sd * 2.0));
  col += vec3(0.9, 0.95, 1.0) * pow(SAT(dot(reflect(-L, n), -rd)), 30.0) * (0.1 + 1.4 * ice) * sh;
  return vec4(col, 1.0);
}
vec3 render(vec2 uv) {
  if (uLayer >= 10) {
    int k = uLayer - 10; vec4 r;
    if (k == 0) r = rockSprite(uv, 3.1, vec3(1.15, 0.92, 1.0), vec3(0.4, 0.9, 0.2));
    else if (k == 1) r = rockSprite(uv, 7.4, vec3(1.05, 1.1, 0.9), vec3(1.2, 0.3, 0.8));
    else if (k == 2) r = rockSprite(uv, 11.9, vec3(1.15, 0.85, 0.95), vec3(0.2, 2.1, 1.4));
    else if (k == 3) r = rockSprite(uv, 15.2, vec3(1.0, 1.1, 1.05), vec3(2.2, 0.6, 0.1));
    else if (k == 4) r = rockSprite(uv, 19.7, vec3(1.1, 0.95, 1.0), vec3(0.9, 1.7, 2.6));
    else if (k == 5) r = rockSprite(uv, 23.3, vec3(0.95, 1.12, 1.0), vec3(1.6, 2.4, 0.5));
    else if (k == 6) r = rockSprite(uv, 27.8, vec3(1.0, 1.0, 1.1), vec3(0.3, 0.2, 2.9));
    else r = rockSprite(uv * vec2(0.7, 1.0), 31.4, vec3(1.25, 0.55, 0.7), vec3(0.5, 0.3, 0.6)); // elongated shard (wide frame)
    gAlpha = r.a; return r.rgb;
  }
  vec3 ro = vec3(0.0, 0.0, 0.0);
  vec3 rd = camera(ro, vec3(-0.05, 0.08, 1.0), 0.06) * normalize(vec3(uv, 1.1));
  if (uLayer == 4) { gAlpha = 0.0; return vec3(0.0); } // close rocks are now individual sprites (moving on their own)
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
    // asteroids are individual sprites now (rendered separately and composed at runtime); the flat image keeps the sky
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
  // near: the asteroid field is made of individual sprites at runtime (autonomous drift); nothing baked here
  gAlpha = 0.0; return vec3(0.0);
}
