// RepoVibe 3D wallpaper engine — shared GLSL (WebGL2). Original code for this project.
// Each scene defines: vec3 render(vec2 uv) using these helpers. uv: centered, y in [-0.5, 0.5].
precision highp float;
uniform vec2 uRes;      // full image resolution
uniform vec2 uOffset;   // tile offset in pixels
uniform float uSeed;
// Depth layers (2.5D engine). 0 = flat composite (the classic wallpaper); scenes that support layers render
// 1 = far (sky, ground, distant objects), 2 = mid, 3 = near, 4 = decorative foreground, 5 = light rays, each with alpha.
// Objects are assigned to a layer per instance (distance from the camera), so nothing is cut in half and every layer
// is complete behind nearer objects (no holes when layers move in parallax).
uniform int uLayer;
float gAlpha = 1.0; // set by render() for layered output (coverage of this sample)
out vec4 fragColor;

#define PI 3.14159265
#define SAT(x) clamp(x, 0.0, 1.0)

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

// Value noise with analytic derivatives (iq-style), for terrain shading.
vec3 noised(vec2 x) {
  vec2 p = floor(x), f = fract(x);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash12(p), b = hash12(p + vec2(1, 0)), c = hash12(p + vec2(0, 1)), d = hash12(p + vec2(1, 1));
  float k0 = a, k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(-1.0 + 2.0 * (k0 + k1 * u.x + k2 * u.y + k4 * u.x * u.y), 2.0 * du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
float noise(vec2 x) { return noised(x).x; }
float noise3(vec3 x) {
  vec3 p = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 157.0 + 113.0 * p.z;
  return mix(mix(mix(hash11(n), hash11(n + 1.0), f.x), mix(hash11(n + 157.0), hash11(n + 158.0), f.x), f.y),
             mix(mix(hash11(n + 113.0), hash11(n + 114.0), f.x), mix(hash11(n + 270.0), hash11(n + 271.0), f.x), f.y), f.z) * 2.0 - 1.0;
}
const mat2 M2 = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct) { float s = 0.0, a = 0.5; for (int i = 0; i < 12; i++) { if (i >= oct) break; s += a * noise(p); p = M2 * p * 2.02; a *= 0.5; } return s; }
float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * noise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }

// Eroded terrain: derivative-damped fbm (gives ridges, valleys and realistic slopes).
float terrainH(vec2 p, int oct) {
  float a = 0.0, b = 1.0; vec2 d = vec2(0.0);
  for (int i = 0; i < 16; i++) { if (i >= oct) break; vec3 n = noised(p); d += n.yz; a += b * n.x / (1.0 + dot(d, d)); b *= 0.5; p = M2 * p * 2.0; }
  return a;
}

float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdSphere(vec3 p, float r) { return length(p) - r; }
float smin(float a, float b, float k) { float h = SAT(0.5 + 0.5 * (b - a) / k); return mix(b, a, h) - k * h * (1.0 - h); }

// Filmic tonemap (ACES fit) + gamma.
vec3 aces(vec3 x) { return SAT((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); }
vec3 finish(vec3 col, vec2 uv) {
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  float vx = uv.x + 0.5, vy = uv.y + 0.5; // both in [0, 1]
  if (uLayer < 10) col *= 0.6 + 0.4 * pow(16.0 * vx * (1.0 - vx) * vy * (1.0 - vy), 0.22); // vignette (not on sprites, uLayer >= 10)
  col += (hash12(gl_FragCoord.xy + uSeed) - 0.5) / 255.0 * 2.0; // dither (no banding)
  return col;
}
mat3 camera(vec3 ro, vec3 ta, float roll) {
  vec3 w = normalize(ta - ro), u = normalize(cross(w, vec3(sin(roll), cos(roll), 0.0))), v = cross(u, w);
  return mat3(u, v, w);
}

vec3 render(vec2 uv);

void main() {
  // 2x2 supersampling (rotated grid).
  vec2 px = gl_FragCoord.xy + uOffset;
  vec4 acc = vec4(0.0); // premultiplied colour + coverage
  vec2 o[4] = vec2[4](vec2(0.125, 0.375), vec2(0.375, -0.125), vec2(-0.125, -0.375), vec2(-0.375, 0.125));
  for (int i = 0; i < 4; i++) {
    vec2 uv = (px + o[i] - 0.5 * uRes) / uRes.y;
    gAlpha = 1.0;
    vec3 c = render(uv);
    acc += vec4(c * gAlpha, gAlpha);
  }
  vec2 uv0 = (px - 0.5 * uRes) / uRes.y;
  float a = acc.a * 0.25;
  vec3 rgb = a > 0.0 ? acc.rgb / acc.a : vec3(0.0);
  fragColor = vec4(finish(rgb, uv0 * vec2(uRes.y / uRes.x, 1.0) * vec2(1.0, 1.0)), a);
}
