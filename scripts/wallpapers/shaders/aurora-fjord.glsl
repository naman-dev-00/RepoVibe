// Aurora over a frozen fjord: snowy mountain walls, mirror water, volumetric aurora curtains, stars.
float mapH(vec2 p) {
  float valley = smoothstep(120.0, 700.0, abs(p.x + 120.0 * sin(p.y * 0.0015)));
  float h = terrainH(p * 0.0022, 9) * 300.0 + 200.0;
  return mix(-20.0, h * valley, smoothstep(0.0, 1.0, valley));
}
float march(vec3 ro, vec3 rd, float tmax) { float t = 1.0; for (int i = 0; i < 260; i++) { vec3 p = ro + rd * t; float d = p.y - mapH(p.xz); if (abs(d) < 0.0015 * t || t > tmax) break; t += 0.45 * d; } return t; }
vec3 nrm(vec3 p, float t) { vec2 e = vec2(0.002 * t, 0.0); return normalize(vec3(mapH(p.xz - e.xy) - mapH(p.xz + e.xy), 2.0 * e.x, mapH(p.xz - e.yx) - mapH(p.xz + e.yx))); }
vec3 aurora(vec3 ro, vec3 rd) {
  vec3 acc = vec3(0.0);
  if (rd.y < 0.01) return acc;
  for (int i = 0; i < 48; i++) {
    float h = 600.0 + float(i) * 22.0;
    float t = (h - ro.y) / rd.y;
    vec3 p = ro + rd * t;
    vec2 q = p.xz * 0.0009;
    float curtain = abs(sin(q.x * 3.0 + fbm(q * 2.0, 4) * 4.0 + q.y * 0.6));
    float band = smoothstep(0.35, 0.0, curtain) * smoothstep(0.0, 0.6, fbm(q * 1.5 + 7.0, 3) + 0.4);
    float fall = exp(-float(i) * 0.07);
    vec3 c = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.25, 1.0), SAT(float(i) / 40.0));
    acc += c * band * fall * 0.035 * exp(-t * 0.00005);
  }
  return acc;
}
vec3 skyCol(vec3 ro, vec3 rd) {
  vec3 col = mix(vec3(0.02, 0.06, 0.1), vec3(0.005, 0.01, 0.03), SAT(rd.y * 2.0));
  vec3 s = floor(rd * 1100.0);
  col += step(0.9978, hash12(s.xy + s.z * 3.0)) * vec3(0.9, 0.95, 1.0) * (0.4 + 1.6 * hash12(s.zx));
  return col + aurora(ro, rd) * 1.6;
}
vec3 shade(vec3 p, vec3 n, vec3 rd) {
  float snow = smoothstep(0.5, 0.75, n.y + 0.2 * fbm(p.xz * 0.03, 3));
  vec3 alb = mix(vec3(0.05, 0.05, 0.06), vec3(0.75, 0.82, 0.9), snow);
  vec3 auroraLight = vec3(0.12, 0.38, 0.32) * SAT(n.y) * 0.45 + vec3(0.25, 0.2, 0.45) * SAT(n.z * -0.5 + 0.2) * 0.25 + vec3(0.05, 0.07, 0.12);
  return alb * (auroraLight + vec3(0.02, 0.03, 0.05));
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(-60.0, 18.0, 0.0);
  vec3 ta = vec3(-20.0, 160.0, 1000.0);
  vec3 rd = camera(ro, ta, 0.0) * normalize(vec3(uv, 1.05));
  float tmax = 7000.0, t = march(ro, rd, tmax);
  float tw = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  vec3 col;
  if (tw < t) {
    vec3 p = ro + rd * tw;
    vec2 w = vec2(fbm(p.xz * 0.05, 3), fbm(p.xz * 0.05 + 4.0, 3)) * 0.015;
    vec3 n = normalize(vec3(w.x, 1.0, w.y));
    vec3 rr = reflect(rd, n);
    float t2 = march(p + vec3(0, 0.3, 0), rr, tmax);
    vec3 rc = t2 < tmax ? shade(p + rr * t2, nrm(p + rr * t2, t2), rr) : skyCol(p, rr);
    float fres = 0.05 + 0.95 * pow(1.0 - SAT(dot(-rd, n)), 5.0);
    col = mix(vec3(0.004, 0.01, 0.015), rc, SAT(fres + 0.45));
    // ice floes in the foreground
    col = mix(col, vec3(0.35, 0.45, 0.5) * 0.25, smoothstep(0.45, 0.6, fbm(p.xz * 0.04 + 2.0, 4)) * smoothstep(400.0, 40.0, tw));
  } else if (t < tmax) {
    vec3 p = ro + rd * t;
    col = shade(p, nrm(p, t), rd);
    col = mix(col, vec3(0.03, 0.08, 0.1), 1.0 - exp(-t * 0.00035));
  } else col = skyCol(ro, rd);
  return col;
}
