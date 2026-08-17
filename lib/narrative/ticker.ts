'use client';

import { useEffect } from 'react';
import { makeFrame, sample, type NarrativeFrame } from './interpolate';
import { scrollState } from './store';

/**
 * One rAF for the whole DOM layer.
 *
 * The driver emits a sampled `NarrativeFrame` each tick; overlays subscribe and
 * write directly to refs. No component re-renders to animate. WebGL panels use
 * demand-driven R3F canvases and invalidate from this same tick, so foreground
 * and field panels describe the same scroll moment.
 */

export type FrameListener = (frame: NarrativeFrame) => void;

const listeners = new Set<FrameListener>();

/**
 * The narrative frame, sampled exactly once per tick.
 *
 * Every consumer — DOM overlays and all visible R3F panels — reads this same
 * object. Each of them used to call `sample()` itself, which meant four
 * evaluations of the same function per frame and, worse, four chances to
 * disagree if any of them ran either side of a scroll update.
 */
export const liveFrame: NarrativeFrame = sample(0, makeFrame());

export function emitFrame() {
  sample(scrollState.progress, liveFrame);
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
