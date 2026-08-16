'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SCENE_STATES } from '@/content/types';
import { sample, type NarrativeFrame } from '@/lib/narrative/interpolate';
import { scrollState, useNarrative } from '@/lib/narrative/store';

/**
 * The camera is a function of narrative progress and nothing else.
 *
 * `dimensionality` gates how much of the yaw, pitch and pointer parallax is
 * actually applied. The cursor is an inspection aid, so its camera contribution
 * stays small even when the point cloud becomes dimensional.
 */
export function CameraRig() {
  const { camera } = useThree();
  const reducedMotion = useNarrative((s) => s.reducedMotion);

  const frame = useRef<NarrativeFrame>(sample(0)).current;
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const time = useRef(0);

  useFrame((_, delta) => {
    sample(scrollState.progress, frame);
    time.current += delta * frame.motion;

    const { camera: key } = frame;
    const dim = key.dimensionality;
    const baseState = THREE.MathUtils.lerp(frame.stateAIndex, frame.stateBIndex, frame.blend);
    const effectiveState = THREE.MathUtils.lerp(baseState, scrollState.focusState, scrollState.focusStrength);
    const cloudInspection = stateWeight(effectiveState, SCENE_STATES.indexOf('cloud'), 1.15);
    const graphInspection = stateWeight(effectiveState, SCENE_STATES.indexOf('graph'), 1.25);
    const constellationDrift = stateWeight(effectiveState, SCENE_STATES.indexOf('constellation'), 1.1);

    // Depth and graph states give the cursor a little more room to inspect the
    // field. Flat states stay nearly still so the foreground remains primary.
    const pointerYaw = reducedMotion
      ? 0
      : scrollState.pointerX * (0.045 + cloudInspection * 0.095 + graphInspection * 0.02) * scrollState.pointerStrength;
    const pointerPitch = reducedMotion
      ? 0
      : -scrollState.pointerY * (0.03 + cloudInspection * 0.075 + graphInspection * 0.018) * scrollState.pointerStrength;
    const drift = reducedMotion
      ? 0
      : Math.sin(time.current * (0.2 - constellationDrift * 0.08)) * key.drift * (0.5 + graphInspection * 0.18);

    // Parallax and drift are scaled by dimensionality: flat states stay legible,
    // while depth states acknowledge the cursor with restrained parallax.
    const yaw = key.yaw + (pointerYaw + drift) * dim;
    const pitch = key.pitch + pointerPitch * dim;

    const [ox, oy] = key.offset;

    desired.set(
      Math.sin(yaw) * Math.cos(pitch) * key.distance + ox,
      Math.sin(pitch) * key.distance + oy,
      Math.cos(yaw) * Math.cos(pitch) * key.distance,
    );

    // Light damping only — the narrative model is already smoothed, and heavier
    // damping here would make the camera lag the copy.
    const ease = reducedMotion ? 1 : 1 - Math.pow(0.002, delta);
    camera.position.lerp(desired, ease);

    target.set(ox, oy, 0);
    camera.lookAt(target);
  });

  return null;
}

function stateWeight(value: number, center: number, radius: number) {
  const t = THREE.MathUtils.clamp(Math.abs(value - center) / radius, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}
