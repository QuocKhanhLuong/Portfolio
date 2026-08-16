'use client';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SCENE_STATES } from '@/content/types';
import { makeStateWeights, stateWeights } from '@/lib/narrative/interpolate';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { liveFrame } from '@/lib/narrative/ticker';
import { useMemo } from 'react';
import { MORPH } from './morph/core';

/**
 * One evaluation of the scene per rendered frame.
 *
 * The camera, the point field, the diagram layer and the scan plane all used to
 * call `sample()` themselves and each derive their own state weights. That is
 * four times the work and, more importantly, four opportunities to disagree
 * about which state is on screen. They now read these two objects, written once
 * per frame by `SceneClock`.
 */

export const SCENE_INDEX = Object.fromEntries(SCENE_STATES.map((s, i) => [s, i])) as Record<
  (typeof SCENE_STATES)[number],
  number
>;

/** Categorical per-state presence, 0–1, summing to 1. Never an interpolated id. */
export const sceneWeights = makeStateWeights();

/** Seconds elapsed at the current state's own pace. */
export const sceneClock = { time: 0 };

/** The largest focus contribution a hovered foreground item may claim. */
export const MAX_FOCUS_MIX = MORPH.focusMax;

/**
 * The cursor, unprojected onto the field plane, in world units.
 *
 * Computed once here rather than in each layer: the grain shader and the node
 * tier must be inspecting the same point, or the lens brightens one and lifts
 * the other somewhere else.
 */
export const scenePointer = new THREE.Vector3();

/**
 * Runs before every other frame callback — R3F sorts subscriptions by priority
 * and a negative one does not take over the render loop.
 */
export function SceneClock() {
  const reducedMotion = useNarrative((s) => s.reducedMotion);
  const { camera } = useThree();

  // Scratch objects — this runs every frame and must not allocate.
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const frame = liveFrame;

    ndc.set(scrollState.pointerX, scrollState.pointerY, 0.5).unproject(camera);
    ray.origin.copy(camera.position);
    ray.direction.copy(ndc).sub(camera.position).normalize();
    ray.intersectPlane(plane, scenePointer);

    stateWeights(
      frame,
      scrollState.focusState,
      Math.min(scrollState.focusStrength, MAX_FOCUS_MIX),
      sceneWeights,
    );
    // Time advances at the state's own pace, so slowing a state genuinely slows
    // everything in it rather than only its transitions.
    sceneClock.time += reducedMotion ? 0 : delta * frame.motion;
  }, -1);

  return null;
}
