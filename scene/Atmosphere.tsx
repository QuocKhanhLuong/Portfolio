'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLOR } from '@/lib/narrative/timeline';
import { useNarrative } from '@/lib/narrative/store';
import { liveFrame } from '@/lib/narrative/ticker';
import { atmosFragmentShader, atmosVertexShader } from './shaders/atmos';
import { sceneClock } from './sceneFrame';

/**
 * The ground the whole scene sits on. Drawn first, in front of nothing.
 *
 * It replaces the flat clear colour with a tone that has some life in it, and
 * it reacts to the camera the way a page reacts to being leaned over: the
 * texture opens up as the camera comes in. On the low tier it is skipped
 * entirely — it is the cheapest thing to lose and the least missed.
 */
export function Atmosphere() {
  const tier = useNarrative((s) => s.tier);
  const reducedMotion = useNarrative((s) => s.reducedMotion);
  const { size } = useThree();

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const uniforms = useMemo(
    () => ({
      uPaper: { value: new THREE.Color('#080909') },
      uInk: { value: new THREE.Color().setRGB(COLOR.muted[0], COLOR.muted[1], COLOR.muted[2]) },
      uAccent: { value: new THREE.Color() },
      uTime: { value: 0 },
      uAmount: { value: 0.14 },
      uZoom: { value: 1.6 },
      uAspect: { value: 1 },
      uWarp: { value: 0.9 },
    }),
    [],
  );

  const material = useRef<THREE.ShaderMaterial>(null);

  useEffect(() => {
    uniforms.uAspect.value = size.width / Math.max(1, size.height);
  }, [size, uniforms]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const frame = liveFrame;
    uniforms.uTime.value = reducedMotion ? 0 : sceneClock.time;
    // The wash opens as the camera closes in, which keeps the background from
    // reading as a fixed image pasted behind a moving field.
    uniforms.uZoom.value += (1.15 + frame.camera.distance * 0.11 - uniforms.uZoom.value) * 0.02;
    uniforms.uAccent.value.setRGB(
      frame.palette.accent[0],
      frame.palette.accent[1],
      frame.palette.accent[2],
    );
    // Restrained everywhere, and it recedes further as the field expands.
    uniforms.uAmount.value = 0.15 * (1 - frame.palette.density * 0.4);
  });

  if (tier === 'low') return null;

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-1} matrixAutoUpdate={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={atmosVertexShader}
        fragmentShader={atmosFragmentShader}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
