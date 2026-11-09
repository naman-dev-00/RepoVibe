// RepoVibe raymarched-sprite helpers (real 3D signed-distance geometry rendered to transparent sprites). Original code.
// A shader that includes this file ("// @lib3d") provides:
//   float map3(vec3 p);                                  scene distance (must set gM = material id)
//   vec3  shade3(vec3 p, vec3 n, vec3 rd, float m, float ao, out float alpha);   final colour
// and calls sprite3d(uv, camPos, camTarget, fov) which marches, estimates normals, AO and returns straight-alpha colour.
float gM = 0.0; vec3 gP = vec3(0.0); // gM: material id, gP: model-space hit point (set by map3 for material lookups)
float sdE(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }
float sdCap3(vec3 p, vec3 a, vec3 b, float r0, float r1) { vec3 pa = p - a, ba = b - a; float h = SAT(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - mix(r0, r1, h); }
float sdSph(vec3 p, float r) { return length(p) - r; }
float sdRBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }
float map3(vec3 p);
vec3 shade3(vec3 p, vec3 n, vec3 rd, float m, float ao, out float alpha);
vec3 nrm3(vec3 p) { vec2 e = vec2(0.0012, -0.0012); return normalize(e.xyy * map3(p + e.xyy) + e.yyx * map3(p + e.yyx) + e.yxy * map3(p + e.yxy) + e.xxx * map3(p + e.xxx)); }
float ao3(vec3 p, vec3 n) { float o = 0.0, s = 1.0; for (int i = 1; i <= 5; i++) { float h = 0.012 * float(i) * float(i) * 0.6; o += (h - map3(p + n * h)) * s; s *= 0.62; } return SAT(1.0 - 3.2 * o); }
float shadow3(vec3 p, vec3 l) { float res = 1.0, t = 0.02; for (int i = 0; i < 28; i++) { float h = map3(p + l * t); res = min(res, 10.0 * h / t); t += clamp(h, 0.01, 0.12); if (res < 0.02 || t > 1.4) break; } return SAT(res); }
// uv: sprite uv (y in [-0.5,0.5]); ortho-ish camera looking down -z... position/target in world units, fov as focal length
vec4 sprite3d(vec2 uv, vec3 ro, vec3 ta, float focal) {
  vec3 w = normalize(ta - ro), u = normalize(cross(w, vec3(0.0, 1.0, 0.0))), v = cross(u, w);
  vec3 rd = normalize(u * uv.x + v * uv.y + w * focal);
  float t = 0.0, d = 1.0; bool hit = false;
  for (int i = 0; i < 110; i++) { vec3 p = ro + rd * t; d = map3(p); if (d < 0.0006 * (1.0 + t * 0.4)) { hit = true; break; } t += d * 0.85; if (t > 9.0) break; }
  if (!hit) return vec4(0.0);
  vec3 p = ro + rd * t; map3(p); float m = gM; vec3 gp = gP; vec3 n = nrm3(p); float ao = ao3(p, n); gP = gp; gM = m;
  float alpha; vec3 c = shade3(p, n, rd, m, ao, alpha);
  return vec4(c, alpha);
}
