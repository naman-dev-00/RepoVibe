// Synthwave 3D: glowing wireframe terrain valley, neon mountains, striped sun, fog.
float mapH(vec2 p) {
  float valley = smoothstep(14.0, 70.0, abs(p.x));
  return terrainH(p * 0.018, 6) * 26.0 * valley + valley * 18.0 - 1.0;
}
float march(vec3 ro, vec3 rd, float tmax) { float t = 0.2; for (int i = 0; i < 260; i++) { vec3 p = ro + rd * t; float d = p.y - mapH(p.xz); if (abs(d) < 0.001 * t || t > tmax) break; t += 0.4 * d; } return t; }
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 4.0, 0.0);
  vec3 ta = vec3(0.0, 9.0, 100.0);
  vec3 rd = camera(ro, ta, 0.0) * normalize(vec3(uv, 1.2));
  float tmax = 900.0, t = march(ro, rd, tmax);
  // sky + sun
  vec3 col = mix(vec3(0.9, 0.2, 0.5), vec3(0.06, 0.01, 0.12), pow(SAT(rd.y * 3.0 + 0.05), 0.6));
  vec2 sd = vec2(rd.x, rd.y - 0.11);
  float r = length(sd);
  if (r < 0.2) {
    float stripes = step(0.0, sin((rd.y - 0.11) * 140.0 - 0.6)) + step(0.04, rd.y - 0.11 + 0.03);
    vec3 sun = mix(vec3(1.0, 0.25, 0.55), vec3(1.0, 0.85, 0.25), SAT((rd.y - 0.0) * 5.0));
    col = mix(col, sun * 2.4, smoothstep(0.2, 0.197, r) * SAT(stripes));
  }
  col += vec3(1.0, 0.3, 0.6) * exp(-r * 6.0) * 0.6;
  vec3 s = floor(rd * 700.0);
  col += step(0.998, hash12(s.xy + s.z)) * SAT(rd.y * 5.0) * vec3(1.0);
  if (t < tmax) {
    vec3 p = ro + rd * t;
    vec2 e = vec2(0.01 * t, 0.0);
    vec3 n = normalize(vec3(mapH(p.xz - e.xy) - mapH(p.xz + e.xy), 2.0 * e.x, mapH(p.xz - e.yx) - mapH(p.xz + e.yx)));
    vec2 g = abs(fract(p.xz * 0.25) - 0.5) / fwidth(p.xz * 0.25);
    float line = 1.0 - SAT(min(g.x, g.y) * 0.9);
    vec3 base = vec3(0.04, 0.0, 0.08) * (0.4 + 0.6 * SAT(dot(n, normalize(vec3(0.0, 0.5, 1.0)))));
    vec3 neon = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.2, 0.8), SAT(p.y / 20.0));
    col = base + neon * line * 1.8 * exp(-t * 0.004);
    col = mix(col, vec3(0.45, 0.06, 0.35), 1.0 - exp(-t * 0.006));
  }
  return col;
}
