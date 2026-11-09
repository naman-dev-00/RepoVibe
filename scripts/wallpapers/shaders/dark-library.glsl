// @lib2d
// @sprites flame:128x256, chandelier:900x900, curtain:420x1200, candle:300x520, bookStack:700x420, page:160x160, dust:96x96
// Dark Academia — a gothic library at night. Layered 2.5D art painted with signed-distance shapes (not real-time 3D).
// uLayer: 1 far (back wall: tall arched windows with moonlight, shelves, vaulted ceiling, wooden floor) · 2 mid (shelf columns, ladder, globe) ·
// 3 near (stone arches framing the room, reading desk) · 4 front (sharp book stacks, candlestick) · 5 moonbeams ·
// 10+ sprites (candle flames, chandelier, curtains, candles, floating pages, dust).
const float HZ = -0.2;
vec3 wood(vec2 p, float tone) {
  float g = fbm(vec2(p.x * 7.0, p.y * 90.0), 4);
  return mix(vec3(0.07, 0.035, 0.02), vec3(0.3, 0.16, 0.07), SAT(0.5 + g * 0.8 + tone));
}
vec4 books(vec2 uv, vec2 c, vec2 size, float seed) {   // a bookshelf bay: planks + rows of spines
  vec2 p = uv - c; if (abs(p.x) > size.x || abs(p.y) > size.y) return vec4(0.0);
  float rows = 6.0; float rh = size.y * 2.0 / rows; float ry = (p.y + size.y) / rh; float ri = floor(ry), rf = fract(ry);
  vec3 col = wood(p, -0.1); float a = 1.0;
  if (rf > 0.06) {
    float bw = size.x * 2.0 / 22.0; float x = (p.x + size.x) / bw; float bi = floor(x), bf = fract(x);
    float h = hash11(bi * 3.7 + ri * 11.0 + seed);
    float bh = 0.62 + 0.36 * h;
    if ((rf - 0.06) / 0.94 < bh && h > 0.07) {
      vec3 b = mix(vec3(0.35, 0.07, 0.08), vec3(0.08, 0.16, 0.22), hash11(bi * 1.9 + ri + seed));
      b = mix(b, vec3(0.3, 0.2, 0.08), step(0.7, hash11(bi * 5.1 + ri * 2.0 + seed)));
      b *= 0.7 + 0.4 * SAT(1.0 - abs(bf - 0.5) * 2.0);
      float gold = step(abs((rf - 0.06) / 0.94 - bh * 0.7), 0.04) + step(abs((rf - 0.06) / 0.94 - bh * 0.3), 0.025);
      b = mix(b, vec3(0.9, 0.7, 0.3), gold * 0.8 * step(0.2, bf) * step(bf, 0.8));
      col = b; col *= step(0.07, bf) * 0.85 + 0.15;
    } else col = vec3(0.02, 0.012, 0.01);
  }
  col *= 0.6 + 0.6 * exp(-length(p / size) * 0.6);
  return vec4(col, 1.0);
}
float archD(vec2 p, vec2 hw) { float rect = sdBox(p - vec2(0.0, -hw.y * 0.5 + 0.0), vec2(hw.x, hw.y * 0.5)); float top = length(p - vec2(0.0, 0.0)) - hw.x; return min(rect, max(top, -(p.y) - 0.0 + 0.0 * hw.y) ); }
vec4 farLayer(vec2 uv) {
  vec3 col = mix(vec3(0.03, 0.02, 0.025), vec3(0.09, 0.055, 0.045), SAT((uv.y + 0.3) * 1.2));
  // vaulted ceiling
  float rib = abs(sin((uv.x / (0.5 + (uv.y - 0.1) * 0.0)) * 3.14159 * 2.0)); 
  col *= 0.8 + 0.2 * smoothstep(0.1, 0.0, abs(fract(uv.x * 4.0) - 0.5) - 0.46) ;
  // back wall shelves left and right, windows in the middle
  vec4 sl = books(uv, vec2(-0.55, 0.0), vec2(0.3, 0.46), 1.0), sr = books(uv, vec2(0.55, 0.0), vec2(0.3, 0.46), 6.0);
  col = mix(col, sl.rgb, sl.a); col = mix(col, sr.rgb, sr.a);
  // three arched windows with moonlit mullions
  for (int i = 0; i < 3; i++) { float fi = float(i) - 1.0; vec2 c = vec2(fi * 0.26, 0.04);
    vec2 q = uv - c; float hw = 0.09; float win = min(sdBox(q - vec2(0.0, -0.06), vec2(hw, 0.2)), length(q - vec2(0.0, 0.14)) - hw);
    float frame = abs(win) - 0.008;
    vec3 sky = mix(vec3(0.03, 0.05, 0.16), vec3(0.12, 0.2, 0.42), SAT(q.y * 2.0 + 0.5)); vec2 sg = floor(uv * 90.0); sky += vec3(0.8) * step(0.99, hash12(sg + fi)) * 0.6;
    float moon = smoothstep(0.034, 0.028, length(uv - vec2(0.0, 0.12))) * step(float(i), 1.0) * step(1.0, float(i));
    sky = mix(sky, vec3(1.0, 0.97, 0.85), moon);
    float mull = min(smoothstep(0.004, 0.0, abs(q.x)), smoothstep(0.004, 0.0, abs(q.y - 0.02)));
    col = mix(col, sky, cov(win)); col = mix(col, vec3(0.05, 0.03, 0.02), max(cov(frame), mull * cov(win)));
  }
  // floor: polished planks with perspective and moonlit pools
  if (uv.y < HZ) { float d = HZ - uv.y; float z = 0.3 / max(d, 0.004); float x = uv.x * z; vec3 f = wood(vec2(x * 0.7, z), -0.15) * 0.8; f *= 0.55 + 0.7 * smoothstep(0.0, 0.5, d);
    f += vec3(0.35, 0.45, 0.7) * exp(-pow((uv.x) * 2.2, 2.0)) * exp(-d * 3.5) * 0.35; col = f; }
  return vec4(col, 1.0);
}
vec4 midLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  vec4 l = books(uv, vec2(-0.82, 0.0), vec2(0.12, 0.5), 11.0), rr = books(uv, vec2(0.82, 0.0), vec2(0.12, 0.5), 16.0);
  r = over(vec4(l.rgb * 0.85, l.a), r); r = over(vec4(rr.rgb * 0.85, rr.a), r);
  // globe on a stand (centre right) and a rolling ladder
  vec2 g = uv - vec2(0.38, -0.17); float globe = length(g - vec2(0.0, 0.1)) - 0.075, stand = min(sdBox(g - vec2(0.0, 0.0), vec2(0.004, 0.06)), sdBox(g + vec2(0.0, 0.07), vec2(0.04, 0.008)));
  vec3 gc = mix(vec3(0.15, 0.3, 0.4), vec3(0.5, 0.42, 0.25), step(0.55, fbm(g * 20.0, 4) + 0.5)) * (0.6 + 0.7 * SAT(0.5 - (g.x) * 6.0));
  r = over(vec4(gc, cov(globe)), r); r = over(vec4(vec3(0.5, 0.35, 0.15), cov(stand)), r);
  float lad = min(sdBox(uv - vec2(-0.6, -0.1), vec2(0.004, 0.4)) , sdBox(uv - vec2(-0.55, -0.1), vec2(0.004, 0.4)));
  for (int i = 0; i < 9; i++) lad = min(lad, sdBox(rot2(0.0) * (uv - vec2(-0.575, -0.45 + float(i) * 0.09)), vec2(0.026, 0.0025)));
  r = over(vec4(vec3(0.28, 0.15, 0.07), cov(lad) * step(abs(uv.x + 0.575), 0.04)), r);
  return r;
}
vec4 nearLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // stone pillars framing the scene with pointed arch tops
  float px = abs(uv.x) - 0.84; float pillar = max(px, -1.0); float shaft = -px - 0.0;
  float col = smoothstep(0.0, 0.005, -(abs(uv.x) - 0.9));
  float pd = abs(uv.x) - 0.855;
  if (pd > -0.07 || true) {
    float dd = (abs(uv.x) - 0.835);
    vec3 st = mix(vec3(0.05, 0.045, 0.05), vec3(0.28, 0.25, 0.27), SAT(0.5 - (abs(uv.x) - 0.88) * 12.0 * sign(uv.x) * 0.0 + 0.4 * noise(uv * 30.0))) ;
    st *= 0.7 + 0.3 * fbm(uv * vec2(20.0, 4.0), 4);
    r = vec4(st, cov(-dd));
  }
  // reading desk across the bottom with an open book
  float desk = uv.y + 0.4 + 0.0 * uv.x; vec3 dw = wood(vec2(uv.x, uv.y * 0.2), 0.05) * (0.8 + 0.4 * SAT(0.5 + uv.y + 0.4 * 0.0));
  r = over(vec4(dw, cov(uv.y + 0.4)), r);
  vec2 bk = uv - vec2(0.1, -0.38); float page = max(abs(bk.x) - 0.12 * 1.0, abs(bk.y) - 0.022 + 0.0 * bk.x);
  float spine = abs(bk.x) - 0.002; vec3 pc = mix(vec3(0.95, 0.88, 0.7), vec3(0.75, 0.65, 0.45), SAT(abs(bk.x) * 6.0)); pc *= 0.9 + 0.1 * sin(bk.y * 400.0) * 0.5;
  r = over(vec4(pc, cov(page)), r);
  return r;
}
vec4 frontLayer(vec2 uv) {
  vec4 r = vec4(0.0);
  // stacked books at the bottom-left and bottom-right edges: sharp, close
  for (int s = 0; s < 2; s++) { float side = s == 0 ? -1.0 : 1.0; vec2 c = vec2(side * 0.72, -0.47);
    for (int i = 0; i < 5; i++) { float fi = float(i); float hw = 0.12 - 0.01 * fi + 0.02 * hash11(fi + side * 7.0), hh = 0.022 + 0.008 * hash11(fi * 3.0 + side);
      vec2 p = uv - c - vec2((hash11(fi + side * 2.0) - 0.5) * 0.03, fi * 0.048);
      vec3 b = mix(vec3(0.4, 0.07, 0.08), vec3(0.08, 0.17, 0.22), hash11(fi * 7.0 + side)); b = mix(b, vec3(0.3, 0.2, 0.08), step(0.7, hash11(fi * 5.0 + side)));
      b *= 0.7 + 0.5 * SAT(0.5 - p.y * 8.0); float d = sdBox(p, vec2(hw, hh));
      r = over(vec4(b, cov(d)), r);
      r = over(vec4(vec3(0.9, 0.78, 0.5), cov(sdBox(p - vec2(0.0, 0.0), vec2(hw * 0.9, hh * 0.3)) ) * 0.4 * cov(d)), r); }
  }
  return r;
}
vec4 raysLayer(vec2 uv) {
  float x = uv.x * 4.5 + uv.y * -2.5; float beams = smoothstep(0.55, 0.2, abs(fract(x * 0.5) - 0.5) * 1.6) * (0.5 + 0.5 * noise(vec2(x, uv.y * 4.0)));
  float fade = SAT(0.9 - (0.35 - uv.y) * 0.8) * SAT(1.0 - abs(uv.x) * 1.2);
  return vec4(vec3(0.55, 0.72, 1.0), SAT(beams * fade * 0.35));
}
vec4 flame(vec2 uv) { vec2 p = uv * vec2(1.0, 0.7) + vec2(0.0, 0.1); float d = length(p * vec2(2.4, 1.0) - vec2(0.0, 0.0)) ; float tear = max(abs(p.x) * 5.5 - SAT(1.0 - (p.y + 0.35)) * 1.6, -p.y - 0.3); float al = SAT(1.0 - smoothstep(0.0, 0.35, tear + 0.0)) * smoothstep(-0.3, -0.2, p.y) * smoothstep(0.45, 0.3, p.y);
  vec3 c = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.45, 0.1), SAT((p.y + 0.3) * 1.6)); c = mix(c, vec3(1.0, 1.0, 0.9), exp(-length(p - vec2(0.0, -0.12)) * 9.0)); return vec4(c, al); }
vec4 chandelier(vec2 uv) {
  vec4 r = vec4(0.0); vec2 p = uv; float ring = abs(length(p * vec2(1.0, 3.0) - vec2(0.0, -0.1)) - 0.3) - 0.008;
  vec3 br = vec3(0.7, 0.5, 0.2); r = vec4(br, cov(ring));
  r = over(vec4(br, cov(sdBox(p - vec2(0.0, 0.28), vec2(0.004, 0.22)))), r);
  for (int i = 0; i < 6; i++) { float t = float(i) / 6.0 * 6.2831; vec2 c = vec2(cos(t) * 0.3, sin(t) * 0.1 - 0.1 * 0.0 - 0.0) + vec2(0.0, -0.1 * 0.0 - 0.0); c = vec2(cos(t) * 0.3, -0.1 + sin(t) * 0.1);
    r = over(vec4(vec3(0.9, 0.85, 0.7), cov(sdBox(p - c - vec2(0.0, 0.04), vec2(0.008, 0.035)))), r);
    float f = exp(-length((p - c - vec2(0.0, 0.1)) * vec2(1.0, 1.4)) * 18.0); r = over(vec4(vec3(1.0, 0.7, 0.3), SAT(f)), r); }
  return r;
}
vec4 curtainS(vec2 uv) { float x = uv.x + 0.5; float f = 0.5 + 0.5 * sin(x * 38.0 + uv.y * 1.5); float edge = 0.5 - abs(uv.x) * 1.0; float a = step(-0.26 - 0.03 * sin(uv.y * 8.0), uv.x) * step(uv.x, 0.3 + 0.0); vec3 c = mix(vec3(0.35, 0.04, 0.07), vec3(0.62, 0.1, 0.12), f) * (0.5 + 0.5 * (uv.y + 0.5) * 0.0 + 0.6 * SAT(0.6 - uv.y)); return vec4(c, SAT(a) * smoothstep(0.5, 0.45, abs(uv.y))); }
vec4 flame(vec2 uv);
vec4 candle(vec2 uv) { vec4 fl = flame((uv - vec2(0.0, 0.3)) * 1.6); float d = sdBox(uv - vec2(0.0, -0.15), vec2(0.07, 0.25)); float base = sdBox(uv - vec2(0.0, -0.42), vec2(0.17, 0.05)); float stem = sdBox(uv - vec2(0.0, -0.3), vec2(0.03, 0.1));
  vec3 c = mix(vec3(0.95, 0.9, 0.78), vec3(0.65, 0.55, 0.4), SAT(0.5 + uv.x * 6.0)); vec4 r = vec4(c, cov(d)); r = over(vec4(vec3(0.7, 0.5, 0.2) * (0.7 + 0.5 * SAT(0.5 - uv.x * 4.0)), cov(min(base, stem))), r); r = over(fl, r); r.rgb += vec3(1.0, 0.6, 0.2) * exp(-length((uv - vec2(0.0, 0.3)) * vec2(1.0, 1.3)) * 7.0) * 0.5 * (1.0 - r.a); r.a = max(r.a, exp(-length((uv - vec2(0.0, 0.3)) * vec2(1.0, 1.3)) * 7.0) * 0.5); return r; }
vec4 bookStack(vec2 uv) { vec4 r = vec4(0.0); for (int i = 0; i < 4; i++) { float fi = float(i); vec2 p = uv - vec2((hash11(fi * 3.0) - 0.5) * 0.08, -0.32 + fi * 0.16); float d = sdBox(p, vec2(0.42 - 0.03 * fi, 0.075)); vec3 b = mix(vec3(0.4, 0.07, 0.08), vec3(0.08, 0.17, 0.22), hash11(fi * 7.0)); b *= 0.7 + 0.5 * SAT(0.5 - p.y * 5.0); r = over(vec4(b, cov(d)), r); r = over(vec4(vec3(0.9, 0.78, 0.5), cov(sdBox(p - vec2(0.0, 0.0), vec2(0.38 - 0.03 * fi, 0.012))) * 0.6 * cov(d)), r); } return r; }
vec4 pageS(vec2 uv) { vec2 p = rot2(0.4) * uv; float d = sdBox(p, vec2(0.3, 0.38)); vec3 c = mix(vec3(0.98, 0.93, 0.78), vec3(0.8, 0.7, 0.5), SAT(0.5 + p.x * 1.2)); c = mix(c, vec3(0.35, 0.25, 0.15), smoothstep(0.012, 0.0, abs(fract(p.y * 9.0) - 0.5) - 0.44) * step(abs(p.x), 0.22) * 0.5); return vec4(c, cov(d)); }
vec4 dust(vec2 uv) { float r = length(uv); return vec4(vec3(1.0, 0.85, 0.55), SAT(exp(-r * 9.0) * 1.2)); }
vec3 render(vec2 uv) {
  vec4 r;
  if (uLayer >= 10) {
    int k = uLayer - 10;
    if (k == 0) r = flame(uv); else if (k == 1) r = chandelier(uv); else if (k == 2) r = curtainS(uv); else if (k == 3) r = candle(uv);
    else if (k == 4) r = bookStack(uv); else if (k == 5) r = pageS(uv); else r = dust(uv);
    gAlpha = r.a; return r.rgb;
  }
  if (uLayer == 1) { r = farLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 2) { r = midLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 3) { r = nearLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 4) { r = frontLayer(uv); gAlpha = r.a; return r.rgb; }
  if (uLayer == 5) { r = raysLayer(uv); gAlpha = r.a; return r.rgb; }
  r = farLayer(uv); r = over(midLayer(uv), r); r = over(nearLayer(uv), r); r = over(frontLayer(uv), r);
  vec4 ry = raysLayer(uv); r.rgb += ry.rgb * ry.a * 0.5; return r.rgb;
}
