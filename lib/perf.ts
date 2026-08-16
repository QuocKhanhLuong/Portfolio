import type { PerfTier } from './narrative/store';

/**
 * Density is not the quality target. These counts are a starting point that the
 * runtime scales down from; composition and transition behaviour carry the
 * work, and the field reads the same at 18k as at 30k.
 */
export const PARTICLE_COUNT: Record<PerfTier, number> = {
  high: 30000,
  mid: 22000,
  low: 9000,
};

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
