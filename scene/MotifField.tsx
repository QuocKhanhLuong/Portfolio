'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RESEARCH_EDGES } from '@/content/research';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { liveFrame } from '@/lib/narrative/ticker';
import { MIN_ACTIVE_FRACTION } from '@/lib/perf';
import { SCENE_INDEX, sceneClock, scenePointer } from './sceneFrame';
import { motifFragmentShader, motifVertexShader } from './shaders/motif';
import type { PackedStates } from './states/pack';

/**
 * The grain tier.
 *
 * It used to be the whole visual. Since the node layer arrived it is the
 * substrate: it carries the luminance of the source image, the texture of each
 * state and the sense that the diagram is an extraction from something denser.
 * It is deliberately quiet — the nodes are what you read.
 *
 * The field itself is never torn down and never replaced. It only ever moves
 * between states, using the shared morph in `scene/morph/core.ts`.
 */

/** How much of the palette density the grain is allowed to claim. */
const GRAIN_DENSITY = 0.6;

export function MotifField({ packed }: { packed: PackedStates }) {
  const reducedMotion = useNarrative((s) => s.reducedMotion);
  const points = useRef<THREE.Points>(null);

  const texture = useMemo(() => {
    const tex = new THREE.DataTexture(
      // Typed-array generics: the worker hands back a plain ArrayBuffer, but
      // the DOM lib types the parameter as ArrayBuffer-backed specifically.
      packed.data as Float32Array<ArrayBuffer>,
      packed.width,
      packed.height,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [packed]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const index = new Float32Array(packed.count);
    for (let i = 0; i < packed.count; i += 1) index[i] = i;

    // Position is never read — the shader builds it from the state texture —
    // but three needs an attribute to know how many vertices to draw.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(packed.count * 3), 3));
    geo.setAttribute('aIndex', new THREE.BufferAttribute(index, 1));
    geo.setAttribute('aStagger', new THREE.BufferAttribute(packed.stagger, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(packed.seed, 1));
    return geo;
  }, [packed]);

  const uniforms = useMemo(
    () => ({
      uStates: { value: texture },
      uTile: { value: packed.width },
      uRows: { value: packed.rows },
      uStateCount: { value: packed.stateCount },
      uStateA: { value: 0 },
      uStateB: { value: 0 },
      uFocusState: { value: 0 },
      uFocusMix: { value: 0 },
      uBlend: { value: 0 },
      uSpread: { value: 0.5 },
      uArc: { value: 0.15 },
      uTime: { value: 0 },
      uTurbulence: { value: 0 },
      uPointer: { value: new THREE.Vector3() },
      uPointerStrength: { value: 0 },
      uPointerRadius: { value: 0.6 },
      uPixelScale: { value: 5 },
      uScanX: { value: 0 },
      uEdgeCount: { value: RESEARCH_EDGES.length },
      uCore: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uDensity: { value: 1 },
      // Named slots, so the shader never has to hardcode a state's position in
      // SCENE_STATES.
      uIdxPixel: { value: SCENE_INDEX.pixel },
      uIdxImage: { value: SCENE_INDEX.image },
      uIdxFeatures: { value: SCENE_INDEX.features },
      uIdxCloud: { value: SCENE_INDEX.cloud },
      uIdxVolume: { value: SCENE_INDEX.volume },
      uIdxHuman: { value: SCENE_INDEX.human },
      uIdxUncertainty: { value: SCENE_INDEX.uncertainty },
      uIdxGraph: { value: SCENE_INDEX.graph },
      uIdxConstellation: { value: SCENE_INDEX.constellation },
    }),
    [texture, packed],
  );

  useEffect(
    () => () => {
      texture.dispose();
      geometry.dispose();
    },
    [texture, geometry],
  );

  useFrame(() => {
    const mesh = points.current;
    if (!mesh) return;

    const frame = liveFrame;
    const u = uniforms;

    u.uTime.value = sceneClock.time;

    u.uStateA.value = frame.stateAIndex;
    u.uStateB.value = frame.stateBIndex;
    u.uFocusState.value = scrollState.focusState;
    u.uFocusMix.value = scrollState.focusStrength;
    u.uBlend.value = frame.blend;
    u.uSpread.value = reducedMotion ? 0 : frame.interaction.spread;
    u.uArc.value = reducedMotion ? 0 : frame.interaction.arc;
    u.uTurbulence.value = reducedMotion ? 0 : frame.interaction.turbulence;
    u.uPointerRadius.value = frame.interaction.pointerRadius;
    u.uScanX.value = scrollState.scanX;

    u.uCore.value.setRGB(frame.palette.core[0], frame.palette.core[1], frame.palette.core[2]);
    u.uAccent.value.setRGB(frame.palette.accent[0], frame.palette.accent[1], frame.palette.accent[2]);
    u.uDensity.value = frame.palette.density * GRAIN_DENSITY;

    // Adaptive density. Buffers stay at full size; the draw range shrinks, so
    // a struggling device sheds particles without rebuilding anything.
    const active = Math.max(MIN_ACTIVE_FRACTION, useNarrative.getState().activeFraction);
    const drawCount = Math.floor(packed.count * active);
    if (mesh.geometry.drawRange.count !== drawCount) mesh.geometry.setDrawRange(0, drawCount);

    // The inspection point is computed once per frame by `SceneClock`, so the
    // grain and the nodes are always being read at the same place.
    u.uPointer.value.copy(scenePointer);
    u.uPointerStrength.value = reducedMotion
      ? 0
      : frame.interaction.pointerStrength * scrollState.pointerStrength;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={0}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={motifVertexShader}
        fragmentShader={motifFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
