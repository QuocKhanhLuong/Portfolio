export interface ExperienceItem {
  id: string;
  role: string;
  organization: string;
  period: string;
  summary: string;
}

/**
 * Keep this list deliberately factual and compact until the final CV details
 * are supplied. The section is complete structurally without inventing titles,
 * employers, or dates.
 */
export const EXPERIENCE: ExperienceItem[] = [
  {
    id: 'research-engineering',
    role: 'Research and engineering',
    organization: 'Independent / project-based',
    period: 'Current',
    summary: 'Building and studying systems across computer vision, medical imaging, representation learning, and research tooling.',
  },
  {
    id: 'visual-systems',
    role: 'Visual systems development',
    organization: 'Computer vision projects',
    period: 'Selected work',
    summary: 'Moving between model behaviour, data pipelines, evaluation, and the interfaces that make technical evidence understandable.',
  },
];
