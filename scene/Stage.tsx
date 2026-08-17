'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useNarrative } from '@/lib/narrative/store';
import { detectTier, DPR_RANGE, MIN_ACTIVE_FRACTION } from '@/lib/perf';
import { FPlusGraph } from './graph/FPlusGraph';
import { SceneClock, SCENE_FOV } from './sceneFrame';
import styles from './stage.module.css';

/**
 * One persistent R3F scene. FPlusGraph owns the graph, dust, postprocessing,
 * camera orbit, group transform, and pointer interaction for the whole visit.
 */
function Scene() {
  return (
    <>
      <SceneClock />
      <FPlusGraph />
    </>
  );
}

export function Stage() {
  const tier = useNarrative((state) => state.tier);
  const setTier = useNarrative((state) => state.setTier);
  const setActiveFraction = useNarrative((state) => state.setActiveFraction);
  const setWebglFailed = useNarrative((state) => state.setWebglFailed);
  const webglFailed = useNarrative((state) => state.webglFailed);
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
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: SCENE_FOV, near: 0.1, far: 100, position: [0, 0, 5.9] }}
        onCreated={({ gl }) => {
          gl.setClearColor('#080909', 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        fallback={null}
        onError={() => setWebglFailed(true)}
      >
        <PerformanceMonitor
          onDecline={() => setActiveFraction(Math.max(MIN_ACTIVE_FRACTION, 0.7))}
          onIncline={() => setActiveFraction(1)}
        />
        <Scene />
      </Canvas>
    </div>
  );
}
