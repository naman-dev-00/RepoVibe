// @sprites sprayA:1400x900, sprayB:1100x760, flowerA:640x760, flowerB:560x640, leafG:384x384, mush:640x560, leafY:384x384, leafO:384x384, leafM:384x384
// Enchanted forest at night — layered 3D scene (RepoVibe depth engine).
// Raymarched SDF trees (trunks with root flare, branches, displaced canopy clumps), glowing mushrooms and flowers as
// real geometry, a reflective stream, moonlit teal haze. uLayer selects a depth slab (see common.glsl):
// 1 far: sky, ground, stream, ground glow, trees ≥ D2 · 2 mid: trees/plants in [D1, D2) · 3 near: trees/plants < D1
// 4 front: decorative foreground leaves and ferns (2D, alpha) · 5 rays: moonlight shafts (alpha) · 0: everything.
const vec3 MOON = normalize(vec3(0.22, 0.62, 1.0));
const float D1 = 11.0, D2 = 27.0;
vec3 RO; mat3 CAM;

bool inLayer(float d) {
  if (uLayer == 0) return true;
  if (uLayer == 1) return d >= D2;
  if (uLayer == 2) return d >= D1 && d < D2;
  if (uLayer == 3) return d < D1;
  return false;
}
bool groundLayer() { return uLayer == 0 || uLayer == 1; }

float pathX(float z) { return 2.5 * sin(z * 0.035) + 1.2 * sin(z * 0.011 + 1.0); }
float groundH(vec2 p) { return 0.6 * fbm(p * 0.08, 4) + 0.25 * noise(p * 0.5) - 0.6 * exp(-pow((p.x - pathX(p.y)) * 0.32, 2.0)); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = SAT(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - r; }

// One tree per 7×7 m cell (jittered), none inside the clearing. mat: 1 bark, 2 foliage, 3 glowing cap, 4 stem
float trees(vec3 p, out float mat, out float id) {
  vec2 cell = floor(p.xz / 7.0);
  float d = 1e9; mat = 1.0; id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j);
    vec2 h = hash22(c);
    vec2 base = (c + 0.2 + 0.6 * h) * 7.0;
    if (abs(base.x - pathX(base.y)) < 5.0) continue;
    float dist = length(base - RO.xz);
    if (!inLayer(dist)) continue;
    float r = 0.42 + 0.55 * h.x;
    vec3 q = p - vec3(base.x, 0.0, base.y);
    vec3 qb = q; qb.xz += vec2(sin(q.y * 0.15 + h.y * 6.0), cos(q.y * 0.12 + h.x * 6.0)) * 0.55;
    float rr = r * (1.0 + 0.7 * exp(-max(qb.y, 0.0) * 1.3)) + 0.07 * noise(vec2(qb.y * 2.0, atan(qb.z, qb.x) * 3.0));
    float t = max(length(qb.xz) - rr, qb.y - 34.0);
    float m = 1.0;
    // branches: two capsules angling up and out
    for (int k = 0; k < 2; k++) {
      float fk = float(k), a = h.x * 6.28 + fk * 2.6, y0 = 6.0 + fk * 3.5 + h.y * 2.0;
      vec3 b0 = vec3(0.0, y0, 0.0), b1 = vec3(cos(a) * 3.6, y0 + 2.6, sin(a) * 3.6);
      t = smin(t, sdCapsule(qb, b0, b1, 0.18 * r + 0.06), 0.25);
    }
    // canopy clumps (noise-displaced spheres) high up
    for (int k = 0; k < 3; k++) {
      float fk = float(k), a = h.y * 6.28 + fk * 2.1;
      vec3 cc = vec3(cos(a) * (2.6 + fk), 12.0 + fk * 3.0 + h.x * 3.0, sin(a) * (2.6 + fk));
      float f = length(qb - cc) - (3.2 + h.x * 1.6) + 0.9 * noise3((qb - cc) * 0.9 + fk);
      if (f < t) { t = f; m = 2.0; }
    }
    // glowing mushrooms / flowers around the roots (part of this tree's depth slab)
    for (int k = 0; k < 3; k++) {
      float fk = float(k), a = h.x * 9.0 + fk * 2.3;
      vec2 mp = vec2(cos(a), sin(a)) * (r * 1.9 + 0.5 + 0.4 * hash11(fk + h.y * 9.0));
      float sz = 0.16 + 0.18 * hash11(fk * 3.1 + h.x * 11.0);
      vec3 mq = q - vec3(mp.x, 0.0, mp.y);
      float stem = sdCapsule(mq, vec3(0.0), vec3(0.0, sz * 2.0, 0.0), sz * 0.22);
      float cap = max(length(mq - vec3(0.0, sz * 2.0, 0.0)) - sz, -(mq.y - sz * 1.75));
      if (stem < t) { t = stem; m = 4.0; }
      if (cap < t) { t = cap; m = 3.0; id = h.x + fk; }
    }
    if (t < d) { d = t; mat = m; if (m != 3.0) id = h.x + h.y * 7.0; }
  }
  return d;
}
float map(vec3 p, out float mat, out float id) {
  float tm, tid; float t = trees(p, tm, tid);
  t = max(t, groundH(p.xz) - 0.05 - p.y); // objects end at the terrain (needed once layers move independently)
  float g = groundLayer() ? p.y - groundH(p.xz) : 1e9;
  if (g < t) { mat = 0.0; id = 0.0; return g; }
  mat = tm; id = tid; return t;
}
float mapD(vec3 p) { float m, i; return map(p, m, i); }
vec3 nrm(vec3 p) { vec2 e = vec2(0.02, 0.0); return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx))); }

vec3 sky(vec3 rd) {
  vec3 col = mix(vec3(0.03, 0.08, 0.11), vec3(0.01, 0.025, 0.06), SAT(rd.y * 1.5));
  float m = SAT(dot(rd, MOON));
  col += vec3(0.65, 0.88, 1.0) * pow(m, 1200.0) * 9.0 + vec3(0.25, 0.5, 0.6) * pow(m, 14.0) * 0.6;
  vec3 s = floor(rd * 700.0);
  col += step(0.997, hash12(s.xy + s.z)) * SAT(rd.y * 3.0) * 0.7;
  return col;
}
vec3 shade(vec3 p, vec3 rd, float mat, float id) {
  vec3 n = nrm(p);
  float moon = SAT(dot(n, MOON));
  float rim = pow(1.0 - SAT(dot(n, -rd)), 3.0) * SAT(dot(n, MOON) + 0.4);
  vec3 col;
  if (mat == 3.0) { // glowing caps: emissive, hue per cluster
    vec3 g = mix(vec3(0.2, 1.0, 0.85), vec3(0.55, 0.6, 1.0), fract(id * 3.7));
    g = mix(g, vec3(1.0, 0.55, 0.85), step(0.8, fract(id * 7.1)));
    return g * (1.6 + 0.8 * pow(SAT(dot(n, -rd)), 2.0));
  }
  if (mat == 4.0) return vec3(0.35, 0.75, 0.7) * 0.5;
  if (mat == 2.0) { // foliage
    vec3 leaf = mix(vec3(0.02, 0.07, 0.06), vec3(0.05, 0.16, 0.13), noise3(p * 1.7) * 0.5 + 0.5);
    col = leaf * (0.35 + moon * 1.6) + vec3(0.25, 0.55, 0.6) * rim * 0.9;
    return col;
  }
  if (mat == 1.0) { // bark + moss + bioluminescent lichen
    vec3 bark = mix(vec3(0.03, 0.04, 0.04), vec3(0.08, 0.09, 0.08), noise(p.xz * 3.0 + p.y));
    float moss = smoothstep(0.2, 0.8, n.y + 0.4 * noise(p.xz * 2.0 + p.y * 0.5)) * smoothstep(6.0, 0.0, p.y);
    col = mix(bark, vec3(0.05, 0.18, 0.12), moss) * (0.3 + moon * 1.4) + vec3(0.2, 0.45, 0.5) * rim * 0.7;
    float lich = smoothstep(0.82, 0.97, noise(vec2(p.y * 3.0, atan(p.z, p.x) * 6.0 + id * 5.0))) * step(0.5, fract(id * 3.1)) * smoothstep(5.0, 0.5, p.y);
    return col + lich * vec3(0.1, 0.9, 0.7) * 0.55;
  }
  // ground with scattered glowing plants (denser along the stream banks)
  vec3 grass = mix(vec3(0.02, 0.06, 0.04), vec3(0.04, 0.12, 0.08), fbm(p.xz * 0.6, 3) * 0.5 + 0.5);
  col = grass * (0.35 + moon * 1.6);
  float bank = exp(-pow((p.x - pathX(p.z)) * 0.4 - 1.3, 2.0)) + exp(-pow((p.x - pathX(p.z)) * 0.4 + 1.3, 2.0));
  vec2 gc = floor(p.xz * 1.6); vec2 gf = fract(p.xz * 1.6) - 0.5;
  float pl = step(0.84 - 0.25 * bank, hash12(gc)) * smoothstep(0.3, 0.0, length(gf + (hash22(gc) - 0.5) * 0.4));
  return col + pl * mix(vec3(0.1, 0.85, 0.75), vec3(0.45, 0.55, 1.0), hash12(gc + 3.0)) * 1.5;
}
vec3 fog(vec3 col, vec3 rd, float t, vec3 p) {
  float m = SAT(dot(rd, MOON));
  vec3 fc = mix(vec3(0.03, 0.09, 0.11), vec3(0.16, 0.36, 0.42), pow(m, 5.0));
  float hf = exp(-max(p.y, 0.0) * 0.12);
  float a = 1.0 - exp(-t * (0.007 + 0.013 * hf) * (0.8 + 0.4 * noise(p.xz * 0.05 + p.y * 0.1)));
  return mix(col, fc, a);
}
// Returns colour; tHit < 0 when the ray hit nothing in this layer.
vec3 trace(vec3 ro, vec3 rd, out float tHit) {
  float t = 0.2, mat = 0.0, id = 0.0;
  for (int i = 0; i < 220; i++) {
    vec3 p = ro + rd * t;
    float d = map(p, mat, id);
    if (d < 0.002 * t) break;
    t += d * 0.75;
    if (t > 260.0) break;
  }
  if (t > 260.0) { tHit = -1.0; return groundLayer() ? fog(sky(rd), rd, 260.0, ro + rd * 260.0) : vec3(0.0); }
  tHit = t;
  vec3 p = ro + rd * t;
  vec3 c = shade(p, rd, mat, id);
  return mat == 3.0 ? mix(c, fog(c, rd, t, p), 0.5) : fog(c, rd, t, p);
}
// Decorative foreground (front layer): large leaves hanging from the top corners and fern fronds at the bottom.
vec4 foreground(vec2 uv) {
  // Placed to frame the scene window: GitHub's header covers roughly the top 22 % of the viewport, so leaves hang from
  // just below it (uv.y ≈ 0.28) at both sides, plus leafy branches climbing the left and right edges.
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 26; i++) {
    float fi = float(i), side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
    float k = floor(fi / 2.0) / 12.0;                       // 0..1 along the cluster
    vec2 c = vec2(side * (0.84 - 0.24 * k - 0.04 * hash11(fi)), 0.27 - 0.07 * k + 0.05 * (hash11(fi + 4.0) - 0.5));
    if (k > 0.6) c = vec2(side * (0.80 + 0.04 * hash11(fi + 6.0)), 0.16 - 0.30 * (k - 0.6) / 0.4); // climbing the edges
    float a = (hash11(fi + 8.0) - 0.5) * 1.4 + side * 1.1 - 1.57 * 0.55;
    vec2 q = uv - c; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
    float len = 0.10 + 0.05 * hash11(fi + 2.0), wid = len * 0.36;
    float x = q.x / len;
    float halfW = wid * pow(max(1.0 - x * x, 0.0), 0.8) * (1.0 - 0.25 * x);
    float inside = smoothstep(0.003, -0.003, abs(q.y) - halfW) * step(abs(x), 1.0);
    if (inside <= 0.0) continue;
    float vein = smoothstep(0.003, 0.0, abs(q.y)) + 0.5 * smoothstep(0.0025, 0.0, abs(fract(x * 4.0 + q.y / wid * 1.6) - 0.5) * wid * 0.6);
    float edge = smoothstep(halfW * 0.5, halfW, abs(q.y));
    vec3 col = mix(vec3(0.014, 0.045, 0.036), vec3(0.04, 0.11, 0.085), 0.5 + 0.5 * x)
             + vec3(0.30, 0.62, 0.66) * edge * 0.45 * SAT(q.y * -side + 0.6)          // moonlit rim
             + vec3(0.10, 0.32, 0.28) * vein * 0.3;
    acc = vec4(mix(acc.rgb, col, inside), max(acc.a, inside));
  }
  // twig connecting each cluster
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec2 a0 = vec2(side * 0.92, 0.29), a1 = vec2(side * 0.58, 0.20);
    vec2 pa = uv - a0, ba = a1 - a0; float h = SAT(dot(pa, ba) / dot(ba, ba));
    float twig = smoothstep(0.004, 0.0, length(pa - ba * h) - 0.004 * (1.0 - h * 0.6));
    acc = vec4(mix(acc.rgb, vec3(0.02, 0.035, 0.03), twig), max(acc.a, twig));
  }
  return acc;
}
// Moonlight shafts (rays layer): streaks radiating from the moon through gaps in the canopy, strongest in the haze.
vec4 rays(vec2 uv) {
  vec3 mv = vec3(dot(MOON, CAM[0]), dot(MOON, CAM[1]), dot(MOON, CAM[2]));
  vec2 ms = mv.xy / mv.z * 1.25;
  vec2 d = uv - ms;
  float ang = atan(d.y, d.x), r = length(d);
  float shafts = pow(SAT(noise(vec2(ang * 9.0, 1.3)) * 0.5 + 0.5), 5.0) + 0.6 * pow(SAT(noise(vec2(ang * 23.0, 7.1)) * 0.5 + 0.5), 8.0);
  float fall = exp(-r * 1.1) * smoothstep(0.0, 0.25, r) * SAT(0.6 - d.y * 0.4);
  float a = SAT(shafts * fall * 1.4);
  return vec4(vec3(0.55, 0.85, 0.95), a * 0.85);
}
// ---- Sprites (uLayer >= 10): close foliage, glowing flowers, a falling leaf and a mushroom cluster on transparency.
vec4 leafAt(vec2 uv, vec2 c, float ang, float len, float sd) {
  vec2 q = uv - c; q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
  float x = q.x / len; if (abs(x) > 1.0) return vec4(0.0);
  float wid = len * (0.34 + 0.06 * hash11(sd));
  float halfW = wid * pow(max(1.0 - x * x, 0.0), 0.75) * (1.0 - 0.22 * x);
  float aa = 1.5 / uRes.y;
  float inside = smoothstep(aa, -aa, abs(q.y) - halfW);
  if (inside <= 0.0) return vec4(0.0);
  float side = sign(q.y);
  float vein = smoothstep(aa * 1.6, 0.0, abs(q.y) - aa * 0.4) + 0.55 * smoothstep(aa * 1.4, 0.0, abs(fract(x * 5.0 - abs(q.y) / wid * 1.8) - 0.5) * wid * 0.5);
  float edge = smoothstep(halfW * 0.55, halfW, abs(q.y));
  float tex = noise(q * 140.0 + sd) * 0.5 + noise(q * 420.0 + sd) * 0.5;
  float lit = SAT(0.55 + 0.45 * side * sin(ang + 0.6));             // one half faces the moon
  float var = hash11(sd * 1.7);
  vec3 col = mix(vec3(0.006, 0.022, 0.018), mix(vec3(0.03, 0.1, 0.07), vec3(0.05, 0.11, 0.05), var), pow(lit, 1.6) * (0.5 + 0.5 * x)) * (0.75 + 0.5 * tex);
  col += vec3(0.3, 0.75, 0.7) * pow(edge, 3.0) * 0.5 * pow(lit, 2.0);   // thin moonlit rim
  col += vec3(0.1, 0.3, 0.24) * vein * 0.18 * lit;
  col += vec3(0.05, 0.2, 0.1) * pow(SAT(1.0 - abs(q.y) / halfW), 3.0) * 0.12 * lit; // translucency near the midrib
  return vec4(col, inside);
}
vec4 overS(vec4 a, vec4 b) { return vec4(mix(a.rgb, b.rgb, b.a), max(a.a, b.a)); }
vec4 spray(vec2 uv, float sd, int n, float scale) {
  vec4 acc = vec4(0.0);
  float asp = uRes.x / uRes.y;
  vec2 a0 = vec2(-0.5 * asp - 0.02, -0.18), a1 = vec2(0.36 * asp, 0.14);
  // twig (tapered, slightly curved)
  for (int j = 0; j < 24; j++) {
    float t0 = float(j) / 24.0, t1 = float(j + 1) / 24.0;
    vec2 p0 = mix(a0, a1, t0) + vec2(0.0, 0.06 * sin(t0 * 3.1)), p1 = mix(a0, a1, t1) + vec2(0.0, 0.06 * sin(t1 * 3.1));
    vec2 pa = uv - p0, ba = p1 - p0; float h = SAT(dot(pa, ba) / dot(ba, ba));
    float r = 0.012 * scale * (1.0 - 0.75 * mix(t0, t1, h));
    float tw = smoothstep(1.5 / uRes.y, 0.0, length(pa - ba * h) - r);
    acc = overS(acc, vec4(mix(vec3(0.02, 0.03, 0.025), vec3(0.08, 0.1, 0.08), SAT((uv - p0).y / r * 0.5 + 0.5)), tw));
  }
  for (int i = 0; i < 22; i++) {
    if (i >= n) break;
    float fi = float(i), t = 0.08 + 0.9 * fi / float(n);
    vec2 base = mix(a0, a1, t) + vec2(0.0, 0.06 * sin(t * 3.1));
    float side = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
    float ang = 0.35 + side * (0.9 + 0.35 * hash11(fi + sd)) + (hash11(fi * 3.1 + sd) - 0.5) * 0.5;
    float len = (0.16 - 0.08 * t) * scale * (0.85 + 0.3 * hash11(fi + sd * 2.0));
    vec2 c = base + vec2(cos(ang), sin(ang)) * len * 0.95;
    acc = overS(acc, leafAt(uv, c, ang, len, fi + sd));
  }
  return acc;
}
vec4 flower(vec2 uv, float sd, vec3 hue) {
  vec4 acc = vec4(0.0);
  // stems
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 top = vec2((fk - 1.0) * 0.16 + 0.03 * hash11(sd + fk), 0.12 - 0.12 * abs(fk - 1.0)), bot = vec2((fk - 1.0) * 0.05, -0.5);
    vec2 pa = uv - bot, ba = top - bot; float h = SAT(dot(pa, ba) / dot(ba, ba));
    float st = smoothstep(1.5 / uRes.y, 0.0, length(pa - ba * h - vec2(0.03 * sin(h * 3.0), 0.0)) - 0.006);
    acc = overS(acc, vec4(vec3(0.03, 0.12, 0.08), st));
  }
  float glow = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 c = vec2((fk - 1.0) * 0.16 + 0.03 * hash11(sd + fk), 0.12 - 0.12 * abs(fk - 1.0) + 0.04);
    vec2 q = uv - c; float r = length(q), a = atan(q.y, q.x);
    float petals = 0.075 * (0.75 + 0.25 * cos(5.0 * (a + sd)));
    float inside = smoothstep(1.5 / uRes.y, -1.5 / uRes.y, r - petals);
    float core = exp(-r * r / 0.0006);
    vec3 col = mix(hue * 0.6, hue * 2.2, SAT(1.0 - r / petals)) + vec3(1.0, 0.95, 0.8) * core * 1.5;
    col += hue * 0.5 * smoothstep(0.0025, 0.0, abs(fract(a * 5.0 / 6.2832 + 0.5) - 0.5) * r); // petal veins
    acc = overS(acc, vec4(col, inside));
    glow += exp(-r * r / 0.012) * 0.7;
  }
  // soft emissive halo (premultiplied-ish: low alpha, bright colour)
  float ha = SAT(glow) * 0.55 * (1.0 - acc.a);
  return vec4(acc.a > 0.0 ? mix(hue * 1.6, acc.rgb, acc.a / max(acc.a + ha, 1e-3)) : hue * 1.6, SAT(acc.a + ha));
}
vec4 mushCluster(vec2 uv, float sd) {
  vec4 acc = vec4(0.0); float glow = 0.0;
  for (int k = 0; k < 5; k++) {
    float fk = float(k), x = (fk - 2.0) * 0.17 + 0.03 * hash11(fk + sd), sc = 0.7 + 0.5 * hash11(fk * 2.0 + sd) - 0.15 * abs(fk - 2.0);
    vec2 base = vec2(x, -0.42), capC = base + vec2(0.02 * (hash11(fk) - 0.5), 0.32 * sc);
    vec2 pa = uv - base, ba = capC - base; float h = SAT(dot(pa, ba) / dot(ba, ba));
    float stem = smoothstep(1.5 / uRes.y, 0.0, length(pa - ba * h) - 0.022 * sc * (1.1 - 0.3 * h));
    acc = overS(acc, vec4(vec3(0.55, 0.62, 0.6) * (0.5 + 0.5 * h), stem));
    vec2 q = (uv - capC) / vec2(0.13 * sc, 0.07 * sc);
    float cap = smoothstep(0.03, -0.03, length(q) - 1.0) * step(-0.25, q.y);
    float spots = step(0.82, noise(q * 6.0 + fk * 7.0));
    vec3 cc = mix(vec3(0.15, 0.75, 0.8), vec3(0.75, 1.0, 1.0), SAT(q.y)) * 1.4 + vec3(1.0) * spots * 0.6;
    acc = overS(acc, vec4(cc, cap));
    glow += exp(-dot(uv - capC, uv - capC) / (0.02 * sc));
  }
  float ha = SAT(glow) * 0.5 * (1.0 - acc.a);
  return vec4(acc.a > 0.0 ? acc.rgb : vec3(0.3, 0.95, 1.0) * 1.4, SAT(acc.a + ha));
}
// A single falling leaf, lit and coloured for visibility in the moonlit glade: asymmetric outline with a curled midrib and
// a pointed tip, folded halves, branching veins, translucent glowing margins, speckle (autumn leaves) and a thin petiole.
vec4 fallLeaf(vec2 uv, float sd, vec3 cLo, vec3 cHi, vec3 cVein, float spots) {
  float aa = 1.5 / uRes.y;
  float ang = 0.55 + 0.35 * (hash11(sd) - 0.5);
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uv;
  float len = 0.40;
  float x = q.x / len;                                         // -1 (base) .. 1 (tip)
  q.y -= (0.16 + 0.1 * hash11(sd + 3.0)) * len * x * x;         // curled midrib
  float side = q.y >= 0.0 ? 1.0 : -1.0;
  float wid = len * (0.38 + 0.05 * hash11(sd + 1.0));
  float halfW = wid * pow(max(1.0 - x * x, 0.0), 0.72) * (0.78 - 0.34 * x) * (1.0 + 0.1 * side * sin(sd * 3.0 + x * 2.0)) * (1.0 + 0.018 * sin(x * 38.0 + sd));
  float inside = x > -1.0 && x < 1.0 ? smoothstep(aa, -aa, abs(q.y) - halfW) : 0.0;
  // petiole: a short stem past the base
  float stem = (x <= -0.98 && x > -1.2) ? smoothstep(aa * 1.5, 0.0, abs(q.y - 0.012 * (x + 0.98) * len) - 0.0075) : 0.0;
  if (inside <= 0.0 && stem <= 0.0) return vec4(0.0);
  if (inside <= 0.0) return vec4(vec3(0.24, 0.15, 0.06), SAT(stem));                    // petiole only
  float w = abs(q.y) / max(halfW, 1e-4);                        // 0 midrib .. 1 margin
  float t = x * 0.5 + 0.5;
  float fold = mix(0.74, 1.06, smoothstep(-0.2, 0.2, q.y / wid));                 // the two halves catch the light differently
  float tex = 0.86 + 0.28 * (noise(q * 110.0 + sd) * 0.6 + noise(q * 330.0 + sd) * 0.4);
  float vein = smoothstep(aa * 1.4, 0.0, abs(q.y) - aa * 0.9 * (1.0 - 0.6 * t))                                  // midrib
             + 0.7 * smoothstep(0.075, 0.015, abs(fract(t * 6.5 - w * 0.9) - 0.5) * 0.5) * step(w, 0.9) * step(0.06, t) * step(t, 0.93);
  vec3 col = mix(cLo, cHi, SAT(fold * (0.55 + 0.45 * t) * tex - 0.1 * w));
  col = mix(col, cVein, SAT(vein) * 0.3);
  col += cHi * pow(w, 3.0) * 0.18;                                              // light glowing through the thin margin
  col += vec3(0.5, 0.8, 0.95) * pow(w, 7.0) * 0.14;                              // cool moonlit rim
  col *= 1.0 - spots * step(0.8, noise(q * 52.0 + sd * 3.0)) * 0.5 * smoothstep(0.1, 0.5, w);
  return vec4(col, SAT(max(inside, stem)));
}
vec3 render(vec2 uv) {
  if (uLayer >= 10) {
    int k = uLayer - 10; vec4 r;
    if (k == 0) r = spray(uv, 1.0, 22, 1.25);
    else if (k == 1) r = spray(uv * vec2(-1.0, 1.0), 9.0, 18, 1.1);
    else if (k == 2) r = flower(uv, 2.0, vec3(0.3, 0.9, 1.0));
    else if (k == 3) r = flower(uv, 5.0, vec3(1.0, 0.45, 0.85));
    else if (k == 4) r = fallLeaf(uv, 3.0, vec3(0.025, 0.13, 0.045), vec3(0.2, 0.6, 0.085), vec3(0.55, 0.9, 0.3), 0.0);            // fresh green
    else if (k == 5) r = mushCluster(uv, 4.0);
    else if (k == 6) r = fallLeaf(uv, 8.0, vec3(0.24, 0.12, 0.01), vec3(0.8, 0.52, 0.05), vec3(1.0, 0.82, 0.35), 0.55);          // golden
    else if (k == 7) r = fallLeaf(uv, 13.0, vec3(0.2, 0.05, 0.02), vec3(0.78, 0.27, 0.05), vec3(1.0, 0.6, 0.3), 0.9);           // amber / copper
    else r = fallLeaf(uv, 21.0, vec3(0.03, 0.17, 0.13), vec3(0.17, 0.66, 0.48), vec3(0.65, 0.95, 0.8), 0.0);                     // soft mint-teal
    gAlpha = r.a; return r.rgb;
  }
  RO = vec3(pathX(0.0) + 0.3, 1.7, 0.0);
  vec3 ta = vec3(pathX(60.0), 4.5, 60.0);
  CAM = camera(RO, ta, 0.0);
  if (uLayer == 4) { vec4 f = foreground(uv); gAlpha = f.a; return f.rgb; }
  if (uLayer == 5) { vec4 r = rays(uv); gAlpha = r.a; return r.rgb; }
  vec3 rd = CAM * normalize(vec3(uv, 1.25));
  float t;
  vec3 col = trace(RO, rd, t);
  if (!groundLayer()) { gAlpha = t > 0.0 ? 1.0 : 0.0; return col; }
  // stream: reflective water in the clearing (far layer / flat)
  float tw = rd.y < 0.0 ? (-0.35 - RO.y) / rd.y : 1e9;
  vec3 pw = RO + rd * tw;
  if ((t < 0.0 || tw < t) && abs(pw.x - pathX(pw.z)) < 1.6) {
    vec3 n = normalize(vec3(noise(pw.xz * 2.0) * 0.06, 1.0, noise(pw.xz * 2.0 + 4.0) * 0.06));
    float t2; vec3 rc = trace(pw + vec3(0, 0.05, 0), reflect(rd, n), t2);
    col = fog(mix(vec3(0.0, 0.02, 0.03), rc, 0.75), rd, tw, pw);
  }
  if (uLayer == 0) {
    vec4 f = foreground(uv); col = mix(col, f.rgb, f.a);
    vec4 r = rays(uv); col += r.rgb * r.a * 0.25;
  }
  return col * 1.12;
}
