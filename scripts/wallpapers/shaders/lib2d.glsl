// RepoVibe painter helpers for the data-driven worlds (2D signed-distance shapes with analytic anti-aliasing and layered
// shading). Original code. Included by shaders that start with "// @lib2d". Straight-alpha colours: vec4(rgb, a).
float aaw() { return 1.25 / uRes.y; }
float cov(float d) { return smoothstep(aaw(), -aaw(), d); }
vec4 over(vec4 t, vec4 b) { float a = t.a + b.a * (1.0 - t.a); return a <= 0.0 ? vec4(0.0) : vec4((t.rgb * t.a + b.rgb * b.a * (1.0 - t.a)) / a, a); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// tapered capsule from a to b with radii r0 → r1; h = 0..1 position along it
float sdTaper(vec2 p, vec2 a, vec2 b, float r0, float r1, out float h) {
  vec2 pa = p - a, ba = b - a; h = SAT(dot(pa, ba) / dot(ba, ba));
  return length(pa - ba * h) - mix(r0, r1, h);
}
float sdBox(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float sdEll(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
float sdTaper2(vec2 p, vec2 a, vec2 b, float r0, float r1) { float h; return sdTaper(p, a, b, r0, r1, h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float fbmN(vec2 p) { return fbm(p, 5); }
// Five-petal blossom (cherry/plum), local coordinates, radius R. Returns straight colour + coverage.
vec4 blossom(vec2 p, float R, float sd, float lit, vec3 tint) {
  float r = length(p), a = atan(p.y, p.x) + sd * 6.2831;
  float lobe = pow(abs(cos(2.5 * a)), 0.5);
  float rad = R * (0.56 + 0.44 * lobe);
  float c = cov(r - rad);
  if (c <= 0.0) return vec4(0.0);
  float edge = SAT(r / rad);
  vec3 pale = vec3(1.0, 0.93, 0.95), deep = vec3(0.98, 0.58, 0.72);
  vec3 col = mix(pale, deep, SAT(0.12 + 0.55 * pow(1.0 - edge, 0.0) * (1.0 - edge) * 0.0 + 0.4 * (1.0 - smoothstep(0.0, 1.0, edge * 1.1 - 0.15)) + 0.25 * hash11(sd * 3.1)));
  col = mix(col, vec3(1.0, 0.97, 0.98), smoothstep(0.55, 1.0, edge) * 0.55);              // pale petal rims
  col *= 0.9 + 0.1 * sin(a * 5.0 * 2.0 + sd * 9.0) * (1.0 - edge);                          // petal creases
  col = mix(col, vec3(0.82, 0.16, 0.38), smoothstep(R * 0.34, R * 0.02, r) * 0.85);       // magenta heart
  float st = 0.0;
  for (int i = 0; i < 7; i++) { float t = float(i) * 0.8976 + sd * 5.0; vec2 q = vec2(cos(t), sin(t)) * R * (0.22 + 0.1 * hash11(sd + float(i))); st = max(st, smoothstep(R * 0.055, R * 0.02, length(p - q))); }
  col = mix(col, vec3(1.0, 0.88, 0.4), st);                                                 // stamens
  col *= tint * (0.52 + 0.62 * lit);
  return vec4(col, c);
}
// A canopy of blossoms over a soft shaded base. m = canopy mask (>0 inside, soft), lit = lighting 0..1, cell = flower spacing.
vec4 blossomMass(vec2 uv, float m, float lit, float cell, float R, float seed, vec3 tint, vec3 shadowCol, vec3 litCol) {
  if (m < -0.06) return vec4(0.0);
  float baseA = smoothstep(-0.02, 0.1, m);
  vec3 baseCol = mix(shadowCol, litCol, lit);
  vec4 res = vec4(baseCol * (0.8 + 0.2 * fbm(uv * 60.0 + seed, 3)), baseA);
  vec2 g = uv / cell, ci = floor(g);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ci + vec2(float(i), float(j));
    vec2 h = hash22(c + seed), h2 = hash22(c * 1.7 + seed + 9.0);
    float present = smoothstep(0.0, 0.2, m + 0.2 * (h2.x - 0.5) * 1.6);
    if (h2.y > present) continue;
    vec2 ctr = (c + 0.15 + 0.7 * h) * cell;
    float rr = R * (0.7 + 0.6 * h2.x);
    vec2 q = rot2(h.x * 6.28) * (uv - ctr);
    q.y *= 0.82 + 0.3 * h.y;                                                                 // flowers seen at slightly different angles
    float inner = smoothstep(0.7, 0.0, m);                                                  // deep inside the canopy is shaded, the rim catches light
    vec4 f = blossom(q, rr, hash12(c + seed), SAT((lit + 0.25 * (h.y - 0.5)) * (0.5 + 0.5 * inner) + 0.1), tint * (0.94 + 0.12 * h2.x));
    res = over(f, res);
  }
  return res;
}

// Layered pine (stacked wedges), local coords with the base at the origin and total height h. snow = 0..1 cover.
vec4 pine(vec2 p, float h, vec3 dark, vec3 light, float snow, float seed) {
  float y = p.y / h; if (y < -0.02 || y > 1.04) return vec4(0.0);
  float d = sdBox(p - vec2(0.0, h * 0.05), vec2(h * 0.018, h * 0.05));
  vec3 col = vec3(0.16, 0.1, 0.08); float a = cov(d);
  for (int i = 0; i < 6; i++) {
    float fi = float(i); float y0 = (0.08 + fi * 0.145) * h, th = 0.27 * h, w = (0.33 - fi * 0.049) * h * (0.92 + 0.16 * hash11(seed + fi));
    vec2 q = p - vec2(0.0, y0);
    float hw = w * (1.0 - q.y / th);
    float dd = max(abs(q.x) - hw + 0.015 * h * sin(q.y * 60.0 / h + fi), max(-q.y, q.y - th));
    float c = cov(dd);
    if (c <= 0.0) continue;
    float side = SAT(0.5 - q.x / max(hw, 1e-3) * 0.5);
    vec3 cc = mix(dark, light, side * (0.5 + 0.5 * (q.y / th)));
    cc *= 0.85 + 0.2 * noise(p * 400.0 / h);
    float sn = smoothstep(0.25, 0.45, q.y / th + 0.25 * (noise(vec2(q.x * 30.0 / h, fi + seed)) - 0.2) + snow * 0.4 - 0.05) * snow;
    cc = mix(cc, mix(vec3(0.82, 0.9, 1.0), vec3(1.0), side), SAT(sn));
    col = mix(col, cc, c); a = max(a, c);
  }
  return vec4(col, a);
}
// Palm: curved trunk with ringed bark and drooping fronds (leaflet-hatched), base at the origin, height h, lean in x.
vec4 palm(vec2 p, float h, float lean, vec3 frondDark, vec3 frondLight, float seed) {
  float th; vec2 top = vec2(lean * h, h);
  vec2 ctrl = vec2(lean * h * 0.15, h * 0.5);
  float td = 1e9; vec2 prev = vec2(0.0);
  for (int i = 1; i <= 8; i++) { float t = float(i) / 8.0; vec2 q = (1.0 - t) * (1.0 - t) * vec2(0.0) + 2.0 * (1.0 - t) * t * ctrl + t * t * top; td = min(td, sdTaper(p, prev, q, h * 0.028 * (1.0 - 0.4 * float(i - 1) / 8.0), h * 0.028 * (1.0 - 0.4 * t), th)); prev = q; }
  vec4 r = vec4(0.0);
  if (td < aaw()) { vec3 b = mix(vec3(0.22, 0.13, 0.08), vec3(0.55, 0.38, 0.22), SAT(0.5 - (p.x - lean * p.y) / (h * 0.05))); b *= 0.8 + 0.25 * step(0.5, fract(p.y / h * 26.0)); r = vec4(b, cov(td)); }
  for (int f = 0; f < 9; f++) {
    float ff = float(f); float ang = 3.14159 * (ff / 8.0) + 0.1 * hash11(seed + ff);   // fan from left (π) over the top to right (0)
    float len = h * (0.38 + 0.12 * hash11(seed + ff * 2.0));
    vec2 dir = vec2(cos(ang), sin(ang)); vec2 pp = top; float fd = 1e9; float lf = 0.0;
    for (int s = 1; s <= 10; s++) { float t = float(s) / 10.0; vec2 q = top + dir * len * t + vec2(0.0, -len * 0.9 * t * t * (0.35 + 0.65 * abs(dir.x))); float wid = h * 0.02 * (1.0 - t * 0.9);
      float dd = sdTaper(p, pp, q, wid * 0.4, wid * 0.4, th); if (dd < fd) { fd = dd; lf = t; } pp = q; }
    float leaf = fd - h * 0.012 * (1.0 - lf);
    if (leaf < aaw()) { vec3 c = mix(frondDark, frondLight, SAT(0.5 + 0.5 * dir.x * (1.0 - lf) + 0.25 * sin(lf * 30.0 + ff))); r = over(vec4(c, cov(leaf)), r); }
  }
  return r;
}
