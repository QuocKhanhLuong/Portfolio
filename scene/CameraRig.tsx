'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sample, type NarrativeFrame } from '@/lib/narrative/interpolate';
import { scrollState, useNarrative } from '@/lib/narrative/store';

/**
 * The camera is a function of narrative progress and nothing else.
 *
 * `dimensionality` gates how much of the yaw, pitch and pointer parallax is
 * actually applied. It is held near zero for the first three acts so that the
 * world reads as flat, and opens to 1 in Act 03 — the arrival of depth is an
 * event, and withholding it for 40% of the scroll is what makes it one.
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

    const pointerYaw = reducedMotion ? 0 : scrollState.pointerX * 0.16 * scrollState.pointerStrength;
    const pointerPitch = reducedMotion ? 0 : -scrollState.pointerY * 0.1 * scrollState.pointerStrength;
    const drift = reducedMotion ? 0 : Math.sin(time.current * 0.24) * key.drift * 0.5;

    // Parallax and drift are scaled by dimensionality: before Act 03 the camera
    // barely acknowledges that it can move.
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
