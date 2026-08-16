import type { Act } from './types';

/**
 * The internal scene timeline. The foreground no longer renders these as
 * narrative chapters; they only determine the continuous state interpolation.
 */
export const ACTS: Act[] = [
  {
    id: 'signal',
    index: '00',
    label: 'SIGNAL',
    weight: 1.0,
    states: ['signal'],
  },
  {
    id: 'curiosity',
    index: '01',
    label: 'CURIOSITY',
    weight: 1.6,
    states: ['pixel', 'image'],
  },
  {
    id: 'representation',
    index: '02',
    label: 'REPRESENTATION',
    weight: 1.3,
    states: ['features'],
  },
  {
    id: 'depth',
    index: '03',
    label: 'DEPTH',
    weight: 1.5,
    states: ['cloud'],
  },
  {
    id: 'consequence',
    index: '04',
    label: 'CONSEQUENCE',
    weight: 2.2,
    states: ['volume', 'human'],
  },
  {
    id: 'uncertainty',
    index: '05',
    label: 'UNCERTAINTY',
    weight: 1.4,
    states: ['uncertainty'],
  },
  {
    id: 'frontier',
    index: '06',
    label: 'FRONTIER',
    weight: 1.4,
    states: ['graph'],
  },
  {
    id: 'return',
    index: '07',
    label: 'RETURN',
    weight: 1.8,
    states: ['constellation'],
  },
];
