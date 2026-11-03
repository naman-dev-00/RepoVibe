// Enchanted forest at night: SDF trunks receding along a clearing with a stream, glowing plants and mushrooms,
// moonlit teal haze, fireflies (3D points), and dark foreground foliage framing the view.
const vec3 MOON = normalize(vec3(0.15, 0.55, 1.0));
vec3 RO; mat3 CAM;

float pathX(float z) { return 2.5 * sin(z * 0.035) + 1.2 * sin(z * 0.011 + 1.0); }
float groundH(vec2 p) { return 0.6 * fbm(p * 0.08, 4) + 0.25 * noise(p * 0.5) - 0.6 * exp(-pow((p.x - pathX(p.y)) * 0.32, 2.0)); }

// trees: one per 7x7 cell, jittered, none inside the clearing
float trees(vec3 p, out float id) {
  vec2 cell = floor(p.xz / 7.0);
  float d = 1e9; id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j);
    vec2 h = hash22(c);
    vec2 base = (c + 0.2 + 0.6 * h) * 7.0;
    if (abs(base.x - pathX(base.y)) < 5.5) continue;
    float r = 0.45 + 0.6 * h.x;
    vec3 q = p - vec3(base.x, 0.0, base.y);
    q.xz += vec2(sin(q.y * 0.15 + h.y * 6.0), cos(q.y * 0.12 + h.x * 6.0)) * 0.6; // gentle bend
    float rr = r * (1.0 + 0.6 * exp(-q.y * 1.2)) + 0.08 * noise(vec2(q.y * 2.0, atan(q.z, q.x) * 3.0)); // root flare + bark
    float t = max(length(q.xz) - rr, q.y - 40.0);
    if (t < d) { d = t; id = h.x + h.y * 7.0; }
  }
  return d;
}
float map(vec3 p, out float mat, out float id) {
  float g = p.y - groundH(p.xz);
  float t = trees(p, id);
  mat = t < g ? 1.0 : 0.0;
  return min(g, t);
}
float mapD(vec3 p) { float m, i; return map(p, m, i); }
vec3 nrm(vec3 p) { vec2 e = vec2(0.02, 0.0); return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx))); }

vec3 sky(vec3 rd) {
  vec3 col = mix(vec3(0.02, 0.06, 0.09), vec3(0.01, 0.02, 0.05), SAT(rd.y * 1.5));
  float m = SAT(dot(rd, MOON));
  col += vec3(0.55, 0.8, 0.95) * pow(m, 900.0) * 6.0 + vec3(0.2, 0.45, 0.55) * pow(m, 12.0) * 0.5;
  vec3 s = floor(rd * 700.0);
  col += step(0.997, hash12(s.xy + s.z)) * SAT(rd.y * 3.0) * 0.6;
  return col;
}
vec3 shade(vec3 p, vec3 rd, float mat, float id, float t) {
  vec3 n = nrm(p);
  vec3 col;
  float moon = SAT(dot(n, MOON)) * 0.35;
  if (mat > 0.5) {
    vec3 bark = mix(vec3(0.03, 0.04, 0.04), vec3(0.07, 0.08, 0.07), noise(p.xz * 3.0 + p.y));
    float moss = smoothstep(0.2, 0.8, n.y + 0.4 * noise(p.xz * 2.0 + p.y * 0.5)) * smoothstep(6.0, 0.0, p.y);
    col = mix(bark, vec3(0.05, 0.18, 0.12), moss) * (0.25 + moon * 2.0);
    // bioluminescent lichen rings on some trunks
    float lich = smoothstep(0.75, 0.95, noise(vec2(p.y * 1.5, atan(p.z, p.x) * 4.0 + id))) * step(0.5, fract(id * 3.1)) * smoothstep(8.0, 1.0, p.y);
    col += lich * vec3(0.1, 0.9, 0.7) * 0.9;
  } else {
    vec3 grass = mix(vec3(0.02, 0.06, 0.04), vec3(0.04, 0.12, 0.08), fbm(p.xz * 0.6, 3) * 0.5 + 0.5);
    col = grass * (0.3 + moon * 2.0);
    // glowing plants scattered on the ground, denser near the stream banks
    float bank = exp(-pow((p.x - pathX(p.z)) * 0.4 - 1.3, 2.0)) + exp(-pow((p.x - pathX(p.z)) * 0.4 + 1.3, 2.0));
    vec2 gc = floor(p.xz * 1.6); vec2 gf = fract(p.xz * 1.6) - 0.5;
    float pl = step(0.82 - 0.25 * bank, hash12(gc)) * smoothstep(0.32, 0.0, length(gf + (hash22(gc) - 0.5) * 0.4));
    vec3 pc = mix(vec3(0.1, 0.85, 0.75), vec3(0.4, 0.55, 1.0), hash12(gc + 3.0));
    col += pl * pc * 1.6;
  }
  return col;
}
vec3 fog(vec3 col, vec3 rd, float t, vec3 p) {
  float m = SAT(dot(rd, MOON));
  vec3 fc = mix(vec3(0.02, 0.07, 0.09), vec3(0.12, 0.3, 0.36), pow(m, 6.0));
  float hf = exp(-max(p.y, 0.0) * 0.12);
  float a = 1.0 - exp(-t * (0.006 + 0.012 * hf) * (0.8 + 0.4 * noise(p.xz * 0.05 + p.y * 0.1)));
  return mix(col, fc, a);
}
vec3 trace(vec3 ro, vec3 rd, out float tHit) {
  float t = 0.2, mat = 0.0, id = 0.0;
  for (int i = 0; i < 200; i++) {
    vec3 p = ro + rd * t;
    float d = map(p, mat, id);
    if (d < 0.002 * t) break;
    t += d * 0.75;
    if (t > 260.0) break;
  }
  tHit = t;
  if (t > 260.0) return fog(sky(rd), rd, 260.0, ro + rd * 260.0);
  vec3 p = ro + rd * t;
  return fog(shade(p, rd, mat, id, t), rd, t, p);
}
vec3 render(vec2 uv) {
  RO = vec3(pathX(0.0) + 0.3, 1.7, 0.0);
  vec3 ta = vec3(pathX(60.0), 4.5, 60.0);
  CAM = camera(RO, ta, 0.0);
  vec3 rd = CAM * normalize(vec3(uv, 1.25));
  float t;
  vec3 col = trace(RO, rd, t);
  vec3 p = RO + rd * t;
  // stream: reflective water in the clearing
  float tw = rd.y < 0.0 ? (-0.35 - RO.y) / rd.y : 1e9;
  vec3 pw = RO + rd * tw;
  if (tw < t && abs(pw.x - pathX(pw.z)) < 1.6) {
    vec3 n = normalize(vec3(noise(pw.xz * 2.0) * 0.06, 1.0, noise(pw.xz * 2.0 + 4.0) * 0.06));
    float t2; vec3 rc = trace(pw + vec3(0, 0.05, 0), reflect(rd, n), t2);
    col = fog(mix(vec3(0.0, 0.02, 0.03), rc, 0.75), rd, tw, pw);
    t = tw;
  }
  // fireflies: 3D points projected to the screen, occluded by the scene depth
  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec3 fp = vec3(pathX(4.0 + fi * 0.9) + (hash11(fi) - 0.5) * 9.0, 0.6 + hash11(fi + 7.0) * 4.5, 4.0 + fi * 0.9 + hash11(fi + 3.0) * 6.0);
    vec3 v = fp - RO;
    float vz = dot(v, CAM[2]);
    if (vz < 0.5 || vz > t) continue;
    vec2 sp = vec2(dot(v, CAM[0]), dot(v, CAM[1])) / vz * 1.25;
    float d = length(uv - sp) * vz;
    vec3 fc = mix(vec3(1.0, 0.85, 0.35), vec3(0.5, 1.0, 0.7), hash11(fi + 11.0));
    col += fc * (0.002 / (d * d + 0.0004)) * exp(-vz * 0.02) * 0.25;
  }
  // moon shafts: soft beams through the haze
  float beams = pow(SAT(noise(vec2(uv.x * 9.0 - uv.y * 4.0, 2.0)) * 0.5 + 0.5), 4.0) * SAT(uv.y + 0.3);
  col += vec3(0.25, 0.5, 0.55) * beams * 0.12;
  // foreground: dark leaf clusters hanging from the top corners (closest depth layer), smooth ellipses
  float leaves = 0.0;
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float side = fi < 13.0 ? -1.0 : 1.0;
    vec2 c = vec2(side * (0.62 + 0.3 * hash11(fi)), 0.32 + 0.3 * hash11(fi + 4.0));
    float a = (hash11(fi + 8.0) - 0.5) * 2.4 + side * 0.6;
    vec2 q = uv - c; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
    leaves = max(leaves, smoothstep(1.0, 0.92, length(q / vec2(0.16, 0.05))));
  }
  float rim = 0.0; // faint moonlit edge on the leaves
  col = mix(col, vec3(0.006, 0.02, 0.016), leaves * 0.95);
  return col * 1.15;
}
