// Alien world: rocky foreground, mesas in the midground, a giant ringed planet and nebula sky.
const vec3 SUN = normalize(vec3(0.7, 0.18, 0.6));
const vec3 PC = vec3(-1900.0, 1300.0, 6000.0); // planet centre
const float PR = 1500.0;

float mapH(vec2 p) {
  float h = terrainH(p * 0.004, 9) * 90.0;
  float mesa = smoothstep(0.15, 0.3, fbm(p * 0.0012 + 4.0, 3)) * 160.0; // terraced mesas
  h += floor(mesa / 40.0) * 40.0 * 0.6 + mesa * 0.4;
  return h - 20.0;
}
float march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.5;
  for (int i = 0; i < 260; i++) { vec3 p = ro + rd * t; float d = p.y - mapH(p.xz); if (abs(d) < 0.002 * t || t > tmax) break; t += 0.45 * d; }
  return t;
}
vec3 nrm(vec3 p, float t) { vec2 e = vec2(0.002 * t + 0.01, 0.0); return normalize(vec3(mapH(p.xz - e.xy) - mapH(p.xz + e.xy), 2.0 * e.x, mapH(p.xz - e.yx) - mapH(p.xz + e.yx))); }
float shadow(vec3 ro, vec3 rd) { float r = 1.0, t = 1.0; for (int i = 0; i < 48; i++) { vec3 p = ro + rd * t; float h = p.y - mapH(p.xz); r = min(r, 10.0 * h / t); t += clamp(h, 1.0, 40.0); if (r < 0.001 || p.y > 400.0) break; } return SAT(r); }
vec3 space(vec3 rd) {
  vec3 col = vec3(0.01, 0.008, 0.03);
  float n1 = fbm3(rd * 3.0 + 2.0), n2 = fbm3(rd * 6.0 + 9.0);
  col += vec3(0.5, 0.12, 0.6) * pow(SAT(n1 + 0.25), 2.5) * 0.9;
  col += vec3(0.08, 0.35, 0.7) * pow(SAT(n2 + 0.15), 3.0) * 0.8;
  vec3 s = floor(rd * 900.0);
  float st = step(0.9975, hash12(s.xy + s.z * 7.0));
  col += st * vec3(1.0, 0.95, 0.9) * (0.5 + hash12(s.yz) * 2.0);
  // planet + rings (analytic)
  vec3 oc = -PC; float b = dot(oc, rd), c = dot(oc, oc) - PR * PR, h = b * b - c;
  vec3 rn = normalize(vec3(0.25, 1.0, -0.15));
  float tr = -dot(-PC, rn) / dot(rd, rn);
  vec3 rp = rd * tr - PC; float rr = length(rp);
  float ringA = (tr > 0.0 && rr > PR * 1.35 && rr < PR * 2.4) ? (0.55 + 0.45 * sin(rr * 0.012) * sin(rr * 0.031)) * smoothstep(PR * 1.35, PR * 1.5, rr) * smoothstep(PR * 2.4, PR * 2.2, rr) : 0.0;
  if (h > 0.0) {
    float tp = -b - sqrt(h);
    vec3 n = normalize(rd * tp - PC);
    float bands = fbm(vec2(n.y * 9.0, n.x * 1.5 + n.z), 5);
    vec3 alb = mix(vec3(0.75, 0.45, 0.32), vec3(0.95, 0.82, 0.62), bands * 0.5 + 0.5);
    float dif = SAT(dot(n, SUN));
    vec3 pc = alb * (dif * 2.2 + 0.03) + vec3(0.4, 0.5, 1.0) * pow(1.0 - SAT(dot(n, -rd)), 3.0) * 0.6;
    if (tr > 0.0 && tr < tp && ringA > 0.0) pc = mix(pc, vec3(0.9, 0.8, 0.7) * 1.4, ringA * 0.8);
    return pc;
  }
  if (ringA > 0.0) col = mix(col, vec3(0.9, 0.78, 0.66) * 1.2, ringA * 0.85);
  return col;
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(300.0, 0.0, -400.0);
  float hmax = 0.0; for (int i = 0; i < 8; i++) hmax = max(hmax, mapH(ro.xz + vec2(-30.0, 120.0) * float(i)));
  ro.y = hmax + 40.0;
  vec3 ta = ro + vec3(-300.0, 160.0, 1000.0);
  vec3 rd = camera(ro, ta, -0.04) * normalize(vec3(uv, 1.1));
  float tmax = 4000.0;
  float t = march(ro, rd, tmax);
  vec3 col;
  vec3 fogCol = vec3(0.32, 0.12, 0.3);
  if (t < tmax) {
    vec3 p = ro + rd * t, n = nrm(p, t);
    vec3 alb = mix(vec3(0.42, 0.16, 0.12), vec3(0.75, 0.42, 0.28), SAT(fbm(p.xz * 0.05, 4) + 0.5 * n.y));
    alb = mix(alb, vec3(0.12, 0.08, 0.14), smoothstep(0.6, 0.2, n.y) * 0.6);
    float dif = SAT(dot(n, SUN));
    float sh = dif > 0.0 ? shadow(p + n * 0.5, SUN) : 0.0;
    vec3 lin = dif * sh * vec3(5.0, 3.2, 2.4) + SAT(0.5 + 0.5 * n.y) * vec3(0.35, 0.2, 0.55) + SAT(-n.x) * vec3(0.1, 0.25, 0.6) * 0.6; // planet-shine rim
    col = alb * lin * 0.75;
    col = mix(col, fogCol, 1.0 - exp(-t * 0.0012));
  } else {
    col = space(rd);
    col = mix(col, fogCol * 1.3, exp(-max(rd.y, 0.0) * 10.0) * 0.8); // atmospheric horizon glow
  }
  col += vec3(1.0, 0.6, 0.4) * pow(SAT(dot(rd, SUN)), 30.0) * 0.6;
  return col;
}
