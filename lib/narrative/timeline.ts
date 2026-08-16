import type { SceneState } from '@/content/types';

/**
 * The scene keys are the visual definition of each state.
 *
 * Pacing is no longer defined here. Where a state sits on the scroll axis is
 * measured from the real DOM in `sceneMap.ts`; this file only says what a state
 * looks like once you are in it.
 */

export interface CameraKey {
  yaw: number;
  pitch: number;
  /**
   * Distance from the origin. This no longer decides how big the field looks —
   * `fill` does — so it is free to control perspective alone: closer is a more
   * dimensional read, further is a flatter, more diagrammatic one.
   */
  distance: number;
  /**
   * Fraction of the viewport *height* the field should occupy. The composition
   * divides this by the state's measured radius, so a flat image plane and the
   * constellation both arrive on screen at the size they were asked for.
   */
  fill: number;
  /**
   * Offset in units of the field's on-screen radius, not world units. 0.4 means
   * "shifted by 40% of its own radius", which means the same thing whatever
   * state is showing. Clamped so the field can never leave the frame.
   */
  offset: [number, number];
  /**
   * How much the camera is allowed to move in three dimensions, 0–1. Held near
   * zero through the flat states on purpose: depth has to arrive as an event.
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
  ink: rgb('#ECE9E1'),
  inkSoft: rgb('#929792'),
  muted: rgb('#686D69'),
  cool: rgb('#8296AA'),
  warm: rgb('#C87552'),
  research: rgb('#B49A65'),
};

/**
 * Per-state tuning of the transition engine and the optical instrument. Each
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

/**
 * How the node tier connects itself in a given state.
 *
 * Sparsity is not a large radius. A large radius admits *more* candidate pairs,
 * including long ones that read as noise. A sparse, legible network is a small
 * radius and a low degree cap; a dense one is a larger radius and a higher cap.
 * The budget is the last defence — it bounds the draw regardless of how the
 * field happens to be arranged at that moment.
 */
export interface GraphKey {
  /** Proximity threshold in world units. Beyond it, no edge exists. */
  radius: number;
  /** Maximum edges any one node may carry. The main sparsity control. */
  maxDegree: number;
  /** Falloff exponent on (1 - d/radius). Higher fades long edges faster. */
  falloff: number;
  /** Base opacity of the edge network. */
  edgeOpacity: number;
  /** Node mark size multiplier. */
  nodeSize: number;
  /** Node ink opacity. */
  nodeOpacity: number;
  /**
   * How much the network is the *research* topology rather than a proximity
   * one. At 1 the edges are the actual relationships in `content/research.ts`.
   */
  semantic: number;
}

export interface SceneKey {
  camera: CameraKey;
  palette: PaletteKey;
  /** Time scale for drift, turbulence and transition speed. */
  motion: number;
  interaction: InteractionKey;
  graph: GraphKey;
}

/**
 * One key per scene state. Values carry over from the previous act table so the
 * look of the field is unchanged; only what selects them has moved.
 */
export const SCENE_KEYS: Record<SceneState, SceneKey> = {
  signal: {
    camera: { yaw: 0, pitch: 0, distance: 4.6, fill: 0.7, offset: [0.44, 0.0], dimensionality: 0.05, drift: 0.02 },
    palette: { core: COLOR.inkSoft, accent: COLOR.cool, density: 0.13 },
    motion: 0.35,
    interaction: { pointerStrength: 0.18, pointerRadius: 0.58, turbulence: 0.001, arc: 0.12, spread: 0.55 },
    graph: { radius: 0.30, maxDegree: 2, falloff: 1.7, edgeOpacity: 0.3, nodeSize: 0.95, nodeOpacity: 0.62, semantic: 0 },
  },
  pixel: {
    camera: { yaw: 0.03, pitch: 0.02, distance: 4.2, fill: 0.66, offset: [-0.42, 0.05], dimensionality: 0.1, drift: 0.04 },
    palette: { core: COLOR.inkSoft, accent: COLOR.cool, density: 0.18 },
    motion: 0.7,
    interaction: { pointerStrength: 0.34, pointerRadius: 0.5, turbulence: 0.0012, arc: 0.1, spread: 0.5 },
    graph: { radius: 0.20, maxDegree: 3, falloff: 1.2, edgeOpacity: 0.24, nodeSize: 0.85, nodeOpacity: 0.66, semantic: 0 },
  },
  image: {
    camera: { yaw: 0.05, pitch: 0.02, distance: 4.2, fill: 0.66, offset: [-0.42, 0.04], dimensionality: 0.14, drift: 0.06 },
    palette: { core: COLOR.inkSoft, accent: COLOR.cool, density: 0.19 },
    motion: 0.7,
    interaction: { pointerStrength: 0.24, pointerRadius: 0.54, turbulence: 0.0015, arc: 0.1, spread: 0.5 },
    graph: { radius: 0.22, maxDegree: 3, falloff: 1.2, edgeOpacity: 0.22, nodeSize: 0.85, nodeOpacity: 0.68, semantic: 0 },
  },
  features: {
    camera: { yaw: -0.12, pitch: 0.06, distance: 4.4, fill: 0.68, offset: [0.45, 0.03], dimensionality: 0.25, drift: 0.08 },
    palette: { core: COLOR.cool, accent: COLOR.ink, density: 0.22 },
    motion: 0.95,
    interaction: { pointerStrength: 0.34, pointerRadius: 0.48, turbulence: 0.0015, arc: 0.16, spread: 0.62 },
    graph: { radius: 0.28, maxDegree: 4, falloff: 1.5, edgeOpacity: 0.32, nodeSize: 0.9, nodeOpacity: 0.72, semantic: 0 },
  },
  cloud: {
    // The first state with real dimensionality. Everything before it was flat.
    camera: { yaw: 0.42, pitch: 0.22, distance: 3.6, fill: 0.7, offset: [-0.34, 0.03], dimensionality: 1.0, drift: 0.35 },
    palette: { core: COLOR.cool, accent: COLOR.ink, density: 0.24 },
    motion: 1.15,
    interaction: { pointerStrength: 0.38, pointerRadius: 0.72, turbulence: 0.002, arc: 0.12, spread: 0.45 },
    graph: { radius: 0.24, maxDegree: 3, falloff: 1.8, edgeOpacity: 0.26, nodeSize: 1.0, nodeOpacity: 0.74, semantic: 0 },
  },
  volume: {
    camera: { yaw: 0.55, pitch: -0.1, distance: 3.5, fill: 0.68, offset: [0.46, -0.04], dimensionality: 0.9, drift: 0.14 },
    palette: { core: COLOR.warm, accent: COLOR.ink, density: 0.23 },
    motion: 0.45,
    interaction: { pointerStrength: 0.3, pointerRadius: 0.62, turbulence: 0.0008, arc: 0.08, spread: 0.35 },
    graph: { radius: 0.22, maxDegree: 3, falloff: 1.6, edgeOpacity: 0.22, nodeSize: 0.95, nodeOpacity: 0.7, semantic: 0 },
  },
  human: {
    // A warm annotation state. Slowest motion on the site.
    camera: { yaw: 0.6, pitch: -0.14, distance: 3.4, fill: 0.66, offset: [0.46, -0.05], dimensionality: 0.85, drift: 0.12 },
    palette: { core: COLOR.warm, accent: COLOR.ink, density: 0.23 },
    motion: 0.4,
    interaction: { pointerStrength: 0.28, pointerRadius: 0.62, turbulence: 0.0008, arc: 0.08, spread: 0.35 },
    graph: { radius: 0.20, maxDegree: 2, falloff: 1.6, edgeOpacity: 0.18, nodeSize: 0.95, nodeOpacity: 0.68, semantic: 0 },
  },
  uncertainty: {
    camera: { yaw: 0.2, pitch: 0.1, distance: 4.4, fill: 0.7, offset: [-0.3, 0.03], dimensionality: 0.7, drift: 0.5 },
    palette: { core: COLOR.muted, accent: COLOR.research, density: 0.16 },
    motion: 0.8,
    interaction: { pointerStrength: 0.3, pointerRadius: 0.7, turbulence: 0.003, arc: 0.22, spread: 0.7 },
    graph: { radius: 0.32, maxDegree: 4, falloff: 1.3, edgeOpacity: 0.3, nodeSize: 0.9, nodeOpacity: 0.64, semantic: 0.22 },
  },
  graph: {
    camera: { yaw: 0.1, pitch: 0.06, distance: 4.2, fill: 0.72, offset: [0.5, -0.04], dimensionality: 0.6, drift: 0.14 },
    palette: { core: COLOR.research, accent: COLOR.ink, density: 0.21 },
    motion: 0.7,
    interaction: { pointerStrength: 0.36, pointerRadius: 0.66, turbulence: 0.0015, arc: 0.1, spread: 0.4 },
    graph: { radius: 0.34, maxDegree: 4, falloff: 1.5, edgeOpacity: 0.46, nodeSize: 1.15, nodeOpacity: 0.86, semantic: 0.4 },
  },
  constellation: {
    camera: { yaw: 0.28, pitch: 0.14, distance: 5.4, fill: 0.76, offset: [0.22, 0.0], dimensionality: 0.35, drift: 0.06 },
    palette: { core: COLOR.muted, accent: COLOR.inkSoft, density: 0.1 },
    motion: 0.2,
    interaction: { pointerStrength: 0.14, pointerRadius: 0.8, turbulence: 0.0005, arc: 0.14, spread: 0.8 },
    graph: { radius: 0.55, maxDegree: 1, falloff: 2.2, edgeOpacity: 0.14, nodeSize: 0.8, nodeOpacity: 0.48, semantic: 0 },
  },
};
