import * as THREE from 'three';
import { SCENE_STATES, type SceneState } from '@/content/types';

/** Fixed topology keeps the field predictable on the M1 baseline. */
export const FIELD_NODE_COUNT = 350;
export const FIELD_POINT_SIZE = 4.5;
export const FIELD_EDGE_DISTANCE = 0.72;
export const FIELD_EDGE_OPACITY = 0.06;

export interface FieldEdge {
  a: number;
  b: number;
}

export interface Field {
  seed: THREE.Vector3[];
  phases: Float32Array;
  directionHash: Float32Array;
  magnitudeHash: Float32Array;
  states: SceneState[];
  targets: Record<SceneState, THREE.Vector3[]>;
  edges: FieldEdge[];
}

function randomSource(seed = 0x9e3779b9) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fract(value: number) {
  return value - Math.floor(value);
}

function resamplePath(path: [number, number][], count: number, random: () => number) {
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index < path.length; index += 1) {
    const current = path[index];
    const next = path[(index + 1) % path.length];
    const length = Math.hypot(next[0] - current[0], next[1] - current[1]);
    lengths.push(length);
    total += length;
  }

  const points: THREE.Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    let distance = (index / count) * total;
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]) {
      distance -= lengths[segment];
      segment += 1;
    }
    const current = path[segment];
    const next = path[(segment + 1) % path.length];
    const ratio = lengths[segment] ? distance / lengths[segment] : 0;
    points.push(
      new THREE.Vector3(
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
        (random() - 0.5) * 0.12,
      ),
    );
  }
  return points;
}

function resamplePaths(paths: [number, number][][], count: number, random: () => number) {
  const lengths = paths.map((path) => {
    let length = 0;
    for (let index = 0; index < path.length; index += 1) {
      const current = path[index];
      const next = path[(index + 1) % path.length];
      length += Math.hypot(next[0] - current[0], next[1] - current[1]);
    }
    return length;
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const points: THREE.Vector3[] = [];
  let allocated = 0;
  paths.forEach((path, index) => {
    const samples = index === paths.length - 1
      ? Math.max(1, count - allocated)
      : Math.max(2, Math.round((count * lengths[index]) / Math.max(total, 1e-6)));
    allocated += samples;
    points.push(...resamplePath(path, samples, random));
  });
  while (points.length < count) points.push(points[points.length - 1]?.clone() ?? new THREE.Vector3());
  return points.slice(0, count);
}

function circle(cx: number, cy: number, radius: number, count: number): [number, number][] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

function ellipse(cx: number, cy: number, radiusX: number, radiusY: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY] as [number, number];
  });
}

function rectangle(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  return [[x0, y1], [x1, y1], [x1, y0], [x0, y0]];
}

function roundedRect(cx: number, cy: number, width: number, height: number, radius: number, segments = 5) {
  const halfWidth = width / 2 - radius;
  const halfHeight = height / 2 - radius;
  const corners: [number, number][] = [
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
  ];
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const points: [number, number][] = [];
  for (let corner = 0; corner < 4; corner += 1) {
    for (let index = 0; index <= segments; index += 1) {
      const angle = angles[corner] + (index / segments) * (Math.PI / 2);
      points.push([
        cx + corners[corner][0] + Math.cos(angle) * radius,
        cy + corners[corner][1] + Math.sin(angle) * radius,
      ]);
    }
  }
  return points;
}

function scaleAndShift(path: [number, number][], scale: number, x = 0, y = 0) {
  return path.map(([px, py]) => [px * scale + x, py * scale + y] as [number, number]);
}

function line(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  return [[x0, y0], [x1, y1], [x0, y0]];
}

function makeShapeTargets(random: () => number): Record<SceneState, THREE.Vector3[]> {
  const pixelCells: [number, number][][] = [];
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) {
      if ((row + column + 4) % 3 !== 0) pixelCells.push(rectangle(column * 0.34 - 0.12, row * 0.34 - 0.12, column * 0.34 + 0.12, row * 0.34 + 0.12));
    }
  }

  const image = [
    roundedRect(0, 0.22, 2.5, 1.7, 0.12),
    roundedRect(0, 0.22, 2.15, 1.35, 0.06),
    line(-0.95, -0.18, 0.95, -0.18),
    line(-0.78, -0.46, 0.42, -0.46),
  ];

  const featureKeypoints = [
    circle(-0.72, 0.42, 0.14, 18),
    circle(0.72, 0.42, 0.14, 18),
    circle(-0.26, -0.2, 0.11, 16),
    circle(0.26, -0.2, 0.11, 16),
    line(-0.72, 0.42, -0.26, -0.2),
    line(0.72, 0.42, 0.26, -0.2),
    line(-0.26, -0.2, 0.26, -0.2),
  ];

  const pointCloud = [
    ellipse(0, 0, 1.1, 0.72, 56),
    ellipse(0, 0, 0.68, 0.4, 34),
    circle(-0.55, 0.3, 0.16, 14),
    circle(0.58, -0.28, 0.2, 14),
  ];

  const volume = [
    rectangle(-0.9, -0.72, 0.9, 0.72),
    rectangle(-0.68, -0.54, 1.12, 0.9),
    rectangle(-0.46, -0.36, 1.34, 1.08),
    line(-0.9, -0.72, -0.46, -0.36),
    line(0.9, -0.72, 1.34, -0.36),
    line(0.9, 0.72, 1.34, 1.08),
  ];

  const contour = [
    scaleAndShift(ellipse(0, 0, 0.9, 1.05, 48), 1, -0.16, 0),
    scaleAndShift(ellipse(0, 0, 0.34, 0.52, 28), 1, -0.38, 0.1),
    scaleAndShift(ellipse(0, 0, 0.3, 0.46, 28), 1, 0.22, -0.16),
    line(-0.18, 0.8, -0.5, 1.18),
    line(0.18, 0.8, 0.56, 1.18),
  ];

  const uncertainty = [
    ellipse(0, 0, 0.95, 0.55, 42),
    ellipse(0, 0, 0.52, 0.28, 28),
    circle(-0.7, 0.38, 0.1, 12),
    circle(0.62, 0.22, 0.12, 12),
    circle(0.2, -0.38, 0.08, 12),
  ];

  const graph: [number, number][][] = [
    circle(-0.78, 0.42, 0.14, 14),
    circle(0, 0.72, 0.14, 14),
    circle(0.78, 0.42, 0.14, 14),
    circle(-0.42, -0.52, 0.14, 14),
    circle(0.42, -0.52, 0.14, 14),
    line(-0.78, 0.42, 0, 0.72),
    line(0, 0.72, 0.78, 0.42),
    line(-0.78, 0.42, -0.42, -0.52),
    line(0.78, 0.42, 0.42, -0.52),
    line(-0.42, -0.52, 0.42, -0.52),
  ];

  const constellation = [
    line(-0.94, 0.8, -0.94, -0.8),
    arc(0, 0, 0.94, Math.PI * 0.52, Math.PI * 1.48, 30),
    line(0.12, 0.8, 0.58, -0.8),
    line(0.58, -0.8, 1.02, 0.8),
    line(0.28, 0.04, 0.82, 0.04),
  ];

  const targets = {
    signal: [] as THREE.Vector3[],
    pixel: resamplePaths(pixelCells.map((path) => scaleAndShift(path, 1.35)), FIELD_NODE_COUNT, random),
    image: resamplePaths(image, FIELD_NODE_COUNT, random),
    features: resamplePaths(featureKeypoints, FIELD_NODE_COUNT, random),
    cloud: resamplePaths(pointCloud, FIELD_NODE_COUNT, random),
    volume: resamplePaths(volume, FIELD_NODE_COUNT, random),
    human: resamplePaths(contour, FIELD_NODE_COUNT, random),
    uncertainty: resamplePaths(uncertainty, FIELD_NODE_COUNT, random),
    graph: resamplePaths(graph, FIELD_NODE_COUNT, random),
    constellation: resamplePaths(constellation, FIELD_NODE_COUNT, random),
  } satisfies Record<SceneState, THREE.Vector3[]>;

  return targets;
}

function arc(cx: number, cy: number, radius: number, start: number, end: number, count: number): [number, number][] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = start + (index / count) * (end - start);
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

export function createField(): Field {
  const random = randomSource();
  const seed: THREE.Vector3[] = [];
  for (let index = 0; index < FIELD_NODE_COUNT; index += 1) {
    const radius = 0.6 + random() * 1.7;
    const azimuth = random() * Math.PI * 2;
    const polar = Math.acos(2 * random() - 1);
    seed.push(new THREE.Vector3(
      radius * Math.sin(polar) * Math.cos(azimuth),
      radius * Math.sin(polar) * Math.sin(azimuth),
      radius * Math.cos(polar),
    ));
  }

  const phases = new Float32Array(FIELD_NODE_COUNT);
  const directionHash = new Float32Array(FIELD_NODE_COUNT);
  const magnitudeHash = new Float32Array(FIELD_NODE_COUNT);
  for (let index = 0; index < FIELD_NODE_COUNT; index += 1) {
    phases[index] = random() * Math.PI * 2;
    directionHash[index] = fract(Math.sin(index * 12.9898) * 43758.5453);
    magnitudeHash[index] = fract(Math.sin(index * 78.233) * 24634.6345);
  }

  const targets = makeShapeTargets(random);
  targets.signal = seed.map((point) => point.clone());

  const edges: FieldEdge[] = [];
  for (let a = 0; a < FIELD_NODE_COUNT; a += 1) {
    for (let b = a + 1; b < FIELD_NODE_COUNT; b += 1) {
      if (seed[a].distanceTo(seed[b]) < FIELD_EDGE_DISTANCE) edges.push({ a, b });
    }
  }

  return { seed, phases, directionHash, magnitudeHash, states: SCENE_STATES, targets, edges };
}

let cachedField: Field | null = null;

/** All panels share immutable target data; each panel owns its GPU buffers. */
export function getField(): Field {
  if (!cachedField) cachedField = createField();
  return cachedField;
}
