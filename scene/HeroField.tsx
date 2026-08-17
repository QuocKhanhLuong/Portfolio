'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { subscribeFrame } from '@/lib/narrative/ticker';
import { useNarrative } from '@/lib/narrative/store';
import { DPR_RANGE } from '@/lib/perf';
import { FieldGraph } from './graph/FieldGraph';
import styles from './hero-field.module.css';

function HeroClock() {
  const invalidate = useThree((value) => value.invalidate);

  useEffect(() => {
    const stop = subscribeFrame(() => invalidate());
    invalidate();
    return stop;
  }, [invalidate]);

  return null;
}

export function HeroField() {
  const tier = useNarrative((value) => value.tier);
  const webglFailed = useNarrative((value) => value.webglFailed);
  const setWebglFailed = useNarrative((value) => value.setWebglFailed);
  const [dprMin, dprMax] = DPR_RANGE[tier];

  if (webglFailed) return null;

  return (
    <div className={styles.heroField} aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[dprMin, dprMax]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 52, near: 0.1, far: 100, position: [0, 0, 5.9] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        fallback={null}
        onError={() => setWebglFailed(true)}
      >
        <HeroClock />
        <FieldGraph state="signal" active placement="hero" />
      </Canvas>
    </div>
  );
}
