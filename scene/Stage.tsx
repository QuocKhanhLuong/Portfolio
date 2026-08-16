'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { useNarrative } from '@/lib/narrative/store';
import { detectTier, DPR_RANGE, MIN_ACTIVE_FRACTION } from '@/lib/perf';
import { CameraRig } from './CameraRig';
import { MotifField } from './MotifField';
import styles from './stage.module.css';

/**
 * The canvas. Fixed behind everything, never unmounted, one scene for the whole
 * visit.
 *
 * If WebGL is unavailable the page keeps working: the narrative still runs, the
 * type still resolves, and the field simply is not there.
 */
export function Stage() {
  const tier = useNarrative((s) => s.tier);
  const setTier = useNarrative((s) => s.setTier);
  const setActiveFraction = useNarrative((s) => s.setActiveFraction);
  const setWebglFailed = useNarrative((s) => s.setWebglFailed);
  const webglFailed = useNarrative((s) => s.webglFailed);

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
        camera={{ fov: 60, near: 0.1, far: 60, position: [0, 0, 4.2] }}
        onCreated={({ gl }) => {
          gl.setClearColor('#05070C', 1);
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
        <MotifField />
      </Canvas>
    </div>
  );
}
