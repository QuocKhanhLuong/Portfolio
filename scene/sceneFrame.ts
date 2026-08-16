'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { SCENE_STATES } from '@/content/types';
import { makeStateWeights, stateWeights } from '@/lib/narrative/interpolate';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { liveFrame } from '@/lib/narrative/ticker';
import { composeField, type ComposeInput, type Composition } from './composition';
import { graphDebug } from './debug';
import { MORPH } from './morph/core';
import type { PackedStates } from './states/pack';

/**
 * One evaluation of the scene per rendered frame.
 *
 * The camera, the grain field, the node tier and the atmosphere all used to
 * derive their own state weights, their own pointer position and their own idea
 * of how big the field was. That is four times the work and, more importantly,
 * four opportunities to disagree. They now read the objects below, written once
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
 * The group transform both tiers are drawn under: how much of the viewport the
 * field fills, and where it sits. Written here, applied by one group in `Stage`.
 */
export const sceneField: Composition = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  halfWidth: 1,
  halfHeight: 1,
};

/**
 * The cursor, unprojected onto the field plane and taken back into the field's
 * own space.
 *
 * Local, not world: node positions and the grain shader's positions are both
 * pre-transform, so a world-space cursor would inspect a point somewhere off to
 * the side the moment the field was scaled or offset at all.
 */
export const scenePointer = new THREE.Vector3();

/** Camera field of view. Narrower than a typical scene — this is an instrument
 *  looking at something, not a wide-angle environment. */
export const SCENE_FOV = 42;

export function SceneClock({ packed }: { packed: PackedStates | null }) {
  const reducedMotion = useNarrative((s) => s.reducedMotion);
  const { camera, size } = useThree();
  const debug = graphDebug();

  // Scratch objects — this runs every frame and must not allocate.
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  const composeInput = useMemo<ComposeInput>(
    () => ({
      halfX: 1,
      halfY: 1,
      halfZ: 1,
      fill: 0.7,
      distance: 4.6,
      fovDegrees: SCENE_FOV,
      offsetX: 0,
      offsetY: 0,
      viewportWidth: 1440,
      aspect: 1.6,
    }),
    [],
  );

  useFrame((_, delta) => {
    const frame = liveFrame;

    stateWeights(
      frame,
      scrollState.focusState,
      Math.min(scrollState.focusStrength, MAX_FOCUS_MIX),
      sceneWeights,
    );

    // The field's extents right now: the two states either side of the
    // transition, blended the same way everything else is. Without this the
    // frame would jump in size at every boundary.
    if (packed) {
      const a = frame.stateAIndex * 3;
      const b = frame.stateBIndex * 3;
      const t = frame.blend;
      composeInput.halfX = packed.halfExtent[a] + (packed.halfExtent[b] - packed.halfExtent[a]) * t;
      composeInput.halfY =
        packed.halfExtent[a + 1] + (packed.halfExtent[b + 1] - packed.halfExtent[a + 1]) * t;
      composeInput.halfZ =
        packed.halfExtent[a + 2] + (packed.halfExtent[b + 2] - packed.halfExtent[a + 2]) * t;
    }

    composeInput.fill = debug.enabled ? 0.8 : frame.camera.fill;
    composeInput.distance = frame.camera.distance;
    composeInput.offsetX = debug.enabled ? 0 : frame.camera.offset[0];
    composeInput.offsetY = debug.enabled ? 0 : frame.camera.offset[1];
    composeInput.viewportWidth = size.width;
    composeInput.aspect = size.width / Math.max(1, size.height);
    composeField(composeInput, sceneField);

    // Cursor onto the field plane, then out of the group transform.
    ndc.set(scrollState.pointerX, scrollState.pointerY, 0.5).unproject(camera);
    ray.origin.copy(camera.position);
    ray.direction.copy(ndc).sub(camera.position).normalize();
    if (ray.intersectPlane(plane, scenePointer)) {
      scenePointer.x = (scenePointer.x - sceneField.offsetX) / sceneField.scale;
      scenePointer.y = (scenePointer.y - sceneField.offsetY) / sceneField.scale;
      scenePointer.z /= sceneField.scale;
    }

    // Time advances at the state's own pace, so slowing a state genuinely slows
    // everything in it rather than only its transitions.
    sceneClock.time += reducedMotion ? 0 : delta * frame.motion;
  }, -1);

  return null;
}
