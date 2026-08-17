'use client';

import { useEffect } from 'react';
import { scrollState } from './store';

/**
 * One GSAP/Lenis clock for the whole DOM and scene layer. Subscribers invalidate
 * the single persistent R3F canvas or update small DOM refs; no component
 * re-renders to animate.
 */

export interface NarrativeFrame {
  progress: number;
}

export type FrameListener = (frame: NarrativeFrame) => void;

const listeners = new Set<FrameListener>();

/**
 * The minimal shared frame object is mutated in place so subscribers receive
 * the same scroll value as the scene's `useFrame` callback.
 */
export const liveFrame: NarrativeFrame = { progress: 0 };

export function emitFrame() {
  liveFrame.progress = scrollState.progress;
  listeners.forEach((fn) => fn(liveFrame));
}

export function subscribeFrame(fn: FrameListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Subscribe for the lifetime of a component. `fn` must be stable or cheap. */
export function useNarrativeFrame(fn: FrameListener) {
  useEffect(() => subscribeFrame(fn), [fn]);
}
