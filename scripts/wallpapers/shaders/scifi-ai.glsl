// @sprites panel:760x1000, ring:900x900, crystal:620x760, probe:560x380
// Futuristic sci-fi AI hall: sculpted pale ribs receding along a dark corridor, lit from within by cyan light
// strips; glossy reflective floor; a holographic core (rings + sphere) at the vanishing point; volumetric
// ceiling beams; holographic UI panels close to the camera.
// Depth layers (uLayer): 1 far = floor, walls, ribs beyond D2, hologram; 2 mid = ribs D1..D2; 3 near = ribs < D1;
// 4 front = holographic UI panels (2D); 5 rays = ceiling light beams (2D). 0 = flat composite of everything.
// Ribs sit every 6 m at z = 6n + 3, so the slab boundaries (D1, D2) fall between ribs and nothing is sliced.
const float D1 = 18.0, D2 = 42.0;
bool gAll = false; // true while tracing reflections: every slab is visible
bool ribInLayer(float id) {
  if (uLayer == 0 || gAll) return true;
  float z = id * 6.0 + 3.0;
  if (uLayer == 1) return z >= D2;
  if (uLayer == 2) return z >= D1 && z < D2;
  return z < D1;
}
bool shellInLayer() { return uLayer == 0 || uLayer == 1 || gAll; }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xy) - t.x, p.z); return length(q) - t.y; }
float map(vec3 p, out float mat) {
  mat = 0.0;
  float d = 1e9;
  if (shellInLayer()) {
    d = p.y;                                   // floor
    float wall = 9.6 - abs(p.x);               // side walls with light slots
    if (wall < d) { d = wall; mat = 2.0; }
    float ceil = 11.5 - p.y;                   // dark ceiling
    if (ceil < d) { d = ceil; mat = 3.0; }
  }
  float id = floor(p.z / 6.0);
  vec3 q = p; q.z = p.z - id * 6.0 - 3.0;
  float arch;
  if (ribInLayer(id)) {
    arch = abs(length(vec2(q.x * 0.98, q.y - 2.0)) - 9.0) - 0.35;
    arch = max(arch, abs(q.z) - 0.45);
    arch = max(arch, -p.y);
    // domain repetition: never step further than the neighbouring cells' ribs (z-only lower bound)
    arch = min(arch, 3.0 - abs(q.z) + 2.5);
  } else {
    // skipped cell: a safe lower bound to the next cell's rib (along z only), so the march cannot jump over it
    arch = 3.0 - abs(q.z) + 2.5;
  }
  if (arch < d) { d = arch; mat = 1.0; }
  return d;
}
float mapD(vec3 p) { float m; return map(p, m); }
vec3 nrm(vec3 p) { vec2 e = vec2(0.003, 0.0); return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy), mapD(p + e.yxy) - mapD(p - e.yxy), mapD(p + e.yyx) - mapD(p - e.yyx))); }
vec3 hologram(vec3 ro, vec3 rd, float tmax) {
  // emissive rings + core sphere at z = 70, accumulated as glow (cheap volumetric look)
  vec3 acc = vec3(0.0);
  vec3 c = vec3(0.0, 4.6, 70.0);
  for (int i = 0; i < 72; i++) {
    float t = 40.0 + float(i) * 0.8;
    if (t > tmax) break;
    vec3 p = ro + rd * t - c;
    float r1 = sdTorus(p, vec2(3.4, 0.05));
    vec3 p2 = vec3(p.x, p.y * 0.8 - p.z * 0.6, p.y * 0.6 + p.z * 0.8);
    float r2 = sdTorus(p2, vec2(2.5, 0.04));
    vec3 p3 = vec3(p.x * 0.7 + p.z * 0.7, p.y, -p.x * 0.7 + p.z * 0.7);
    float r3 = sdTorus(p3.yxz, vec2(4.3, 0.03));
    float core = length(p) - 1.15;
    acc += vec3(0.2, 0.85, 1.0) * (0.012 / (0.02 + r1 * r1 * 3.0) + 0.009 / (0.02 + r2 * r2 * 3.0) + 0.007 / (0.02 + r3 * r3 * 3.0)) * 0.6;
    acc += vec3(0.65, 0.95, 1.0) * 0.08 / (0.05 + max(core, 0.0) * max(core, 0.0) * 3.0) * 0.5;
    // faint violet data halo for colour contrast
    acc += vec3(0.55, 0.35, 1.0) * 0.004 / (0.05 + abs(length(p.xy) - 5.6) * 2.0) * step(abs(p.z), 0.6);
  }
  return acc;
}
vec3 shade(vec3 p, vec3 rd, float mat) {
  vec3 n = nrm(p);
  vec3 key = normalize(vec3(-0.3, 0.8, -0.2));
  float ao = SAT(0.4 + 0.6 * SAT(mapD(p + n * 0.6) / 0.6));
  // light from the hologram at the end of the hall
  vec3 hl = vec3(0.0, 4.6, 70.0) - p; float hd = length(hl);
  vec3 holo = vec3(0.3, 0.85, 1.0) * SAT(dot(n, hl / hd)) * 40.0 / (hd * hd * 0.06 + 40.0);
  vec3 col;
  if (mat == 1.0) {
    col = vec3(0.74, 0.79, 0.86) * (0.16 + 0.42 * SAT(dot(n, key))) * ao * ao + holo * 0.35;
    // cyan light strips along both inner edges of each rib, pulsing brighter at intervals
    vec3 q = p; q.z = p.z - floor(p.z / 6.0) * 6.0 - 3.0;
    float edge = smoothstep(0.08, 0.0, abs(abs(q.z) - 0.4)) * step(0.5, n.z * n.z + n.x * n.x);
    float seg = 0.6 + 0.4 * step(0.5, fract(atan(p.y - 2.0, p.x) * 3.0));
    col += vec3(0.1, 0.8, 1.0) * edge * 3.2 * seg;
  } else if (mat == 2.0) {
    float slot = smoothstep(0.03, 0.0, abs(fract(p.y * 0.25) - 0.5) - 0.015) * step(0.3, fract(p.z * 0.08));
    col = vec3(0.07, 0.09, 0.13) * ao + holo * 0.2 + vec3(0.2, 0.8, 1.0) * slot * 1.6;
  } else if (mat == 3.0) {
    // ceiling: dark panels with a central light seam
    col = vec3(0.05, 0.07, 0.1) + vec3(0.3, 0.85, 1.0) * smoothstep(0.25, 0.0, abs(p.x)) * 0.9;
  } else {
    col = vec3(0.12, 0.15, 0.2) * (0.5 + 0.4 * SAT(dot(n, key))) * ao + holo * 0.2;
    // floor grid inlay and a glowing centre line toward the core
    vec2 g = abs(fract(p.xz * 0.25) - 0.5);
    col = mix(col, vec3(0.25, 0.8, 1.0), smoothstep(0.015, 0.0, min(g.x, g.y)) * 0.55);
    col += vec3(0.3, 0.9, 1.0) * smoothstep(0.12, 0.0, abs(p.x)) * 1.2;
  }
  return col;
}
vec3 haze(vec3 col, vec3 rd, float t) {
  vec3 hc = mix(vec3(0.05, 0.1, 0.16), vec3(0.1, 0.22, 0.32), SAT(rd.y * 3.0 + 0.2));
  return mix(col, hc, 1.0 - exp(-t * 0.0085));
}
vec3 trace(vec3 ro, vec3 rd, out float tHit, out float mat) {
  float t = 0.1; mat = 0.0;
  for (int i = 0; i < 200; i++) { float d = map(ro + rd * t, mat); if (d < 0.001 * t) break; t += d; if (t > 200.0) break; }
  tHit = t;
  if (t > 200.0) return haze(vec3(0.06, 0.1, 0.15), rd, t);
  return haze(shade(ro + rd * t, rd, mat), rd, t);
}
// Front layer: translucent holographic UI panels hovering at the scene window's edges (2D, alpha).
vec4 foreground(vec2 uv) {
  vec4 acc = vec4(0.0);
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec2 c = vec2(side * 0.77, 0.06), hs = vec2(0.085, 0.16);
    vec2 q = uv - c; q.x += q.y * side * 0.18; // slight perspective skew toward the hall
    vec2 dq = abs(q) - hs; float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - 0.01;
    vec3 cy = vec3(0.35, 0.9, 1.0);
    float halo = exp(-max(sd, 0.0) * 34.0) * 0.4 * step(0.0, sd);
    float inside = smoothstep(0.003, -0.003, sd);
    float frame = smoothstep(0.004, 0.0, abs(sd)) ;
    vec2 l = (q + hs) / (2.0 * hs); // 0..1 inside the panel
    float rows = step(abs(fract(l.y * 9.0) - 0.5), 0.12) * step(0.12, l.x) * step(l.x, 0.18 + 0.7 * hash11(floor(l.y * 9.0) + side * 3.0));
    float bars = step(0.72, l.y) * step(abs(fract(l.x * 7.0) - 0.5), 0.3) * step(1.0 - l.y, 0.28 * hash11(floor(l.x * 7.0) + side));
    float ring = smoothstep(0.004, 0.0, abs(length((l - vec2(0.78, 0.2)) * hs * 2.0) - 0.035));
    float scan = 0.5 + 0.5 * step(0.5, fract(uv.y * 160.0));
    float a = inside * (0.24 + 0.7 * max(rows, max(bars, ring))) * scan + frame;
    vec3 col = cy * (0.5 + 1.2 * max(frame, max(rows, max(bars, ring))));
    a = max(a, halo);
    acc = vec4(mix(acc.rgb, col, SAT(a)), max(acc.a, SAT(a)));
  }
  return acc;
}
// Light layer: volumetric beams falling from the ceiling seam and slots (alpha).
vec4 rays(vec2 uv) {
  float a = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i), side = mod(fi, 2.0) < 1.0 ? -1.0 : 1.0;
    float x0 = side * (0.18 + 0.13 * floor(fi / 2.0));
    float x = x0 + (0.5 - uv.y) * side * 0.35; // beams fan outward toward the floor
    float w = 0.025 + 0.02 * hash11(fi + 3.0) + (0.5 - uv.y) * 0.04;
    a += exp(-pow((uv.x - x) / w, 2.0)) * SAT(0.55 - uv.y) * SAT(uv.y + 0.45) * (0.35 + 0.35 * hash11(fi + 7.0));
  }
  return vec4(vec3(0.7, 0.95, 1.0), SAT(a * 2.2));
}
// ---- Sprites (uLayer >= 10): holographic UI panel, rotating holo ring, data crystal and a probe drone (transparency).
vec4 overC(vec4 a, vec4 b) { return vec4(mix(a.rgb, b.rgb, b.a), max(a.a, b.a)); }
vec4 holoPanel(vec2 uv) {
  float asp = uRes.x / uRes.y, aa = 1.5 / uRes.y;
  vec2 hs = vec2(0.44 * asp, 0.45);
  vec2 dq = abs(uv) - hs; float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - 0.02;
  vec3 cy = vec3(0.3, 0.9, 1.0);
  float frame = smoothstep(aa * 2.0, 0.0, abs(sd)), inside = step(sd, 0.0);
  vec2 l = (uv + hs) / (2.0 * hs);
  float rows = step(abs(fract(l.y * 12.0) - 0.5), 0.12) * step(0.1, l.x) * step(l.x, 0.16 + 0.55 * hash11(floor(l.y * 12.0)));
  float graph = smoothstep(0.012, 0.0, abs(l.y - (0.78 + 0.08 * sin(l.x * 18.0) * noise(vec2(l.x * 6.0, 1.0))))) * step(0.08, l.x) * step(l.x, 0.92);
  float ring = smoothstep(aa * 2.0, 0.0, abs(length((l - vec2(0.75, 0.3)) * hs * 2.0) - 0.07)) + smoothstep(aa * 2.0, 0.0, abs(length((l - vec2(0.75, 0.3)) * hs * 2.0) - 0.045)) * 0.6;
  float corner = step(0.86, max(abs(l.x - 0.5), abs(l.y - 0.5)) * 2.0) * frame;
  float scan = 0.6 + 0.4 * step(0.5, fract(uv.y * 170.0));
  float a = inside * (0.1 + 0.75 * max(rows, max(graph, ring))) * scan + frame * 0.85 + corner * 0.2;
  vec3 col = cy * (0.55 + 1.5 * max(frame, max(rows, max(graph, ring))));
  vec2 fe = 0.5 * vec2(asp, 1.0) - abs(uv);
  float halo = exp(-max(sd, 0.0) * 40.0) * 0.4 * step(0.0, sd) * SAT(min(fe.x, fe.y) * 20.0);
  return vec4(col, SAT(max(a, halo)));
}
vec4 holoRing(vec2 uv) {
  float r = length(uv), a = atan(uv.y, uv.x), aa = 1.5 / uRes.y;
  vec3 cy = vec3(0.3, 0.92, 1.0);
  float r1 = smoothstep(aa * 3.0, 0.0, abs(r - 0.42) - 0.006);
  float ticks = step(0.5, fract(a * 36.0 / 6.2832)) * smoothstep(aa * 2.0, 0.0, abs(r - 0.39) - 0.012);
  float r2 = smoothstep(aa * 2.0, 0.0, abs(r - 0.33) - 0.003) * step(0.25, fract(a / 6.2832 * 3.0));
  float arc = smoothstep(aa * 3.0, 0.0, abs(r - 0.27) - 0.015) * step(fract(a / 6.2832 + 0.1), 0.35);
  float dots = step(0.82, hash11(floor(a * 60.0 / 6.2832))) * smoothstep(aa * 2.0, 0.0, abs(r - 0.46) - 0.005);
  float core = exp(-r * r / 0.004);
  float glow = exp(-pow((r - 0.42) / 0.05, 2.0)) * 0.35;
  float al = max(max(r1, ticks * 0.8), max(max(r2, arc * 0.7), max(dots, core))) ;
  vec3 col = cy * (0.8 + 1.6 * al) + vec3(1.0) * core;
  return vec4(col, SAT(max(al, glow)));
}
vec4 crystal(vec2 uv) {
  // a floating octahedral data crystal: facets with flat shading, bright edges, inner glow
  vec2 p = uv * vec2(1.0, 0.85); float aa = 1.5 / uRes.y;
  float d = abs(p.x) / 0.24 + abs(p.y) / 0.36;           // diamond silhouette (fits the frame)
  float inside = smoothstep(1.0 + aa * 6.0, 1.0 - aa * 6.0, d);
  if (inside <= 0.0) { float g = exp(-max(d - 1.0, 0.0) * 6.0) * 0.35; return vec4(vec3(0.3, 0.9, 1.0) * 1.4, g); }
  float facet = (p.x > 0.0 ? 1.0 : 0.0) + (p.y > 0.0 ? 2.0 : 0.0);
  vec3 base = vec3(0.04, 0.2, 0.3) + vec3(0.1, 0.35, 0.45) * (facet == 3.0 ? 1.0 : facet == 1.0 ? 0.6 : facet == 2.0 ? 0.45 : 0.2);
  float edge = smoothstep(aa * 6.0, 0.0, abs(d - 1.0)) + smoothstep(0.006, 0.0, abs(p.x)) * 0.8 + smoothstep(0.006, 0.0, abs(p.y)) * 0.6;
  float inner = exp(-dot(p, p) / 0.012);
  float lines = step(0.92, fract((p.y + abs(p.x) * 0.5) * 22.0)) * 0.25;
  return vec4(base + vec3(0.5, 0.95, 1.0) * (edge * 1.5 + inner * 1.2 + lines), inside);
}
vec4 probe(vec2 uv) {
  float asp = uRes.x / uRes.y, aa = 1.5 / uRes.y;
  vec2 q = uv;
  float body = smoothstep(aa * 2.0, -aa * 2.0, length(q / vec2(1.0, 0.62)) - 0.2);
  float wingL = smoothstep(aa * 2.0, -aa * 2.0, length(max(abs(q - vec2(-0.32, 0.0)) - vec2(0.11, 0.018), 0.0)) - 0.01);
  float wingR = smoothstep(aa * 2.0, -aa * 2.0, length(max(abs(q - vec2(0.32, 0.0)) - vec2(0.11, 0.018), 0.0)) - 0.01);
  float shape = max(body, max(wingL, wingR));
  vec3 col = mix(vec3(0.12, 0.14, 0.18), vec3(0.75, 0.8, 0.88), SAT(q.y * 3.0 + 0.55));
  float eye = exp(-dot(q - vec2(0.0, -0.02), q - vec2(0.0, -0.02)) / 0.002);
  col += vec3(0.3, 0.95, 1.0) * eye * 2.5;
  float lights = exp(-dot(q - vec2(-0.43, 0.0), q - vec2(-0.43, 0.0)) / 0.0008) + exp(-dot(q - vec2(0.43, 0.0), q - vec2(0.43, 0.0)) / 0.0008);
  float glow = SAT(lights * 1.2 + eye * 0.5);
  return vec4(shape > 0.0 ? col : vec3(0.4, 0.95, 1.0) * 2.0, SAT(max(shape, glow)));
}
vec3 render(vec2 uv) {
  if (uLayer >= 10) {
    int k = uLayer - 10; vec4 r;
    if (k == 0) r = holoPanel(uv);
    else if (k == 1) r = holoRing(uv);
    else if (k == 2) r = crystal(uv);
    else r = probe(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 4) { vec4 f = foreground(uv); gAlpha = f.a; return f.rgb; }
  if (uLayer == 5) { vec4 r = rays(uv); gAlpha = r.a; return r.rgb; }
  vec3 ro = vec3(-1.2, 2.2, 0.0);
  vec3 rd = camera(ro, vec3(0.6, 3.8, 60.0), 0.0) * normalize(vec3(uv, 1.3));
  float t, mat;
  vec3 col = trace(ro, rd, t, mat);
  if (uLayer == 2 || uLayer == 3) {
    // rib-only slab: transparent where the ray escapes
    gAlpha = t < 200.0 ? 1.0 : 0.0;
    return gAlpha > 0.0 ? col : vec3(0.0);
  }
  if (mat == 0.0 && t < 200.0) {
    // glossy floor reflection of everything (all slabs)
    vec3 p = ro + rd * t;
    vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
    float t2, m2;
    gAll = true; vec3 rc = trace(p + vec3(0, 0.01, 0), rr, t2, m2); gAll = false;
    rc += hologram(p, rr, t2);
    float fres = 0.1 + 0.9 * pow(1.0 - SAT(dot(-rd, vec3(0, 1, 0))), 5.0);
    col = mix(col, rc, SAT(fres + 0.35));
  }
  col += hologram(ro, rd, t);
  if (uLayer == 0) {
    // floating data particles (animated at runtime in the layered version) + baked light
    vec2 g = floor(uv * vec2(90.0, 50.0));
    float sp = step(0.994, hash12(g)) * smoothstep(0.5, 0.0, length(fract(uv * vec2(90.0, 50.0)) - 0.5));
    col += vec3(0.3, 0.85, 1.0) * sp * 0.5;
    vec4 r = rays(uv); col += r.rgb * r.a * 0.3;
    vec4 f = foreground(uv); col = mix(col, f.rgb, f.a);
  }
  return col;
}
