import { MORPH_GLSL } from '../morph/core';

/**
 * The grain tier. One resident point buffer; the shader changes how that buffer
 * is read and marked, not which scene is mounted.
 *
 * Since the graph layer arrived this is the substrate rather than the subject:
 * it carries texture, luminance and state identity behind the node diagram, at
 * a density that never competes with it. The morph itself is not defined here —
 * it comes from `scene/morph/core.ts`, which the CPU node tier reads too.
 *
 * Two rules hold everywhere below:
 *
 *  1. State identity is categorical. A state's presence is the sum of the
 *     weights of the slots that actually hold it — never a distance to an
 *     interpolated index. Blending cloud (4) with graph (8) must not produce
 *     anything resembling human (6), which is exactly what index interpolation
 *     used to do.
 *  2. A state's behaviour follows this particle's own transition progress
 *     (`local`), not the global blend. A particle that has not left the old
 *     state yet must still behave like the old state.
 */

export const motifVertexShader = /* glsl */ `
${MORPH_GLSL}

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
uniform float uScanX;
uniform float uEdgeCount;

uniform float uIdxPixel;
uniform float uIdxImage;
uniform float uIdxFeatures;
uniform float uIdxCloud;
uniform float uIdxVolume;
uniform float uIdxHuman;
uniform float uIdxUncertainty;
uniform float uIdxGraph;
uniform float uIdxConstellation;

varying float vBrightness;
varying float vLens;
varying float vPixelBlock;
varying float vPixelReveal;
varying float vFeature;
varying float vScan;
varying float vGraph;
varying float vUncertainty;
varying float vConfidence;
varying float vConstellation;
varying float vOrientation;
varying float vPulse;
varying float vDepth;

vec4 fetchState(float state, float index) {
  float row = state * uRows + floor(index / uTile);
  float col = mod(index, uTile);
  vec2 uv = vec2((col + 0.5) / uTile, (row + 0.5) / (uRows * uStateCount));
  return texture2D(uStates, uv);
}

/** How much of this particle is currently the given state slot. */
#define PRESENCE(slot) (wA * morphIsState(uStateA, slot) + wB * morphIsState(uStateB, slot) + wF * morphIsState(uFocusState, slot))

void main() {
  vec4 A = fetchState(uStateA, aIndex);
  vec4 B = fetchState(uStateB, aIndex);
  vec4 focus = fetchState(uFocusState, aIndex);

  // Per-particle delay keeps transitions spatially coherent without turning
  // them into a hard wipe. Everything state-specific below is keyed off this,
  // not off uBlend.
  float local = morphLocal(uBlend, aStagger, uSpread);

  vec3 p = morphPath(A.xyz, B.xyz, local, aSeed, uArc);
  float brightness = mix(A.w, B.w, local);

  // Content focus samples another already-packed state. It is a stronger,
  // temporary inspection bias, never a remount or a change to scroll progress.
  float focusMix = clamp(uFocusMix, 0.0, 0.62);
  p = mix(p, focus.xyz, focusMix);
  brightness = mix(brightness, focus.w, focusMix);

  // Categorical presence: how much of *this particle* is currently each state.
  float base = 1.0 - focusMix;
  float wA = (1.0 - local) * base;
  float wB = local * base;
  float wF = focusMix;

  float pixelWeight = PRESENCE(uIdxPixel);
  float featureWeight = PRESENCE(uIdxFeatures);
  float cloudWeight = PRESENCE(uIdxCloud);
  float medicalWeight = clamp(PRESENCE(uIdxVolume) + PRESENCE(uIdxHuman), 0.0, 1.0);
  float uncertaintyWeight = PRESENCE(uIdxUncertainty);
  float graphWeight = PRESENCE(uIdxGraph);
  float constellationWeight = PRESENCE(uIdxConstellation);

  // The cursor is an optical instrument. Each state gives that instrument a
  // different aperture and reading operation rather than applying one lens to
  // every scene.
  float aperture = morphAperture(uPointerRadius, pixelWeight, cloudWeight, graphWeight);
  float lens = morphLens(distance(p.xy, uPointer.xy), aperture, uPointerStrength);

  // PIXEL — a real local resolution reveal. Under the lens the quantised field
  // resolves toward its own full-resolution sample; outside it, the sampling
  // grid stays visible. Both states are already resident, so this costs a fetch.
  float pixelReveal = lens * pixelWeight;
  if (pixelReveal > 0.001) {
    vec4 sharp = fetchState(uIdxImage, aIndex);
    p = mix(p, sharp.xyz, pixelReveal * 0.88);
    brightness = mix(brightness, sharp.w, pixelReveal * 0.8);
  }
  vPixelBlock = pixelWeight * (1.0 - pixelReveal);

  // FEATURES — oriented contour reveal. Each particle belongs to one of the
  // eight filter orientations; the lens lengthens the mark along that
  // orientation instead of brightening a blob.
  float featureReveal = featureWeight * (0.28 + lens * 0.72);

  // Every state-specific displacement — cloud depth reading, the medical slice,
  // the competing uncertainty routes, the graph propagation front, the
  // constellation orbit and ambient drift — lives in the shared morph module,
  // so the node tier moves through exactly the same field.
  float scan;
  float confidence;
  float propagation;
  p = morphStateOffset(
    p, uTime, aSeed, aIndex, uEdgeCount, lens,
    cloudWeight, medicalWeight, uncertaintyWeight, graphWeight, constellationWeight,
    uScanX, uTurbulence, uPointer.xy,
    scan, confidence, propagation
  );

  brightness = mix(brightness, brightness * (0.45 + confidence * 0.85), uncertaintyWeight);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Eight orientations over half a turn — the same set the feature generator
  // used when it computed the responses.
  float orientation = mod(aIndex, 8.0) / 8.0;
  float markScale =
    0.7 + brightness * 0.38 + lens * 0.42 + vPixelBlock * 0.5 - pixelReveal * 0.3 +
    featureReveal * 0.16 + scan * 0.55 + graphWeight * (0.06 + propagation * 0.5) -
    constellationWeight * 0.06;
  gl_PointSize = clamp(uPixelScale * markScale / max(0.35, -mv.z), 1.0, 8.5);

  vBrightness = brightness;
  vLens = lens;
  vPixelReveal = pixelReveal;
  vFeature = featureReveal;
  vScan = scan;
  vGraph = graphWeight;
  vUncertainty = uncertaintyWeight;
  vConfidence = confidence;
  vConstellation = constellationWeight;
  vOrientation = orientation;
  vPulse = propagation;
  vDepth = p.z;
}
`;

export const motifFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uAccent;
uniform float uDensity;

varying float vBrightness;
varying float vLens;
varying float vPixelBlock;
varying float vPixelReveal;
varying float vFeature;
varying float vScan;
varying float vGraph;
varying float vUncertainty;
varying float vConfidence;
varying float vConstellation;
varying float vOrientation;
varying float vPulse;
varying float vDepth;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);

  float dotMark = 1.0 - smoothstep(0.05, 0.27, r2);
  float fineMark = 1.0 - smoothstep(0.02, 0.14, r2);
  float squareMark = 1.0 - smoothstep(0.37, 0.5, max(abs(d.x), abs(d.y)));
  float sampleGrid = 0.72 + 0.28 * (0.5 + 0.5 * cos((d.x + 0.5) * 18.0) * cos((d.y + 0.5) * 18.0));
  float pixelMark = squareMark * sampleGrid;

  float lineMark =
    (1.0 - smoothstep(0.012, 0.07, abs(d.y))) *
    (1.0 - smoothstep(0.3, 0.49, abs(d.x)));

  // Eight orientations spread over half a turn, matching the feature bank.
  float angle = vOrientation * 3.14159265;
  vec2 oriented = vec2(
    cos(angle) * d.x + sin(angle) * d.y,
    -sin(angle) * d.x + cos(angle) * d.y
  );
  // The contour extends along its orientation as the reveal strengthens.
  float halfLength = mix(0.18, 0.47, clamp(vFeature, 0.0, 1.0));
  float vectorMark =
    (1.0 - smoothstep(0.012, 0.05, abs(oriented.y))) *
    (1.0 - smoothstep(halfLength * 0.55, halfLength, abs(oriented.x)));

  // State-specific marks: sampling squares, oriented feature contours, scan
  // lines, and diagram pulses all remain ink-on-paper primitives.
  float mark = dotMark;
  mark = mix(mark, pixelMark, clamp(vPixelBlock * 0.92, 0.0, 0.92));
  mark = mix(mark, fineMark, clamp(vPixelReveal * 0.85, 0.0, 0.85));
  mark = mix(mark, max(mark * 0.55, vectorMark), clamp(vFeature * 0.82, 0.0, 0.82));
  mark = mix(mark, max(mark * 0.5, lineMark), clamp(vScan * 0.95, 0.0, 0.95));
  mark = mix(mark, max(mark * 0.72, lineMark * (0.7 + vPulse * 0.3)), clamp(vGraph * 0.5, 0.0, 0.5));

  // Depth reading: under the lens, the cloud shades by how far a point sits
  // from the image plane, which is what makes the depth legible at all.
  float depthShade = 1.0 + clamp(vDepth, -1.0, 1.0) * vLens * 0.45;

  float inkAmount = clamp(
    (0.1 + vBrightness * 0.42 + vLens * 0.28 + vScan * 0.36 + vGraph * 0.1 + vPulse * vGraph * 0.3) * depthShade,
    0.0,
    1.0
  );
  vec3 color = mix(
    uCore,
    uAccent,
    clamp(vBrightness * 0.48 + vLens * 0.2 + vScan * 0.5 + vGraph * 0.3, 0.0, 1.0)
  );

  // Low-confidence branches fade rather than flicker: the alternative is still
  // there, just less believed.
  float belief = mix(1.0, 0.4 + vConfidence * 0.85, clamp(vUncertainty, 0.0, 1.0));
  float alpha = mark * inkAmount * uDensity * belief * (1.0 - vConstellation * 0.18);

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`;
