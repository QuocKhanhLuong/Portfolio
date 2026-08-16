import { create } from 'zustand';
import type { Locale } from '@/content/types';

/**
 * Two tiers of state, deliberately.
 *
 * `scrollState` is a plain mutable singleton written every frame and read
 * directly inside `useFrame`. It is not React state, because per-frame React
 * state is how animation loops die.
 *
 * The zustand store below holds only things that change a handful of times per
 * visit — the current act, the language, the performance tier. Those may cause
 * renders; nothing else may.
 */
export const scrollState = {
  /** Raw scroll position, 0–1 across the whole page. */
  target: 0,
  /** Smoothed progress the scene actually uses. */
  progress: 0,
  /** Signed progress-per-second, drives turbulence and point elongation. */
  velocity: 0,
  /** Pointer in normalized device coords, -1..1. */
  pointerX: 0,
  pointerY: 0,
  /** Falls off when the pointer leaves, so touch devices settle to zero. */
  pointerStrength: 0,
  /** Seconds since the driver started, scaled by the act's motion factor. */
  time: 0,
};

export type PerfTier = 'high' | 'mid' | 'low';

interface NarrativeStore {
  actIndex: number;
  locale: Locale;
  reducedMotion: boolean;
  tier: PerfTier;
  webglFailed: boolean;
  setActIndex: (i: number) => void;
  setLocale: (l: Locale) => void;
  setReducedMotion: (v: boolean) => void;
  setTier: (t: PerfTier) => void;
  setWebglFailed: (v: boolean) => void;
}

export const useNarrative = create<NarrativeStore>((set) => ({
  actIndex: 0,
  locale: 'en',
  reducedMotion: false,
  tier: 'mid',
  webglFailed: false,
  setActIndex: (i) => set((s) => (s.actIndex === i ? s : { actIndex: i })),
  setLocale: (locale) => set({ locale }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTier: (tier) => set({ tier }),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
}));
