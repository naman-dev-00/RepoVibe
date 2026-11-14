// Open ocean at twilight: raymarched waves with fresnel reflection, subsurface tint, cloud sky, low sun.
const vec3 SUN = normalize(vec3(-0.25, 0.035, 1.0));
float wave(vec2 p, int oct) {
  float h = 0.0, a = 0.55, f = 0.16; vec2 d = vec2(1.0, 0.3);
  for (int i = 0; i < 8; i++) { if (i >= oct) break;
    vec2 q = p * f + noise(p * f * 0.5) * 0.8;
    h += a * (1.0 - abs(sin(dot(q, normalize(d))))) * (1.0 - abs(sin(dot(q, normalize(d)) * 0.5 + 0.3)));
    d = mat2(0.8, -0.6, 0.6, 0.8) * d; f *= 1.9; a *= 0.48; }
  return h * 1.4 - 0.7;
}
float march(vec3 ro, vec3 rd) { float t = 0.5; for (int i = 0; i < 160; i++) { vec3 p = ro + rd * t; float d = p.y - wave(p.xz, 5); if (d < 0.002 * t || t > 2000.0) break; t += 0.6 * d; } return t; }
vec3 sky(vec3 rd) {
  float sd = SAT(dot(rd, SUN));
  vec3 col = mix(vec3(0.95, 0.45, 0.3), vec3(0.03, 0.06, 0.18), pow(SAT(rd.y * 1.8 + 0.02), 0.4));
  col += vec3(1.0, 0.45, 0.2) * pow(sd, 10.0) * 0.6 + vec3(1.0, 0.9, 0.7) * pow(sd, 900.0) * 8.0;
  vec2 cp = rd.xz / max(rd.y, 0.03);
  float c = smoothstep(0.05, 0.75, fbm(cp * 0.6 + vec2(4.0, 1.0), 6) * 0.5 + 0.5) * SAT(rd.y * 5.0);
  col = mix(col, mix(vec3(0.45, 0.28, 0.4), vec3(1.0, 0.6, 0.45), pow(sd, 2.0)), c * 0.8);
  return col * 0.62;
}
vec3 render(vec2 uv) {
  vec3 ro = vec3(0.0, 3.4, 0.0);
  vec3 ta = vec3(0.0, 3.6, 100.0);
  vec3 rd = camera(ro, ta, 0.0) * normalize(vec3(uv, 1.25));
  if (rd.y > 0.0) return sky(rd);
  float t = march(ro, rd);
  vec3 p = ro + rd * t;
  vec2 e = vec2(0.002 * t + 0.01, 0.0);
  vec3 n = normalize(vec3(wave(p.xz - e.xy, 7) - wave(p.xz + e.xy, 7), 2.0 * e.x, wave(p.xz - e.yx, 7) - wave(p.xz + e.yx, 7)));
  float fres = 0.02 + 0.98 * pow(1.0 - SAT(dot(-rd, n)), 5.0);
  vec3 refl = sky(reflect(rd, n));
  vec3 deep = vec3(0.01, 0.06, 0.09), shallow = vec3(0.05, 0.25, 0.28);
  vec3 water = mix(deep, shallow, SAT((p.y + 0.5) * 0.8)) * (0.35 + 0.6 * SAT(dot(n, SUN)));
  water += vec3(0.1, 0.35, 0.3) * pow(SAT(p.y + 0.4), 3.0) * SAT(dot(rd, SUN) + 0.3) * 0.6; // subsurface glow on crests
  vec3 col = mix(water, refl, fres);
  col += pow(SAT(dot(reflect(rd, n), SUN)), 300.0) * vec3(1.0, 0.75, 0.5) * 4.0;
  col = mix(col, sky(vec3(rd.x, 0.001, rd.z)), 1.0 - exp(-t * 0.0012));
  return col;
}
