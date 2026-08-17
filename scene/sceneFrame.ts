'use client';

import { useFrame } from '@react-three/fiber';
import { useNarrative } from '@/lib/narrative/store';

/** F+ uses a 42 degree perspective camera. */
export const SCENE_FOV = 42;

/** Shared render time for the persistent graph and any future scene layer. */
export const sceneClock = { time: 0 };

/**
 * Keeps time on the existing R3F clock. Scroll position remains owned by
 * Lenis/the narrative driver; this value is only elapsed render time.
 */
export function SceneClock() {
  const reducedMotion = useNarrative((state) => state.reducedMotion);

  useFrame((_, delta) => {
    if (!reducedMotion) sceneClock.time += Math.min(0.1, delta);
  }, -1);

  return null;
}
