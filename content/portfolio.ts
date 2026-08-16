import type { SceneState } from './types';

export const NAV_ITEMS = [
  { href: '#about', label: 'About' },
  { href: '#work', label: 'Work' },
  { href: '#research', label: 'Research' },
  { href: '#experience', label: 'Experience' },
  { href: '#contact', label: 'Contact' },
] as const;

export const INTRO = {
  eyebrow: 'Computer vision research / engineering',
  title: 'Luong Quoc Khanh',
  positioning:
    'I work across 3D vision, medical imaging, and representation learning—building visual systems that make structure easier to inspect and reason about.',
  note: 'Learning how to see · research in progress',
};

export const ABOUT = {
  paragraphs: [
    'My work sits between visual understanding and the tools that make it possible to study. I am interested in what a model preserves, what it discards, and how those choices affect the people who use its output.',
    'The portfolio keeps the projects, methods, and open questions together. The field behind the page is a continuous visual study of the same progression: signal, image, structure, depth, uncertainty, and connection.',
  ],
  domains: [
    {
      label: '3D vision',
      detail: 'Geometry, depth, and reconstruction from visual evidence.',
      scene: 'cloud' as SceneState,
    },
    {
      label: 'Medical imaging',
      detail: 'Volumetric structure, segmentation, and annotation-aware systems.',
      scene: 'human' as SceneState,
    },
    {
      label: 'Representation learning',
      detail: 'Features that preserve useful evidence rather than only appearance.',
      scene: 'features' as SceneState,
    },
    {
      label: 'Research systems',
      detail: 'Reproducible experiments, diagnostics, and tools for careful inquiry.',
      scene: 'graph' as SceneState,
    },
  ],
};

export interface ContactLink {
  label: string;
  href?: string;
  note?: string;
}

export const CONTACT = {
  invitation: 'If you are working on a related problem, I would like to hear about it.',
  links: [
    { label: 'Email', href: 'mailto:khanhlq.hust.work@gmail.com' },
    { label: 'GitHub', href: 'https://github.com/QuocKhanhLuong' },
    { label: 'Scholar', note: 'Profile URL pending' },
    { label: 'LinkedIn', note: 'Profile URL pending' },
    { label: 'CV', note: 'Document URL pending' },
  ] satisfies ContactLink[],
};
