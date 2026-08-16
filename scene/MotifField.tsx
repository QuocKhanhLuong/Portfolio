'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RESEARCH_EDGES, RESEARCH_NODES } from '@/content/research';
import { SCENE_STATES } from '@/content/types';
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
    u.uFocusState.value = scrollState.focusState;
    u.uFocusMix.value = scrollState.focusStrength;
    u.uBlend.value = frame.blend;
    u.uSpread.value = reducedMotion ? 0 : frame.interaction.spread;
    u.uArc.value = reducedMotion ? 0 : frame.interaction.arc;
    u.uTurbulence.value = reducedMotion ? 0 : frame.interaction.turbulence;
    u.uPointerRadius.value = frame.interaction.pointerRadius;

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

    // Project the cursor onto the field plane so the shader and the supporting
    // instrument layers share one optical inspection point.
    ndc.set(scrollState.pointerX, scrollState.pointerY, 0.5).unproject(camera);
    ray.origin.copy(camera.position);
    ray.direction.copy(ndc).sub(camera.position).normalize();
    if (ray.intersectPlane(plane, hit)) u.uPointer.value.copy(hit);
    u.uPointerStrength.value = reducedMotion ? 0 : frame.interaction.pointerStrength * scrollState.pointerStrength;
  });

  return (
    <>
      <GraphEdges reducedMotion={reducedMotion} />
      <ScanPlane pointer={uniforms.uPointer.value} reducedMotion={reducedMotion} />
      <points ref={points} geometry={geometry} frustumCulled={false}>
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
    </>
  );
}

const GRAPH_SCALE = 1.5;
const GRAPH_STATE = SCENE_STATES.indexOf('graph');
const UNCERTAINTY_STATE = SCENE_STATES.indexOf('uncertainty');
const VOLUME_STATE = SCENE_STATES.indexOf('volume');
const HUMAN_STATE = SCENE_STATES.indexOf('human');

function stateWeight(value: number, center: number, radius: number) {
  const t = THREE.MathUtils.clamp(Math.abs(value - center) / radius, 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

/** A restrained diagram layer that clarifies the graph state without glow. */
function GraphEdges({ reducedMotion }: { reducedMotion: boolean }) {
  const lines = useRef<THREE.LineSegments>(null);
  const material = useRef<THREE.LineDashedMaterial>(null);
  const frame = useRef<NarrativeFrame>(sample(0)).current;
  const time = useRef(0);
  const geometry = useMemo(() => {
    const positions = new Float32Array(RESEARCH_EDGES.length * 6);
    const nodes = new Map(RESEARCH_NODES.map((node) => [node.id, node.position] as const));

    RESEARCH_EDGES.forEach((edge, index) => {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) return;

      const offset = index * 6;
      positions[offset] = from[0] * GRAPH_SCALE;
      positions[offset + 1] = from[1] * GRAPH_SCALE;
      positions[offset + 2] = from[2] * GRAPH_SCALE;
      positions[offset + 3] = to[0] * GRAPH_SCALE;
      positions[offset + 4] = to[1] * GRAPH_SCALE;
      positions[offset + 5] = to[2] * GRAPH_SCALE;
    });

    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => {
    lines.current?.computeLineDistances();
    return () => geometry.dispose();
  }, [geometry]);

  useFrame((_, delta) => {
    sample(scrollState.progress, frame);
    time.current += delta * frame.motion;

    const state = THREE.MathUtils.lerp(frame.stateAIndex, frame.stateBIndex, frame.blend);
    const graphWeight = stateWeight(state, GRAPH_STATE, 1.25);
    const uncertaintyWeight = stateWeight(state, UNCERTAINTY_STATE, 1.25);
    const focused = scrollState.focusState === GRAPH_STATE ? scrollState.focusStrength : 0;

    if (material.current) {
      material.current.color.setRGB(frame.palette.accent[0], frame.palette.accent[1], frame.palette.accent[2]);
      material.current.opacity = THREE.MathUtils.clamp(
        graphWeight * 0.16 + uncertaintyWeight * 0.04 + focused * 0.34,
        0,
        0.42,
      );
      if (lines.current) {
        lines.current.rotation.z = reducedMotion ? 0 : Math.sin(time.current * 0.12) * 0.008;
      }
    }
  });

  return (
    <lineSegments ref={lines} geometry={geometry} frustumCulled={false}>
      <lineDashedMaterial
        ref={material}
        color="#A48A58"
        transparent
        depthTest={false}
        depthWrite={false}
        dashSize={0.075}
        gapSize={0.055}
        opacity={0}
      />
    </lineSegments>
  );
}

/** A narrow translucent slice that turns the medical states into an instrument. */
function ScanPlane({ pointer, reducedMotion }: { pointer: THREE.Vector3; reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const frame = useRef<NarrativeFrame>(sample(0)).current;
  const time = useRef(0);

  useFrame((_, delta) => {
    sample(scrollState.progress, frame);
    time.current += delta * frame.motion;

    const state = THREE.MathUtils.lerp(frame.stateAIndex, frame.stateBIndex, frame.blend);
    const medicalWeight = Math.max(
      stateWeight(state, VOLUME_STATE, 0.95),
      stateWeight(state, HUMAN_STATE, 0.95),
    );
    const focused =
      scrollState.focusState === VOLUME_STATE || scrollState.focusState === HUMAN_STATE
        ? scrollState.focusStrength
        : 0;
    const instrumentWeight = THREE.MathUtils.clamp(medicalWeight + focused * 0.55, 0, 1);

    if (mesh.current) {
      mesh.current.position.copy(pointer);
      mesh.current.rotation.z = reducedMotion ? 0.06 : 0.06 + Math.sin(time.current * 0.22) * 0.025;
      mesh.current.scale.y = 0.84 + instrumentWeight * 0.2;
    }
    if (material.current) {
      material.current.color.setRGB(frame.palette.accent[0], frame.palette.accent[1], frame.palette.accent[2]);
      material.current.opacity = instrumentWeight * (0.018 + scrollState.pointerStrength * 0.22 + focused * 0.12);
    }
  });

  return (
    <mesh ref={mesh} renderOrder={2}>
      <planeGeometry args={[0.055, 4.4]} />
      <meshBasicMaterial
        ref={material}
        color="#71849A"
        transparent
        depthTest={false}
        depthWrite={false}
        opacity={0}
      />
    </mesh>
  );
}
