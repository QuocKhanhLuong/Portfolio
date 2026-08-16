import { SCENE_STATES } from '@/content/types';
import { buildEye, makeRng } from './eye';
import { buildConstellation, GENERATORS, type BuildContext } from './generators';

/**
 * All ten states packed into one float texture, resident on the GPU for the
 * whole visit.
 *
 * The prototype held two states at a time and re-uploaded at every boundary,
 * which is a stall exactly where the eye is most likely to be watching. Here
 * nothing is uploaded after load: the vertex shader samples whichever two rows
 * it needs.
 *
 * Layout: the texture is TILE wide. Each state occupies `rows` consecutive
 * texture rows, so a particle's texel for state s is
 *   row = s * rows + floor(index / TILE),  col = index % TILE
 */
export const TILE = 1024;

export interface PackedStates {
  data: Float32Array;
  width: number;
  height: number;
  rows: number;
  count: number;
  stateCount: number;
  /** Per-particle transition delay, 0–1, spatially coherent. */
  stagger: Float32Array;
  /** Per-particle random seed for arc direction and drift. */
  seed: Float32Array;
  /**
   * Half-extent of each state on each axis, measured not assumed: three floats
   * per state, x then y then z.
   *
   * A single radius is not enough. The states are not the same shape — the
   * image plane is 4.3 wide and 1.6 tall, the hero shell is a ball, the
   * constellation is five times either — so fitting them all by radius frames
   * the wide ones by their width and leaves them a quarter of the viewport
   * high. The scene contain-fits against these instead.
   */
  halfExtent: Float32Array;
}

export function packStates(count: number): PackedStates {
  const eye = buildEye(count);
  const rng = makeRng(981731);
  const ctx: BuildContext = { eye, count, rng };

  const stateCount = SCENE_STATES.length;
  const rows = Math.ceil(count / TILE);
  const width = TILE;
  const height = rows * stateCount;
  const data = new Float32Array(width * height * 4);

  // Build each state into its own scratch buffer first: the constellation
  // needs to read the finished ones, and packing directly would interleave.
  const buffers: Float32Array[] = [];

  SCENE_STATES.forEach((state) => {
    const buffer = new Float32Array(count * 4);
    if (state === 'constellation') {
      buildConstellation(ctx, buffer, buffers.slice(0, -1));
    } else {
      GENERATORS[state](ctx, buffer);
    }
    buffers.push(buffer);
  });

  // Measured from the 98th percentile rather than the true maximum: a handful
  // of far outliers in the constellation would otherwise shrink every frame of
  // it to fit particles nobody can see.
  const halfExtent = new Float32Array(stateCount * 3);
  const scratch = new Float32Array(count);
  const cut = Math.floor(count * 0.98);
  buffers.forEach((buffer, s) => {
    for (let axis = 0; axis < 3; axis += 1) {
      for (let i = 0; i < count; i += 1) scratch[i] = Math.abs(buffer[i * 4 + axis]);
      scratch.sort();
      halfExtent[s * 3 + axis] = Math.max(0.02, scratch[cut]);
    }
  });

  buffers.forEach((buffer, s) => {
    for (let i = 0; i < count; i += 1) {
      const row = s * rows + ((i / TILE) | 0);
      const col = i % TILE;
      const dst = (row * width + col) * 4;
      const src = i * 4;
      data[dst] = buffer[src];
      data[dst + 1] = buffer[src + 1];
      data[dst + 2] = buffer[src + 2];
      data[dst + 3] = buffer[src + 3];
    }
  });

  // Stagger is spatially coherent, not random: it sweeps across the eye, so a
  // transition reads as a wave passing through the field rather than every
  // particle leaving at once. A little noise keeps the wavefront from looking
  // like a wipe.
  const stagger = new Float32Array(count);
  const seed = new Float32Array(count);
  const jitter = makeRng(55221);
  for (let i = 0; i < count; i += 1) {
    const u = (eye.x[i] + 1) * 0.5;
    const v = (eye.y[i] / 0.4 + 1) * 0.5;
    stagger[i] = Math.min(1, Math.max(0, u * 0.72 + v * 0.14 + jitter() * 0.14));
    seed[i] = jitter();
  }

  return { data, width, height, rows, count, stateCount, stagger, seed, halfExtent };
}
