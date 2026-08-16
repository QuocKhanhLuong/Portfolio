/**
 * The edge network.
 *
 * Two populations share this material. Proximity edges are hairlines: they say
 * only that two nodes are near each other, so they stay near the threshold of
 * visibility. Semantic edges — the research relationships — are drawn a little
 * darker, in the accent, and carry a travelling front so the structure reads as
 * something being propagated through rather than a static web.
 *
 * `uSemantic` cross-fades between the two as the research state arrives.
 */

export const edgeVertexShader = /* glsl */ `
attribute float aWeight;
attribute float aKind;
attribute float aArc;

varying float vWeight;
varying float vKind;
varying float vArc;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vWeight = aWeight;
  vKind = aKind;
  vArc = aArc;
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

void main() {
  float semantic = vKind * uSemantic;

  // A front travelling along the relationship, at constant speed in world
  // units — the arc attribute is a real length, not a fraction of the edge.
  float front = fract(vArc * uDash - uTime * 0.35);
  float pulse = smoothstep(0.0, 0.12, front) * (1.0 - smoothstep(0.12, 0.55, front));

  // Proximity edges fade out as the semantic network takes over, so the two
  // never sit on top of each other at full strength.
  float proximity = (1.0 - vKind) * (1.0 - uSemantic * 0.8);

  float strength = proximity + semantic * (0.72 + pulse * 0.6);
  float alpha = vWeight * strength * uOpacity;
  if (alpha < 0.003) discard;

  vec3 color = mix(uCore, uAccent, clamp(semantic * 0.85 + 0.1, 0.0, 1.0));
  gl_FragColor = vec4(color, alpha);
}
`;
