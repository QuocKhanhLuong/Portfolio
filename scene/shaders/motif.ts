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
varying float vPixelReveal;
varying float vFeatureWeight;
varying float vScan;
varying float vGraph;
varying float vUncertainty;
varying float vConstellation;
varying float vOrientation;
varying float vPulse;

vec4 fetchState(float state, float index) {
  float row = state * uRows + floor(index / uTile);
  float col = mod(index, uTile);
  vec2 uv = vec2((col + 0.5) / uTile, (row + 0.5) / (uRows * uStateCount));
  return texture2D(uStates, uv);
}

float smootherstep01(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float nearState(float value, float center, float radius) {
  return 1.0 - smoothstep(0.0, radius, abs(value - center));
}

void main() {
  vec4 A = fetchState(uStateA, aIndex);
  vec4 B = fetchState(uStateB, aIndex);
  vec4 focus = fetchState(uFocusState, aIndex);
  vec4 pixel = fetchState(1.0, aIndex);

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

  // Content focus samples another already-packed state. It is a stronger,
  // temporary inspection bias, never a remount or a change to scroll progress.
  float focusMix = clamp(uFocusMix, 0.0, 0.62);
  p = mix(p, focus.xyz, focusMix);
  brightness = mix(brightness, focus.w, focusMix);

  float baseState = mix(uStateA, uStateB, uBlend);
  float sceneState = mix(baseState, uFocusState, focusMix);
  float pixelWeight = nearState(sceneState, 1.0, 0.9);
  float featureWeight = nearState(sceneState, 3.0, 1.0);
  float cloudWeight = nearState(sceneState, 4.0, 1.05);
  float medicalWeight = max(nearState(sceneState, 5.0, 0.9), nearState(sceneState, 6.0, 0.9));
  float uncertaintyWeight = nearState(sceneState, 7.0, 1.05);
  float graphWeight = nearState(sceneState, 8.0, 1.2);
  float constellationWeight = nearState(sceneState, 9.0, 0.95);

  // The cursor is an optical instrument. Each state gives that instrument a
  // different aperture and reading operation rather than applying one lens to
  // every scene.
  float pointerDistance = distance(p.xy, uPointer.xy);
  float aperture = uPointerRadius * (0.58 + pixelWeight * 0.52 + cloudWeight * 0.48 + graphWeight * 0.2);
  float lens = 1.0 - smoothstep(aperture * 0.12, aperture, pointerDistance);
  lens *= clamp(uPointerStrength, 0.0, 1.0);

  // Pixel state locally resolves the packed field into a sampled image. The
  // other state textures remain resident and the reveal is still continuous.
  float pixelReveal = lens * pixelWeight;
  p = mix(p, pixel.xyz, pixelReveal * 0.76);
  brightness = mix(brightness, pixel.w, pixelReveal * 0.6);

  // Cloud state makes depth legible near the inspection point. This is a small
  // parallax read, not a force field: points retain their world relationship.
  float depthRead = lens * cloudWeight;
  p.z += depthRead * 0.14;
  p.xy += (p.xy - uPointer.xy) * depthRead * 0.022;

  // Volume and human states use the cursor as a scanning plane through depth.
  float depthBand = 1.0 - smoothstep(0.035, 0.16, abs(p.z - uPointer.z));
  float scan = lens * medicalWeight * depthBand;
  p.z += scan * 0.018;

  // Uncertainty separates competing paths with a restrained, time-dependent
  // distribution. The packed generator supplies the possible paths; motion
  // makes their disagreement readable without resorting to glow.
  vec3 instability = vec3(
    sin(uTime * 1.18 + aSeed * 43.0),
    cos(uTime * 0.94 + aSeed * 31.0),
    sin(uTime * 0.72 + aSeed * 19.0)
  );
  p += instability * uncertaintyWeight * (0.006 + (1.0 - lens) * 0.016 + uTurbulence * 0.35);

  // Graph paths breathe along their relationships. The separate line layer in
  // MotifField supplies the diagram edges; this keeps the resident particles
  // active inside that diagram.
  float pathPulse = 0.5 + 0.5 * sin(uTime * 1.1 + aSeed * 19.0);
  p += vec3(
    cos(aSeed * 12.0 + uTime * 0.38),
    sin(aSeed * 17.0 + uTime * 0.31),
    sin(aSeed * 23.0 + uTime * 0.27)
  ) * graphWeight * (0.003 + pathPulse * 0.006);

  // The final state opens the field slowly instead of scattering it abruptly.
  p += vec3(
    sin(uTime * 0.08 + aSeed * 2.1),
    cos(uTime * 0.065 + aSeed * 1.7),
    sin(uTime * 0.052 + aSeed * 1.3)
  ) * constellationWeight * 0.028;

  // Ambient motion remains subordinate to the state-specific readings above.
  p += vec3(
    sin(uTime * 0.5 + aSeed * 40.0),
    cos(uTime * 0.42 + aSeed * 33.0),
    sin(uTime * 0.31 + aSeed * 27.0)
  ) * (0.003 + uTurbulence * 0.55);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float orientation = mod(aIndex, 8.0) / 8.0;
  float markScale =
    0.7 + brightness * 0.38 + lens * 0.58 + pixelReveal * 0.62 +
    featureWeight * 0.1 + scan * 0.5 + graphWeight * (0.08 + pathPulse * 0.12) -
    constellationWeight * 0.06;
  gl_PointSize = clamp(uPixelScale * markScale / max(0.35, -mv.z), 1.0, 8.5);

  vBrightness = brightness;
  vLens = lens;
  vState = sceneState;
  vPixelReveal = pixelReveal;
  vFeatureWeight = featureWeight;
  vScan = scan;
  vGraph = graphWeight;
  vUncertainty = uncertaintyWeight;
  vConstellation = constellationWeight;
  vOrientation = orientation;
  vPulse = pathPulse;
}
`;

export const motifFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uAccent;
uniform float uDensity;
uniform float uTime;

varying float vBrightness;
varying float vLens;
varying float vState;
varying float vPixelReveal;
varying float vFeatureWeight;
varying float vScan;
varying float vGraph;
varying float vUncertainty;
varying float vConstellation;
varying float vOrientation;
varying float vPulse;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);

  float dotMark = 1.0 - smoothstep(0.05, 0.27, r2);
  float squareMark = 1.0 - smoothstep(0.37, 0.5, max(abs(d.x), abs(d.y)));
  float sampleGrid = 0.72 + 0.28 * (0.5 + 0.5 * cos((d.x + 0.5) * 18.0) * cos((d.y + 0.5) * 18.0));
  float pixelMark = squareMark * sampleGrid;

  float lineMark =
    (1.0 - smoothstep(0.012, 0.07, abs(d.y))) *
    (1.0 - smoothstep(0.3, 0.49, abs(d.x)));

  float angle = vOrientation * 6.2831853;
  vec2 oriented = vec2(
    cos(angle) * d.x + sin(angle) * d.y,
    -sin(angle) * d.x + cos(angle) * d.y
  );
  float vectorMark =
    (1.0 - smoothstep(0.012, 0.055, abs(oriented.y))) *
    (1.0 - smoothstep(0.25, 0.49, abs(oriented.x)));

  // State-specific marks: square samples, oriented feature vectors, scan
  // contours, and diagram pulses all remain ink-on-paper primitives.
  float mark = mix(dotMark, pixelMark, clamp(vPixelReveal * 0.9, 0.0, 0.9));
  mark = mix(mark, max(mark * 0.62, vectorMark), clamp(vFeatureWeight * 0.78, 0.0, 0.78));
  mark = mix(mark, max(mark * 0.62, lineMark), clamp(vScan * 0.9, 0.0, 0.9));
  mark = mix(mark, max(mark * 0.72, lineMark * (0.72 + vPulse * 0.28)), clamp(vGraph * 0.55, 0.0, 0.55));

  float contourMix = clamp(vFeatureWeight * 0.26 + vLens * 0.28 + vScan * 0.42, 0.0, 0.74);
  mark = mix(mark, max(dotMark * 0.68, lineMark), contourMix);

  float uncertaintyPulse = 0.78 + vUncertainty * (0.12 + 0.1 * sin(uTime * 1.4 + vPulse * 8.0));
  float inkAmount = clamp(
    0.1 + vBrightness * 0.42 + vLens * 0.3 + vScan * 0.34 + vGraph * 0.12,
    0.0,
    1.0
  );
  vec3 color = mix(
    uCore,
    uAccent,
    clamp(vBrightness * 0.48 + vLens * 0.2 + vScan * 0.48 + vGraph * 0.3, 0.0, 1.0)
  );
  float alpha = mark * inkAmount * uDensity * uncertaintyPulse * (1.0 - vConstellation * 0.18);

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`;
