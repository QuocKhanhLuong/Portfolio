'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SceneState } from '@/content/types';
import { subscribeFrame } from '@/lib/narrative/ticker';
import { useNarrative } from '@/lib/narrative/store';
import { DPR_RANGE } from '@/lib/perf';
import { FieldGraph } from './graph/FieldGraph';
import styles from './field-panel.module.css';

export interface FieldPanelProps {
  state: SceneState;
  align: 'left' | 'right';
  className?: string;
}

function DemandClock({ active }: { active: boolean }) {
  const invalidate = useThree((value) => value.invalidate);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    invalidate();
  }, [active, invalidate]);

  useEffect(() => {
    const stop = subscribeFrame(() => {
      if (activeRef.current) invalidate();
    });
    invalidate();
    return stop;
  }, [invalidate]);

  return null;
}

export function FieldPanel({ state, align, className = '' }: FieldPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const tier = useNarrative((value) => value.tier);
  const webglFailed = useNarrative((value) => value.webglFailed);
  const setWebglFailed = useNarrative((value) => value.setWebglFailed);
  const [dprMin, dprMax] = DPR_RANGE[tier];

  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;

    if (!('IntersectionObserver' in window)) {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      { rootMargin: '20% 0px', threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={panelRef}
      className={`${styles.fieldPanel} ${align === 'left' ? styles.fieldPanelLeft : styles.fieldPanelRight} ${className}`}
      data-field-panel={state}
      data-field-active={active ? 'true' : 'false'}
      role="img"
      aria-label={`${state} visual field`}
    >
      {!webglFailed && (
        <Canvas
          frameloop="demand"
          dpr={[dprMin, dprMax]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 5.9] }}
          onCreated={({ gl }) => {
            gl.setClearColor('#080909', 1);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
          fallback={null}
          onError={() => setWebglFailed(true)}
        >
          <DemandClock active={active} />
          <FieldGraph state={state} active={active} />
        </Canvas>
      )}
    </div>
  );
}
