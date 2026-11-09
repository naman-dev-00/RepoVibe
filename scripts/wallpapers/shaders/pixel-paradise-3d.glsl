// @lib2d
// @sprites palmA:480x640, palmB:420x600, cloudA:640x240, cloudB:520x200, gull:160x96, cube:160x160, crab:200x120
// Pixel Paradise — a voxel island. Chunky pixel art built from quantised cells with oblique voxel shading (honest label: layered 2.5D
// pixel-art illustration, not real-time 3D). uLayer: 1 far (banded sky, sun, voxel clouds, sea) · 2 mid (the island with terraces, beach, huts) ·
// 3 near (foreground voxel rocks and sand) · 4 front (sharp pixel grass) · 5 sun glow · 10+ sprites (palms, clouds, gull, floating cubes, crab).
const float N = 72.0;                    // cells per scene height
vec2 q(vec2 uv) { return (floor(uv * N) + 0.5) / N; }
vec3 band(vec3 a, vec3 b, float t, float steps) { return mix(a, b, floor(SAT(t) * steps) / steps); }
const float SEA = -0.12;
vec3 skyP(vec2 uv) {
  vec2 c = q(uv); float t = (c.y - SEA) / 0.6;
  vec3 col = band(vec3(0.99, 0.82, 0.5), vec3(0.3, 0.62, 0.98), t, 7.0);
  float sd = length(c - vec2(0.45, 0.2)) ;
  col = mix(col, vec3(1.0, 0.95, 0.6), step(sd, 0.07)); col = mix(col, vec3(1.0, 0.8, 0.4), step(sd, 0.1) * 0.0 + 0.0);
  // voxel clouds: unions of boxes
  for (int i = 0; i < 4; i++) { float fi = float(i); vec2 p = c - vec2(-0.6 + fi * 0.42, 0.22 + 0.07 * hash11(fi * 3.0));
    float cl = min(sdBox(p, vec2(0.13, 0.025)), min(sdBox(p - vec2(-0.03, 0.03), vec2(0.07, 0.025)), sdBox(p - vec2(0.05, 0.05), vec2(0.045, 0.02))));
    col = mix(col, mix(vec3(1.0), vec3(0.82, 0.88, 1.0), step(0.0, -(p.y + 0.02))), step(cl, 0.0)); }
  return col;
}
vec3 seaP(vec2 uv) {
  vec2 c = q(uv); float d = SEA - c.y; float t = d / 0.4;
  vec3 col = band(vec3(0.03, 0.26, 0.56), vec3(0.015, 0.11, 0.4), t, 6.0);
  float wave = step(0.72, noise(vec2(c.x * 28.0 + floor(c.y * N) * 1.7, floor(c.y * N) * 0.9)) * 0.5 + 0.5);
  col += vec3(0.35, 0.5, 0.45) * wave * step(c.y, SEA - 0.01) * 0.3;
  col = mix(col, vec3(1.0, 0.9, 0.6), step(abs(c.x - 0.45), 0.03 + d * 0.15) * step(0.5, hash11(floor(c.y * N) * 5.0 + floor(c.x * N))) * 0.45 * step(d, 0.25));
  return col;
}
vec4 farLayer(vec2 uv) { return vec4(uv.y > SEA ? skyP(uv) : seaP(uv), 1.0); }
float islandTop(float x) { float t = x / 0.62; return SEA + 0.02 + 0.2 * pow(SAT(1.0 - t * t), 0.8) + 0.04 * floor(noise(vec2(floor(x * N * 0.5), 3.0)) * 3.0) / 3.0; }
vec4 midLayer(vec2 uv) {
  vec2 c = q(uv);
  float top = islandTop(c.x);
  float hasI = step(abs(c.x), 0.62);
  if (c.y > top || hasI < 0.5 || c.y < SEA - 0.0) return vec4(0.0);
  float depth = (top - c.y) * N;                       // cells below the surface
  vec3 grass = vec3(0.36, 0.78, 0.22), grass2 = vec3(0.24, 0.6, 0.18), dirt = vec3(0.55, 0.36, 0.2), dirt2 = vec3(0.4, 0.25, 0.14), sand = vec3(0.96, 0.84, 0.52);
  bool beach = top < SEA + 0.07;
  vec3 col;
  if (depth < 1.0) col = beach ? sand : grass;
  else if (depth < 3.0) col = beach ? sand * 0.9 : grass2;
  else col = mix(dirt, dirt2, step(0.5, hash12(floor(c * N))));
  // voxel edge shading: left faces lit, right faces dark; individual cube highlight
  float edge = step(abs(c.x), 0.62) * (1.0 - step(abs(c.x), 0.6));
  col *= 0.8 + 0.3 * step(c.x, 0.0) * 0.5 + 0.1 * hash12(floor(c * N) + 7.0);
  col = mix(col, vec3(0.8, 0.9, 1.0), step(c.y, SEA - 0.0) * 0.2);
  // waterline foam
  col = mix(col, vec3(1.0), step(abs(c.y - (SEA - 0.0)), 0.5 / N) * 0.9);
  return vec4(col, 1.0);
}
vec4 nearLayer(vec2 uv) {
  vec2 c = q(uv); vec4 r = vec4(0.0);
  float sandTop = -0.5 + 0.09 + 0.05 * floor(noise(vec2(floor(c.x * N * 0.3), 1.0)) * 3.0) / 3.0 + 0.03 * smoothstep(0.2, 0.9, abs(c.x));
  if (c.y < sandTop) { float d = (sandTop - c.y) * N; r = vec4(mix(vec3(0.74, 0.56, 0.3), vec3(0.5, 0.36, 0.2), SAT(d / 6.0)) * (0.92 + 0.08 * hash12(floor(c * N))), 1.0); }
  // voxel rocks at the corners
  for (int i = 0; i < 2; i++) { float side = i == 0 ? -1.0 : 1.0; vec2 p = c - vec2(side * 0.72, -0.4); float rock = min(sdBox(p, vec2(0.1, 0.06)), sdBox(p - vec2(0.02 * side, 0.07), vec2(0.06, 0.04)));
    if (rock < 0.0) { vec3 rc = mix(vec3(0.55, 0.58, 0.62), vec3(0.3, 0.32, 0.4), step(0.5, hash12(floor(c * N)))); rc *= 0.8 + 0.3 * step(p.y, 0.02) * 0.0 + 0.25 * step(0.05, p.y); r = vec4(rc, 1.0); } }
  return r;
}
vec4 frontLayer(vec2 uv) {
  vec2 c = q(uv); vec4 r = vec4(0.0);
  float id = floor(c.x * N); float h = hash11(id * 1.3);
  float top = -0.5 + 0.03 + 0.07 * step(0.55, h) * h;
  if (c.y < top && c.y > -0.5 + 0.01) r = vec4(mix(vec3(0.2, 0.55, 0.15), vec3(0.45, 0.85, 0.25), SAT((c.y + 0.5) * 10.0)), step(0.35, hash11(id * 7.0 + 2.0)));
  return r;
}
vec4 raysLayer(vec2 uv) { float d = length(uv - vec2(0.45, 0.2)); return vec4(vec3(1.0, 0.9, 0.6), SAT(exp(-d * 3.5) * 0.45)); }
// sprites (quantised)
vec4 palmV(vec2 uv, float lean, float seed) {
  vec2 c = (floor(uv * 36.0) + 0.5) / 36.0; vec2 p = c + vec2(0.0, 0.48); vec3 col = vec3(0.0); float a = 0.0;
  // trunk: stack of brown cells leaning right
  for (int i = 0; i < 14; i++) { float fi = float(i); vec2 tp = vec2(lean * fi * fi * 0.0012, fi / 36.0 * 0.95); if (abs(p.x - tp.x) < 0.5 / 36.0 && abs(p.y - tp.y) < 0.5 / 36.0) { col = mix(vec3(0.45, 0.28, 0.14), vec3(0.62, 0.4, 0.2), step(0.5, fract(fi * 0.5))); a = 1.0; } }
  vec2 top = vec2(lean * 13.0 * 13.0 * 0.0012, 13.0 / 36.0 * 0.95);
  for (int f = 0; f < 7; f++) { float ff = float(f); float ang = 0.35 + ff * 0.45; vec2 dir = vec2(cos(ang) * (f < 4 ? 1.0 : 1.0), sin(ang));
    for (int s = 1; s <= 7; s++) { float t = float(s); vec2 fp = top + vec2(cos(ang + 0.0) * t * 0.034 * (ff < 3.5 ? -1.0 : 1.0) * -1.0 , 0.0); fp = top + vec2((ff - 3.0) * 0.045 * t * 0.5, 0.0) + vec2(0.0, 0.0);
      float side = (ff - 3.0) / 3.0; fp = top + vec2(side * t * 0.05, (1.0 - abs(side)) * t * 0.02 - t * t * 0.0032 + 0.02);
      if (abs(p.x - fp.x) < 0.5 / 36.0 && abs(p.y - fp.y) < 0.5 / 36.0) { col = mix(vec3(0.1, 0.55, 0.15), vec3(0.4, 0.85, 0.2), step(0.5, fract(t * 0.5 + ff))); a = 1.0; } } }
  return vec4(col, a);
}
vec4 cloudV(vec2 uv, float s) { vec2 c = (floor(uv * 22.0) + 0.5) / 22.0; float cl = min(sdBox(c, vec2(0.34, 0.09)), min(sdBox(c - vec2(-0.1, 0.1), vec2(0.18, 0.08)), sdBox(c - vec2(0.12, 0.13), vec2(0.12, 0.07)))); return vec4(mix(vec3(1.0), vec3(0.8, 0.86, 1.0), step(c.y, -0.02)), step(cl, 0.0)); }
vec4 gullV(vec2 uv) { vec2 c = (floor(uv * 16.0) + 0.5) / 16.0; float w = abs(c.x); float y = c.y + 0.12 - w * 0.5; return vec4(vec3(1.0), step(abs(y), 0.5 / 16.0) * step(w, 0.4)); }
vec4 cubeV(vec2 uv) { vec2 c = uv; float d = sdBox(c, vec2(0.3)); vec3 col = mix(vec3(1.0, 0.8, 0.2), vec3(1.0, 0.45, 0.2), step(0.0, c.x + c.y)); col = mix(col, vec3(1.0, 0.95, 0.6), step(0.0, -c.x + c.y - 0.15)); col *= 0.9 + 0.1 * step(0.28, abs(c.x)); return vec4(col, cov(d)); }
vec4 crabV(vec2 uv) { vec2 c = (floor(uv * 18.0) + 0.5) / 18.0; float body = sdBox(c, vec2(0.2, 0.09)); float claws = min(sdBox(c - vec2(-0.26, 0.1), vec2(0.06, 0.06)), sdBox(c - vec2(0.26, 0.1), vec2(0.06, 0.06))); float legs = min(sdBox(c - vec2(-0.14, -0.12), vec2(0.04, 0.04)), sdBox(c - vec2(0.14, -0.12), vec2(0.04, 0.04))); float d = min(min(body, claws), legs); vec3 col = mix(vec3(0.95, 0.35, 0.2), vec3(0.75, 0.2, 0.15), step(c.y, 0.0)); return vec4(col, step(d, 0.0)); }
vec3 px(vec3 c) { return pow(c, vec3(1.8)); }   // pixel art wants saturated flats: pre-compensate the final gamma
vec4 px(vec4 c) { return vec4(px(c.rgb), c.a); }
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = palmV(uv, 1.0, 1.0); else if (k == 1) r = palmV(uv, -1.2, 2.0); else if (k == 2) r = cloudV(uv, 1.0); else if (k == 3) r = cloudV(uv * 1.1, 2.0);
    else if (k == 4) r = gullV(uv); else if (k == 5) r = cubeV(uv); else r = crabV(uv);
    gAlpha = r.a; return px(r.rgb);
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return px(r.rgb); }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  r = farLayer(uv); r = over(midLayer(uv), r); r = over(nearLayer(uv), r); r = over(frontLayer(uv), r);
  r = over(palmV((uv - vec2(-0.12, islandTop(-0.12) + 0.2)) / 0.444, 1.0, 1.0), r);
  r = over(palmV((uv - vec2(0.18, islandTop(0.18) + 0.19)) / 0.444 * vec2(-1.0, 1.0), 1.0, 2.0), r);
  r = px(r); vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.3; return r.rgb;
}
