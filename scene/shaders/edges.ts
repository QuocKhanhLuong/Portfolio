/**
 * The edge network.
 *
 * Two populations share this material. Proximity edges are hairlines: they say
 * only that two nodes are near each other, so they stay near the threshold of
 * visibility. Semantic edges — the research relationships — are drawn a little
 * darker, in the accent, and carry a travelling front so the structure reads as
 * something being propagated through rather than a static web.
 *
 * `uSemantic` raises the second population as the research state arrives. It
 * never lowers the first.
 */

export const edgeVertexShader = /* glsl */ `
attribute float aWeight;
attribute float aKind;
attribute float aArc;

uniform float uFocal;
uniform float uSpan;

varying float vWeight;
varying float vKind;
varying float vArc;
varying float vFade;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vWeight = aWeight;
  vKind = aKind;
  vArc = aArc;

  // Edges fall away with depth harder than nodes do. A far edge and a near one
  // at the same weight is what makes a connected field read as a flat tangle;
  // dropping the back of the network is what gives it an inside.
  float rel = clamp((-mv.z - uFocal) / max(0.001, uSpan), -1.0, 1.0);
  vFade = 1.0 - max(0.0, rel) * 0.72 + max(0.0, -rel) * 0.15;
}
`;

export const edgeFragmentShader = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uAccent;
uniform float uOpacity;
uniform float uSemantic;
uniform float uTime;
uniform float uDash;

varying float vWeight;
varying float vKind;
varying float vArc;
varying float vFade;

void main() {
  float semantic = vKind * uSemantic;

  // A front travelling along the relationship, at constant speed in world
  // units — the arc attribute is a real length, not a fraction of the edge.
  float front = fract(vArc * uDash - uTime * 0.35);
  float pulse = smoothstep(0.0, 0.12, front) * (1.0 - smoothstep(0.12, 0.55, front));

  // Proximity is the network. It does not step aside when the research state
  // arrives — that inversion is what left a few long chords as the entire
  // composition. The relationships are read *within* the field, at a fraction
  // of its weight, with only the travelling front to mark them out.
  float proximity = 1.0 - vKind;

  float strength = proximity + semantic * (0.34 + pulse * 0.5);
  float alpha = vWeight * strength * uOpacity * max(0.0, vFade);
  if (alpha < 0.003) discard;

  vec3 color = mix(uCore, uAccent, clamp(semantic * 0.7 + 0.08, 0.0, 1.0));
  gl_FragColor = vec4(color, alpha);
}
`;
