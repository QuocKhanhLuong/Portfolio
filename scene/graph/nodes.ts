import { RESEARCH_EDGES, RESEARCH_NODES } from '@/content/research';
import { SCENE_STATES } from '@/content/types';
import type { NarrativeFrame } from '@/lib/narrative/interpolate';
import { GRAPH_SCALE } from '@/scene/states/generators';
import type { PackedStates } from '@/scene/states/pack';
import {
  clamp01,
  morphAperture,
  morphLens,
  morphLocal,
  morphPath,
  morphStateOffset,
  type MutableVec3,
  type StateOffsetInput,
  type StateOffsetReadings,
} from '../morph/core';

/**
 * The node tier: a deterministic subset of the particle field, evaluated on the
 * CPU because edges need real distances between real positions on the main
 * thread.
 *
 * These are not new points. They are particles 0, k, 2k … of the same packed
 * buffer the grain shader draws, moved by the same morph functions with the same
 * stagger, arc, focus and pointer semantics. A node is therefore always sitting
 * exactly on top of the grain particle it was drawn from — which is what makes
 * the two layers read as one field being looked at two ways, rather than a
 * diagram floating over a texture.
 */

export interface NodeField {
  count: number;
  /** Index into the packed particle buffer for each node. */
  source: Int32Array;
  /** Live world positions, xyz interleaved. Rewritten every frame. */
  position: Float32Array;
  /** Per-node brightness from the packed state, 0–~1.5. */
  brightness: Float32Array;
  /** Lens response, asymmetrically smoothed. */
  lens: Float32Array;
  /** Per-node scan and belief readings, for marks. */
  scan: Float32Array;
  confidence: Float32Array;
  /** Node pairs that carry actual research relationships. */
  semanticEdges: Int32Array;
  semanticEdgeCount: number;
  /** Bounding radius of the current frame's positions, for the edge grid. */
  extent: number;
}

/** The lens engages quickly and lets go slowly — reading, not flicking. */
const LENS_ATTACK = 0.42;
const LENS_RELEASE = 0.055;

const NODE_INDEX = new Map(RESEARCH_NODES.map((n, i) => [n.id, i]));

export function buildNodeField(packed: PackedStates, wanted: number): NodeField {
  const count = Math.max(24, Math.min(wanted, packed.count));
  const stride = Math.max(1, Math.floor(packed.count / count));

  const source = new Int32Array(count);
  for (let i = 0; i < count; i += 1) source[i] = Math.min(packed.count - 1, i * stride);

  const field: NodeField = {
    count,
    source,
    position: new Float32Array(count * 3),
    brightness: new Float32Array(count),
    lens: new Float32Array(count),
    scan: new Float32Array(count),
    confidence: new Float32Array(count),
    semanticEdges: new Int32Array(0),
    semanticEdgeCount: 0,
    extent: 1,
  };

  buildSemanticEdges(packed, field);
  return field;
}

/**
 * Map the research topology onto the node subset.
 *
 * The `graph` state already packs particles onto research node clusters and
 * along their edges. So for each research node we find the subset node that
 * landed closest to it in that state, and use those as the representatives. The
 * result is that when the graph state is on screen the edges drawn are the
 * actual relationships in `content/research.ts` — `builds`, `informs`,
 * `tension` — rather than whichever particles happen to be near each other.
 */
function buildSemanticEdges(packed: PackedStates, field: NodeField) {
  const graphState = SCENE_STATES.indexOf('graph');
  if (graphState < 0) return;

  const representative = new Int32Array(RESEARCH_NODES.length).fill(-1);
  const best = new Float32Array(RESEARCH_NODES.length).fill(Infinity);
  const p = { x: 0, y: 0, z: 0 };

  for (let n = 0; n < field.count; n += 1) {
    readState(packed, graphState, field.source[n], p);
    for (let r = 0; r < RESEARCH_NODES.length; r += 1) {
      const target = RESEARCH_NODES[r].position;
      const d =
        (p.x - target[0] * GRAPH_SCALE) ** 2 +
        (p.y - target[1] * GRAPH_SCALE) ** 2 +
        (p.z - target[2] * GRAPH_SCALE) ** 2;
      if (d < best[r]) {
        best[r] = d;
        representative[r] = n;
      }
    }
  }

  const pairs: number[] = [];
  RESEARCH_EDGES.forEach((edge) => {
    const from = NODE_INDEX.get(edge.from);
    const to = NODE_INDEX.get(edge.to);
    if (from === undefined || to === undefined) return;
    const a = representative[from];
    const b = representative[to];
    if (a < 0 || b < 0 || a === b) return;
    pairs.push(a, b);
  });

  field.semanticEdges = Int32Array.from(pairs);
  field.semanticEdgeCount = pairs.length / 2;
}

/** One texel of the packed buffer: position in xyz, brightness in w. */
function readState(packed: PackedStates, state: number, index: number, out: MutableVec3): number {
  const row = state * packed.rows + ((index / packed.width) | 0);
  const col = index % packed.width;
  const at = (row * packed.width + col) * 4;
  out.x = packed.data[at];
  out.y = packed.data[at + 1];
  out.z = packed.data[at + 2];
  return packed.data[at + 3];
}

export interface NodeUpdate {
  frame: NarrativeFrame;
  /** Slot indices, so nothing here has to know the order of SCENE_STATES. */
  index: {
    pixel: number;
    cloud: number;
    volume: number;
    human: number;
    uncertainty: number;
    graph: number;
    constellation: number;
  };
  time: number;
  focusState: number;
  focusMix: number;
  scanX: number;
  pointerX: number;
  pointerY: number;
  pointerStrength: number;
  edgeCount: number;
  reducedMotion: boolean;
  /** Frame delta, so lens smoothing is frame-rate independent. */
  delta: number;
}

const from: MutableVec3 = { x: 0, y: 0, z: 0 };
const to: MutableVec3 = { x: 0, y: 0, z: 0 };
const focusPos: MutableVec3 = { x: 0, y: 0, z: 0 };
const p: MutableVec3 = { x: 0, y: 0, z: 0 };
const readings: StateOffsetReadings = { scan: 0, confidence: 0, propagation: 0 };
const offsetInput: StateOffsetInput = {
  time: 0,
  seed: 0,
  index: 0,
  edgeCount: 1,
  lens: 0,
  cloudW: 0,
  medicalW: 0,
  uncertaintyW: 0,
  graphW: 0,
  constellationW: 0,
  scanX: 0,
  turbulence: 0,
  pointerX: 0,
  pointerY: 0,
};

/**
 * Advance every node one frame. Allocates nothing.
 *
 * This is the CPU half of the pair in `scene/morph/core.ts` — the sequence
 * below is the same sequence the grain vertex shader runs, in the same order,
 * against the same constants.
 */
export function updateNodes(field: NodeField, packed: PackedStates, u: NodeUpdate) {
  const { frame, index } = u;
  const focusMix = clamp01(u.focusMix);
  const base = 1 - focusMix;

  // Categorical presence, exactly as the shader computes it: a slot's weight is
  // the sum of the weights of the slots that actually hold it, never a distance
  // to an interpolated index.
  //
  // Only three slots can be occupied in any frame, so the presence of each
  // state the morph cares about is resolved once here from the three selectors
  // rather than per node — this loop runs a few hundred times a frame and must
  // not allocate.
  const slotA = frame.stateAIndex;
  const slotB = frame.stateBIndex;
  const slotF = u.focusState;

  let extent = 0;

  for (let n = 0; n < field.count; n += 1) {
    const i = field.source[n];
    const stagger = packed.stagger[i];
    const seed = packed.seed[i];

    const local = morphLocal(frame.blend, stagger, frame.interaction.spread);

    const bA = readState(packed, frame.stateAIndex, i, from);
    const bB = readState(packed, frame.stateBIndex, i, to);
    morphPath(from.x, from.y, from.z, to.x, to.y, to.z, local, seed, frame.interaction.arc, p);
    let brightness = bA + (bB - bA) * local;

    if (focusMix > 0.001) {
      const bF = readState(packed, u.focusState, i, focusPos);
      p.x += (focusPos.x - p.x) * focusMix;
      p.y += (focusPos.y - p.y) * focusMix;
      p.z += (focusPos.z - p.z) * focusMix;
      brightness += (bF - brightness) * focusMix;
    }

    const wA = (1 - local) * base;
    const wB = local * base;

    const pixelW =
      (slotA === index.pixel ? wA : 0) +
      (slotB === index.pixel ? wB : 0) +
      (slotF === index.pixel ? focusMix : 0);
    const cloudW =
      (slotA === index.cloud ? wA : 0) +
      (slotB === index.cloud ? wB : 0) +
      (slotF === index.cloud ? focusMix : 0);
    const volumeW =
      (slotA === index.volume ? wA : 0) +
      (slotB === index.volume ? wB : 0) +
      (slotF === index.volume ? focusMix : 0);
    const humanW =
      (slotA === index.human ? wA : 0) +
      (slotB === index.human ? wB : 0) +
      (slotF === index.human ? focusMix : 0);
    const medicalW = clamp01(volumeW + humanW);
    const uncertaintyW =
      (slotA === index.uncertainty ? wA : 0) +
      (slotB === index.uncertainty ? wB : 0) +
      (slotF === index.uncertainty ? focusMix : 0);
    const graphW =
      (slotA === index.graph ? wA : 0) +
      (slotB === index.graph ? wB : 0) +
      (slotF === index.graph ? focusMix : 0);
    const constellationW =
      (slotA === index.constellation ? wA : 0) +
      (slotB === index.constellation ? wB : 0) +
      (slotF === index.constellation ? focusMix : 0);

    // The lens: same aperture rule as the shader, but held on the node with an
    // asymmetric filter so an inspected node stays lit while the eye is on it.
    const aperture = morphAperture(frame.interaction.pointerRadius, pixelW, cloudW, graphW);
    const dist = Math.hypot(p.x - u.pointerX, p.y - u.pointerY);
    const targetLens = u.reducedMotion
      ? 0
      : morphLens(dist, aperture, frame.interaction.pointerStrength * u.pointerStrength);
    const rate = targetLens > field.lens[n] ? LENS_ATTACK : LENS_RELEASE;
    // Frame-rate independent, referenced to 60fps so the constants keep meaning.
    field.lens[n] += (targetLens - field.lens[n]) * (1 - Math.pow(1 - rate, u.delta * 60));
    const lens = field.lens[n];

    offsetInput.time = u.time;
    offsetInput.seed = seed;
    offsetInput.index = i;
    offsetInput.edgeCount = u.edgeCount;
    offsetInput.lens = lens;
    offsetInput.cloudW = cloudW;
    offsetInput.medicalW = medicalW;
    offsetInput.uncertaintyW = uncertaintyW;
    offsetInput.graphW = graphW;
    offsetInput.constellationW = constellationW;
    offsetInput.scanX = u.scanX;
    offsetInput.turbulence = u.reducedMotion ? 0 : frame.interaction.turbulence;
    offsetInput.pointerX = u.pointerX;
    offsetInput.pointerY = u.pointerY;
    morphStateOffset(p, offsetInput, readings);

    // The inspection lift. The cursor is an instrument, not a force: a node
    // under it rises a little toward the viewer and brightens. It does not flee.
    p.z += lens * (0.03 + graphW * 0.05);

    const at = n * 3;
    field.position[at] = p.x;
    field.position[at + 1] = p.y;
    field.position[at + 2] = p.z;
    field.brightness[n] = brightness + readings.propagation * graphW * 0.4;
    field.scan[n] = readings.scan;
    field.confidence[n] = 1 - uncertaintyW * (1 - readings.confidence);

    const r = Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z);
    if (r > extent) extent = r;
  }

  field.extent = Math.max(1, extent);
}
