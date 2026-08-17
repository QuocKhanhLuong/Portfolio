/**
 * The one definition of how a particle moves between states.
 *
 * Two renderers read the packed state texture: the GLSL grain field (thousands
 * of points, positions computed in the vertex shader) and the CPU graph node
 * tier (a few hundred nodes whose world positions must exist on the main thread
 * so edges can be built from real distances). Those are two evaluations of the
 * same morph, and if they were written twice they would drift apart — a node
 * would sit slightly off the grain it is supposed to be extracted from, and the
 * error would grow every time either file was tuned.
 *
 * So the morph is written once, here, in two languages against one set of
 * constants. `MORPH` is the single source of truth for every magic number; the
 * GLSL below interpolates those same constants into its source, and the
 * TypeScript below reads them directly. Adding a term means adding it twice in
 * this file, side by side, where the divergence is visible — never in two
 * files where it is not.
 */

/** GLSL requires a decimal point on float literals. */
const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export const MORPH = {
  /** Largest contribution a hovered foreground item may claim. */
  focusMax: 0.62,

  /** Frequencies that turn a particle seed into a stable arc direction. */
  biasFreqX: 91.7,
  biasFreqY: 57.3,
  biasFreqZ: 33.1,

  /** Cursor aperture: base radius plus per-state widening. */
  aperture: 0.58,
  aperturePixel: 0.52,
  apertureCloud: 0.48,
  apertureGraph: 0.2,
  apertureInner: 0.12,

  /** CLOUD — local depth separation under the lens. */
  cloudDepth: 0.06,
  cloudDepthGain: 0.34,
  cloudLateral: 0.045,

  /** VOLUME / HUMAN — the cutting plane. */
  slabInner: 0.022,
  slabOuter: 0.135,
  slabPull: 0.16,
  slabLift: 0.012,

  /** UNCERTAINTY — three competing routes taking turns at being believed. */
  branchRate: 0.5,
  branchBase: 0.012,
  branchSpread: 0.055,

  /** GRAPH — a front travelling outward through the structure. */
  waveRate: 0.18,
  waveScale: 0.42,
  waveHead: 0.1,
  waveTail: 0.42,
  wavePush: 0.022,

  /** CONSTELLATION — a shallow orbit, not a jitter. */
  orbitRate: 0.014,
  driftAmount: 0.02,

  /** Ambient motion, subordinate to everything above. */
  ambientBase: 0.003,
  ambientTurbulence: 0.55,
} as const;

/* ------------------------------------------------------------------------ *
 * GLSL
 * ------------------------------------------------------------------------ */

/**
 * Shared morph functions. Included verbatim by the grain vertex shader; the
 * TypeScript below is the same maths for the node tier.
 */
export const MORPH_GLSL = /* glsl */ `
float morphSmoother(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/** 1.0 when two state selectors are the same slot, 0.0 otherwise. */
float morphIsState(float a, float b) {
  return 1.0 - step(0.5, abs(a - b));
}

/** This particle's own transition progress, eased, given the stagger spread. */
float morphLocal(float blend, float stagger, float spread) {
  float t = clamp((blend - stagger * spread) / max(1e-4, 1.0 - spread), 0.0, 1.0);
  return morphSmoother(t);
}

/** A stable per-particle direction for the transition arc to bow along. */
vec3 morphBias(float seed) {
  return normalize(vec3(
    sin(seed * ${f(MORPH.biasFreqX)}) + 0.001,
    cos(seed * ${f(MORPH.biasFreqY)}),
    sin(seed * ${f(MORPH.biasFreqZ)})
  ));
}

/** Quadratic bezier from A to B, bowed by arc along the seed bias. */
vec3 morphPath(vec3 from, vec3 to, float local, float seed, float arc) {
  vec3 control = mix(from, to, 0.5) + morphBias(seed) * length(to - from) * arc;
  return mix(mix(from, control, local), mix(control, to, local), local);
}

/** Radius of the inspection lens, widened by the states that invite reading. */
float morphAperture(float radius, float pixelW, float cloudW, float graphW) {
  return radius * (${f(MORPH.aperture)} + pixelW * ${f(MORPH.aperturePixel)} +
    cloudW * ${f(MORPH.apertureCloud)} + graphW * ${f(MORPH.apertureGraph)});
}

/** Lens falloff, 1 at the cursor and 0 at the aperture edge. */
float morphLens(float dist, float aperture, float strength) {
  return (1.0 - smoothstep(aperture * ${f(MORPH.apertureInner)}, aperture, dist)) *
    clamp(strength, 0.0, 1.0);
}

/** A short, directional field disturbance shared by grain and readable nodes. */
vec3 pointerDisturbance(vec3 p, vec2 pointer, vec2 velocity, float energy, float radius) {
  float dist = max(length(p.xy - pointer), 0.0001);
  float edge = max(0.08, radius * 1.35);
  float falloff = 1.0 - smoothstep(edge * 0.12, edge, dist);
  vec2 radial = (p.xy - pointer) / dist;
  float speed = length(velocity);
  vec2 direction = speed > 0.001 ? velocity / speed : vec2(0.0);
  float repel = (0.045 + energy * 0.14) * falloff * falloff;
  float trail = energy * 0.11 * falloff;
  p.xy += radial * repel - direction * trail;
  p.z += energy * falloff * 0.055;
  return p;
}

/** Which of the three packed uncertainty routes this particle belongs to. */
float morphBranch(float index, float edgeCount) {
  return mod(floor(index / max(1.0, edgeCount)), 3.0);
}

float morphConfidence(float branch, float time) {
  return 0.5 + 0.5 * sin(time * ${f(MORPH.branchRate)} + branch * 2.0944);
}

/** The graph propagation front at this radius. */
float morphPropagation(float reach, float time) {
  float wave = fract(time * ${f(MORPH.waveRate)} - reach * ${f(MORPH.waveScale)});
  return smoothstep(0.0, ${f(MORPH.waveHead)}, wave) *
    (1.0 - smoothstep(${f(MORPH.waveHead)}, ${f(MORPH.waveTail)}, wave));
}

/**
 * Every state-specific displacement, applied in one place.
 *
 * The scan and confidence readings come back out because the grain shader
 * shades with them; the node tier uses them too, for mark size and belief.
 */
vec3 morphStateOffset(
  vec3 p,
  float time,
  float seed,
  float index,
  float edgeCount,
  float lens,
  float cloudW,
  float medicalW,
  float uncertaintyW,
  float graphW,
  float constellationW,
  float scanX,
  float turbulence,
  vec2 pointer,
  out float scan,
  out float confidence,
  out float propagation
) {
  // CLOUD — points separate along view depth near the cursor, in proportion to
  // the depth they already have, so the reading is of the structure.
  float depthRead = lens * cloudW;
  p.z += depthRead * (${f(MORPH.cloudDepth)} + p.z * ${f(MORPH.cloudDepthGain)});
  p.xy += (p.xy - pointer) * depthRead * ${f(MORPH.cloudLateral)};

  // VOLUME / HUMAN — a true slice. The instrument keeps cutting whether or not
  // you are pointing at it.
  float slab = 1.0 - smoothstep(${f(MORPH.slabInner)}, ${f(MORPH.slabOuter)}, abs(p.x - scanX));
  scan = medicalW * slab;
  p.x += (scanX - p.x) * scan * ${f(MORPH.slabPull)};
  p.z += scan * ${f(MORPH.slabLift)};

  // UNCERTAINTY — competing distributions alternate rather than blur.
  float branch = morphBranch(index, edgeCount);
  confidence = morphConfidence(branch, time);
  vec3 branchDir = normalize(vec3(
    cos(branch * 2.4 + seed * 6.0),
    sin(branch * 1.7 + seed * 4.0),
    sin(branch * 3.1 + seed * 2.0) + 0.001
  ));
  p += branchDir * uncertaintyW * (${f(MORPH.branchBase)} + (1.0 - confidence) * ${f(MORPH.branchSpread)});

  // GRAPH — relationship propagation along the structure.
  propagation = morphPropagation(length(p), time);
  p += normalize(p + vec3(0.001)) * graphW * propagation * ${f(MORPH.wavePush)};

  // CONSTELLATION — the sky turns, it does not vibrate.
  float orbit = time * ${f(MORPH.orbitRate)} * constellationW;
  float co = cos(orbit);
  float so = sin(orbit);
  p.xz = vec2(co * p.x - so * p.z, so * p.x + co * p.z);
  p += vec3(
    sin(time * 0.05 + seed * 2.1),
    cos(time * 0.041 + seed * 1.7),
    sin(time * 0.033 + seed * 1.3)
  ) * constellationW * ${f(MORPH.driftAmount)};

  // Ambient motion.
  p += vec3(
    sin(time * 0.5 + seed * 40.0),
    cos(time * 0.42 + seed * 33.0),
    sin(time * 0.31 + seed * 27.0)
  ) * (${f(MORPH.ambientBase)} + turbulence * ${f(MORPH.ambientTurbulence)});

  return p;
}
`;

/* ------------------------------------------------------------------------ *
 * TypeScript — the same maths, for the node tier
 * ------------------------------------------------------------------------ */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const morphSmoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export const smoothstep01 = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
};

export function morphLocal(blend: number, stagger: number, spread: number): number {
  return morphSmoother(clamp01((blend - stagger * spread) / Math.max(1e-4, 1 - spread)));
}

export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

const bias: MutableVec3 = { x: 0, y: 0, z: 0 };

export function morphBias(seed: number, out: MutableVec3 = bias): MutableVec3 {
  const x = Math.sin(seed * MORPH.biasFreqX) + 0.001;
  const y = Math.cos(seed * MORPH.biasFreqY);
  const z = Math.sin(seed * MORPH.biasFreqZ);
  const len = Math.hypot(x, y, z) || 1;
  out.x = x / len;
  out.y = y / len;
  out.z = z / len;
  return out;
}

/** Quadratic bezier from A to B, bowed by arc along the seed bias. */
export function morphPath(
  fx: number,
  fy: number,
  fz: number,
  tx: number,
  ty: number,
  tz: number,
  local: number,
  seed: number,
  arc: number,
  out: MutableVec3,
): MutableVec3 {
  const travel = Math.hypot(tx - fx, ty - fy, tz - fz);
  const b = morphBias(seed);
  const cx = (fx + tx) * 0.5 + b.x * travel * arc;
  const cy = (fy + ty) * 0.5 + b.y * travel * arc;
  const cz = (fz + tz) * 0.5 + b.z * travel * arc;
  const u = 1 - local;
  const w0 = u * u;
  const w1 = 2 * u * local;
  const w2 = local * local;
  out.x = fx * w0 + cx * w1 + tx * w2;
  out.y = fy * w0 + cy * w1 + ty * w2;
  out.z = fz * w0 + cz * w1 + tz * w2;
  return out;
}

export function morphAperture(radius: number, pixelW: number, cloudW: number, graphW: number) {
  return (
    radius *
    (MORPH.aperture +
      pixelW * MORPH.aperturePixel +
      cloudW * MORPH.apertureCloud +
      graphW * MORPH.apertureGraph)
  );
}

export function morphLens(dist: number, aperture: number, strength: number) {
  return (
    (1 - smoothstep01(aperture * MORPH.apertureInner, aperture, dist)) * clamp01(strength)
  );
}

/** TypeScript twin of the shared directional pointer disturbance. */
export function pointerDisturbance(
  p: MutableVec3,
  pointerX: number,
  pointerY: number,
  velocityX: number,
  velocityY: number,
  energy: number,
  radius: number,
): MutableVec3 {
  const e = clamp01(energy);
  if (e <= 0.001) return p;

  const dx = p.x - pointerX;
  const dy = p.y - pointerY;
  const dist = Math.max(Math.hypot(dx, dy), 0.0001);
  const edge = Math.max(0.08, radius * 1.35);
  const falloff = 1 - smoothstep01(edge * 0.12, edge, dist);
  const speed = Math.hypot(velocityX, velocityY);
  const directionX = speed > 0.001 ? velocityX / speed : 0;
  const directionY = speed > 0.001 ? velocityY / speed : 0;
  const repel = (0.045 + e * 0.14) * falloff * falloff;
  const trail = e * 0.11 * falloff;

  p.x += (dx / dist) * repel - directionX * trail;
  p.y += (dy / dist) * repel - directionY * trail;
  p.z += e * falloff * 0.055;
  return p;
}

export function morphBranch(index: number, edgeCount: number) {
  return Math.floor(index / Math.max(1, edgeCount)) % 3;
}

export function morphConfidence(branch: number, time: number) {
  return 0.5 + 0.5 * Math.sin(time * MORPH.branchRate + branch * 2.0944);
}

export function morphPropagation(reach: number, time: number) {
  const wave = (time * MORPH.waveRate - reach * MORPH.waveScale) % 1;
  const w = wave < 0 ? wave + 1 : wave;
  return smoothstep01(0, MORPH.waveHead, w) * (1 - smoothstep01(MORPH.waveHead, MORPH.waveTail, w));
}

export interface StateOffsetReadings {
  scan: number;
  confidence: number;
  propagation: number;
}

export interface StateOffsetInput {
  time: number;
  seed: number;
  index: number;
  edgeCount: number;
  lens: number;
  cloudW: number;
  medicalW: number;
  uncertaintyW: number;
  graphW: number;
  constellationW: number;
  scanX: number;
  turbulence: number;
  pointerX: number;
  pointerY: number;
}

/** The TypeScript twin of `morphStateOffset` above. Mutates `p` in place. */
export function morphStateOffset(
  p: MutableVec3,
  input: StateOffsetInput,
  readings: StateOffsetReadings,
): MutableVec3 {
  const {
    time,
    seed,
    index,
    edgeCount,
    lens,
    cloudW,
    medicalW,
    uncertaintyW,
    graphW,
    constellationW,
    scanX,
    turbulence,
    pointerX,
    pointerY,
  } = input;

  const depthRead = lens * cloudW;
  p.z += depthRead * (MORPH.cloudDepth + p.z * MORPH.cloudDepthGain);
  p.x += (p.x - pointerX) * depthRead * MORPH.cloudLateral;
  p.y += (p.y - pointerY) * depthRead * MORPH.cloudLateral;

  const slab = 1 - smoothstep01(MORPH.slabInner, MORPH.slabOuter, Math.abs(p.x - scanX));
  const scan = medicalW * slab;
  p.x += (scanX - p.x) * scan * MORPH.slabPull;
  p.z += scan * MORPH.slabLift;

  const branch = morphBranch(index, edgeCount);
  const confidence = morphConfidence(branch, time);
  let bx = Math.cos(branch * 2.4 + seed * 6);
  let by = Math.sin(branch * 1.7 + seed * 4);
  let bz = Math.sin(branch * 3.1 + seed * 2) + 0.001;
  const blen = Math.hypot(bx, by, bz) || 1;
  bx /= blen;
  by /= blen;
  bz /= blen;
  const push = uncertaintyW * (MORPH.branchBase + (1 - confidence) * MORPH.branchSpread);
  p.x += bx * push;
  p.y += by * push;
  p.z += bz * push;

  const propagation = morphPropagation(Math.hypot(p.x, p.y, p.z), time);
  const plen = Math.hypot(p.x + 0.001, p.y + 0.001, p.z + 0.001) || 1;
  const wave = graphW * propagation * MORPH.wavePush;
  p.x += ((p.x + 0.001) / plen) * wave;
  p.y += ((p.y + 0.001) / plen) * wave;
  p.z += ((p.z + 0.001) / plen) * wave;

  const orbit = time * MORPH.orbitRate * constellationW;
  const co = Math.cos(orbit);
  const so = Math.sin(orbit);
  const ox = co * p.x - so * p.z;
  const oz = so * p.x + co * p.z;
  p.x = ox;
  p.z = oz;
  p.x += Math.sin(time * 0.05 + seed * 2.1) * constellationW * MORPH.driftAmount;
  p.y += Math.cos(time * 0.041 + seed * 1.7) * constellationW * MORPH.driftAmount;
  p.z += Math.sin(time * 0.033 + seed * 1.3) * constellationW * MORPH.driftAmount;

  const ambient = MORPH.ambientBase + turbulence * MORPH.ambientTurbulence;
  p.x += Math.sin(time * 0.5 + seed * 40) * ambient;
  p.y += Math.cos(time * 0.42 + seed * 33) * ambient;
  p.z += Math.sin(time * 0.31 + seed * 27) * ambient;

  readings.scan = scan;
  readings.confidence = confidence;
  readings.propagation = propagation;
  return p;
}
