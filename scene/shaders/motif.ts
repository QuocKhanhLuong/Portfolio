/**
 * The visual field is one resident point buffer. The shader changes how that
 * buffer is read and marked, not which scene is mounted.
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
uniform float uFocusState;
uniform float uFocusMix;
uniform float uBlend;
uniform float uSpread;
uniform float uArc;

uniform float uTime;
uniform float uTurbulence;

uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uPointerRadius;
uniform float uPixelScale;

varying float vBrightness;
varying float vLens;
varying float vState;

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
  vec4 focus = fetchState(uFocusState, aIndex);

  // Per-particle delay keeps transitions spatially coherent without turning
  // them into a hard wipe.
  float local = clamp((uBlend - aStagger * uSpread) / max(1e-4, 1.0 - uSpread), 0.0, 1.0);
  local = smootherstep01(local);

  vec3 from = A.xyz;
  vec3 to = B.xyz;
  float travel = length(to - from);

  vec3 bias = normalize(vec3(
    sin(aSeed * 91.7) + 0.001,
    cos(aSeed * 57.3),
    sin(aSeed * 33.1)
  ));
  vec3 control = mix(from, to, 0.5) + bias * travel * uArc;
  vec3 p = mix(mix(from, control, local), mix(control, to, local), local);
  float brightness = mix(A.w, B.w, local);

  // Content focus samples another already-packed state. It is a small visual
  // bias, never a remount or a change to the scroll timeline.
  float focusMix = clamp(uFocusMix, 0.0, 0.24);
  p = mix(p, focus.xyz, focusMix);
  brightness = mix(brightness, focus.w, focusMix);

  p += vec3(
    sin(uTime * 0.5 + aSeed * 40.0),
    cos(uTime * 0.42 + aSeed * 33.0),
    sin(uTime * 0.31 + aSeed * 27.0)
  ) * (0.003 + uTurbulence * 0.55);

  // The pointer is an optical lens. It slightly changes the mark's scale and
  // clarity; it does not push particles away or pull them toward the cursor.
  float pointerDistance = distance(p.xy, uPointer.xy);
  float lens = 1.0 - smoothstep(uPointerRadius * 0.18, uPointerRadius, pointerDistance);
  lens *= clamp(uPointerStrength, 0.0, 1.0);

  // Depth becomes inspectable near the cursor once the field has left the flat
  // image states. This is deliberately tiny: parallax is a reading aid.
  p.z += lens * smoothstep(2.0, 5.0, mix(uStateA, uStateB, uBlend)) * 0.018;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float sceneState = mix(uStateA, uStateB, uBlend);
  float markScale = 0.76 + brightness * 0.48 + lens * 0.68;
  gl_PointSize = clamp(uPixelScale * markScale / max(0.35, -mv.z), 1.0, 7.0);

  vBrightness = brightness;
  vLens = lens;
  vState = mix(sceneState, uFocusState, focusMix * 0.7);
}
`;

export const motifFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uAccent;
uniform float uDensity;

varying float vBrightness;
varying float vLens;
varying float vState;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);

  // Small ink marks remain crisp on paper. Later states borrow a little of the
  // horizontal contour mark; the pointer increases that clarity locally.
  float dotMark = 1.0 - smoothstep(0.05, 0.27, r2);
  float lineMark =
    (1.0 - smoothstep(0.012, 0.07, abs(d.y))) *
    (1.0 - smoothstep(0.3, 0.49, abs(d.x)));
  float contourMix = clamp(smoothstep(2.0, 4.8, vState) * 0.34 + vLens * 0.5, 0.0, 0.82);
  float mark = mix(dotMark, max(dotMark * 0.72, lineMark), contourMix);

  float inkAmount = clamp(0.12 + vBrightness * 0.46 + vLens * 0.34, 0.0, 1.0);
  vec3 color = mix(uCore, uAccent, clamp(vBrightness * 0.58 + vLens * 0.42, 0.0, 1.0));
  float alpha = mark * inkAmount * uDensity;

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`;
