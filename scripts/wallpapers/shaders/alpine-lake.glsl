// Alpine lake at golden hour: eroded snow mountains, valley fog, reflective lake, foreground rocks.
const vec3 SUN = normalize(vec3(-0.55, 0.1, 0.83));

// Lake basin around the camera; peaks rise with distance so the valley opens toward big mountains.
float shape(vec2 p, float h) {
  float d = length((p - vec2(0.0, 1100.0)) * vec2(0.45, 1.0));
  float lake = smoothstep(500.0, 1100.0, d);
  float rise = 0.35 + 0.9 * smoothstep(800.0, 3200.0, d);
  return mix(-30.0, h * rise + 40.0 * rise, lake);
}
float mapH(vec2 p) { return shape(p, terrainH(p * 0.0016, 10) * 620.0 + 140.0); }
float mapHlow(vec2 p) { return shape(p, terrainH(p * 0.0016, 5) * 620.0 + 140.0); }

float march(vec3 ro, vec3 rd, float tmax) {
  float t = 1.0;
  for (int i = 0; i < 320; i++) {
    vec3 p = ro + rd * t;
    float d = p.y - mapH(p.xz);
    if (abs(d) < 0.0015 * t || t > tmax) break;
    t += 0.42 * d;
  }
  return t;
}
vec3 normalAt(vec3 p, float t) {
  vec2 e = vec2(0.002 * t, 0.0);
  return normalize(vec3(mapH(p.xz - e.xy) - mapH(p.xz + e.xy), 2.0 * e.x, mapH(p.xz - e.yx) - mapH(p.xz + e.yx)));
}
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 2.0;
  for (int i = 0; i < 64; i++) { vec3 p = ro + rd * t; float h = p.y - mapHlow(p.xz); res = min(res, 16.0 * h / t); t += clamp(h, 4.0, 80.0); if (res < 0.001 || p.y > 600.0) break; }
  return SAT(res);
}
vec3 skyCol(vec3 rd) {
  float sd = SAT(dot(rd, SUN));
  vec3 col = mix(vec3(0.95, 0.58, 0.36), vec3(0.08, 0.2, 0.46), pow(SAT(rd.y + 0.02), 0.38));
  col += vec3(1.0, 0.6, 0.3) * pow(sd, 6.0) * 0.6 + vec3(1.0, 0.85, 0.6) * pow(sd, 400.0) * 10.0;
  // high clouds
  vec2 cp = rd.xz / max(rd.y, 0.05) * 1.6;
  float c = smoothstep(0.1, 0.65, fbm(cp + vec2(3.0, 1.0), 6) * 0.5 + 0.5);
  col = mix(col, mix(vec3(1.0, 0.72, 0.55), vec3(0.55, 0.45, 0.55), 0.4) * (0.7 + 0.6 * pow(sd, 3.0)), c * SAT(rd.y * 3.0) * 0.75);
  return col;
}
vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t) {
  float slope = n.y;
  float snow = smoothstep(0.62, 0.8, slope + 0.25 * fbm(p.xz * 0.02, 4)) * smoothstep(90.0, 170.0, p.y + 40.0 * fbm(p.xz * 0.01, 3));
  vec3 rock = mix(vec3(0.16, 0.13, 0.11), vec3(0.32, 0.27, 0.22), fbm(p.xz * 0.05, 4) * 0.5 + 0.5);
  vec3 grass = vec3(0.12, 0.17, 0.07);
  vec3 alb = mix(rock, grass, smoothstep(0.8, 0.95, slope) * (1.0 - smoothstep(60.0, 120.0, p.y)));
  alb = mix(alb, vec3(0.93, 0.95, 1.0), snow);
  float dif = SAT(dot(n, SUN));
  float sh = dif > 0.0 ? softShadow(p + n * 1.5, SUN) : 0.0;
  float sky = SAT(0.5 + 0.5 * n.y);
  float bounce = SAT(0.2 - 0.8 * n.y);
  vec3 lin = dif * sh * vec3(5.2, 3.3, 2.0) + sky * vec3(0.35, 0.5, 0.85) * 0.9 + bounce * vec3(0.25, 0.16, 0.1);
  vec3 col = alb * lin;
  col += snow * pow(SAT(dot(reflect(rd, n), SUN)), 24.0) * sh * vec3(1.6, 1.2, 0.9); // snow glint
  return col;
}
vec3 aerial(vec3 col, vec3 ro, vec3 rd, float t) {
  float sd = SAT(dot(rd, SUN));
  vec3 fogCol = mix(vec3(0.42, 0.52, 0.72), vec3(1.05, 0.66, 0.4), pow(sd, 5.0));
  float fo = 1.0 - exp(-pow(t * 0.00011, 1.6));
  // valley height-fog (volumetric approximation, integrated along the ray)
  float hf = exp(-ro.y * 0.01) * (1.0 - exp(-t * max(rd.y, 0.0005) * 0.01)) / max(rd.y, 0.0005);
  hf = SAT(hf * 0.0005);
  col = mix(col, fogCol, fo);
  col = mix(col, fogCol * 1.15, hf);
  return col;
}

vec3 scene(vec3 ro, vec3 rd) {
  float tmax = 9000.0;
  float t = march(ro, rd, tmax);
  float tw = rd.y < 0.0 ? (-0.0 - ro.y) / rd.y : 1e9; // lake plane y = 0
  if (tw < t && tw < tmax) {
    vec3 p = ro + rd * tw;
    vec2 w = vec2(fbm(p.xz * 0.04 + 3.0, 4), fbm(p.xz * 0.04 + 7.0, 4)) * 0.04;
    vec3 n = normalize(vec3(w.x, 1.0, w.y));
    vec3 rr = reflect(rd, n);
    float tr = march(p + vec3(0, 0.5, 0), rr, tmax);
    vec3 rc = tr < tmax ? shadeTerrain(p + rr * tr, normalAt(p + rr * tr, tr), rr, tr) : skyCol(rr);
    rc = aerial(rc, p, rr, tr < tmax ? tr : tmax);
    float fres = 0.04 + 0.96 * pow(1.0 - SAT(dot(-rd, n)), 5.0);
    vec3 water = mix(vec3(0.02, 0.05, 0.06), rc, SAT(fres * 1.6 + 0.35));
    return aerial(water, ro, rd, tw);
  }
  if (t < tmax) {
    vec3 p = ro + rd * t;
    return aerial(shadeTerrain(p, normalAt(p, t), rd, t), ro, rd, t);
  }
  return skyCol(rd);
}

vec3 render(vec2 uv) {
  vec3 ro = vec3(-60.0, 26.0, 700.0);
  vec3 ta = vec3(60.0, 150.0, 3200.0);
  vec3 rd = camera(ro, ta, 0.0) * normalize(vec3(uv, 1.35));
  vec3 col = scene(ro, rd);
  // sun bloom + god-ray-ish glow
  col += vec3(1.0, 0.6, 0.3) * pow(SAT(dot(rd, SUN)), 10.0) * 0.35;
  return col;
}
