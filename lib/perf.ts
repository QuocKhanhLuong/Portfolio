import type { PerfTier } from './narrative/store';

/**
 * The grain tier. Subordinate to the graph since the node layer arrived: it is
 * substrate, not subject, so it runs at roughly a third of its former density.
 * Density was never the quality target anyway — composition and transition
 * behaviour carry the work.
 */
export const PARTICLE_COUNT: Record<PerfTier, number> = {
  high: 12000,
  mid: 8000,
  low: 3500,
};

/**
 * The node tier — the readable graph.
 *
 * These nodes are a deterministic subset of the same particle buffer, so the
 * count must stay well under `PARTICLE_COUNT` at every tier. A few hundred is
 * the range where a proximity network reads as a diagram; past about 600 it
 * silts up into a mesh, and the O(n·k) edge pass stops being free.
 */
export const NODE_COUNT: Record<PerfTier, number> = {
  high: 420,
  mid: 320,
  low: 180,
};

/** Node marks scale down with the field so the diagram keeps its weight. */
export const NODE_SCALE: Record<PerfTier, number> = {
  high: 1,
  mid: 0.95,
  low: 0.86,
};

/** Edge topology is rebuilt at most this often, in frames, when scroll is calm. */
export const EDGE_REBUILD_INTERVAL = 3;

/** Lower bound the adaptive scaler will not go past — below this the eye stops
 *  reading as an image and the whole premise breaks. */
export const MIN_ACTIVE_FRACTION = 0.45;

export const DPR_RANGE: Record<PerfTier, [number, number]> = {
  high: [1, 1.75],
  mid: [1, 1.5],
  low: [1, 1.25],
};

export function detectTier(): PerfTier {
  if (typeof navigator === 'undefined') return 'mid';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 820;

  if (coarse || narrow) return cores >= 8 && memory >= 6 ? 'mid' : 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  if (cores >= 4) return 'mid';
  return 'low';
}
