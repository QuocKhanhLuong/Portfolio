import type { Localized } from './types';

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
  /** Venue / status line. */
  meta: Localized;
  summary: Localized;
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
    meta: { en: 'the through-line', vi: 'mạch xuyên suốt' },
    summary: {
      en: 'What a system keeps, and what it throws away. Every other node here is a consequence of that question.',
      vi: 'Thứ một hệ thống giữ lại, và thứ nó bỏ đi. Mọi node khác ở đây là hệ quả của câu hỏi đó.',
    },
    position: [0, 0, 0],
  },
  {
    id: 'multimodal',
    kind: 'paper',
    label: 'multimodal',
    meta: { en: 'Workshop paper, 2025', vi: 'Bài workshop, 2025' },
    summary: {
      en: 'Aligning visual and textual representations for clinical report generation.',
      vi: 'Căn chỉnh biểu diễn thị giác và văn bản để sinh báo cáo lâm sàng.',
    },
    position: [0, 0.62, 0],
  },
  {
    id: 'vision',
    kind: 'paper',
    label: 'computer vision',
    meta: { en: 'First author', vi: 'Tác giả chính' },
    summary: {
      en: 'Self-supervised pretraining that cut the labelled-data requirement substantially.',
      vi: 'Tiền huấn luyện tự giám sát giúp giảm đáng kể nhu cầu dữ liệu gán nhãn.',
    },
    position: [-1.32, 0.06, -0.2],
  },
  {
    id: 'medical',
    kind: 'paper',
    label: 'medical imaging',
    meta: { en: 'Journal, 2026', vi: 'Tạp chí, 2026' },
    summary: {
      en: 'Volumetric segmentation validated against radiologist annotation.',
      vi: 'Phân vùng thể tích được đối chiếu với chú giải của bác sĩ chẩn đoán hình ảnh.',
    },
    position: [1.32, 0.06, 0.2],
  },
  {
    id: 'geometry',
    kind: 'project',
    label: '3d vision',
    meta: { en: 'Project', vi: 'Dự án' },
    summary: {
      en: 'Depth estimation and reconstruction from uncalibrated multi-view input.',
      vi: 'Ước lượng độ sâu và tái dựng từ đầu vào đa góc nhìn chưa hiệu chỉnh.',
    },
    position: [-0.52, -0.66, 0.15],
  },
  {
    id: 'calibration',
    kind: 'open',
    label: 'uncertainty',
    meta: { en: 'Open', vi: 'Đang mở' },
    summary: {
      en: 'When should a model decline to answer? Calibration under distribution shift.',
      vi: 'Khi nào một mô hình nên từ chối trả lời? Hiệu chỉnh dưới dịch chuyển phân phối.',
    },
    position: [0.62, -0.6, -0.25],
  },
  {
    id: 'efficiency',
    kind: 'project',
    label: 'efficiency',
    meta: { en: 'Project', vi: 'Dự án' },
    summary: {
      en: 'Distillation and pruning, so these models run on the hardware hospitals actually have.',
      vi: 'Chưng cất và tỉa mô hình, để chúng chạy được trên phần cứng bệnh viện thực sự có.',
    },
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
