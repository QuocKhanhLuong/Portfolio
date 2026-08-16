import { RESEARCH_EDGES, RESEARCH_NODES } from '@/content/research';
import type { SceneState } from '@/content/types';
import { luminanceAt, type EyeSource } from './eye';

/**
 * State generators.
 *
 * Each writes N × vec4 — xyz position, w brightness — into a flat buffer that
 * becomes one row-block of the state texture. Every generator reads the same
 * eye. None of them invent a new subject.
 */

export interface BuildContext {
  eye: EyeSource;
  count: number;
  rng: () => number;
}

export type StateGenerator = (ctx: BuildContext, out: Float32Array) => void;

/** World extent of the image plane. */
const W = 2.15;
const H = 1.92;

const write = (out: Float32Array, i: number, x: number, y: number, z: number, b: number) => {
  const k = i * 4;
  out[k] = x;
  out[k + 1] = y;
  out[k + 2] = z;
  out[k + 3] = b;
};

/** 00 — light before it is a scene: one raster line collapsed to a waveform. */
const signal: StateGenerator = ({ eye, count, rng }, out) => {
  for (let i = 0; i < count; i += 1) {
    const ex = eye.x[i];
    const lum = eye.lum[i];
    const u = (ex + 1) * 0.5;
    const wave =
      0.42 * Math.sin(u * 29) + 0.2 * Math.sin(u * 11 + 1.7) + 0.11 * Math.sin(u * 61) + 0.3 * (lum - 0.5);
    // Most particles sit dark on the line; only the structured part is lit, so
    // the opening reads as almost nothing.
    write(out, i, ex * W, wave * 0.55 + (rng() - 0.5) * 0.03, (rng() - 0.5) * 0.05, 0.12 + lum * 0.3);
  }
};

/** 01a — the same image, quantised hard enough to see the sampling. */
const pixel: StateGenerator = ({ eye, count }, out) => {
  const qx = 0.062;
  const qy = 0.07;
  for (let i = 0; i < count; i += 1) {
    const ex = eye.x[i];
    const ey = eye.y[i];
    const cx = Math.round(ex / qx) * qx;
    const cy = Math.round(ey / qy) * qy;
    const quantised = Math.round(luminanceAt(cx, cy) * 4) / 4;
    // Particles collapse most of the way to their cell centre, so the grid is
    // legible without the field turning into a flat mosaic.
    write(out, i, (cx + (ex - cx) * 0.62) * W, (cy + (ey - cy) * 0.62) * H, 0, 0.03 + Math.pow(quantised, 1.5) * 0.8);
  }
};

/** 01b — full resolution. The first time the subject is recognisable. */
const image: StateGenerator = ({ eye, count }, out) => {
  for (let i = 0; i < count; i += 1) {
    write(out, i, eye.x[i] * W, eye.y[i] * H, 0, Math.pow(eye.lum[i], 1.25) * 0.85);
  }
};

/** 02 — eight oriented edge responses. The image, kept as evidence. */
const features: StateGenerator = ({ eye, count, rng }, out) => {
  const eps = 0.045;
  for (let i = 0; i < count; i += 1) {
    const ex = eye.x[i];
    const ey = eye.y[i];
    const tile = i % 8;
    const col = tile % 4;
    const row = (tile / 4) | 0;
    const theta = (tile * Math.PI) / 8;

    const gx = luminanceAt(ex + eps, ey) - luminanceAt(ex - eps, ey);
    const gy = luminanceAt(ex, ey + eps) - luminanceAt(ex, ey - eps);
    const response = Math.abs(gx * Math.cos(theta) + gy * Math.sin(theta));

    write(
      out,
      i,
      (col - 1.5) * 1.42 + ex * 0.66,
      (0.5 - row) * 1.1 + ey * 0.62,
      (rng() - 0.5) * 0.05,
      0.06 + Math.min(1.3, response * 3.4),
    );
  }
};

/** 03 — depth lifted straight out of luminance. The plane stops being a plane. */
const cloud: StateGenerator = ({ eye, count, rng }, out) => {
  for (let i = 0; i < count; i += 1) {
    const ex = eye.x[i];
    const ey = eye.y[i];
    const lum = eye.lum[i];
    const r = Math.sqrt(ex * ex + ey * ey * 1.7);
    const z = (lum - 0.45) * 0.55 + Math.exp(-r * r * 3.4) * 0.72 - 0.18;
    write(out, i, ex * W, ey * H, z * 1.35 + (rng() - 0.5) * 0.05, 0.28 + lum * 0.62);
  }
};

/** 04a — the cloud closes into a solid. Geometry with an inside. */
const volume: StateGenerator = ({ eye, count, rng }, out) => {
  for (let i = 0; i < count; i += 1) {
    const lum = eye.lum[i];
    const phi = Math.acos(2 * ((i + 0.5) / count) - 1);
    const theta = i * 2.399963; // golden angle — even shell coverage
    const radius = 0.78 + 0.3 * Math.pow(rng(), 0.5) * (lum > 0.5 ? 0.5 : 1);
    write(
      out,
      i,
      radius * Math.sin(phi) * Math.cos(theta) * 1.28,
      radius * Math.cos(phi) * 1.05,
      radius * Math.sin(phi) * Math.sin(theta) * 1.28,
      0.24 + lum * 0.55,
    );
  }
};

/** 04b — a body. Two lobes, folded surface, and one bright scan slice. */
const human: StateGenerator = ({ eye, count, rng }, out) => {
  for (let i = 0; i < count; i += 1) {
    const lum = eye.lum[i];
    const side = i % 2 ? 1 : -1;
    const r1 = rng();
    const r2 = rng();
    const phi = Math.acos(2 * r1 - 1);
    const theta = r2 * Math.PI * 2;
    const fold = 0.72 + 0.1 * Math.sin(phi * 9) * Math.sin(theta * 7);

    let hx = side * 0.3 + fold * Math.sin(phi) * Math.cos(theta) * 0.62;
    let hy = fold * Math.cos(phi) * 0.72 - 0.02;
    const hz = fold * Math.sin(phi) * Math.sin(theta) * 0.8;

    // The midline groove — what makes it read as two hemispheres, not a ball.
    hy -= 0.3 * Math.exp(-(hx * hx) / 0.03) * Math.max(0, -hz);

    // A single illuminated slice, as though something is being looked through.
    const slice = Math.abs(hz) < 0.1 ? 0.75 : 0;

    write(out, i, hx * 1.42, hy * 1.42, hz * 1.3, 0.2 + lum * 0.4 + slice);
  }
};

const NODE_INDEX = new Map(RESEARCH_NODES.map((n, i) => [n.id, i]));
const NODE_POS = RESEARCH_NODES.map((n) => n.position);
const EDGE_PAIRS = RESEARCH_EDGES.map((e) => [NODE_INDEX.get(e.from) ?? 0, NODE_INDEX.get(e.to) ?? 0] as const);
const GRAPH_SCALE = 1.5;

/** 06 — the questions, and what connects them. Nodes are crisp here. */
const graph: StateGenerator = ({ count, rng }, out) => {
  for (let i = 0; i < count; i += 1) {
    if (rng() < 0.3) {
      // clustered at a node
      const n = NODE_POS[i % NODE_POS.length];
      const s = 0.085;
      write(
        out,
        i,
        n[0] * GRAPH_SCALE + (rng() - 0.5) * s,
        n[1] * GRAPH_SCALE + (rng() - 0.5) * s,
        n[2] * GRAPH_SCALE + (rng() - 0.5) * s,
        0.55 + rng() * 0.8,
      );
    } else {
      // travelling along an edge
      const [a, b] = EDGE_PAIRS[i % EDGE_PAIRS.length];
      const A = NODE_POS[a];
      const B = NODE_POS[b];
      const t = rng();
      const j = 0.028;
      write(
        out,
        i,
        (A[0] + (B[0] - A[0]) * t) * GRAPH_SCALE + (rng() - 0.5) * j,
        (A[1] + (B[1] - A[1]) * t) * GRAPH_SCALE + (rng() - 0.5) * j,
        (A[2] + (B[2] - A[2]) * t) * GRAPH_SCALE + (rng() - 0.5) * j,
        0.16 + 0.24 * Math.sin(t * Math.PI),
      );
    }
  }
};

/**
 * 05 — the same graph, before it was sure of itself.
 *
 * Nodes are distributions rather than points: each one is a gaussian smear
 * whose width is its uncertainty. Edges scatter across several candidate paths
 * instead of one, so the structure is visibly present but refuses to commit.
 * The core node is the tightest; the open question is the widest.
 */
const uncertainty: StateGenerator = ({ count, rng }, out) => {
  const gaussian = () => {
    // Box–Muller, so the smear is a real distribution and not a box.
    const u = Math.max(1e-6, rng());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };

  const spread = RESEARCH_NODES.map((n) => (n.kind === 'core' ? 0.16 : n.kind === 'open' ? 0.48 : 0.3));

  for (let i = 0; i < count; i += 1) {
    if (rng() < 0.42) {
      const k = i % NODE_POS.length;
      const n = NODE_POS[k];
      const s = spread[k];
      write(
        out,
        i,
        n[0] * GRAPH_SCALE + gaussian() * s,
        n[1] * GRAPH_SCALE + gaussian() * s,
        n[2] * GRAPH_SCALE + gaussian() * s,
        0.2 + rng() * 0.45,
      );
    } else {
      const [a, b] = EDGE_PAIRS[i % EDGE_PAIRS.length];
      const A = NODE_POS[a];
      const B = NODE_POS[b];
      const t = rng();
      // Three competing routes between the same two ideas.
      const branch = ((i / EDGE_PAIRS.length) | 0) % 3;
      const bow = (branch - 1) * 0.34 * Math.sin(t * Math.PI);
      write(
        out,
        i,
        (A[0] + (B[0] - A[0]) * t) * GRAPH_SCALE + bow * 0.7 + gaussian() * 0.06,
        (A[1] + (B[1] - A[1]) * t) * GRAPH_SCALE + bow + gaussian() * 0.06,
        (A[2] + (B[2] - A[2]) * t) * GRAPH_SCALE + bow * 0.5 + gaussian() * 0.06,
        // Faint, and faintest in the middle: the connection is least certain
        // exactly where it should be strongest.
        0.06 + 0.16 * Math.abs(Math.cos(t * Math.PI)),
      );
    }
  }
};

/**
 * 07 — the sky is made of everything already seen.
 *
 * A fixed share of the stars are earlier states, pushed out to distance: a
 * pixel-grid position here, a point-cloud position there, a graph node further
 * out. Not a metaphor for the journey — literally the coordinates of it.
 */
export function buildConstellation(ctx: BuildContext, out: Float32Array, previous: Float32Array[]) {
  const { count, rng } = ctx;
  const echoStates = previous.length;

  for (let i = 0; i < count; i += 1) {
    const roll = rng();

    if (roll < 0.34 && echoStates > 0) {
      // Echo: take this particle's own position from an earlier state and throw
      // it outward, so its history is where it ends up.
      const src = previous[(i + ((rng() * echoStates) | 0)) % echoStates];
      const k = i * 4;
      const x = src[k];
      const y = src[k + 1];
      const z = src[k + 2];
      const len = Math.hypot(x, y, z) || 1;
      const push = 3.2 + rng() * 3.4;
      write(out, i, (x / len) * push, ((y / len) * push) / 1.35, (z / len) * push, 0.08 + Math.pow(rng(), 3) * 1.2);
    } else {
      const phi = Math.acos(2 * rng() - 1);
      const theta = rng() * Math.PI * 2;
      const r = 3.4 + 2.9 * Math.pow(rng(), 1.6);
      write(
        out,
        i,
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.72,
        r * Math.sin(phi) * Math.sin(theta),
        0.06 + Math.pow(rng(), 4) * 1.5,
      );
    }
  }
}

/** Everything except the constellation, which needs the others to exist first. */
export const GENERATORS: Record<Exclude<SceneState, 'constellation'>, StateGenerator> = {
  signal,
  pixel,
  image,
  features,
  cloud,
  volume,
  human,
  uncertainty,
  graph,
};
