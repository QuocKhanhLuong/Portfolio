/**
 * The source image.
 *
 * Every early state in the sequence is this same eye, re-read differently — as
 * a waveform, as quantised blocks, as edge responses, as depth. That is the
 * reason the transitions feel connected rather than cross-faded: nothing is
 * ever replaced, only re-interpreted.
 */

/** Deterministic RNG, so the field is identical on every load and reload. */
export function makeRng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EYE_HALF_WIDTH = 1.0;
export const EYE_HALF_HEIGHT = 0.4;

/**
 * Luminance of the eye at a normalized point. Sampled both when placing
 * particles and when a state needs to read the image at an offset — the edge
 * responses in `features` depend on it.
 */
export function luminanceAt(x: number, y: number): number {
  const r = Math.sqrt(x * x + y * 1.32 * (y * 1.32));

  // pupil
  if (r < 0.082) return 0.015;

  // iris: the bright, structured part, with radial striation
  if (r < 0.3) {
    const angle = Math.atan2(y * 1.32, x);
    return 0.52 + 0.42 * Math.abs(Math.sin(angle * 22)) * (1 - r / 0.3) + 0.34 * (r / 0.3);
  }

  // sclera: deliberately dim, so the iris carries the composition
  return 0.26 - (0.09 * Math.abs(y)) / EYE_HALF_HEIGHT;
}

export interface EyeSource {
  count: number;
  /** Normalized position within the eye, -1..1 by -0.4..0.4. */
  x: Float32Array;
  y: Float32Array;
  /** Luminance, roughly 0..1.3 including the specular highlight. */
  lum: Float32Array;
}

export function buildEye(count: number, seed = 20260816): EyeSource {
  const rng = makeRng(seed);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const lum = new Float32Array(count);

  const w = EYE_HALF_WIDTH;
  const h = EYE_HALF_HEIGHT;

  for (let i = 0; i < count; i += 1) {
    // Rejection-sample inside the lid shape.
    let px = 0;
    let py = 0;
    let placed = false;
    for (let guard = 0; guard < 40 && !placed; guard += 1) {
      px = (rng() * 2 - 1) * w;
      py = (rng() * 2 - 1) * h;
      const lid = h * Math.pow(Math.max(0, 1 - (px / w) * (px / w)), 0.62);
      if (Math.abs(py) <= lid) placed = true;
    }
    if (!placed) {
      px = (rng() * 2 - 1) * 0.3;
      py = (rng() * 2 - 1) * 0.12;
    }

    x[i] = px;
    y[i] = py;

    let l = luminanceAt(px, py);

    // Soft falloff at the lid, so the silhouette is not a hard cut.
    const r = Math.sqrt(px * px + py * 1.32 * (py * 1.32));
    if (r >= 0.3) {
      const lid = h * Math.pow(Math.max(0, 1 - (px / w) * (px / w)), 0.62);
      l *= Math.min(1, (lid - Math.abs(py)) / 0.09 + 0.2);
    }

    // Specular highlight — the one thing that makes it read as wet and alive.
    const sx = px - 0.115;
    const sy = py - 0.095;
    l += 0.95 * Math.exp(-(sx * sx + sy * sy) / 0.0013);

    lum[i] = Math.max(0.012, Math.min(1.3, l));
  }

  return { count, x, y, lum };
}
