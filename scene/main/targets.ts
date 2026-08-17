export const MAIN_POINT_COUNT = 720;

export interface MainTargets {
  base: Float32Array;
  about: Float32Array;
  work: Float32Array;
  research: Float32Array;
  experience: Float32Array;
  phase: Float32Array;
  seed: Float32Array;
  accent: Float32Array;
  lines: {
    about: Float32Array;
    work: Float32Array;
    research: Float32Array;
    experience: Float32Array;
    phase: Float32Array;
    accent: Float32Array;
    count: number;
  };
}

function randomSource(seed = 0x243f6a88) {
  let value = seed >>> 0;
  return () => {
    value += 0x9e3779b9;
    let t = value;
    t = Math.imul(t ^ (t >>> 16), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setPoint(target: Float32Array, index: number, x: number, y: number, z: number) {
  const offset = index * 3;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

function heartPoint(index: number, random: () => number, fill = true) {
  const angle = (index / MAIN_POINT_COUNT) * Math.PI * 2;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const x = 16 * sin * sin * sin / 18;
  const y = (13 * cos - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) / 19;
  const radius = fill ? Math.sqrt(random()) * 0.9 : 1;
  return {
    x: x * radius + (random() - 0.5) * 0.025,
    y: y * radius + (random() - 0.5) * 0.025,
    z: (index % 14 / 13 - 0.5) * 0.34 + (random() - 0.5) * 0.06,
  };
}

function createTargets(): MainTargets {
  const random = randomSource();
  const base = new Float32Array(MAIN_POINT_COUNT * 3);
  const about = new Float32Array(MAIN_POINT_COUNT * 3);
  const work = new Float32Array(MAIN_POINT_COUNT * 3);
  const research = new Float32Array(MAIN_POINT_COUNT * 3);
  const experience = new Float32Array(MAIN_POINT_COUNT * 3);
  const phase = new Float32Array(MAIN_POINT_COUNT);
  const seed = new Float32Array(MAIN_POINT_COUNT);
  const accent = new Float32Array(MAIN_POINT_COUNT);

  const graphNodes = [
    [-0.88, 0.62, 0.08],
    [-0.34, 0.88, -0.02],
    [0.28, 0.78, 0.04],
    [0.86, 0.44, -0.04],
    [-0.7, 0.02, -0.08],
    [-0.12, 0.16, 0.06],
    [0.52, 0.03, 0.02],
    [-0.76, -0.66, 0.04],
    [-0.22, -0.52, -0.06],
    [0.4, -0.55, 0.08],
    [0.86, -0.62, -0.02],
    [0.05, -0.04, 0.1],
  ] as const;
  const graphEdges = [
    [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 6],
    [4, 5], [5, 6], [4, 7], [5, 8], [6, 9], [6, 10], [7, 8],
    [8, 9], [9, 10], [5, 11], [8, 11], [9, 11],
  ];

  for (let index = 0; index < MAIN_POINT_COUNT; index += 1) {
    const offset = index * 3;
    const cloudRadius = 0.25 + random() * 1.05;
    const cloudAngle = random() * Math.PI * 2;
    const cloudHeight = (random() - 0.5) * 1.15;
    setPoint(base, index, Math.cos(cloudAngle) * cloudRadius, cloudHeight, Math.sin(cloudAngle) * cloudRadius * 0.5);

    const columns = 36;
    const rows = MAIN_POINT_COUNT / columns;
    const column = index % columns;
    const row = Math.floor(index / columns);
    setPoint(
      about,
      index,
      (column / (columns - 1) - 0.5) * 1.68,
      (0.5 - row / (rows - 1)) * 1.2,
      (random() - 0.5) * 0.035,
    );

    const workAngle = index * 2.399963;
    const workRadius = 0.22 + (index % 11) / 11 * 0.75;
    setPoint(
      work,
      index,
      Math.cos(workAngle) * workRadius * (0.94 + Math.sin(workAngle * 2.0) * 0.12),
      Math.sin(workAngle) * workRadius * 0.68,
      Math.sin(workAngle * 1.7) * 0.28 + (random() - 0.5) * 0.12,
    );

    const cardiac = heartPoint(index, random, index % 6 !== 0);
    setPoint(research, index, cardiac.x, cardiac.y, cardiac.z);

    if (index < graphNodes.length) {
      const node = graphNodes[index];
      setPoint(experience, index, node[0], node[1], node[2]);
    } else {
      const edge = graphEdges[index % graphEdges.length];
      const start = graphNodes[edge[0]];
      const end = graphNodes[edge[1]];
      const t = (index % 17) / 16;
      setPoint(
        experience,
        index,
        start[0] + (end[0] - start[0]) * t + (random() - 0.5) * 0.035,
        start[1] + (end[1] - start[1]) * t + (random() - 0.5) * 0.035,
        start[2] + (end[2] - start[2]) * t + (random() - 0.5) * 0.045,
      );
    }

    phase[index] = random() * Math.PI * 2;
    seed[index] = random();
    accent[index] = random();
    // Keep a few particles brighter as stable feature/keypoint marks.
    if (index % 29 === 0) accent[index] = 0.96;
    base[offset + 2] += (random() - 0.5) * 0.08;
  }

  const lineCount = graphEdges.length;
  const lineTargets = {
    about: new Float32Array(lineCount * 2 * 3),
    work: new Float32Array(lineCount * 2 * 3),
    research: new Float32Array(lineCount * 2 * 3),
    experience: new Float32Array(lineCount * 2 * 3),
    phase: new Float32Array(lineCount * 2),
    accent: new Float32Array(lineCount * 2),
    count: lineCount * 2,
  };
  const stateTargets = [about, work, research, experience];
  graphEdges.forEach(([startIndex, endIndex], edgeIndex) => {
    [startIndex, endIndex].forEach((pointIndex, endpoint) => {
      const lineIndex = edgeIndex * 2 + endpoint;
      const lineOffset = lineIndex * 3;
      stateTargets.forEach((target, stateIndex) => {
        const sourceOffset = pointIndex * 3;
        const destination = [lineTargets.about, lineTargets.work, lineTargets.research, lineTargets.experience][stateIndex];
        destination[lineOffset] = target[sourceOffset];
        destination[lineOffset + 1] = target[sourceOffset + 1];
        destination[lineOffset + 2] = target[sourceOffset + 2];
      });
      lineTargets.phase[lineIndex] = phase[pointIndex];
      lineTargets.accent[lineIndex] = accent[pointIndex];
    });
  });

  return { base, about, work, research, experience, phase, seed, accent, lines: lineTargets };
}

let cachedTargets: MainTargets | null = null;

export function getMainTargets() {
  if (!cachedTargets) cachedTargets = createTargets();
  return cachedTargets;
}
