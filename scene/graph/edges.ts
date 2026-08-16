import type { GraphKey } from '@/lib/narrative/timeline';
import type { NodeField } from './nodes';

/**
 * The edge network.
 *
 * Two things are drawn here, in one buffer:
 *
 *  - The *semantic* edges: the actual relationships in `content/research.ts`,
 *    mapped onto their representative nodes once at build time. These never
 *    change topology — a relationship does not stop existing because two nodes
 *    drifted apart — only opacity, which follows `GraphKey.semantic`.
 *  - The *proximity* edges: whatever the field's current arrangement supports.
 *
 * Proximity selection is explicitly bounded, because "everything within r" is
 * not a diagram, it is a mesh. Every candidate must clear the radius; every node
 * may carry at most `maxDegree` of them; the shortest candidates win; and the
 * whole set is capped by a budget. Selection is deterministic — nodes are
 * visited in index order and neighbours are chosen by distance — so the same
 * arrangement always produces the same network, and a rebuild never reshuffles
 * edges that did not need to move.
 */

export interface EdgeBuffers {
  /** Two vertices per edge, xyz interleaved. */
  position: Float32Array;
  /** Per-vertex falloff weight, 0–1. */
  weight: Float32Array;
  /** 0 for proximity edges, 1 for semantic ones. */
  kind: Float32Array;
  /** Arc length at each vertex, for dashes that keep a constant size. */
  arc: Float32Array;
  /** Node index pairs, so positions can refresh without rebuilding topology. */
  pairs: Int32Array;
  /** Edges currently live. Everything past this is not drawn. */
  count: number;
  capacity: number;
}

export function createEdgeBuffers(nodeCount: number, semanticCount: number): EdgeBuffers {
  // Degree caps bound this: the practical worst case is nodeCount * maxDegree / 2
  // and maxDegree never exceeds 4, plus the fixed semantic set.
  const capacity = nodeCount * 2 + semanticCount + 16;
  return {
    position: new Float32Array(capacity * 6),
    weight: new Float32Array(capacity * 2),
    kind: new Float32Array(capacity * 2),
    arc: new Float32Array(capacity * 2),
    pairs: new Int32Array(capacity * 2),
    count: 0,
    capacity,
  };
}

/** Reusable spatial-hash scratch, sized on first use. */
interface Grid {
  cellStart: Int32Array;
  cellItems: Int32Array;
  counts: Int32Array;
  dim: number;
  cell: number;
  origin: number;
}

let grid: Grid | null = null;

function ensureGrid(nodeCount: number, dim: number): Grid {
  const cells = dim * dim * dim;
  if (!grid || grid.counts.length < cells || grid.cellItems.length < nodeCount) {
    grid = {
      cellStart: new Int32Array(cells + 1),
      cellItems: new Int32Array(nodeCount),
      counts: new Int32Array(cells),
      dim,
      cell: 1,
      origin: 0,
    };
  }
  grid.dim = dim;
  return grid;
}

const degree = new Int32Array(4096);
const candidateIndex = new Int32Array(64);
const candidateDist = new Float32Array(64);

/**
 * Rebuild the network topology. Call this at a reduced rate; call
 * `refreshEdgePositions` every frame.
 */
export function buildEdges(field: NodeField, key: GraphKey, out: EdgeBuffers): void {
  const n = field.count;
  const pos = field.position;
  const radius = Math.max(0.02, key.radius);
  const maxDegree = Math.max(0, Math.round(key.maxDegree));
  let count = 0;

  // Semantic edges first, so they survive the budget when it binds.
  for (let e = 0; e < field.semanticEdgeCount && count < out.capacity; e += 1) {
    out.pairs[count * 2] = field.semanticEdges[e * 2];
    out.pairs[count * 2 + 1] = field.semanticEdges[e * 2 + 1];
    out.kind[count * 2] = 1;
    out.kind[count * 2 + 1] = 1;
    count += 1;
  }

  if (maxDegree > 0 && key.edgeOpacity > 0.001) {
    if (degree.length < n) throw new Error('node count exceeds edge degree scratch');
    degree.fill(0, 0, n);

    // Uniform grid at the search radius: each node then only tests the 27 cells
    // around it rather than all n.
    const dim = Math.max(1, Math.min(24, Math.floor((field.extent * 2) / radius)));
    const g = ensureGrid(n, dim);
    const half = field.extent + radius;
    const cellSize = (half * 2) / dim;
    g.cell = cellSize;
    g.origin = -half;
    const cells = dim * dim * dim;
    g.counts.fill(0, 0, cells);

    const cellOf = (x: number, y: number, z: number) => {
      const cx = Math.min(dim - 1, Math.max(0, ((x - g.origin) / cellSize) | 0));
      const cy = Math.min(dim - 1, Math.max(0, ((y - g.origin) / cellSize) | 0));
      const cz = Math.min(dim - 1, Math.max(0, ((z - g.origin) / cellSize) | 0));
      return (cz * dim + cy) * dim + cx;
    };

    for (let i = 0; i < n; i += 1) {
      g.counts[cellOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])] += 1;
    }
    let running = 0;
    for (let c = 0; c < cells; c += 1) {
      g.cellStart[c] = running;
      running += g.counts[c];
    }
    g.cellStart[cells] = running;
    g.counts.fill(0, 0, cells);
    for (let i = 0; i < n; i += 1) {
      const c = cellOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      g.cellItems[g.cellStart[c] + g.counts[c]] = i;
      g.counts[c] += 1;
    }

    const r2 = radius * radius;
    const maxCandidates = Math.min(candidateIndex.length, maxDegree);

    for (let i = 0; i < n && count < out.capacity; i += 1) {
      if (degree[i] >= maxDegree) continue;

      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      const cx = Math.min(dim - 1, Math.max(0, ((x - g.origin) / cellSize) | 0));
      const cy = Math.min(dim - 1, Math.max(0, ((y - g.origin) / cellSize) | 0));
      const cz = Math.min(dim - 1, Math.max(0, ((z - g.origin) / cellSize) | 0));

      // Keep the `maxDegree` nearest candidates, by insertion — the list is at
      // most four long, so nothing more elaborate is worth its own bugs.
      let found = 0;

      for (let dz = -1; dz <= 1; dz += 1) {
        const zz = cz + dz;
        if (zz < 0 || zz >= dim) continue;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = cy + dy;
          if (yy < 0 || yy >= dim) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = cx + dx;
            if (xx < 0 || xx >= dim) continue;

            const c = (zz * dim + yy) * dim + xx;
            for (let s = g.cellStart[c]; s < g.cellStart[c + 1]; s += 1) {
              const j = g.cellItems[s];
              // i < j only: each pair is considered once, from its lower node.
              if (j <= i || degree[j] >= maxDegree) continue;

              const ex = pos[j * 3] - x;
              const ey = pos[j * 3 + 1] - y;
              const ez = pos[j * 3 + 2] - z;
              const d2 = ex * ex + ey * ey + ez * ez;
              if (d2 > r2) continue;

              let slot = found;
              while (slot > 0 && candidateDist[slot - 1] > d2) {
                candidateDist[slot] = candidateDist[slot - 1];
                candidateIndex[slot] = candidateIndex[slot - 1];
                slot -= 1;
              }
              if (slot < maxCandidates) {
                candidateDist[slot] = d2;
                candidateIndex[slot] = j;
                if (found < maxCandidates) found += 1;
              }
            }
          }
        }
      }

      for (let k = 0; k < found && count < out.capacity; k += 1) {
        if (degree[i] >= maxDegree) break;
        const j = candidateIndex[k];
        if (degree[j] >= maxDegree) continue;
        out.pairs[count * 2] = i;
        out.pairs[count * 2 + 1] = j;
        out.kind[count * 2] = 0;
        out.kind[count * 2 + 1] = 0;
        degree[i] += 1;
        degree[j] += 1;
        count += 1;
      }
    }
  }

  out.count = count;
  refreshEdgePositions(field, key, out);
}

/**
 * Rewrite vertex positions and falloff weights from the nodes' current
 * positions. Runs every frame, whatever the topology rebuild rate: an edge may
 * lag by two frames in *which* nodes it joins, but never in where those nodes
 * actually are.
 */
export function refreshEdgePositions(field: NodeField, key: GraphKey, out: EdgeBuffers): void {
  const pos = field.position;
  const radius = Math.max(0.02, key.radius);
  const falloff = Math.max(0.5, key.falloff);

  for (let e = 0; e < out.count; e += 1) {
    const a = out.pairs[e * 2];
    const b = out.pairs[e * 2 + 1];
    const at = e * 6;

    const ax = pos[a * 3];
    const ay = pos[a * 3 + 1];
    const az = pos[a * 3 + 2];
    const bx = pos[b * 3];
    const by = pos[b * 3 + 1];
    const bz = pos[b * 3 + 2];

    out.position[at] = ax;
    out.position[at + 1] = ay;
    out.position[at + 2] = az;
    out.position[at + 3] = bx;
    out.position[at + 4] = by;
    out.position[at + 5] = bz;

    const length = Math.hypot(bx - ax, by - ay, bz - az);
    // Semantic edges are relationships, not distances: they do not fade with
    // length, they only stretch. Proximity edges fade as they lengthen.
    const w =
      out.kind[e * 2] > 0.5
        ? 1
        : Math.pow(Math.max(0, 1 - length / radius), falloff);

    out.weight[e * 2] = w * (0.55 + field.lens[a] * 0.9);
    out.weight[e * 2 + 1] = w * (0.55 + field.lens[b] * 0.9);
    out.arc[e * 2] = 0;
    out.arc[e * 2 + 1] = length;
  }
}
