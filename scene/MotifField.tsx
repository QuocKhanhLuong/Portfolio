'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { sample, type NarrativeFrame } from '@/lib/narrative/interpolate';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { MIN_ACTIVE_FRACTION, PARTICLE_COUNT } from '@/lib/perf';
import { motifFragmentShader, motifVertexShader } from './shaders/motif';
import { packStates, type PackedStates } from './states/pack';

/**
 * The one continuous visual system. It is never torn down and never replaced —
 * it only ever moves between states.
 */
export function MotifField() {
  const tier = useNarrative((s) => s.tier);
  const reducedMotion = useNarrative((s) => s.reducedMotion);
  const count = PARTICLE_COUNT[tier];

  const [packed, setPacked] = useState<PackedStates | null>(null);

  // Built off the main thread; the opening act is the worst possible moment for
  // a 30ms hitch. Falls back to a synchronous build where workers are absent.
  useEffect(() => {
    let cancelled = false;

    if (typeof Worker === 'undefined') {
      setPacked(packStates(count));
      return;
    }

    const worker = new Worker(new URL('./states/pack.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<PackedStates>) => {
      if (!cancelled) setPacked(event.data);
      worker.terminate();
    };
    worker.onerror = () => {
      if (!cancelled) setPacked(packStates(count));
      worker.terminate();
    };
    worker.postMessage({ count });

    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [count]);

  if (!packed) return null;
  return <Field packed={packed} reducedMotion={reducedMotion} />;
}

function Field({ packed, reducedMotion }: { packed: PackedStates; reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  const { camera } = useThree();

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
      uBlend: { value: 0 },
      uSpread: { value: 0.5 },
      uArc: { value: 0.15 },
      uTime: { value: 0 },
      uTurbulence: { value: 0 },
      uVelocity: { value: 0 },
      uPointer: { value: new THREE.Vector3() },
      uPointerStrength: { value: 0 },
      uPointerSign: { value: 1 },
      uPixelScale: { value: 6 },
      uCore: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uDensity: { value: 1 },
    }),
    [texture, packed],
  );

  useEffect(() => () => {
    texture.dispose();
    geometry.dispose();
  }, [texture, geometry]);

  // Scratch objects, so the frame loop allocates nothing.
  const frame = useRef<NarrativeFrame>(sample(0)).current;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const ray = useMemo(() => new THREE.Ray(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const sceneTime = useRef(0);

  useFrame((_, delta) => {
    const mesh = points.current;
    if (!mesh) return;

    sample(scrollState.progress, frame);
    const u = uniforms;

    // Time advances at the act's own pace, so slowing an act genuinely slows
    // everything in it rather than just its transitions.
    sceneTime.current += delta * frame.motion;
    u.uTime.value = reducedMotion ? 0 : sceneTime.current;

    u.uStateA.value = frame.stateAIndex;
    u.uStateB.value = frame.stateBIndex;
    u.uBlend.value = frame.blend;
    u.uSpread.value = reducedMotion ? 0 : frame.interaction.spread;
    u.uArc.value = reducedMotion ? 0 : frame.interaction.arc;
    u.uTurbulence.value = reducedMotion ? 0 : frame.interaction.turbulence;
    u.uVelocity.value = reducedMotion ? 0 : THREE.MathUtils.clamp(scrollState.velocity * 0.55, -1.2, 1.2);

    u.uCore.value.setRGB(frame.palette.core[0], frame.palette.core[1], frame.palette.core[2]);
    u.uAccent.value.setRGB(frame.palette.accent[0], frame.palette.accent[1], frame.palette.accent[2]);
    u.uDensity.value = frame.palette.density;

    // Adaptive density. Buffers stay at full size; the draw range shrinks, so
    // a struggling device sheds particles without rebuilding anything.
    const active = Math.max(
      MIN_ACTIVE_FRACTION,
      useNarrative.getState().activeFraction,
    );
    const drawCount = Math.floor(packed.count * active);
    if (mesh.geometry.drawRange.count !== drawCount) mesh.geometry.setDrawRange(0, drawCount);

    if (reducedMotion) {
      u.uPointerStrength.value = 0;
    } else {
      // Project the cursor onto the plane the field is centred on, so the force
      // is applied in world space and does not skew with camera distance.
      ndc.set(scrollState.pointerX, scrollState.pointerY, 0.5).unproject(camera);
      ray.origin.copy(camera.position);
      ray.direction.copy(ndc).sub(camera.position).normalize();
      if (ray.intersectPlane(plane, hit)) u.uPointer.value.copy(hit);
      u.uPointerStrength.value = frame.interaction.pointerStrength * scrollState.pointerStrength;
      u.uPointerSign.value = frame.interaction.pointerSign;
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={motifVertexShader}
        fragmentShader={motifFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
