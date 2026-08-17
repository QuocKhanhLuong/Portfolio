import type { PerfTier } from './narrative/store';

/** Lower bound the adaptive scaler will not go past — below this the eye stops
 *  reading as an image and the whole premise breaks. */
export const MIN_ACTIVE_FRACTION = 0.45;

export const DPR_RANGE: Record<PerfTier, [number, number]> = {
  high: [1, 2],
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
