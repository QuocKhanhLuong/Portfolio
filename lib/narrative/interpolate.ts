import { SCENE_STATES, type SceneState } from '@/content/types';
import { currentSceneIndex, sceneAnchors } from './sceneMap';
import { SCENE_KEYS, type CameraKey, type GraphKey, type InteractionKey, type PaletteKey } from './timeline';

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Standard smoothstep, remapped from an arbitrary window. */
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
};

/** Ken Perlin's smoother variant — no second-derivative discontinuity, so
 *  camera moves have no perceptible kick at keyframe boundaries. */
export const smootherstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export interface NarrativeFrame {
  progress: number;
  /** Index of the anchor whose stretch of page is on screen. */
  sceneIndex: number;
  /** Scene states either side of the current transition, and the eased blend. */
  stateA: SceneState;
  stateB: SceneState;
  stateAIndex: number;
  stateBIndex: number;
  blend: number;
  camera: CameraKey;
  palette: PaletteKey;
  interaction: InteractionKey;
  graph: GraphKey;
  motion: number;
}

/** Reused across frames — this runs every rAF and must not allocate. */
const scratch: NarrativeFrame = makeFrame();

export function makeFrame(): NarrativeFrame {
  return {
    progress: 0,
    sceneIndex: 0,
    stateA: 'signal',
    stateB: 'signal',
    stateAIndex: 0,
    stateBIndex: 0,
    blend: 0,
    camera: { yaw: 0, pitch: 0, distance: 4, offset: [0, 0], dimensionality: 0, drift: 0 },
    palette: { core: [0, 0, 0], accent: [0, 0, 0], density: 1 },
    interaction: { pointerStrength: 0, pointerRadius: 0.5, turbulence: 0, arc: 0, spread: 0.5 },
    graph: {
      radius: 0.3,
      maxDegree: 3,
      falloff: 1.5,
      edgeOpacity: 0.2,
      nodeSize: 1,
      nodeOpacity: 0.4,
      semantic: 0,
    },
    motion: 1,
  };
}

export function sample(progress: number, out: NarrativeFrame = scratch): NarrativeFrame {
  const p = clamp(progress);
  const anchors = sceneAnchors();
  const last = anchors.length - 1;

  out.progress = p;

  let a = 0;
  let b = 0;
  let raw = 0;

  if (p <= anchors[0].progress) {
    a = b = 0;
  } else if (p >= anchors[last].progress) {
    a = b = last;
  } else {
    a = currentSceneIndex(p);
    b = Math.min(last, a + 1);
    const span = anchors[b].progress - anchors[a].progress;
    raw = span > 0 ? (p - anchors[a].progress) / span : 0;
  }

  // Hold at each anchor, then transition. Without this the field is always
  // morphing and never reads as *being* anything.
  const blend = a === b ? 0 : smootherstep(0.16, 0.88, raw);

  out.sceneIndex = a;
  out.stateA = anchors[a].state;
  out.stateB = anchors[b].state;
  out.stateAIndex = anchors[a].stateIndex;
  out.stateBIndex = anchors[b].stateIndex;
  out.blend = blend;

  const KA = SCENE_KEYS[out.stateA];
  const KB = SCENE_KEYS[out.stateB];

  out.camera.yaw = lerp(KA.camera.yaw, KB.camera.yaw, blend);
  out.camera.pitch = lerp(KA.camera.pitch, KB.camera.pitch, blend);
  out.camera.distance = lerp(KA.camera.distance, KB.camera.distance, blend);
  out.camera.offset[0] = lerp(KA.camera.offset[0], KB.camera.offset[0], blend);
  out.camera.offset[1] = lerp(KA.camera.offset[1], KB.camera.offset[1], blend);
  out.camera.dimensionality = lerp(KA.camera.dimensionality, KB.camera.dimensionality, blend);
  out.camera.drift = lerp(KA.camera.drift, KB.camera.drift, blend);

  for (let i = 0; i < 3; i += 1) {
    out.palette.core[i] = lerp(KA.palette.core[i], KB.palette.core[i], blend);
    out.palette.accent[i] = lerp(KA.palette.accent[i], KB.palette.accent[i], blend);
  }
  out.palette.density = lerp(KA.palette.density, KB.palette.density, blend);

  out.interaction.pointerStrength = lerp(KA.interaction.pointerStrength, KB.interaction.pointerStrength, blend);
  out.interaction.pointerRadius = lerp(KA.interaction.pointerRadius, KB.interaction.pointerRadius, blend);
  out.interaction.turbulence = lerp(KA.interaction.turbulence, KB.interaction.turbulence, blend);
  out.interaction.arc = lerp(KA.interaction.arc, KB.interaction.arc, blend);
  out.interaction.spread = lerp(KA.interaction.spread, KB.interaction.spread, blend);

  out.graph.radius = lerp(KA.graph.radius, KB.graph.radius, blend);
  out.graph.maxDegree = lerp(KA.graph.maxDegree, KB.graph.maxDegree, blend);
  out.graph.falloff = lerp(KA.graph.falloff, KB.graph.falloff, blend);
  out.graph.edgeOpacity = lerp(KA.graph.edgeOpacity, KB.graph.edgeOpacity, blend);
  out.graph.nodeSize = lerp(KA.graph.nodeSize, KB.graph.nodeSize, blend);
  out.graph.nodeOpacity = lerp(KA.graph.nodeOpacity, KB.graph.nodeOpacity, blend);
  out.graph.semantic = lerp(KA.graph.semantic, KB.graph.semantic, blend);

  out.motion = lerp(KA.motion, KB.motion, blend);

  return out;
}

/**
 * Per-state presence, as discrete weights.
 *
 * Scene identity is categorical: state 4 (cloud) blended with state 8 (graph)
 * is *not* state 6 (human). Interpolating the indices and then asking "how close
 * is this number to the medical state" produced exactly that bug — a focused
 * cloud plus a graph read as a body scan. Here each state that is actually
 * present contributes its own weight, and nothing else is ever implicated.
 */
export function stateWeights(
  frame: NarrativeFrame,
  focusState: number,
  focusMix: number,
  out: Float32Array,
): Float32Array {
  out.fill(0);
  const f = clamp(focusMix, 0, 1);
  const base = 1 - f;
  out[frame.stateAIndex] += (1 - frame.blend) * base;
  out[frame.stateBIndex] += frame.blend * base;
  if (focusState >= 0 && focusState < out.length) out[focusState] += f;
  return out;
}

export function makeStateWeights(): Float32Array {
  return new Float32Array(SCENE_STATES.length);
}
