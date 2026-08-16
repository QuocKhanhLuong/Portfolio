/**
 * The research graph. Papers, projects and open questions are the same kind of
 * thing here — nodes with relationships. The edges are the argument; the nodes
 * are only evidence.
 *
 * Positions are normalized (-1..1, y up). The WebGL graph state and the DOM
 * label overlay both read these, so a node moves in both at once.
 */
export type NodeKind = 'paper' | 'project' | 'open' | 'core';

export interface ResearchNode {
  id: string;
  kind: NodeKind;
  /** Short lowercase label — the field, not the title. */
  label: string;
  /** Readable title for the foreground research list. */
  title?: string;
  /** Venue / status line. */
  meta: string;
  summary: string;
  position: [number, number, number];
  links?: { label: string; href: string }[];
}

/** Edges carry meaning: `builds` is sequential, `tension` is unresolved. */
export type EdgeKind = 'builds' | 'informs' | 'tension';

export interface ResearchEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export const RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'representation',
    kind: 'core',
    label: 'representation',
    meta: 'the through-line',
    summary: 'What a system keeps, and what it throws away. Every other node here is a consequence of that question.',
    position: [0, 0, 0],
  },
  {
    id: 'multimodal',
    kind: 'paper',
    label: 'multimodal',
    title: 'Visual–textual alignment for clinical reports',
    meta: 'Workshop paper, 2025',
    summary: 'Aligning visual and textual representations for clinical report generation.',
    position: [0, 0.62, 0],
  },
  {
    id: 'vision',
    kind: 'paper',
    label: 'computer vision',
    title: 'Self-supervised representation learning for computer vision',
    meta: 'First author · details to be confirmed',
    summary: 'Self-supervised pretraining aimed at reducing the labelled-data requirement for visual systems.',
    position: [-1.32, 0.06, -0.2],
  },
  {
    id: 'medical',
    kind: 'paper',
    label: 'medical imaging',
    title: 'Volumetric segmentation for medical imaging',
    meta: 'Journal, 2026 · details to be confirmed',
    summary: 'Volumetric segmentation evaluated against radiologist annotation.',
    position: [1.32, 0.06, 0.2],
  },
  {
    id: 'geometry',
    kind: 'project',
    label: '3d vision',
    meta: 'Project',
    summary: 'Depth estimation and reconstruction from uncalibrated multi-view input.',
    position: [-0.52, -0.66, 0.15],
  },
  {
    id: 'calibration',
    kind: 'open',
    label: 'uncertainty',
    title: 'Calibration under distribution shift',
    meta: 'Open question',
    summary: 'When should a model decline to answer? Calibration under distribution shift.',
    position: [0.62, -0.6, -0.25],
  },
  {
    id: 'efficiency',
    kind: 'project',
    label: 'efficiency',
    meta: 'Project',
    summary: 'Distillation and pruning for models that can run on the hardware hospitals actually have.',
    position: [0.05, -0.02, 0.55],
  },
];

export const RESEARCH_EDGES: ResearchEdge[] = [
  { from: 'representation', to: 'multimodal', kind: 'builds' },
  { from: 'representation', to: 'vision', kind: 'builds' },
  { from: 'representation', to: 'medical', kind: 'builds' },
  { from: 'representation', to: 'geometry', kind: 'builds' },
  { from: 'representation', to: 'calibration', kind: 'tension' },
  { from: 'representation', to: 'efficiency', kind: 'builds' },
  { from: 'vision', to: 'geometry', kind: 'informs' },
  { from: 'medical', to: 'calibration', kind: 'tension' },
  { from: 'multimodal', to: 'medical', kind: 'informs' },
  { from: 'multimodal', to: 'vision', kind: 'informs' },
  { from: 'efficiency', to: 'calibration', kind: 'informs' },
];
