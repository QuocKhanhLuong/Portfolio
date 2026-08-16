'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { liveFrame } from '@/lib/narrative/ticker';
import { detectTier, DPR_RANGE, MIN_ACTIVE_FRACTION } from '@/lib/perf';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Atmosphere } from './Atmosphere';
import { CameraRig } from './CameraRig';
import { graphDebug } from './debug';
import { GraphLayer } from './graph/GraphLayer';
import { MotifField } from './MotifField';
import { SceneClock, SCENE_FOV, sceneField } from './sceneFrame';
import { usePackedStates } from './states/usePackedStates';
import styles from './stage.module.css';

/**
 * The canvas. Fixed behind everything, never unmounted, one scene for the whole
 * visit.
 *
 * If WebGL is unavailable the page keeps working: the portfolio still reads
 * cleanly, and the field simply is not there.
 */
/**
 * Grain and nodes, from one state texture, under one transform.
 *
 * The group is the whole composition: `sceneField` decides how much of the
 * viewport the field fills and where it sits, and both tiers inherit it. They
 * are two readings of a single field and must never be framed separately.
 */
function Field() {
  const packed = usePackedStates();
  const group = useRef<THREE.Group>(null);
  const debug = graphDebug();
  const reduced = useNarrative((s) => s.reducedMotion);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    g.scale.setScalar(sceneField.scale);
    g.position.set(sceneField.offsetX, sceneField.offsetY, 0);

    if (debug.enabled) {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      return;
    }

    // A small tilt toward the cursor, scaled by how dimensional the current
    // state is. Flat states barely move; the volumetric ones acknowledge being
    // looked at. It lives on the group rather than the camera so it reads as
    // the object turning, not the room.
    const frame = liveFrame;
    const reach = frame.camera.dimensionality * scrollState.pointerStrength;
    const tiltY = reduced ? 0 : scrollState.pointerX * 0.14 * reach;
    const tiltX = reduced ? 0 : -scrollState.pointerY * 0.1 * reach;
    const ease = 1 - Math.pow(0.005, Math.min(0.1, delta) || 1 / 60);
    g.rotation.y += (tiltY - g.rotation.y) * ease;
    g.rotation.x += (tiltX - g.rotation.x) * ease;
  });

  return (
    <>
      <SceneClock packed={packed} />
      {packed && (
        <group ref={group}>
          {!debug.enabled && <MotifField packed={packed} />}
          <GraphLayer packed={packed} />
        </group>
      )}
    </>
  );
}

export function Stage() {
  const tier = useNarrative((s) => s.tier);
  const setTier = useNarrative((s) => s.setTier);
  const setActiveFraction = useNarrative((s) => s.setActiveFraction);
  const setWebglFailed = useNarrative((s) => s.setWebglFailed);
  const webglFailed = useNarrative((s) => s.webglFailed);

  const debug = graphDebug();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTier(detectTier());
    setMounted(true);
  }, [setTier]);

  if (!mounted || webglFailed) return <div className={styles.stage} aria-hidden="true" />;

  const [dprMin, dprMax] = DPR_RANGE[tier];

  return (
    <div className={styles.stage} aria-hidden="true">
      <Canvas
        dpr={[dprMin, dprMax]}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        // A narrower field of view than a general 3D scene: less perspective
        // distortion across a wide object, which is what makes the field read as
        // something being looked at rather than something being flown through.
        camera={{ fov: SCENE_FOV, near: 0.1, far: 60, position: [0, 0, 4.6] }}
        onCreated={({ gl }) => {
          gl.setClearColor('#F4F1EA', 1);
        }}
        fallback={null}
        onError={() => setWebglFailed(true)}
      >
        <PerformanceMonitor
          // Shed particles before resolution: a slightly sparser field reads
          // better than a soft one.
          onDecline={() => setActiveFraction(Math.max(MIN_ACTIVE_FRACTION, 0.7))}
          onIncline={() => setActiveFraction(1)}
        />
        <CameraRig />
        {!debug.enabled && <Atmosphere />}
        <Field />
      </Canvas>
    </div>
  );
}
