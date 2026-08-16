/**
 * The node mark.
 *
 * An instrument reticle rather than a glow: a filled centre inside an open
 * ring, drawn in ink on paper. Additive blending is deliberately not used —
 * on a light ground it turns marks grey and washes them out, which is exactly
 * the generic-particle-demo look this is meant to avoid.
 */

export const nodeVertexShader = /* glsl */ `
attribute float aBrightness;
attribute float aLens;
attribute float aScan;
attribute float aConfidence;

uniform float uSize;
uniform float uPixelRatio;
/** View-space depth of the field's centre, and its half-depth. Together these
 *  turn an absolute distance into "how far back inside the field is this". */
uniform float uFocal;
uniform float uSpan;

varying float vBrightness;
varying float vLens;
varying float vScan;
varying float vConfidence;
varying float vFade;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;

  // Where this node sits through the field: -1 at the near face, +1 at the far
  // one. Perspective alone is not enough to read depth in a field of equal
  // marks — every layer arrives at the same weight and the volume looks flat.
  float rel = clamp((-mv.z - uFocal) / max(0.001, uSpan), -1.0, 1.0);
  float behind = max(0.0, rel);

  // Under the lens a node opens up rather than flaring: it grows just enough
  // for its ring to become readable.
  float scale = (0.85 + aBrightness * 0.3 + aLens * 0.75 + aScan * 0.5) * (1.0 - behind * 0.3);
  gl_PointSize = clamp(uSize * uPixelRatio * scale / max(0.35, -mv.z), 2.0, 44.0);

  vBrightness = aBrightness;
  vLens = aLens;
  vScan = aScan;
  vConfidence = aConfidence;
  // Restrained: the back of the field recedes, it does not disappear.
  vFade = 1.0 - behind * 0.42 + max(0.0, -rel) * 0.12;
}
`;

export const nodeFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uAccent;
uniform float uOpacity;

varying float vBrightness;
varying float vLens;
varying float vScan;
varying float vConfidence;
varying float vFade;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);

  // Solid centre.
  float core = 1.0 - smoothstep(0.13, 0.2, r);
  // Open ring, drawn only once the node is being read.
  float ring =
    (1.0 - smoothstep(0.36, 0.44, r)) * smoothstep(0.27, 0.33, r);

  float mark = core + ring * (0.25 + vLens * 0.75 + vScan * 0.4);
  if (mark < 0.01) discard;

  vec3 color = mix(uCore, uAccent, clamp(vBrightness * 0.35 + vLens * 0.45 + vScan * 0.5, 0.0, 1.0));
  float ink = clamp(0.42 + vBrightness * 0.4 + vLens * 0.45 + vScan * 0.3, 0.0, 1.4);

  float alpha = clamp(mark, 0.0, 1.0) * ink * uOpacity * clamp(vConfidence, 0.25, 1.0) * vFade;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
}
`;
