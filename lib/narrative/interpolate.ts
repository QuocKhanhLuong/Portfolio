import { ACTS } from '@/content/acts';
import type { Act, SceneState } from '@/content/types';
import { ACT_KEYS, ACT_RANGES, STATE_ANCHORS, type CameraKey, type PaletteKey } from './timeline';

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

const lerp3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export interface NarrativeFrame {
  progress: number;
  /** Index into ACTS of the act currently on screen. */
  actIndex: number;
  act: Act;
  /** 0–1 within the current act. */
  actProgress: number;
  /** Scene states either side of the current transition, and the eased blend. */
  stateA: SceneState;
  stateB: SceneState;
  stateAIndex: number;
  stateBIndex: number;
  blend: number;
  camera: CameraKey;
  palette: PaletteKey;
  motion: number;
  /**
   * How degraded the act headline is, 0 (clean serif) to 1 (Redaction).
   * Only non-zero in acts that declare it.
   */
  redaction: number;
}

/** Act keyframes sit at act centres; between them the values cross-fade. */
const ACT_CENTRES = ACT_RANGES.map((r) => r.start + r.span * 0.5);

function actKeyframeIndices(p: number): [number, number, number] {
  if (p <= ACT_CENTRES[0]) return [0, 0, 0];
  const last = ACT_CENTRES.length - 1;
  if (p >= ACT_CENTRES[last]) return [last, last, 0];
  let i = 0;
  while (i < last && ACT_CENTRES[i + 1] < p) i += 1;
  const t = smootherstep(ACT_CENTRES[i], ACT_CENTRES[i + 1], p);
  return [i, i + 1, t];
}

function stateAnchorIndices(p: number): [number, number, number] {
  const last = STATE_ANCHORS.length - 1;
  if (p <= STATE_ANCHORS[0].progress) return [0, 0, 0];
  if (p >= STATE_ANCHORS[last].progress) return [last, last, 0];
  let i = 0;
  while (i < last && STATE_ANCHORS[i + 1].progress < p) i += 1;
  const raw = (p - STATE_ANCHORS[i].progress) / (STATE_ANCHORS[i + 1].progress - STATE_ANCHORS[i].progress || 1);
  // Hold at each anchor, then transition. Without this the field is always
  // morphing and never reads as *being* anything.
  const t = smootherstep(0.16, 0.88, raw);
  return [i, i + 1, t];
}

export function currentActIndex(p: number): number {
  for (let i = 0; i < ACT_RANGES.length; i += 1) {
    if (p < ACT_RANGES[i].end || i === ACT_RANGES.length - 1) return i;
  }
  return 0;
}

/** Reused across frames — this runs every rAF and must not allocate. */
const scratch: NarrativeFrame = {
  progress: 0,
  actIndex: 0,
  act: ACTS[0],
  actProgress: 0,
  stateA: 'signal',
  stateB: 'signal',
  stateAIndex: 0,
  stateBIndex: 0,
  blend: 0,
  camera: { yaw: 0, pitch: 0, distance: 4, offset: [0, 0], dimensionality: 0, drift: 0 },
  palette: { core: [0, 0, 0], accent: [0, 0, 0], density: 1 },
  motion: 1,
  redaction: 0,
};

export function sample(progress: number, out: NarrativeFrame = scratch): NarrativeFrame {
  const p = clamp(progress);
  out.progress = p;

  const actIndex = currentActIndex(p);
  const range = ACT_RANGES[actIndex];
  out.actIndex = actIndex;
  out.act = ACTS[actIndex];
  out.actProgress = clamp((p - range.start) / (range.span || 1));

  const [sa, sb, blend] = stateAnchorIndices(p);
  const A = STATE_ANCHORS[sa];
  const B = STATE_ANCHORS[sb];
  out.stateA = A.state;
  out.stateB = B.state;
  out.stateAIndex = A.stateIndex;
  out.stateBIndex = B.stateIndex;
  out.blend = blend;

  const [ka, kb, kt] = actKeyframeIndices(p);
  const KA = ACT_KEYS[ACT_RANGES[ka].id];
  const KB = ACT_KEYS[ACT_RANGES[kb].id];

  out.camera.yaw = lerp(KA.camera.yaw, KB.camera.yaw, kt);
  out.camera.pitch = lerp(KA.camera.pitch, KB.camera.pitch, kt);
  out.camera.distance = lerp(KA.camera.distance, KB.camera.distance, kt);
  out.camera.offset[0] = lerp(KA.camera.offset[0], KB.camera.offset[0], kt);
  out.camera.offset[1] = lerp(KA.camera.offset[1], KB.camera.offset[1], kt);
  out.camera.dimensionality = lerp(KA.camera.dimensionality, KB.camera.dimensionality, kt);
  out.camera.drift = lerp(KA.camera.drift, KB.camera.drift, kt);

  const core = lerp3(KA.palette.core, KB.palette.core, kt);
  const accent = lerp3(KA.palette.accent, KB.palette.accent, kt);
  out.palette.core[0] = core[0];
  out.palette.core[1] = core[1];
  out.palette.core[2] = core[2];
  out.palette.accent[0] = accent[0];
  out.palette.accent[1] = accent[1];
  out.palette.accent[2] = accent[2];
  out.palette.density = lerp(KA.palette.density, KB.palette.density, kt);

  out.motion = lerp(KA.motion, KB.motion, kt);
  out.redaction = redactionAt(out.act, out.actProgress);

  return out;
}

/**
 * Type degradation. `resolve` starts unreadable and clears; `dissolve` runs the
 * other way, which is the whole argument of Act 05.
 */
export function redactionAt(act: Act, actProgress: number): number {
  if (!act.redaction) return 0;
  const ramp = smootherstep(0.08, 0.72, actProgress);
  return act.redaction === 'resolve' ? 1 - ramp : ramp;
}
