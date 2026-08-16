import type { ActId, Localized, SceneState } from './types';

/**
 * Projects are not cards. Each one is bound to an act and to a moment inside
 * that act, so it surfaces while the scene is already showing the thing the
 * project is about. Add an entry here and it appears in the world; there is no
 * component to edit.
 *
 * NOTE: the three entries below are placeholders carried over from the
 * prototype. Replace the copy and metadata with real work — everything except
 * `at` and `scene` is safe to rewrite freely.
 */
export interface Project {
  id: string;
  /** Act this belongs to. */
  act: ActId;
  /** Scene state that must be on screen when it reveals. */
  scene: SceneState;
  /** Position inside the act, 0–1. Around 0.55 lands after the headline settles. */
  at: number;
  title: Localized;
  summary: Localized;
  /** Short technical tags — rendered in mono, kept to four or fewer. */
  stack: string[];
  /** Case study link. Omit and no link renders. */
  href?: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'representation-learning',
    act: 'representation',
    scene: 'features',
    at: 0.58,
    title: {
      en: 'Placeholder — self-supervised pretraining',
      vi: 'Placeholder — tiền huấn luyện tự giám sát',
    },
    summary: {
      en: 'One line on the problem, and the one thing about the approach that was actually different. Two sentences at most — the rest belongs in the case study.',
      vi: 'Một dòng về bài toán, và điều thực sự khác biệt trong cách tiếp cận. Nhiều nhất hai câu — phần còn lại thuộc về case study.',
    },
    stack: ['PyTorch', 'contrastive', 'ViT'],
  },
  {
    id: 'reconstruction',
    act: 'depth',
    scene: 'cloud',
    at: 0.55,
    title: {
      en: 'Placeholder — multi-view reconstruction',
      vi: 'Placeholder — tái dựng đa góc nhìn',
    },
    summary: {
      en: 'Depth and structure recovered from uncalibrated input. Name the constraint that made it hard, not the pipeline.',
      vi: 'Độ sâu và cấu trúc phục hồi từ đầu vào chưa hiệu chỉnh. Nêu ràng buộc khiến bài toán khó, không phải pipeline.',
    },
    stack: ['Open3D', 'SfM', 'MVS'],
  },
  {
    id: 'medical-imaging',
    act: 'consequence',
    scene: 'human',
    at: 0.62,
    title: {
      en: 'Placeholder — volumetric segmentation',
      vi: 'Placeholder — phân vùng thể tích',
    },
    summary: {
      en: 'Give one real number about clinical consequence here, not a benchmark score. What changed for the person reading the scan.',
      vi: 'Đặt ở đây một con số thật về hệ quả lâm sàng, không phải điểm benchmark. Điều gì đã thay đổi với người đọc ảnh.',
    },
    stack: ['MONAI', '3D U-Net', 'DICOM'],
  },
];
