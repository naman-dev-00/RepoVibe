// Futuristic sci-fi AI hall: white sculpted ribs receding along a corridor, glossy reflective floor, cyan light
// strips, a holographic core (rings + sphere) at the vanishing point, soft bright haze. Clean, minimal, elegant.
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xy) - t.x, p.z); return length(q) - t.y; }
float map(vec3 p, out float mat) {
  mat = 0.0;
  float floorD = p.y;
  // ribs: arches every 6 m
  vec3 q = p; q.z = mod(q.z, 6.0) - 3.0;
  float arch = abs(length(vec2(q.x, q.y - 2.0) * vec2(0.75, 1.0)) - 9.0) - 0.35;
  arch = max(arch, abs(q.z) - 0.45);
  arch = max(arch, -p.y + 0.0);
  float d = floorD;
  if (arch < d) { d = arch; mat = 1.0; }
  // side panels with light slots
  float wall = 9.6 - abs(p.x);
  if (wall < d) { d = wall; mat = 2.0; }
  return d;
}
float mapD(vec3 p) { float m; return map(p, m); }
vec3 nrm(vec3 p) { vec2 e = vec2(0.003, 0.0); return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx))); }
vec3 hologram(vec3 ro, vec3 rd, float tmax) {
  // emissive rings + core sphere at z = 70, accumulated as glow (cheap volumetric look)
  vec3 acc = vec3(0.0);
  vec3 c = vec3(0.0, 4.2, 70.0);
  for (int i = 0; i < 64; i++) {
    float t = 40.0 + float(i) * 0.9;
    if (t > tmax) break;
    vec3 p = ro + rd * t - c;
    float r1 = sdTorus(p, vec2(3.2, 0.04));
    vec3 p2 = vec3(p.x, p.y * 0.8 - p.z * 0.6, p.y * 0.6 + p.z * 0.8);
    float r2 = sdTorus(p2, vec2(2.4, 0.03));
    vec3 p3 = vec3(p.x * 0.7 + p.z * 0.7, p.y, -p.x * 0.7 + p.z * 0.7);
    float r3 = sdTorus(p3.yxz, vec2(4.0, 0.025));
    float core = length(p) - 1.1;
    acc += vec3(0.25, 0.85, 1.0) * (0.008 / (0.02 + r1 * r1 * 3.0) + 0.006 / (0.02 + r2 * r2 * 3.0) + 0.005 / (0.02 + r3 * r3 * 3.0)) * 0.6;
    acc += vec3(0.6, 0.95, 1.0) * 0.06 / (0.05 + max(core, 0.0) * max(core, 0.0) * 4.0) * 0.5;
  }
  return acc;
}
vec3 shade(vec3 p, vec3 rd, float mat) {
  vec3 n = nrm(p);
  vec3 key = normalize(vec3(-0.3, 0.8, -0.2));
  float ao = SAT(0.4 + 0.6 * SAT(mapD(p + n * 0.6) / 0.6));
  vec3 col;
  if (mat == 1.0) {
    col = vec3(0.9, 0.93, 0.97) * (0.35 + 0.65 * SAT(dot(n, key))) * ao * ao;
    // cyan light strip along the inner edge of each rib
    vec3 q = p; q.z = mod(q.z, 6.0) - 3.0;
    float edge = smoothstep(0.08, 0.0, abs(abs(q.z) - 0.4)) * step(0.5, n.z * n.z + n.x * n.x);
    col += vec3(0.1, 0.75, 1.0) * edge * 3.0;
  } else if (mat == 2.0) {
    float slot = smoothstep(0.06, 0.0, abs(fract(p.y * 0.25) - 0.5) - 0.42) * step(0.3, fract(p.z * 0.08));
    col = vec3(0.55, 0.62, 0.72) * 0.6 * ao + vec3(0.25, 0.8, 1.0) * slot * 1.4;
  } else {
    col = vec3(0.7, 0.76, 0.84) * (0.5 + 0.4 * SAT(dot(n, key))) * ao;
    // floor grid inlay
    vec2 g = abs(fract(p.xz * 0.25) - 0.5);
    col = mix(col, vec3(0.3, 0.8, 1.0), smoothstep(0.012, 0.0, min(g.x, g.y)) * 0.5);
  }
  return col;
}
vec3 haze(vec3 col, vec3 rd, float t) {
  vec3 hc = mix(vec3(0.72, 0.84, 0.95), vec3(0.6, 0.8, 1.0), SAT(rd.y * 3.0));
  return mix(col, hc, 1.0 - exp(-t * 0.0075));
}
vec3 trace(vec3 ro, vec3 rd, out float tHit, out float mat) {
  float t = 0.1; mat = 0.0;
  for (int i = 0; i < 180; i++) { float d = map(ro + rd * t, mat); if (d < 0.001 * t) break; t += d; if (t > 200.0) break; }
  tHit = t;
  if (t > 200.0) return haze(vec3(0.9, 0.95, 1.0), rd, t);
  return haze(shade(ro + rd * t, rd, mat), rd, t);
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(-1.2, 2.2, 0.0);
  vec3 rd = camera(ro, vec3(0.6, 3.6, 60.0), 0.0) * normalize(vec3(uv, 1.3));
  float t, mat;
  vec3 col = trace(ro, rd, t, mat);
  if (mat == 0.0 && t < 200.0) {
    // glossy floor reflection
    vec3 p = ro + rd * t;
    vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
    float t2, m2; vec3 rc = trace(p + vec3(0, 0.01, 0), rr, t2, m2);
    rc += hologram(p, rr, t2);
    float fres = 0.08 + 0.92 * pow(1.0 - SAT(dot(-rd, vec3(0, 1, 0))), 5.0);
    col = mix(col, rc, SAT(fres + 0.4));
  }
  col += hologram(ro, rd, t);
  // floating data particles
  vec2 g = floor(uv * vec2(90.0, 50.0));
  float sp = step(0.994, hash12(g)) * smoothstep(0.5, 0.0, length(fract(uv * vec2(90.0, 50.0)) - 0.5));
  col += vec3(0.3, 0.85, 1.0) * sp * 0.5;
  return col * 0.92;
}
