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
  /**
   * Eased optical-instrument strength. It follows `pointerTarget`, which holds
   * at 1 for as long as the pointer is over the document. A parked cursor is
   * still an inspection — it is how you look closely at something — so this no
   * longer decays merely because the pointer stopped moving. It falls only when
   * the pointer actually leaves.
   */
  pointerStrength: 0,
  pointerTarget: 0,
  /** Scene state temporarily requested by a focused foreground item. */
  focusState: 0,
  /** -1..1 slice coordinate the medical states are being cut at. */
  scanX: 0,
  /** Current and target blend for the focused scene state. */
  focusStrength: 0,
  focusTargetStrength: 0,
  /** Seconds since the driver started, scaled by the act's motion factor. */
  time: 0,
};

const FOCUS_STRENGTH = 0.52;

/**
 * Foreground content can ask the field to inspect a related state without
 * changing scroll progress. The request is intentionally transient and
 * smoothly bounded:
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
  scrollState.focusTargetStrength = FOCUS_STRENGTH;
}

export type PerfTier = 'high' | 'mid' | 'low';

interface NarrativeStore {
  /** Index of the DOM-measured scene anchor currently on screen. */
  sceneIndex: number;
  reducedMotion: boolean;
  tier: PerfTier;
  /** Fraction of the particle buffer currently drawn, trimmed under load. */
  activeFraction: number;
  webglFailed: boolean;
  setSceneIndex: (i: number) => void;
  setReducedMotion: (v: boolean) => void;
  setTier: (t: PerfTier) => void;
  setActiveFraction: (v: number) => void;
  setWebglFailed: (v: boolean) => void;
}

export const useNarrative = create<NarrativeStore>((set) => ({
  sceneIndex: 0,
  reducedMotion: false,
  tier: 'mid',
  activeFraction: 1,
  webglFailed: false,
  setSceneIndex: (i) => set((s) => (s.sceneIndex === i ? s : { sceneIndex: i })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTier: (tier) => set({ tier }),
  setActiveFraction: (activeFraction) =>
    set((s) => (Math.abs(s.activeFraction - activeFraction) < 0.02 ? s : { activeFraction })),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
}));
