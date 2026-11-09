// @lib2d
// @lib3d
// @sprites kelpA:520x1200, kelpB:420x1000, fan:640x700, jelly:520x720, fishA:320x160, fishB:300x150, turtle:760x520, manta:1200x700, whale:1500x560, bubble:128x128
// Ocean Depths — a living underwater kingdom (RepoVibe immersive world). The sea life sprites (jellyfish, fish, turtle, manta, whale) are
// real raymarched 3D geometry (signed-distance models with materials, subsurface, caustic lighting and ambient occlusion) rendered to
// transparent sprites; the environment layers are painted 2.5D art. Honest label: not real-time 3D. uLayer: 1 far (water column, seabed, sunken ruins) · 2 mid (reef,
// kelp forest) · 3 near (rock and coral frame) · 4 front (sharp foreground kelp/fan coral) · 5 god rays · 10+ sprites.
const float SEA = -0.30; // seabed horizon

vec3 waterCol(vec2 uv) {
  float y = SAT(0.5 - uv.y);                          // 0 at the surface, 1 at the bottom
  vec3 col = mix(vec3(0.20, 0.78, 0.78), vec3(0.04, 0.36, 0.55), smoothstep(0.0, 0.5, y));
  col = mix(col, vec3(0.01, 0.07, 0.22), smoothstep(0.4, 1.05, y));
  col += vec3(0.3, 0.9, 0.7) * exp(-pow((uv.x + 0.1) * 1.8, 2.0)) * exp(-y * 3.0) * 0.35; // brighter column under the sun
  return col;
}
float caustic(vec2 p) {
  float v = 0.0; vec2 q = p;
  for (int i = 0; i < 3; i++) { q = rot2(0.9) * q * 1.6 + vec2(0.0, 0.0); v += abs(sin(q.x * 6.0 + noise(q * 3.0) * 4.0) * sin(q.y * 6.0 + noise(q * 2.0 + 5.0) * 4.0)); }
  return pow(SAT(1.0 - v / 3.0 * 1.2), 3.0);
}
float seabedY(float x) { return SEA - 0.03 + 0.05 * fbm(vec2(x * 2.5, 1.0), 4) - 0.08 * exp(-pow((x - 0.1) * 1.6, 2.0)); }
vec3 farScene(vec2 uv) {
  vec3 col = waterCol(uv);
  // distant sunken ruins: a broken colonnade and arch, hazed into the blue
  float haz = 0.9;
  float cols = 1e9;
  for (int i = 0; i < 4; i++) { float fi = float(i); float cx = -0.30 + fi * 0.085, h = 0.16 + 0.05 * hash11(fi * 3.0) - 0.07 * step(2.5, fi); cols = min(cols, sdBox(uv - vec2(cx, SEA + h * 0.5), vec2(0.014, h * 0.5))); }
  float arch = max(sdEll(uv - vec2(-0.07, SEA + 0.16), vec2(0.075, 0.075)), -(uv.y - (SEA + 0.12) - 0.0) * 0.0);
  arch = max(abs(sdEll(uv - vec2(-0.07, SEA + 0.12), vec2(0.07, 0.07))) - 0.012, -(uv.y - (SEA + 0.12)) * -1.0 - 0.0 * 0.0);
  arch = max(abs(length((uv - vec2(-0.07, SEA + 0.1)) * vec2(1.0, 1.0)) - 0.07) - 0.011, -(uv.y - (SEA + 0.1)));
  float ruin = min(cols, arch);
  col = mix(col, mix(vec3(0.05, 0.2, 0.34), vec3(0.28, 0.58, 0.66), SAT((uv.y - SEA) * 5.0)), cov(ruin) * haz);
  // seabed
  float sb = seabedY(uv.x);
  if (uv.y < sb) {
    float d = sb - uv.y;
    vec3 sand = mix(vec3(0.16, 0.36, 0.42), vec3(0.02, 0.08, 0.2), SAT(d * 3.0));
    sand += vec3(0.5, 0.9, 0.8) * caustic(uv * 2.2 + vec2(0.0, 1.0)) * 0.3 * exp(-d * 5.0);
    col = sand;
  }
  return col;
}
vec4 farLayer(vec2 uv) { return vec4(farScene(uv), 1.0); }

// branching coral: radial staghorn (capsules) with polyp dots
vec4 staghorn(vec2 p, vec2 base, float sc, float seed, vec3 c1, vec3 c2) {
  float d = 1e9, th; float ang0 = 1.5708;
  for (int i = 0; i < 9; i++) {
    float fi = float(i); float a = ang0 + (hash11(seed + fi) - 0.5) * 2.2;
    vec2 e = base + vec2(cos(a), sin(a)) * sc * (0.6 + 0.5 * hash11(seed + 7.0 + fi));
    vec2 m = (base + e) * 0.5 + vec2(0.0, 0.0);
    d = min(d, sdTaper(p, base, e, 0.012 * sc * 6.0, 0.006 * sc * 6.0, th));
    float a2 = a + (hash11(seed + 20.0 + fi) - 0.5) * 1.4;
    vec2 e2 = e + vec2(cos(a2), sin(a2)) * sc * 0.4;
    d = min(d, sdTaper(p, e, e2, 0.006 * sc * 6.0, 0.002 * sc * 6.0, th));
    vec2 e3 = m + vec2(cos(a - 0.9), sin(a - 0.9)) * sc * 0.3;
    d = min(d, sdTaper(p, m, e3, 0.005 * sc * 6.0, 0.002 * sc * 6.0, th));
  }
  if (d > aaw()) return vec4(0.0);
  vec3 col = mix(c1, c2, SAT((p.y - base.y) / (sc * 1.2)));
  col *= 0.8 + 0.3 * noise(p * 300.0);
  col = mix(col, vec3(1.0, 0.92, 0.8), 0.25 * smoothstep(0.7, 0.9, noise(p * 220.0) * 0.5 + 0.5));
  return vec4(col, cov(d));
}
vec4 brainCoral(vec2 p, vec2 c, vec2 r, vec3 col) {
  float d = sdEll(p - c, r); d = max(d, -(p.y - c.y) - r.y * 0.1);
  if (d > aaw()) return vec4(0.0);
  float ridge = abs(sin((fbm(p * 60.0, 3) * 7.0 + (p.x - c.x) * 40.0))); 
  vec3 cc = col * (0.6 + 0.5 * ridge) * (0.7 + 0.5 * SAT(1.0 - length((p - c) / r)));
  return vec4(cc, cov(d));
}
vec4 kelpField(vec2 p, float zoneL, float zoneR, float density, float seed, float hmax) {
  vec4 r = vec4(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = float(i); float bx = mix(zoneL, zoneR, hash11(seed + fi * 3.1)); float h = hmax * (0.6 + 0.4 * hash11(seed + fi));
    float y = (p.y - (seabedY(bx) + 0.01)) / h; if (y < 0.0 || y > 1.0) continue;
    float x = bx + 0.025 * sin(y * 6.0 + fi * 2.0) * y;
    float w = 0.008 * (1.0 - 0.6 * y);
    float dd = abs(p.x - x) - w;
    vec3 c = mix(vec3(0.06, 0.25, 0.14), vec3(0.4, 0.66, 0.2), SAT(y + 0.3 * (p.x - x) / w));
    r = over(vec4(c * (0.7 + 0.3 * y), cov(dd)), r);
  }
  return r;
}
vec4 midLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  float sb = seabedY(uv.x) - 0.02;
  r = over(kelpField(uv, -0.85, 0.85, 1.0, 3.0, 0.5), r); r = over(kelpField(uv, -0.3, 0.4, 1.0, 9.0, 0.42), r);
  r = over(staghorn(uv, vec2(-0.56, sb + 0.03), 0.24, 1.0, vec3(0.7, 0.2, 0.2), vec3(1.0, 0.55, 0.3)), r);
  r = over(staghorn(uv, vec2(-0.36, sb + 0.01), 0.17, 4.0, vec3(0.45, 0.15, 0.45), vec3(0.95, 0.45, 0.8)), r);
  r = over(staghorn(uv, vec2(0.46, sb + 0.02), 0.26, 8.0, vec3(0.55, 0.12, 0.35), vec3(1.0, 0.5, 0.45)), r);
  r = over(staghorn(uv, vec2(0.70, sb), 0.18, 12.0, vec3(0.2, 0.35, 0.65), vec3(0.5, 0.8, 1.0)), r);
  r = over(brainCoral(uv, vec2(0.12, sb + 0.012), vec2(0.1, 0.06), vec3(0.95, 0.7, 0.35)), r);
  r = over(brainCoral(uv, vec2(-0.2, sb + 0.015), vec2(0.07, 0.045), vec3(0.8, 0.4, 0.55)), r);
  // seabed in front of the reef (mid sand mound)
  float mound = SEA - 0.1 + 0.06 * fbm(vec2(uv.x * 3.0, 6.0), 4);
  if (uv.y < mound) r = over(vec4(mix(vec3(0.2, 0.44, 0.46), vec3(0.03, 0.12, 0.22), SAT((mound - uv.y) * 4.0)) + vec3(0.5, 0.9, 0.8) * caustic(uv * 3.0) * 0.3, 1.0), r);
  return r;
}
vec4 nearLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // rock arches framing both lower corners
  float rl = -0.5 + 0.2 * exp(-pow((uv.x + 0.88) * 2.4, 2.0)) + 0.06 * fbm(vec2(uv.x * 6.0, 2.0), 4);
  float rr = -0.5 + 0.17 * exp(-pow((uv.x - 0.88) * 2.6, 2.0)) + 0.05 * fbm(vec2(uv.x * 6.0, 9.0), 4);
  float rock = max(rl, rr);
  if (uv.y < rock) {
    float n = fbm(uv * 14.0, 5);
    vec3 c = mix(vec3(0.07, 0.12, 0.18), vec3(0.26, 0.34, 0.38), SAT(0.5 + n + (rock - uv.y) * -3.0));
    c = mix(c, vec3(0.2, 0.5, 0.35), SAT(n * 1.6 - 0.35) * 0.5);        // algae
    r = vec4(c, 1.0);
  }
  r = over(staghorn(uv, vec2(-0.74, rl - 0.02), 0.26, 2.0, vec3(0.8, 0.28, 0.25), vec3(1.0, 0.7, 0.4)), r);
  r = over(brainCoral(uv, vec2(0.78, rr - 0.01), vec2(0.12, 0.08), vec3(0.9, 0.5, 0.6)), r);
  return r;
}
vec4 frontLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // sharp sea grass along the bottom
  for (int k = 0; k < 3; k++) {
    float fk = float(k); float sc = 40.0 + fk * 22.0; float id = floor(uv.x * sc + fk * 7.0), fx = fract(uv.x * sc + fk * 7.0) - 0.5;
    float h = hash11(id + fk * 31.0); float top = -0.5 + 0.04 + 0.1 * h;
    float t = SAT((uv.y + 0.5) / (top + 0.5));
    float w = 0.42 * (1.0 - t);
    float lean = sin(t * 3.0 + h * 6.0) * 0.18 * t;
    float inside = step(uv.y, top) * smoothstep(w, w - 0.08, abs(fx - lean));
    vec3 c = mix(vec3(0.04, 0.2, 0.1), vec3(0.5, 0.82, 0.3), t) * (0.7 + 0.15 * fk);
    r = over(vec4(c, inside), r);
  }
  return r;
}
vec4 raysLayer(vec2 uv) {
  float x = uv.x + uv.y * 0.35;
  float beams = pow(0.5 + 0.5 * sin(x * 14.0 + 2.0 * sin(x * 5.0) + 1.0), 4.0) * (0.6 + 0.4 * noise(vec2(x * 8.0, 3.0)));
  float fade = SAT(0.5 + uv.y * 1.1);
  return vec4(vec3(0.7, 1.0, 0.9), SAT(beams * fade * 0.55));
}

// ---- sprites
vec4 kelpStrand(vec2 uv, float seed, float n) {
  float y = uv.y + 0.5; float amp = 0.12;
  float cx = amp * sin(y * 5.0 + seed) * y; float d = 1e9; vec4 r = vec4(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i); float off = (fi - 1.0) * 0.12 * (1.0 + 0.3 * hash11(seed + fi));
    float cxi = cx * (0.7 + 0.5 * hash11(seed + 4.0 + fi)) + off;
    float w = 0.022 * (1.0 - 0.75 * y);
    float dd = abs(uv.x - cxi * 0.6) - w;
    float rib = smoothstep(0.003, 0.0, abs(uv.x - cxi * 0.6)) * 0.3;
    vec3 c = mix(vec3(0.07, 0.3, 0.12), vec3(0.5, 0.72, 0.22), SAT(y * 0.9 + 0.5 * (uv.x - cxi * 0.6) / max(w, 1e-3) * 0.4));
    r = over(vec4(c * (0.75 + 0.35 * y) + rib, cov(dd) * smoothstep(1.0, 0.92, y)), r);
  }
  return r;
}
vec4 fanCoral(vec2 uv) {
  vec2 p = uv + vec2(0.0, 0.42); float a = atan(p.x, p.y); float r = length(p);
  float spread = 1.15; if (abs(a) > spread || r > 0.78) return vec4(0.0);
  float lat = abs(sin(a * 22.0 + fbm(p * 6.0, 3) * 3.0));
  float rad = abs(sin(r * 60.0 + fbm(p * 8.0, 3) * 4.0));
  float web = smoothstep(0.82, 0.55, min(lat, rad) * 1.0 + 0.0);
  web = max(web, smoothstep(0.1, 0.03, abs(fract(a * 7.0 / 1.15 * 0.5) - 0.5) * r));
  float edge = smoothstep(0.78, 0.7, r) * smoothstep(spread, spread - 0.1, abs(a));
  float al = SAT(web * 0.9) * edge * smoothstep(0.02, 0.1, r);
  vec3 c = mix(vec3(0.7, 0.1, 0.35), vec3(1.0, 0.45, 0.55), SAT(r * 1.1));
  return vec4(c * (0.8 + 0.3 * lat), al);
}
vec4 jelly(vec2 uv) {
  vec2 p = uv - vec2(0.0, 0.12);
  float bell = max(length(p * vec2(1.0, 1.15)) - 0.28, p.y * -1.0 - 0.02) ;
  bell = max(length(p * vec2(1.0, 1.1)) - 0.3, -p.y - 0.01 + 0.02 * sin(p.x * 30.0));
  vec4 r = vec4(0.0);
  float a = cov(bell);
  float rim = smoothstep(0.045, 0.0, abs(length(p * vec2(1.0, 1.1)) - 0.3));
  vec3 c = mix(vec3(0.55, 0.35, 0.95), vec3(1.0, 0.7, 0.98), SAT(p.y * 2.0 + 0.4));
  c += vec3(0.4, 0.5, 0.6) * rim * 0.5; c += vec3(0.5, 0.8, 1.0) * smoothstep(0.1, 0.0, length(p - vec2(-0.08, 0.1)) - 0.04) * 0.6;
  r = vec4(c, a * (0.4 + 0.5 * SAT(rim * 2.0 + length(p) * 1.5)));
  // tentacles
  for (int i = 0; i < 7; i++) {
    float fi = float(i); float bx = (fi - 3.0) * 0.07; float y = -(uv.y + 0.34); 
    float x = bx + 0.03 * sin(y * 14.0 + fi * 1.7) * SAT(y * 2.0); 
    float d = abs(uv.x - x) - 0.006 * (1.0 - 0.5 * SAT(y * 1.4)); 
    float m = step(0.0, y) * step(y, 0.52 - 0.04 * fi * 0.0);
    r = over(vec4(mix(vec3(1.0, 0.6, 0.95), vec3(0.6, 0.4, 1.0), SAT(y * 1.6)), cov(d) * m * 0.65 * (1.0 - SAT(y * 1.6 - 0.2))), r);
  }
  return r;
}
vec4 fish(vec2 uv, float k) {
  vec2 p = uv * vec2(1.0, 1.0); p.x *= 1.0;
  float body = sdEll(p - vec2(0.02, 0.0), vec2(0.34, 0.15 + 0.03 * k));
  float tailx = p.x + 0.34; float tail = max(abs(p.y) - (0.02 + 0.2 * SAT(-tailx)) * 1.0, max(tailx - 0.0, -tailx - 0.2));
  float dorsal = sdEll(p - vec2(0.0, 0.16), vec2(0.15, 0.06));
  float d = min(body, min(tail, dorsal));
  if (d > aaw()) return vec4(0.0);
  vec3 c = k < 0.5 ? mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.9, 0.5), SAT(0.5 - p.y * 3.0)) : mix(vec3(0.2, 0.6, 1.0), vec3(0.9, 1.0, 1.0), SAT(0.5 - p.y * 3.0));
  c *= 0.85 + 0.25 * sin(p.x * 30.0) * step(k, 0.5);
  c = mix(c, vec3(0.05), smoothstep(0.016, 0.0, length(p - vec2(0.22, 0.04)) - 0.025));
  return vec4(c, cov(d));
}
vec4 turtle(vec2 uv) {
  vec2 p = uv * vec2(1.2, 1.0) * 1.0;
  float shell = sdEll(p, vec2(0.28, 0.2));
  float head = sdEll(p - vec2(0.34, 0.02), vec2(0.08, 0.06));
  float fl1 = sdEll(rot2(0.6) * (p - vec2(0.12, 0.2)), vec2(0.17, 0.045)), fl2 = sdEll(rot2(-0.6) * (p - vec2(0.12, -0.2)), vec2(0.17, 0.045));
  float fl3 = sdEll(rot2(-0.3) * (p - vec2(-0.2, 0.19)), vec2(0.1, 0.035)), fl4 = sdEll(rot2(0.3) * (p - vec2(-0.2, -0.19)), vec2(0.1, 0.035));
  float tail = sdTaper2(p, vec2(-0.27, 0.0), vec2(-0.37, 0.01), 0.02, 0.004);
  float d = min(min(shell, head), min(min(fl1, fl2), min(min(fl3, fl4), tail)));
  if (d > aaw()) return vec4(0.0);
  vec3 c = mix(vec3(0.3, 0.38, 0.15), vec3(0.7, 0.55, 0.2), SAT(0.5 + p.y * 2.0));
  float plates = smoothstep(0.03, 0.0, abs(fract(length(p * vec2(1.0, 1.3)) * 11.0) - 0.5) - 0.42) ;
  vec2 hp = p * 11.0; float hex = abs(fract(hp.x + 0.5 * floor(hp.y)) - 0.5);
  c *= 0.75 + 0.35 * smoothstep(0.1, 0.35, hex * 2.0);
  vec3 sk = vec3(0.45, 0.55, 0.3) * (0.8 + 0.2 * noise(p * 80.0));
  c = shell < 0.0 ? c : sk;
  return vec4(c, cov(d));
}
vec4 manta(vec2 uv) {
  vec2 p = uv * vec2(1.0, 1.0);
  float wing = sdEll(p - vec2(0.0, 0.0), vec2(0.55, 0.19 - 0.12 * smoothstep(0.0, 0.5, abs(p.x))));
  wing = max(wing, -(p.x * p.x * 0.7 + 0.0) + p.y * 0.0 + 0.0 * p.y - 0.001 * 0.0);
  float body = sdEll(p, vec2(0.52, 0.1 * (1.0 - abs(p.x))));
  float tail = sdTaper2(p, vec2(-0.3, 0.0), vec2(-0.58, 0.0), 0.012, 0.002);
  float cep = sdEll(p - vec2(0.33, 0.0), vec2(0.08, 0.12));
  float d = min(min(body, tail), cep);
  d = min(d, sdEll(p, vec2(0.5 * 1.0, 0.18 * (1.0 - smoothstep(0.0, 0.5, abs(p.x))))));
  if (d > aaw()) return vec4(0.0);
  vec3 c = mix(vec3(0.07, 0.1, 0.18), vec3(0.2, 0.3, 0.42), SAT(0.5 - p.y * 3.0 + 0.2 * noise(p * 20.0)));
  c = mix(c, vec3(0.9, 0.95, 1.0), smoothstep(0.06, 0.0, abs(p.x - 0.0) - 0.0) * 0.0 + 0.15 * smoothstep(0.012, 0.0, length(p - vec2(0.18, 0.04)) - 0.012));
  return vec4(c, cov(d));
}
vec4 whale(vec2 uv) {
  vec2 p = uv;
  float body = sdEll(p - vec2(0.0, 0.0), vec2(0.62, 0.17)) ;
  float tail = sdTaper2(p, vec2(-0.5, 0.0), vec2(-0.74, 0.1), 0.05, 0.01);
  float fluke = sdEll(rot2(0.5) * (p - vec2(-0.78, 0.17)), vec2(0.04, 0.1));
  float fluke2 = sdEll(rot2(-0.5) * (p - vec2(-0.78, 0.04)), vec2(0.04, 0.1));
  float fin = sdEll(rot2(0.7) * (p - vec2(0.1, -0.17)), vec2(0.16, 0.035));
  float d = min(min(body, tail), min(min(fluke, fluke2), fin));
  if (d > aaw()) return vec4(0.0);
  vec3 c = mix(vec3(0.1, 0.16, 0.26), vec3(0.42, 0.52, 0.62), SAT(0.5 - p.y * 3.0));
  c = mix(c, vec3(0.75, 0.82, 0.88), smoothstep(0.0, 0.1, -p.y - 0.06) * 0.8 * step(p.x, 0.5));
  return vec4(c, cov(d) * 0.92);
}
vec4 bubble(vec2 uv) {
  float r = length(uv); if (r > 0.45) return vec4(0.0);
  float rim = smoothstep(0.07, 0.0, abs(r - 0.4));
  float hi = smoothstep(0.1, 0.0, length(uv - vec2(-0.14, 0.15)) - 0.05);
  return vec4(vec3(0.8, 0.97, 1.0) * (0.55 + 0.45 * hi + rim * 0.4), SAT(rim * 0.8 + hi + 0.1 * smoothstep(0.4, 0.0, r)) * cov(r - 0.43));
}


// ================= raymarched 3D sea life (uLayer 13..18) =================
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float scales(vec2 q) { vec2 g = q * vec2(1.0, 1.4); vec2 i = floor(g), f = fract(g); float d = 1.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 r = o + hash22(i + o) * 0.6 + 0.2 - f; d = min(d, dot(r, r)); } return sqrt(d); }
float hexEdge(vec2 q) { vec2 r = vec2(1.0, 1.732); vec2 a = mod(q, r) - r * 0.5, b = mod(q - r * 0.5, r) - r * 0.5; vec2 gv = dot(a, a) < dot(b, b) ? a : b; return max(dot(abs(gv), normalize(vec2(1.0, 1.732))), abs(gv.x)); }
float mapTurtle(vec3 p) {
  p = rotX(0.55) * (rotY(-0.25) * p); gP = p; float d;
  float he = hexEdge(p.xz * 6.5); float groove = smoothstep(0.38, 0.5, he);
  float shell = sdE(p - vec3(0.0, 0.07, 0.0), vec3(0.56, 0.2, 0.44)); shell = max(shell, -(p.y + 0.02)); shell += groove * 0.012 - 0.006;
  d = shell; gM = 1.0;
  float skirt = sdE(p - vec3(0.0, 0.0, 0.0), vec3(0.58, 0.05, 0.46)); if (skirt < d) { d = skirt; gM = 4.0; }
  float head = sdE(p - vec3(0.7, 0.03, 0.0), vec3(0.19, 0.11, 0.11)); head = smin(head, sdCap3(p, vec3(0.5, 0.03, 0.0), vec3(0.62, 0.04, 0.0), 0.09, 0.08), 0.05);
  head = max(head, -sdE(p - vec3(0.78, 0.02, 0.0), vec3(0.08, 0.025, 0.12)) + 0.0 * 0.0) ; if (head < d) { d = head; gM = 2.0; }
  float eye = sdSph(p - vec3(0.72, 0.09, 0.085), 0.026); float eye2 = sdSph(p - vec3(0.72, 0.09, -0.085), 0.026); eye = min(eye, eye2); if (eye < d) { d = eye; gM = 3.0; }
  for (int s = 0; s < 2; s++) { float sg = s == 0 ? 1.0 : -1.0;
    vec3 q = p; q.z *= sg;
    float fl = sdCap3(vec3(q.x, q.y * 2.6, q.z), vec3(0.3, -0.02, 0.32), vec3(0.62, -0.18, 0.88), 0.11, 0.028);
    float rf = sdCap3(vec3(q.x, q.y * 2.6, q.z), vec3(-0.34, -0.02, 0.28), vec3(-0.5, -0.06, 0.5), 0.07, 0.025);
    fl = min(fl, rf); if (fl < d) { d = fl; gM = 2.0; } }
  float tl = sdCap3(p, vec3(-0.55, 0.0, 0.0), vec3(-0.72, -0.02, 0.0), 0.04, 0.01); if (tl < d) { d = tl; gM = 2.0; }
  return d * 0.8;
}
float mapManta(vec3 p) {
  p = vec3(p.x, -p.y, p.z); p = rotX(-0.25) * (rotY(0.0) * p);   // seen from below: pale belly toward the viewer
  float ax = abs(p.z); gP = p;
  float zle = 0.30 - 0.42 * pow(ax / 0.95, 2.2), zte = -0.12 - 0.26 * pow(ax / 0.95, 1.3); // heading is +x; span is z
  float outline = max(max(p.x - zle, zte - p.x), ax - 0.95);
  float th = (0.085 * (1.0 - pow(ax / 0.95, 1.4)) * (1.0 - 0.4 * smoothstep(zte, zle, p.x)) + 0.006) * pow(SAT(-outline / 0.16), 0.6) + 0.003;
  float droop = -0.22 * pow(ax, 1.6) + 0.04 * sin(ax * 5.0);
  float d = max(outline * 0.7, abs(p.y - droop) - th); gM = 1.0;
  float body = sdE(p - vec3(0.0, droop * 0.2, 0.0), vec3(0.42, 0.09, 0.18)); d = smin(d, body, 0.06);
  float lobes = min(sdCap3(p, vec3(0.34, -0.02, 0.07), vec3(0.62, -0.06, 0.1), 0.035, 0.018), sdCap3(p, vec3(0.34, -0.02, -0.07), vec3(0.62, -0.06, -0.1), 0.035, 0.018)); d = smin(d, lobes, 0.03);
  float tail = sdCap3(p, vec3(-0.4, 0.0, 0.0), vec3(-1.35, -0.03, 0.0), 0.028, 0.004); d = smin(d, tail, 0.04);
  float gill = abs(p.z) - 0.0; return d * 0.8;
}
float mapWhale(vec3 p) {
  p = rotX(0.28) * (rotY(0.12) * p); gP = p;
  float d = sdCap3(p, vec3(-0.62, 0.02, 0.0), vec3(-0.3, 0.0, 0.0), 0.04, 0.15);
  d = smin(d, sdCap3(p, vec3(-0.3, 0.0, 0.0), vec3(0.15, -0.02, 0.0), 0.15, 0.235), 0.1);
  d = smin(d, sdCap3(p, vec3(0.15, -0.02, 0.0), vec3(0.62, -0.03, 0.0), 0.235, 0.15), 0.1);
  d = smin(d, sdE(p - vec3(0.62, -0.06, 0.0), vec3(0.2, 0.12, 0.16)), 0.06); gM = 1.0;
  float belly = sin(p.z * 70.0) * 0.005 * smoothstep(-0.02, -0.14, p.y) * step(p.x, 0.55); d += belly;
  d = smin(d, sdE(p - vec3(-0.12, 0.215, 0.0), vec3(0.06, 0.04, 0.02)), 0.04);
  for (int s = 0; s < 2; s++) { float sg = s == 0 ? 1.0 : -1.0; vec3 q = p; q.z *= sg;
    float fin = sdCap3(vec3(q.x, q.y * 3.0, q.z), vec3(0.25, -0.35, 0.16), vec3(-0.12, -0.9, 0.78), 0.07, 0.022); if (fin < d) { d = fin; gM = 2.0; }
    float fl = sdE(rotZ(0.0) * (q - vec3(-0.84, 0.05, 0.18)) * vec3(1.0, 3.5, 1.0), vec3(0.09, 0.2, 0.27)); if (fl < d) { d = fl; gM = 2.0; } }
  float stalk = sdCap3(p, vec3(-0.7, 0.03, 0.0), vec3(-0.84, 0.05, 0.0), 0.03, 0.015); d = smin(d, stalk, 0.03);
  return d * 0.75;
}
float mapJelly(vec3 p) {
  p = rotX(0.12) * p; gP = p;
  vec3 b = p - vec3(0.0, 0.2, 0.0);
  float rim = 1.0 + 0.04 * sin(atan(b.z, b.x) * 16.0);
  float bell = sdE(b, vec3(0.36 * rim, 0.27, 0.36 * rim)); float inner = sdE(b - vec3(0.0, -0.03, 0.0), vec3(0.31, 0.235, 0.31));
  float shell = max(max(bell, -inner), -(b.y + 0.02) - 0.0);
  float d = shell; gM = 1.0;
  float core = sdE(b - vec3(0.0, 0.03, 0.0), vec3(0.11, 0.08, 0.11)); if (core < d) { d = core; gM = 3.0; }
  for (int i = 0; i < 4; i++) { float a = float(i) * 1.5708 + 0.4; float yy = p.y + 0.05;
    vec2 off = vec2(cos(a), sin(a)) * 0.07 + vec2(sin(yy * 9.0 + a), cos(yy * 8.0 + a)) * 0.03 * (-yy);
    float arm = sdCap3(p, vec3(off.x, 0.04, off.y), vec3(off.x * 1.4, -0.6, off.y * 1.4 + 0.05), 0.045, 0.012); if (arm < d) { d = arm; gM = 2.0; } }
  for (int i = 0; i < 9; i++) { float a = float(i) * 0.698 + 0.2; vec3 s0 = vec3(cos(a), 0.0, sin(a)) * 0.3 + vec3(0.0, 0.06, 0.0);
    float yy = -(p.y - 0.06);
    vec3 s1 = s0 + vec3(sin(a * 3.0 + yy * 7.0) * 0.04, -0.62 - 0.14 * hash11(float(i)), cos(a * 2.0 + yy * 6.0) * 0.04);
    float t = sdCap3(p, s0, s1, 0.01, 0.003); if (t < d) { d = t; gM = 2.0; } }
  return d * 0.8;
}
float mapFish(vec3 p, float k) {
  p = rotX(0.18) * rotY(-0.2) * p; gP = p;
  float tailx = -0.32;
  float body = sdE(p, vec3(0.34, 0.15 + 0.04 * k, 0.085));
  float tail = sdE(rotZ(0.0) * (p - vec3(-0.42, 0.0, 0.0)) * vec3(1.0, 1.0, 5.0), vec3(0.14, 0.2 + 0.05 * k, 0.12)); tail = max(tail, -(p.x + 0.6));
  float peduncle = sdCap3(p, vec3(-0.22, 0.0, 0.0), vec3(-0.34, 0.0, 0.0), 0.07, 0.04); body = smin(body, peduncle, 0.05);
  float dorsal = sdE((p - vec3(-0.02, 0.17 + 0.03 * k, 0.0)) * vec3(1.0, 1.0, 5.0), vec3(0.22, 0.09, 0.14));
  float pect = sdE(rotZ(-0.5) * (p - vec3(0.06, -0.06, 0.08)) * vec3(1.0, 1.0, 4.0), vec3(0.1, 0.04, 0.1));
  float d = smin(body, dorsal, 0.03); gM = 1.0; if (tail < d) { d = tail; gM = 2.0; } float pf = pect; if (pf < d) { d = pf; gM = 2.0; }
  float eye = sdSph(p - vec3(0.24, 0.05, 0.072), 0.032); if (eye < d) { d = eye; gM = 3.0; }
  d += (gM == 1.0 ? 0.0022 * (1.0 - smoothstep(0.0, 0.5, scales(p.xy * 22.0))) : 0.0);
  return d * 0.8;
}
float map3(vec3 p) {
  int k = uLayer - 10;
  if (k == 3) return mapJelly(p); if (k == 4) return mapFish(p, 0.0); if (k == 5) return mapFish(p, 1.0);
  if (k == 6) return mapTurtle(p); if (k == 7) return mapManta(p); return mapWhale(p);
}
vec3 underLight(vec3 p, vec3 n, vec3 rd, vec3 alb, float rough, float sss, float ao, vec3 amb) {
  vec3 L = normalize(vec3(0.25, 0.9, -0.45));
  float diff = SAT(dot(n, L) * 0.7 + 0.3); float cs = 0.75 + 0.5 * caustic(p.xz * 1.4 + p.y * 0.5);
  float fr = pow(1.0 - SAT(dot(n, -rd)), 3.0);
  vec3 H = normalize(L - rd); float spec = pow(SAT(dot(n, H)), mix(64.0, 8.0, rough)) * (1.0 - rough) * 0.5;
  vec3 c = alb * (amb * (0.22 + 0.3 * (n.y * 0.5 + 0.5)) + vec3(0.9, 1.0, 0.85) * diff * cs * 0.9) * ao;
  c += vec3(0.55, 0.9, 1.0) * fr * (0.12 + sss * 0.2) + vec3(0.8, 1.0, 0.95) * spec;
  c += alb * sss * pow(SAT(dot(rd, L) * 0.5 + 0.5), 2.0) * 0.4;
  return c;
}
vec3 shade3(vec3 pw, vec3 n, vec3 rd, float m, float ao, out float alpha) {
  int k = uLayer - 10; alpha = 1.0; vec3 p = gP; vec3 amb = vec3(0.34, 0.62, 0.78);
  if (k == 6) { // turtle
    if (m == 1.0) { float he = hexEdge(p.xz * 6.5); float g = smoothstep(0.38, 0.5, he);
      vec3 base = mix(vec3(0.62, 0.42, 0.14), vec3(0.2, 0.17, 0.07), g); base = mix(base, vec3(0.28, 0.42, 0.2), 0.45 * SAT(fbm(p.xz * 14.0, 4) + 0.2) * (1.0 - g * 0.0));
      base *= 0.8 + 0.35 * noise(p.xz * 60.0); return underLight(pw, n, rd, base, 0.4, 0.3, ao * (0.55 + 0.45 * (1.0 - g)), amb); }
    if (m == 3.0) return vec3(0.02);
    if (m == 4.0) return underLight(pw, n, rd, vec3(0.5, 0.52, 0.3), 0.7, 0.4, ao, amb);
    vec3 sk = mix(vec3(0.38, 0.5, 0.27), vec3(0.62, 0.62, 0.38), SAT(0.5 - p.y * 4.0)); sk *= 0.85 + 0.25 * noise(p.xz * 40.0); sk = mix(sk, vec3(0.8, 0.7, 0.35), step(0.78, noise(p.xz * 30.0 + 5.0) * 0.5 + 0.5) * 0.7);
    return underLight(pw, n, rd, sk, 0.6, 0.5, ao, amb); }
  if (k == 7) { // manta (seen from below): pale belly with dark gill slits and spots, dark rim
    float ax = abs(p.z);
    vec3 belly = mix(vec3(0.82, 0.88, 0.92), vec3(0.28, 0.36, 0.46), SAT(ax / 0.8 + 0.4 * smoothstep(0.0, 0.5, p.x - 0.1)) * 0.9);
    belly = mix(belly, vec3(0.06, 0.09, 0.14), smoothstep(0.012, 0.0, abs(fract(p.x * 14.0) - 0.5) - 0.42) * step(abs(p.z), 0.2) * step(p.x, 0.3) * step(-0.2, p.x) * 0.9);
    belly = mix(belly, vec3(0.05, 0.08, 0.12), smoothstep(0.03, 0.0, length(vec2(fract(p.x * 9.0 + 0.3) - 0.5, fract(p.z * 9.0) - 0.5) * 0.11) - 0.012) * step(0.05, ax) * 0.8);
    return underLight(pw, n, rd, belly, 0.45, 0.35, ao, amb); }
  if (k == 8) { // whale
    float up = SAT(n.y * 1.2 + 0.4); vec3 skin = mix(vec3(0.78, 0.84, 0.88), vec3(0.12, 0.19, 0.28), up);
    if (m == 2.0) skin = mix(vec3(0.9, 0.93, 0.95), vec3(0.18, 0.25, 0.34), SAT(n.y + 0.5));
    skin *= 0.88 + 0.2 * fbm(p.xz * 14.0 + p.y * 4.0, 4);
    skin = mix(skin, vec3(0.8, 0.78, 0.7), smoothstep(0.62, 0.8, noise(p.xy * 38.0 + 2.0) * 0.5 + 0.5) * smoothstep(0.3, 0.9, p.x + 0.5) * up * 0.7);
    return underLight(pw, n, rd, skin, 0.5, 0.45, ao, amb); }
  if (k == 3) { // jelly: translucent bell with glowing canals
    float fr = pow(1.0 - SAT(dot(n, -rd)), 2.0); float a = atan(p.z, p.x - 0.0);
    vec3 col = mix(vec3(0.5, 0.25, 0.95), vec3(1.0, 0.55, 0.95), SAT((p.y + 0.1) * 2.0));
    float canal = smoothstep(0.12, 0.0, abs(sin(a * 8.0)) - 0.88) * (0.4 + 0.6 * SAT(1.0 - length(p.xz) * 2.6));
    vec3 glow = vec3(0.4, 0.95, 1.0) * canal * 0.9;
    if (m == 3.0) { alpha = 0.95; return vec3(1.0, 0.75, 0.4) * (0.7 + 0.3 * ao); }
    if (m == 2.0) { alpha = 0.7; return mix(vec3(0.8, 0.5, 1.0), vec3(1.0, 0.8, 1.0), SAT(-p.y)) * (0.7 + 0.5 * fr) + vec3(0.2, 0.4, 0.5) * 0.2; }
    alpha = SAT(0.62 + fr * 0.3 + canal * 0.2);
    return col * (0.7 + 0.4 * ao) * (0.8 + 0.4 * SAT(n.y)) + glow * 0.8 + vec3(0.8, 0.7, 1.0) * fr * 0.3; }
  // fish
  float kk = float(k - 4);
  if (m == 3.0) return vec3(0.02, 0.02, 0.03) + 0.5 * pow(SAT(dot(n, normalize(vec3(0.3, 0.8, -0.5)))), 24.0);
  vec3 body;
  if (kk < 0.5) { body = vec3(1.0, 0.42, 0.06); float band = smoothstep(0.02, 0.0, abs(abs(p.x - 0.0) - 0.0 - 0.08) - 0.045) + smoothstep(0.02, 0.0, abs(p.x + 0.2) - 0.035) + smoothstep(0.02, 0.0, abs(p.x - 0.22) - 0.03);
    body = mix(body, vec3(0.97, 0.96, 0.92), SAT(band)); body = mix(body, vec3(0.06, 0.03, 0.02), SAT(smoothstep(0.02, 0.0, abs(abs(p.x - 0.08) - 0.045 - 0.04 + 0.0) - 0.008) * 0.0)); }
  else { body = mix(vec3(0.08, 0.28, 0.9), vec3(0.2, 0.55, 1.0), SAT(0.5 - p.y * 3.0)); body = mix(body, vec3(0.04, 0.05, 0.12), smoothstep(0.02, 0.0, length((p.xy - vec2(0.02, 0.02)) * vec2(1.0, 1.4)) - 0.1) * 0.0 + smoothstep(0.05, 0.0, abs(p.y - 0.03 + 0.15 * (p.x - 0.0) * 0.0) - 0.02 - 0.0) * step(p.x, 0.2) * 0.6); body = mix(body, vec3(1.0, 0.85, 0.1), step(p.x, -0.3) * 0.9); }
  if (m == 2.0) body = kk < 0.5 ? vec3(1.0, 0.5, 0.1) : vec3(1.0, 0.85, 0.15);
  float sc = scales(p.xy * 22.0); body *= 0.8 + 0.3 * smoothstep(0.1, 0.5, sc);
  return underLight(pw, n, rd, body, 0.35, 0.3, ao, amb);
}

vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k >= 3 && k <= 8) { r = sprite3d(uv, vec3(0.0, 0.0, -3.0), vec3(0.0), (k == 4 || k == 5) ? 4.1 : (k == 3 ? 2.6 : 2.2)); gAlpha = r.a; return r.rgb; }
    if (k == 0) r = kelpStrand(uv, 1.0, 0.0);
    else if (k == 1) r = kelpStrand(uv, 7.0, 1.0);
    else if (k == 2) r = fanCoral(uv);
    else if (k == 3) r = jelly(uv);
    else if (k == 4) r = fish(uv, 0.0);
    else if (k == 5) r = fish(uv, 1.0);
    else if (k == 6) r = turtle(uv);
    else if (k == 7) r = manta(uv);
    else if (k == 8) r = whale(uv);
    else r = bubble(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  r = farLayer(uv); r = over(midLayer(uv), r); r = over(nearLayer(uv), r); r = over(frontLayer(uv), r);
  vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.35;
  return r.rgb;
}
