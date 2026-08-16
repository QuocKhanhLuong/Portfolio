import { ACTS } from '@/content/acts';
import { SCENE_STATES, type ActId, type SceneState } from '@/content/types';

/**
 * The timeline is the single source of pacing. Scroll produces one scalar in
 * [0, 1]; everything downstream — scene state, camera, palette, motion scale,
 * type treatment — is a pure function of it. Nothing else may read scroll.
 */

export interface CameraKey {
  yaw: number;
  pitch: number;
  distance: number;
  /** Screen-space offset of the motif, so it never sits under the copy. */
  offset: [number, number];
  /**
   * How much the camera is allowed to move in three dimensions, 0–1. Held near
   * zero until Act 03 on purpose: depth has to arrive as an event.
   */
  dimensionality: number;
  /** Ambient orbital drift. */
  drift: number;
}

export interface PaletteKey {
  /** Base ink colour, RGB in the range expected by the shader. */
  core: [number, number, number];
  /** Accent used for contours, scan marks, and research structure. */
  accent: [number, number, number];
  /** Overall field opacity — deliberately restrained on paper. */
  density: number;
}

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

/** Paper, graphite, slate, warm ink, and research ochre. */
export const COLOR = {
  ink: rgb('#1B1C1A'),
  inkSoft: rgb('#555A55'),
  muted: rgb('#8B8F89'),
  cool: rgb('#71849A'),
  warm: rgb('#B86546'),
  research: rgb('#A48A58'),
};

/**
 * Per-act tuning of the transition engine and the optical instrument. Each
 * state gets a different inspection radius and reveal strength; the pointer
 * never physically pushes the field around.
 */
export interface InteractionKey {
  /** Local optical reveal strength, not physical displacement. */
  pointerStrength: number;
  /** Radius of the cursor's inspection lens in world units. */
  pointerRadius: number;
  /** Ambient positional noise. */
  turbulence: number;
  /** How much transition paths bow away from a straight line. */
  arc: number;
  /** Width of the per-particle transition stagger, 0–0.9. */
  spread: number;
}

interface ActKey {
  camera: CameraKey;
  palette: PaletteKey;
  /** Time scale for drift, turbulence and transition speed. */
  motion: number;
  interaction: InteractionKey;
}

export const ACT_KEYS: Record<ActId, ActKey> = {
  signal: {
    camera: { yaw: 0, pitch: 0, distance: 4.2, offset: [0, -0.85], dimensionality: 0.05, drift: 0.02 },
    palette: { core: COLOR.inkSoft, accent: COLOR.cool, density: 0.13 },
    motion: 0.35,
    interaction: { pointerStrength: 0.18, pointerRadius: 0.58, turbulence: 0.001, arc: 0.12, spread: 0.55 },
  },
  curiosity: {
    camera: { yaw: 0.04, pitch: 0.02, distance: 3.6, offset: [-0.72, 0.08], dimensionality: 0.12, drift: 0.05 },
    palette: { core: COLOR.inkSoft, accent: COLOR.cool, density: 0.18 },
    motion: 0.7,
    interaction: { pointerStrength: 0.26, pointerRadius: 0.52, turbulence: 0.0015, arc: 0.1, spread: 0.5 },
  },
  representation: {
    camera: { yaw: -0.12, pitch: 0.06, distance: 4.2, offset: [0.78, 0.04], dimensionality: 0.25, drift: 0.08 },
    palette: { core: COLOR.cool, accent: COLOR.ink, density: 0.22 },
    motion: 0.95,
    interaction: { pointerStrength: 0.34, pointerRadius: 0.48, turbulence: 0.0015, arc: 0.16, spread: 0.62 },
  },
  depth: {
    // The first state with real dimensionality. Everything before it was flat.
    camera: { yaw: 0.42, pitch: 0.22, distance: 3.1, offset: [-0.55, 0.05], dimensionality: 1.0, drift: 0.35 },
    palette: { core: COLOR.cool, accent: COLOR.ink, density: 0.24 },
    motion: 1.15,
    interaction: { pointerStrength: 0.38, pointerRadius: 0.72, turbulence: 0.002, arc: 0.12, spread: 0.45 },
  },
  consequence: {
    // A warm annotation state. Slowest motion on the site.
    camera: { yaw: 0.6, pitch: -0.14, distance: 2.9, offset: [0.8, -0.08], dimensionality: 0.85, drift: 0.12 },
    palette: { core: COLOR.warm, accent: COLOR.ink, density: 0.23 },
    motion: 0.4,
    interaction: { pointerStrength: 0.28, pointerRadius: 0.62, turbulence: 0.0008, arc: 0.08, spread: 0.35 },
  },
  uncertainty: {
    camera: { yaw: 0.2, pitch: 0.1, distance: 4.6, offset: [-0.5, 0.05], dimensionality: 0.7, drift: 0.5 },
    palette: { core: COLOR.muted, accent: COLOR.research, density: 0.16 },
    motion: 0.8,
    interaction: { pointerStrength: 0.3, pointerRadius: 0.7, turbulence: 0.003, arc: 0.22, spread: 0.7 },
  },
  frontier: {
    camera: { yaw: 0.1, pitch: 0.06, distance: 5.2, offset: [0, -0.22], dimensionality: 0.6, drift: 0.14 },
    palette: { core: COLOR.research, accent: COLOR.ink, density: 0.21 },
    motion: 0.7,
    interaction: { pointerStrength: 0.36, pointerRadius: 0.66, turbulence: 0.0015, arc: 0.1, spread: 0.4 },
  },
  return: {
    camera: { yaw: 0.28, pitch: 0.14, distance: 9.6, offset: [0, 0], dimensionality: 0.35, drift: 0.06 },
    palette: { core: COLOR.muted, accent: COLOR.inkSoft, density: 0.1 },
    motion: 0.2,
    interaction: { pointerStrength: 0.14, pointerRadius: 0.8, turbulence: 0.0005, arc: 0.14, spread: 0.8 },
  },
};

/** One weight unit of scroll, in viewport heights. */
export const SCROLL_UNIT_VH = 110;

export interface ActRange {
  index: number;
  id: ActId;
  start: number;
  end: number;
  span: number;
}

const TOTAL_WEIGHT = ACTS.reduce((sum, a) => sum + a.weight, 0);

export const ACT_RANGES: ActRange[] = (() => {
  const ranges: ActRange[] = [];
  let cursor = 0;
  ACTS.forEach((act, index) => {
    const span = act.weight / TOTAL_WEIGHT;
    ranges.push({ index, id: act.id, start: cursor, end: cursor + span, span });
    cursor += span;
  });
  return ranges;
})();

/** Total page height in viewport units. */
export const TOTAL_VH = TOTAL_WEIGHT * SCROLL_UNIT_VH;

/**
 * Every scene state gets an anchor on the global progress axis: the point where
 * that state is fully itself. Between anchors the field is in transition. Acts
 * holding two states get two anchors inside their own span, which is why Act 01
 * and Act 04 feel like they move through something rather than sit still.
 */
export interface StateAnchor {
  state: SceneState;
  /** Index into SCENE_STATES. */
  stateIndex: number;
  progress: number;
}

export const STATE_ANCHORS: StateAnchor[] = (() => {
  const anchors: StateAnchor[] = [];
  ACTS.forEach((act, i) => {
    const range = ACT_RANGES[i];
    act.states.forEach((state, k) => {
      // Spread anchors inside the act, inset from the edges so transitions
      // straddle act boundaries instead of snapping at them.
      const t = act.states.length === 1 ? 0.42 : 0.24 + (k * 0.56) / (act.states.length - 1);
      anchors.push({
        state,
        stateIndex: SCENE_STATES.indexOf(state),
        progress: range.start + range.span * t,
      });
    });
  });
  return anchors;
})();
