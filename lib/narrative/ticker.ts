'use client';

import { useEffect } from 'react';
import { sample, type NarrativeFrame } from './interpolate';
import { scrollState } from './store';

/**
 * One rAF for the whole DOM layer.
 *
 * The driver emits a sampled `NarrativeFrame` each tick; overlays subscribe and
 * write directly to refs. No component re-renders to animate. The WebGL layer
 * does not use this — R3F has its own loop and reads `scrollState` itself.
 */

export type FrameListener = (frame: NarrativeFrame) => void;

const listeners = new Set<FrameListener>();

/** Owned by the driver; a stable object so subscribers may cache references. */
export const liveFrame: NarrativeFrame = sample(0, {
  ...sample(0),
  camera: { yaw: 0, pitch: 0, distance: 4, offset: [0, 0], dimensionality: 0, drift: 0 },
  palette: { core: [0, 0, 0], accent: [0, 0, 0], density: 1 },
  interaction: { pointerSign: 1, pointerStrength: 0, turbulence: 0, arc: 0, spread: 0.5 },
});

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
