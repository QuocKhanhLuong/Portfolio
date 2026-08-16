import type { SceneState } from './types';

/**
 * Projects are editorial rows, not generic cards. `scene` is the temporary
 * background focus used when a visitor hovers or keyboard-focuses an entry.
 */
export interface Project {
  id: string;
  /** Scene state that receives a small temporary focus blend. */
  scene: SceneState;
  title: string;
  summary: string;
  meta: string;
  stack: string[];
  /** Case study link. Omit when the public URL is not available yet. */
  href?: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'representation-learning',
    scene: 'features',
    title: 'Self-supervised representation learning',
    summary: 'A project brief on learning useful visual structure with less labelled data. The verified case-study details are still being assembled.',
    meta: 'Project brief · details to be confirmed',
    stack: ['PyTorch', 'contrastive', 'ViT'],
  },
  {
    id: 'reconstruction',
    scene: 'cloud',
    title: 'Multi-view reconstruction',
    summary: 'Depth and structure recovered from uncalibrated input, with the geometric constraint kept visible rather than hidden inside the pipeline.',
    meta: 'Project brief · details to be confirmed',
    stack: ['Open3D', 'SfM', 'MVS'],
  },
  {
    id: 'medical-imaging',
    scene: 'human',
    title: 'Volumetric medical-image segmentation',
    summary: 'A medical-imaging brief focused on volumetric structure, annotation, and the human consequence of a boundary drawn on a scan.',
    meta: 'Project brief · clinical details to be confirmed',
    stack: ['MONAI', '3D U-Net', 'DICOM'],
  },
];
