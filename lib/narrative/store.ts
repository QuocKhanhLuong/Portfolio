import { create } from 'zustand';
import { SCENE_STATES, type SceneState } from '@/content/types';

/**
 * Two tiers of state, deliberately.
 *
 * `scrollState` is a plain mutable singleton written every frame and read
 * directly inside `useFrame`. It is not React state, because per-frame React
 * state is how animation loops die.
 *
 * The zustand store below holds only things that change a handful of times per
 * visit — the current act and performance tier. Those may cause
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
  /** Scene state temporarily requested by a focused foreground item. */
  focusState: 0,
  /** Current and target blend for the focused scene state. */
  focusStrength: 0,
  focusTargetStrength: 0,
  /** Seconds since the driver started, scaled by the act's motion factor. */
  time: 0,
};

/**
 * Foreground content can ask the field to inspect a related state without
 * changing scroll progress. The request is intentionally small and transient:
 * scroll remains the source of truth for the continuous scene timeline.
 */
export function setSceneFocus(state: SceneState | null) {
  if (!state) {
    scrollState.focusTargetStrength = 0;
    return;
  }

  const index = SCENE_STATES.indexOf(state);
  if (index < 0) return;

  scrollState.focusState = index;
  scrollState.focusTargetStrength = 0.2;
}

export type PerfTier = 'high' | 'mid' | 'low';

interface NarrativeStore {
  actIndex: number;
  reducedMotion: boolean;
  tier: PerfTier;
  /** Fraction of the particle buffer currently drawn, trimmed under load. */
  activeFraction: number;
  webglFailed: boolean;
  setActIndex: (i: number) => void;
  setReducedMotion: (v: boolean) => void;
  setTier: (t: PerfTier) => void;
  setActiveFraction: (v: number) => void;
  setWebglFailed: (v: boolean) => void;
}

export const useNarrative = create<NarrativeStore>((set) => ({
  actIndex: 0,
  reducedMotion: false,
  tier: 'mid',
  activeFraction: 1,
  webglFailed: false,
  setActIndex: (i) => set((s) => (s.actIndex === i ? s : { actIndex: i })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTier: (tier) => set({ tier }),
  setActiveFraction: (activeFraction) =>
    set((s) => (Math.abs(s.activeFraction - activeFraction) < 0.02 ? s : { activeFraction })),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
}));
