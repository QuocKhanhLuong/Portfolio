/**
 * The motif shader.
 *
 * Two things here are load-bearing.
 *
 * 1. Every state lives in one texture, so a transition is two texture fetches
 *    and a mix — no buffer uploads, no stalls at act boundaries.
 * 2. Particles do not travel in lockstep along straight lines. Each one has its
 *    own delay, taken from where it sits in the source image, and follows a
 *    bowed path. That is the whole difference between a field that reorganizes
 *    and a field that cross-fades.
 */

export const motifVertexShader = /* glsl */ `
attribute float aIndex;
attribute float aStagger;
attribute float aSeed;

uniform sampler2D uStates;
uniform float uTile;
uniform float uRows;
uniform float uStateCount;

uniform float uStateA;
uniform float uStateB;
uniform float uBlend;
uniform float uSpread;
uniform float uArc;

uniform float uTime;
uniform float uTurbulence;
uniform float uVelocity;

uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uPointerSign;

uniform float uPixelScale;

varying float vBrightness;

vec4 fetchState(float state, float index) {
  float row = state * uRows + floor(index / uTile);
  float col = mod(index, uTile);
  vec2 uv = vec2((col + 0.5) / uTile, (row + 0.5) / (uRows * uStateCount));
  return texture2D(uStates, uv);
}

float smootherstep01(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec4 A = fetchState(uStateA, aIndex);
  vec4 B = fetchState(uStateB, aIndex);

  // Per-particle delay. The wavefront sweeps across the image rather than
  // every particle leaving at once.
  float local = clamp((uBlend - aStagger * uSpread) / max(1e-4, 1.0 - uSpread), 0.0, 1.0);
  local = smootherstep01(local);

  vec3 from = A.xyz;
  vec3 to = B.xyz;
  float travel = length(to - from);

  // Bow the path. Longer moves arc more, so a particle crossing the whole
  // field visibly takes a route instead of teleporting along a line.
  vec3 bias = normalize(vec3(
    sin(aSeed * 91.7) + 0.001,
    cos(aSeed * 57.3),
    sin(aSeed * 33.1)
  ));
  vec3 control = mix(from, to, 0.5) + bias * travel * uArc;

  vec3 p = mix(mix(from, control, local), mix(control, to, local), local);
  float brightness = mix(A.w, B.w, local);

  // Ambient life. Scaled by the act's own motion, so the medical act is calm
  // and the depth act is not.
  p += vec3(
    sin(uTime * 0.5 + aSeed * 40.0),
    cos(uTime * 0.42 + aSeed * 33.0),
    sin(uTime * 0.31 + aSeed * 27.0)
  ) * (0.006 + uTurbulence * (0.4 + abs(uVelocity)));

  // Pointer field. Sign is per-act: early states push away, the research graph
  // leans in.
  vec2 toPointer = p.xy - uPointer.xy;
  float d2 = dot(toPointer, toPointer);
  float falloff = exp(-d2 * 1.7);
  p.xy += normalize(toPointer + vec2(1e-5)) * falloff * uPointerStrength * uPointerSign;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Fast scrolling grows the sprite slightly; the fragment stage drops its
  // alpha to match, which reads as smear rather than as brightening.
  float smear = 1.0 + abs(uVelocity) * 1.6;
  gl_PointSize = clamp(uPixelScale * (1.0 + brightness * 0.8) * smear / max(0.35, -mv.z), 1.0, 10.0);

  vBrightness = brightness;
}
`;

export const motifFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uAccent;
uniform float uDensity;
uniform float uVelocity;

varying float vBrightness;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;

  float alpha = smoothstep(0.25, 0.02, r2);

  vec3 c = mix(uCore, uAccent, clamp(vBrightness, 0.0, 1.0));
  // Only the genuinely bright particles reach white; everything else stays in
  // the act's two colours, which is what keeps the palette from turning muddy.
  c = mix(c, vec3(1.0), clamp(vBrightness - 0.72, 0.0, 0.4));

  float smear = 1.0 / (1.0 + abs(uVelocity) * 1.9);
  gl_FragColor = vec4(c, alpha * clamp(vBrightness, 0.04, 1.15) * uDensity * smear);
}
`;
