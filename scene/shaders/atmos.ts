/**
 * The paper.
 *
 * A fullscreen procedural wash sitting behind everything: warm tone, a slow
 * domain-warped noise for the grain of the stock, and a faint vignette. It is
 * not weather and it is not a nebula — at full strength it is a few percent of
 * ink, the amount by which a sheet of paper is not a flat colour.
 *
 * The vertex stage writes clip space directly, so no matrices, no camera, and
 * no chance of it ever being culled or transformed with the field.
 */

export const atmosVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const atmosFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform float uTime;
uniform float uAmount;
uniform float uZoom;
uniform float uAspect;
uniform float uWarp;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

/** Three octaves. Five is a smoke shader; this is a sheet of paper. */
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i += 1) {
    sum += valueNoise(p) * amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * uZoom;

  // One level of domain warp — enough to stop the noise reading as a tiling
  // grid, not enough to become a cloud.
  vec2 warp = vec2(
    fbm(p * 1.3 + vec2(uTime * 0.008, 0.0)),
    fbm(p * 1.3 + vec2(4.7, uTime * 0.006))
  );
  float n = fbm(p * 1.9 + (warp - 0.5) * uWarp);
  n = smoothstep(0.28, 0.86, n);

  // Cool in the deep areas, a touch of warmth where the tone lifts — the way
  // uncoated stock sits under a window.
  vec3 tone = mix(uInk, uAccent, smoothstep(0.45, 1.0, n));

  // Vignette, very soft: the corners of a page are always a shade heavier.
  float radial = length((uv - 0.5) * vec2(uAspect, 1.0));
  float vignette = smoothstep(0.35, 1.05, radial);

  float ink = (n * 0.6 + vignette * 0.5) * uAmount;
  vec3 color = mix(uPaper, tone, clamp(ink, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
`;
