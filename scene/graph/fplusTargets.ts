import * as THREE from 'three';
import { SCENE_STATES, type SceneState } from '@/content/types';

/**
 * The production F+ graph is deliberately small and fixed. Its topology is
 * created once from the spherical seed and never rebuilt while a shape moves.
 */
export const FPLUS_NODE_COUNT = 350;
export const FPLUS_POINT_SIZE = 4.5;
export const FPLUS_EDGE_DISTANCE = 0.72;

export interface FPlusEdge {
  a: number;
  b: number;
}

export interface FPlusField {
  seed: THREE.Vector3[];
  phases: Float32Array;
  directionHash: Float32Array;
  magnitudeHash: Float32Array;
  targets: Record<SceneState, THREE.Vector3[]>;
  centroids: Record<SceneState, THREE.Vector2>;
  edges: FPlusEdge[];
}

/** A tiny deterministic source keeps hydration and hot reloads stable. */
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

function rotate(path: [number, number][], angle: number): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return path.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

/** The single-polygon resampler from the production bundle. */
function resamplePath(path: [number, number][], count: number, random: () => number) {
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let index = 0; index < path.length; index += 1) {
    const current = path[index];
    const next = path[(index + 1) % path.length];
    const length = Math.hypot(next[0] - current[0], next[1] - current[1]);
    segmentLengths.push(length);
    totalLength += length;
  }

  const points: THREE.Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    let distance = (index / count) * totalLength;
    let segment = 0;
    while (segment < segmentLengths.length - 1 && distance > segmentLengths[segment]) {
      distance -= segmentLengths[segment];
      segment += 1;
    }

    const current = path[segment];
    const next = path[(segment + 1) % path.length];
    const ratio = segmentLengths[segment] ? distance / segmentLengths[segment] : 0;
    points.push(
      new THREE.Vector3(
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
        (random() - 0.5) * 0.14,
      ),
    );
  }

  return points;
}

/** The production multi-path perimeter allocation and padding rules. */
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
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const points: THREE.Vector3[] = [];
  let allocated = 0;

  for (let index = 0; index < paths.length; index += 1) {
    const samples =
      index === paths.length - 1
        ? Math.max(1, count - allocated)
        : Math.max(2, Math.round((count * lengths[index]) / Math.max(totalLength, 1e-6)));
    allocated += samples;
    points.push(...resamplePath(paths[index], samples, random));
  }

  while (points.length < count) points.push(points[points.length - 1]?.clone() ?? new THREE.Vector3());
  return points.slice(0, count);
}

function circle(cx: number, cy: number, radius: number, count: number): [number, number][] {
  const points: [number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return points;
}

function ellipse(cx: number, cy: number, radiusX: number, radiusY: number, count: number) {
  const points: [number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    points.push([cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY]);
  }
  return points;
}

function arc(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  count: number,
) {
  const points: [number, number][] = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = start + (index / count) * (end - start);
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return points;
}

function roundedRect(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
  segments = 5,
) {
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

function transformed(path: [number, number][], scale: number, offsetX: number, offsetY = 0) {
  return path.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY] as [number, number]);
}

function makeShapeTargets(random: () => number) {
  const frameOutline = rotate(
    [
      [-2.15, 0],
      [-2, 0.022],
      [-1.84, 0.045],
      [-1.64, 0.072],
      [-1.46, 0.09],
      [1.62, 0.09],
      [1.74, 0.07],
      [1.84, 0.04],
      [1.9, 0],
      [1.84, -0.04],
      [1.74, -0.07],
      [1.62, -0.09],
      [-1.46, -0.09],
      [-1.64, -0.072],
      [-1.84, -0.045],
      [-2, -0.022],
    ],
    0.6,
  );
  const bottleOutline = rotate(
    [
      [-0.2, 1.14],
      [0.2, 1.14],
      [0.2, 0.9],
      [0.44, 0.66],
      [0.46, 0.48],
      [0.46, -0.92],
      [0.4, -1.12],
      [-0.4, -1.12],
      [-0.46, -0.92],
      [-0.46, 0.48],
      [-0.44, 0.66],
      [-0.2, 0.9],
    ],
    -0.5,
  );
  const scaleBottle = (path: [number, number][]) => transformed(path, 0.9, 0);
  const rectangle = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
    [x0, y1],
    [x1, y1],
    [x1, y0],
    [x0, y0],
  ];
  const rounded = (cx: number, cy: number, width: number, height: number, radius: number) =>
    roundedRect(cx, cy, width, height, radius);

  const pixel = [
    [-0.26, -0.78],
    [-0.26, 0.16],
    [0.02, 0.16],
    [0.02, 0.4],
    [-0.26, 0.4],
    [-0.26, 0.5],
    [0.02, 0.5],
    [0.02, 0.78],
    [-0.54, 0.78],
    [-0.54, 0.4],
    [-0.76, 0.4],
    [-0.76, 0.16],
    [-0.54, 0.16],
    [-0.54, -0.78],
  ] as [number, number][];
  const edgePixel = [
    [0.72 - 0.15, 0.58],
    [0.72 + 0.15, 0.58],
    [0.72 + 0.15, 0.15],
    [0.72 + 0.58, 0.15],
    [0.72 + 0.58, -0.15],
    [0.72 + 0.15, -0.15],
    [0.72 + 0.15, -0.58],
    [0.72 - 0.15, -0.58],
    [0.72 - 0.15, -0.15],
    [0.72 - 0.58, -0.15],
    [0.72 - 0.58, 0.15],
    [0.72 - 0.15, 0.15],
  ] as [number, number][];
  const q = (path: [number, number][]) => transformed(path, 1.15, 0.35);
  const shiftedBottle = (path: [number, number][]) => transformed(path, 0.9, 0.46);
  const rings = (cx: number, cy: number, radius: number, count: number) =>
    circle(cx, cy, radius, count);
  const oval = (cx: number, cy: number, rx: number, ry: number, count: number) =>
    ellipse(cx, cy, rx, ry, count);
  const medalTop = (offset: number) => [
    [offset - 0.04, 0.6],
    [offset + 0.1, 0.78],
    [offset - 0.06, 0.96],
    [offset + 0.08, 1.14],
    [offset + 0.16, 1.14],
    [offset + 0.02, 0.96],
    [offset + 0.18, 0.78],
    [offset + 0.04, 0.6],
  ] as [number, number][];
  const cup: [number, number][] = [
    [-0.6, 0.44],
    [0.6, 0.44],
    [0.54, 0],
    [0.48, -0.42],
    [0.4, -0.62],
    [0.22, -0.72],
    [-0.22, -0.72],
    [-0.4, -0.62],
    [-0.48, -0.42],
    [-0.54, 0],
  ] as [number, number][];
  const cupHandle = oval(0, 0.44, 0.6, 0.13, 22);
  const cupArc = [
    ...arc(0.68, -0.02, 0.3, 2.06, -2.06, 14),
    ...arc(0.68, -0.02, 0.16, -2.06, 2.06, 10),
  ];
  const medalPaths = [cup, cupHandle, cupArc, medalTop(-0.24), medalTop(0.2)];
  const shiftCup = (path: [number, number][]) => transformed(path, 0.95, 0.4, 0.02);
  const medalPathsBase: [number, number][][] = [
    [
      [-0.62, 0.95],
      [-0.34, 0.95],
      [0, 0.48],
      [0.34, 0.95],
      [0.62, 0.95],
      [0.1, 0.12],
      [-0.1, 0.12],
    ],
    rings(0, -0.38, 0.58, 30),
    rings(0, -0.38, 0.34, 20),
  ];
  const medalShift = (path: [number, number][]) => transformed(path, 1.15, 0.4);
  const mailPaths: [number, number][][] = [
    rectangle(-1.36, -0.82, 1.36, 0.82),
    [
      [-1.36, 0.82],
      [1.36, 0.82],
      [0, -0.04],
    ],
  ];
  const eighteenPaths: [number, number][][] = [
    [
      [-1.15, 0.5],
      [-0.5, 1.05],
      [-0.5, -0.75],
      [-0.25, -0.75],
      [-0.25, -1.02],
      [-1.15, -1.02],
      [-1.15, -0.75],
      [-0.9, -0.75],
      [-0.9, 0.68],
    ],
    rings(0.5, 0.45, 0.44, 24),
    rings(0.5, 0.45, 0.22, 16),
    rings(0.5, -0.49, 0.56, 28),
    rings(0.5, -0.49, 0.3, 18),
  ];
  const shiftedEighteen = (path: [number, number][]) => transformed(path, 0.9, 0.28);
  const wheelPaths: [number, number][][] = [
    rings(0, 0, 1.15, 38),
    rings(0, 0, 0.8, 30),
    rings(0, 0, 0.22, 14),
  ];
  for (let index = 0; index < 6; index += 1) {
    wheelPaths.push(rotate(rectangle(-0.07, 0.24, 0.07, 0.76), (index * Math.PI * 2) / 6));
  }
  const shiftedWheel = (path: [number, number][]) => transformed(path, 0.9, -0.05);
  const shiftedFrame = (path: [number, number][]) => transformed(path, 0.9, 0.45, 0.2);
  const glassesPaths: [number, number][][] = [
    rounded(-0.52, 0, 0.8, 0.72, 0.18),
    rounded(0.52, 0, 0.8, 0.72, 0.18),
    rectangle(-0.13, 0.04, 0.13, 0.16),
    rectangle(-1.1, 0.02, -0.92, 0.12),
    rectangle(0.92, 0.02, 1.1, 0.12),
  ];
  const shiftedGlasses = (path: [number, number][]) => transformed(path, 0.9, 0.12);
  const framePaths: [number, number][][] = [
    rounded(0, 0.32, 2.5, 1.55, 0.14),
    rounded(0, 0.32, 2.16, 1.16, 0.05),
    [
      [-0.16, -0.46],
      [0.16, -0.46],
      [0.22, -0.9],
      [-0.22, -0.9],
    ],
    rounded(0, -1, 1.05, 0.16, 0.07),
  ];
  const shiftedFrame2 = (path: [number, number][]) => transformed(path, 0.8, 0.32);

  return {
    pen: resamplePath(shiftedFrame(frameOutline), FPLUS_NODE_COUNT, random),
    bottle: resamplePath(scaleBottle(bottleOutline), FPLUS_NODE_COUNT, random),
    fplus: resamplePaths([q(pixel), q(edgePixel)], FPLUS_NODE_COUNT, random),
    medal: resamplePaths(medalPathsBase.map(medalShift), FPLUS_NODE_COUNT, random),
    cup: resamplePaths(medalPaths.map(shiftCup), FPLUS_NODE_COUNT, random),
    frame: resamplePaths(framePaths.map(shiftedFrame2), FPLUS_NODE_COUNT, random),
    mail: resamplePaths(mailPaths.map(shiftedBottle), FPLUS_NODE_COUNT, random),
    eighteen: resamplePaths(eighteenPaths.map(shiftedEighteen), FPLUS_NODE_COUNT, random),
    wheel: resamplePaths(wheelPaths.map(shiftedWheel), FPLUS_NODE_COUNT, random),
    glasses: resamplePaths(glassesPaths.map(shiftedGlasses), FPLUS_NODE_COUNT, random),
  };
}

function centroid(points: THREE.Vector3[]) {
  const result = new THREE.Vector2();
  for (const point of points) result.add(new THREE.Vector2(point.x, point.y));
  return result.multiplyScalar(1 / Math.max(points.length, 1));
}

export function createFPlusField(): FPlusField {
  const random = randomSource();
  const seed: THREE.Vector3[] = [];
  for (let index = 0; index < FPLUS_NODE_COUNT; index += 1) {
    const radius = 0.6 + random() * 1.7;
    const azimuth = random() * Math.PI * 2;
    const polar = Math.acos(2 * random() - 1);
    seed.push(
      new THREE.Vector3(
        radius * Math.sin(polar) * Math.cos(azimuth),
        radius * Math.sin(polar) * Math.sin(azimuth),
        radius * Math.cos(polar),
      ),
    );
  }

  const phases = new Float32Array(FPLUS_NODE_COUNT);
  const directionHash = new Float32Array(FPLUS_NODE_COUNT);
  const magnitudeHash = new Float32Array(FPLUS_NODE_COUNT);
  for (let index = 0; index < FPLUS_NODE_COUNT; index += 1) {
    phases[index] = random() * Math.PI * 2;
    directionHash[index] = fract(Math.sin(index * 12.9898) * 43758.5453);
    magnitudeHash[index] = fract(Math.sin(index * 78.233) * 24634.6345);
  }

  const rawShapes = makeShapeTargets(random);
  const targets = {
    signal: seed.map((point) => point.clone()),
    pixel: rawShapes.fplus,
    image: rawShapes.frame,
    features: rawShapes.glasses,
    cloud: rawShapes.cup,
    volume: rawShapes.bottle,
    human: rawShapes.medal,
    uncertainty: rawShapes.mail,
    graph: rawShapes.pen,
    constellation: rawShapes.eighteen,
  } satisfies Record<SceneState, THREE.Vector3[]>;

  const edges: FPlusEdge[] = [];
  for (let a = 0; a < FPLUS_NODE_COUNT; a += 1) {
    for (let b = a + 1; b < FPLUS_NODE_COUNT; b += 1) {
      if (seed[a].distanceTo(seed[b]) < FPLUS_EDGE_DISTANCE) edges.push({ a, b });
    }
  }

  const centroids = Object.fromEntries(
    SCENE_STATES.map((state) => [state, centroid(targets[state])]),
  ) as Record<SceneState, THREE.Vector2>;

  return { seed, phases, directionHash, magnitudeHash, targets, centroids, edges };
}
