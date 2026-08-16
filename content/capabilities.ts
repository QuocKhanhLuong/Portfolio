import type { SceneState } from './types';

export interface CapabilityGroup {
  title: string;
  scene: SceneState;
  items: string[];
}

export const CAPABILITIES: CapabilityGroup[] = [
  {
    title: 'Vision and learning',
    scene: 'features',
    items: ['Representation learning', 'Self-supervised methods', 'Image understanding', 'Model evaluation'],
  },
  {
    title: '3D and medical imaging',
    scene: 'volume',
    items: ['Multi-view geometry', 'Depth and reconstruction', 'Volumetric segmentation', 'DICOM / MONAI workflows'],
  },
  {
    title: 'Research engineering',
    scene: 'graph',
    items: ['PyTorch', 'Reproducible experiments', 'Data and diagnostic tooling', 'Interactive technical systems'],
  },
];
