// Desert dunes at sunset: sculpted dunes with long shadows, sand ripples, a distant mesa skyline, warm haze.
const vec3 SUN = normalize(vec3(0.6, 0.09, 0.8));
float dune(vec2 p) {
  vec2 q = p * 0.006 + vec2(fbm(p * 0.002, 3), fbm(p * 0.002 + 3.0, 3)) * 1.2;
  float d = 1.0 - abs(sin(q.x * 1.3 + q.y * 0.4));
  return d * d * 110.0 + fbm(p * 0.003, 5) * 60.0;
}
float mapH(vec2 p) { float h = dune(p); float far = smoothstep(2500.0, 3500.0, p.y); return mix(h, h + 260.0 * smoothstep(0.1, 0.25, fbm(p * 0.002 + 9.0, 3)), far); }
float march(vec3 ro, vec3 rd, float tmax) { float t = 1.0; for (int i = 0; i < 260; i++) { vec3 p = ro + rd * t; float d = p.y - mapH(p.xz); if (abs(d) < 0.0015 * t || t > tmax) break; t += 0.5 * d; } return t; }
vec3 nrm(vec3 p, float t) { vec2 e = vec2(0.002 * t + 0.05, 0.0); return normalize(vec3(mapH(p.xz - e.xy) - mapH(p.xz + e.xy), 2.0 * e.x, mapH(p.xz - e.yx) - mapH(p.xz + e.yx))); }
float shadow(vec3 ro, vec3 rd) { float r = 1.0, t = 2.0; for (int i = 0; i < 64; i++) { vec3 p = ro + rd * t; float h = p.y - mapH(p.xz); r = min(r, 12.0 * h / t); t += clamp(h, 2.0, 60.0); if (r < 0.001 || p.y > 500.0) break; } return SAT(r); }
vec3 sky(vec3 rd) {
  float sd = SAT(dot(rd, SUN));
  vec3 col = mix(vec3(1.0, 0.5, 0.22), vec3(0.15, 0.12, 0.32), pow(SAT(rd.y * 1.6 + 0.02), 0.5));
  col += vec3(1.0, 0.55, 0.2) * pow(sd, 8.0) * 0.9 + vec3(1.0, 0.85, 0.6) * pow(sd, 600.0) * 12.0;
  vec2 cp = rd.xz / max(rd.y, 0.04);
  float c = smoothstep(0.15, 0.7, fbm(cp * 0.8 + 2.0, 6) * 0.5 + 0.5) * SAT(rd.y * 4.0);
  col = mix(col, vec3(1.0, 0.45, 0.35) * (0.6 + pow(sd, 2.0)), c * 0.7);
  return col;
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 0.0, 0.0);
  float hmax = 0.0; for (int i = 0; i < 10; i++) hmax = max(hmax, mapH(vec2(60.0, 100.0) * float(i)));
  ro.y = hmax + 35.0;
  vec3 ta = ro + vec3(780.0, -120.0, 1300.0);
  vec3 rd = camera(ro, ta, 0.0) * normalize(vec3(uv, 1.3));
  float tmax = 6000.0, t = march(ro, rd, tmax);
  vec3 col;
  if (t < tmax) {
    vec3 p = ro + rd * t, n = nrm(p, t);
    vec2 rip = vec2(sin(p.x * 1.6 + p.z * 0.7 + noise(p.xz * 0.3) * 3.0), 0.0) * 0.08 * exp(-t * 0.004);
    n = normalize(n + vec3(rip.x, 0.0, rip.x * 0.5));
    float dif = SAT(dot(n, SUN));
    float sh = dif > 0.0 ? shadow(p + n, SUN) : 0.0;
    vec3 alb = vec3(0.78, 0.5, 0.3);
    col = alb * (dif * sh * vec3(4.2, 2.4, 1.3) + SAT(0.5 + 0.5 * n.y) * vec3(0.22, 0.18, 0.32));
    col += pow(SAT(dot(reflect(rd, n), SUN)), 30.0) * sh * vec3(1.0, 0.6, 0.3) * 0.5; // sand sheen
    float sd = SAT(dot(rd, SUN));
    col = mix(col, mix(vec3(0.6, 0.35, 0.35), vec3(1.0, 0.6, 0.35), pow(sd, 4.0)), 1.0 - exp(-pow(t * 0.00022, 1.4)));
  } else col = sky(rd);
  return col;
}
