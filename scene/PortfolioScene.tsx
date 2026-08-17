'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { sceneAnchors } from '@/lib/narrative/sceneMap';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { subscribeFrame } from '@/lib/narrative/ticker';
import { DPR_RANGE } from '@/lib/perf';
import { getMainTargets, type MainTargets } from './main/targets';
import styles from './portfolio-scene.module.css';

const POINT_VERTEX = /* glsl */ `
  attribute vec3 a_base;
  attribute vec3 a_about;
  attribute vec3 a_work;
  attribute vec3 a_research;
  attribute vec3 a_experience;
  attribute float a_phase;
  attribute float a_seed;
  attribute float a_accent;
  uniform float u_scene_a;
  uniform float u_scene_b;
  uniform float u_blend;
  uniform float u_time;
  uniform float u_pixel_ratio;
  uniform float u_motion;
  uniform float u_point_size;
  uniform float u_pointer_energy;
  uniform float u_focus;
  uniform vec2 u_pointer;
  uniform float u_about_progress;
  uniform float u_research_weight;
  varying float v_accent;
  varying float v_alpha;

  vec3 targetFor(float state) {
    if (state < 0.5) return a_about;
    if (state < 1.5) return a_work;
    if (state < 2.5) return a_research;
    return a_experience;
  }

  float stateWeight(float state, float target) {
    return 1.0 - step(0.5, abs(state - target));
  }

  void main() {
    vec3 point = mix(targetFor(u_scene_a), targetFor(u_scene_b), u_blend);
    float about = stateWeight(u_scene_a, 0.0) * (1.0 - u_blend) + stateWeight(u_scene_b, 0.0) * u_blend;
    float work = stateWeight(u_scene_a, 1.0) * (1.0 - u_blend) + stateWeight(u_scene_b, 1.0) * u_blend;
    float research = stateWeight(u_scene_a, 2.0) * (1.0 - u_blend) + stateWeight(u_scene_b, 2.0) * u_blend;
    float experience = stateWeight(u_scene_a, 3.0) * (1.0 - u_blend) + stateWeight(u_scene_b, 3.0) * u_blend;

    // GPU-side independent motion. The phase and seed attributes never change,
    // so the cloud wanders instead of breathing as one synchronized shape.
    vec3 drift = vec3(
      sin(u_time * (0.17 + a_seed * 0.15) + a_phase) * (0.014 + a_seed * 0.016),
      cos(u_time * (0.13 + a_seed * 0.19) + a_phase * 1.31) * (0.014 + a_seed * 0.02),
      sin(u_time * (0.11 + a_seed * 0.12) + a_phase * 0.71) * (0.028 + a_seed * 0.03)
    ) * u_motion;
    point += drift;

    // Pointer energy is layered onto the stable motion and decays in the shared
    // narrative clock. Focus changes the lens strength, never the scroll state.
    vec2 pointerDelta = point.xy - u_pointer * 0.65;
    float pointerDistance = max(length(pointerDelta), 0.001);
    float lens = 1.0 - smoothstep(0.06, 0.7, pointerDistance);
    point.xy += normalize(pointerDelta) * lens * (u_pointer_energy * 0.11 + u_focus * 0.018);
    point.z += lens * u_pointer_energy * 0.045;

    // ABOUT reads as a scan: the moving band is a shading event, not a second
    // scene anchor. WORK gains dimensionality as its reconstructed structure
    // settles; RESEARCH keeps slice/depth uncertainty visible at rest.
    float scan = about * (1.0 - smoothstep(0.025, 0.14, abs(point.y - (u_about_progress * 2.0 - 1.0))));
    point.x += scan * sin(point.y * 32.0 + u_time * 0.7 + a_phase) * 0.012;
    point.z += work * sin(u_time * 0.23 + a_phase * 1.7) * 0.018;
    point.z += research * sin(u_time * (0.3 + a_seed * 0.2) + point.x * 5.0) * 0.045;
    point.xy += research * vec2(
      sin(a_phase * 2.1 + u_time * 0.21),
      cos(a_phase * 1.6 + u_time * 0.17)
    ) * u_research_weight * 0.018;

    vec4 modelPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * modelPosition;
    gl_PointSize = u_point_size * u_pixel_ratio * (4.2 / max(1.0, -modelPosition.z));
    v_accent = clamp(a_accent + research * 0.18 + experience * 0.08, 0.0, 1.0);
    v_alpha = 0.54 + a_seed * 0.36 + scan * 0.22 + experience * 0.12;
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float v_accent;
  varying float v_alpha;
  uniform vec3 u_core;
  uniform vec3 u_accent_color;
  uniform float u_opacity;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float softness = 1.0 - smoothstep(0.12, 0.5, distanceToCenter);
    vec3 color = mix(u_core, u_accent_color, smoothstep(0.66, 1.0, v_accent));
    gl_FragColor = vec4(color, softness * v_alpha * u_opacity);
  }
`;

const LINE_VERTEX = /* glsl */ `
  attribute vec3 a_about;
  attribute vec3 a_work;
  attribute vec3 a_research;
  attribute vec3 a_experience;
  attribute float a_phase;
  attribute float a_accent;
  uniform float u_scene_a;
  uniform float u_scene_b;
  uniform float u_blend;
  uniform float u_time;
  uniform float u_motion;
  varying float v_accent;
  varying float v_alpha;

  vec3 targetFor(float state) {
    if (state < 0.5) return a_about;
    if (state < 1.5) return a_work;
    if (state < 2.5) return a_research;
    return a_experience;
  }

  void main() {
    vec3 point = mix(targetFor(u_scene_a), targetFor(u_scene_b), u_blend);
    point += vec3(
      sin(u_time * (0.17 + a_accent * 0.12) + a_phase) * 0.012,
      cos(u_time * (0.13 + a_accent * 0.16) + a_phase * 1.2) * 0.012,
      sin(u_time * (0.1 + a_accent * 0.1) + a_phase) * 0.025
    ) * u_motion;
    vec4 modelPosition = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * modelPosition;
    v_accent = a_accent;
    v_alpha = 0.5 + a_accent * 0.4;
  }
`;

const LINE_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float v_accent;
  varying float v_alpha;
  uniform vec3 u_core;
  uniform vec3 u_accent_color;
  uniform float u_opacity;

  void main() {
    gl_FragColor = vec4(mix(u_core, u_accent_color, v_accent), v_alpha * u_opacity);
  }
`;

interface MainSceneSample {
  sceneA: number;
  sceneB: number;
  blend: number;
  opacity: number;
  side: number;
  researchWeight: number;
  experienceWeight: number;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function resolveMainScene(progress: number): MainSceneSample {
  const anchors = sceneAnchors();
  const order = [
    { state: 'pixel', mode: 0, side: -1 },
    { state: 'features', mode: 1, side: 1 },
    { state: 'uncertainty', mode: 2, side: -1 },
    { state: 'graph', mode: 3, side: 1 },
    { state: 'constellation', mode: 3, side: 0 },
  ] as const;
  const mainAnchors = order
    .map((item) => ({ ...item, anchor: anchors.find((anchor) => anchor.state === item.state) }))
    .filter((item): item is typeof item & { anchor: NonNullable<typeof item.anchor> } => Boolean(item.anchor));

  if (!mainAnchors.length) {
    return { sceneA: 0, sceneB: 0, blend: 0, opacity: 0, side: -1, researchWeight: 0, experienceWeight: 0 };
  }

  const first = mainAnchors[0].anchor;
  const last = mainAnchors[mainAnchors.length - 1].anchor;
  if (progress < first.progress) {
    const opacity = smoothstep(first.progress - 0.16, first.progress - 0.015, progress);
    return { sceneA: 0, sceneB: 0, blend: 0, opacity, side: -1, researchWeight: 0, experienceWeight: 0 };
  }
  if (progress >= last.progress) {
    const opacity = 1 - smoothstep(last.progress, Math.min(1, last.progress + 0.14), progress);
    return { sceneA: 3, sceneB: 3, blend: 0, opacity, side: 0, researchWeight: 0, experienceWeight: opacity };
  }

  let current = mainAnchors[0];
  let next = mainAnchors[1] ?? current;
  for (let index = 0; index < mainAnchors.length - 1; index += 1) {
    if (progress >= mainAnchors[index].anchor.progress) {
      current = mainAnchors[index];
      next = mainAnchors[index + 1];
    }
  }
  const blend = smoothstep(current.anchor.transitionStart, current.anchor.transitionEnd, progress);
  const side = current.side + (next.side - current.side) * blend;
  const researchWeight = current.mode === 2
    ? 1 - blend
    : next.mode === 2
      ? blend
      : 0;
  const experienceWeight = current.mode === 3
    ? 1 - blend
    : next.mode === 3
      ? blend
      : 0;
  return {
    sceneA: current.mode,
    sceneB: next.mode,
    blend,
    opacity: 1,
    side,
    researchWeight,
    experienceWeight,
  };
}

function SceneClock() {
  const invalidate = useThree((value) => value.invalidate);

  useEffect(() => {
    const stop = subscribeFrame(() => invalidate());
    invalidate();
    return stop;
  }, [invalidate]);

  return null;
}

function MainField({ targets, reducedMotion }: { targets: MainTargets; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const lineMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const { camera, gl, size } = useThree();

  const pointGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(targets.base, 3));
    geometry.setAttribute('a_about', new THREE.BufferAttribute(targets.about, 3));
    geometry.setAttribute('a_work', new THREE.BufferAttribute(targets.work, 3));
    geometry.setAttribute('a_research', new THREE.BufferAttribute(targets.research, 3));
    geometry.setAttribute('a_experience', new THREE.BufferAttribute(targets.experience, 3));
    geometry.setAttribute('a_phase', new THREE.BufferAttribute(targets.phase, 1));
    geometry.setAttribute('a_seed', new THREE.BufferAttribute(targets.seed, 1));
    geometry.setAttribute('a_accent', new THREE.BufferAttribute(targets.accent, 1));
    return geometry;
  }, [targets]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const zero = new Float32Array(targets.lines.count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(zero, 3));
    geometry.setAttribute('a_about', new THREE.BufferAttribute(targets.lines.about, 3));
    geometry.setAttribute('a_work', new THREE.BufferAttribute(targets.lines.work, 3));
    geometry.setAttribute('a_research', new THREE.BufferAttribute(targets.lines.research, 3));
    geometry.setAttribute('a_experience', new THREE.BufferAttribute(targets.lines.experience, 3));
    geometry.setAttribute('a_phase', new THREE.BufferAttribute(targets.lines.phase, 1));
    geometry.setAttribute('a_accent', new THREE.BufferAttribute(targets.lines.accent, 1));
    return geometry;
  }, [targets]);

  const pointMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_scene_a: { value: 0 },
      u_scene_b: { value: 0 },
      u_blend: { value: 0 },
      u_time: { value: 0 },
      u_pixel_ratio: { value: 1 },
      u_motion: { value: 1 },
      u_point_size: { value: 3.4 },
      u_pointer: { value: new THREE.Vector2() },
      u_pointer_energy: { value: 0 },
      u_focus: { value: 0 },
      u_about_progress: { value: 0 },
      u_research_weight: { value: 0 },
      u_core: { value: new THREE.Color('#ECE9E1') },
      u_accent_color: { value: new THREE.Color('#8296AA') },
      u_opacity: { value: 0 },
    },
  }), []);

  const lineMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_scene_a: { value: 0 },
      u_scene_b: { value: 0 },
      u_blend: { value: 0 },
      u_time: { value: 0 },
      u_motion: { value: 1 },
      u_core: { value: new THREE.Color('#8296AA') },
      u_accent_color: { value: new THREE.Color('#B49A65') },
      u_opacity: { value: 0 },
    },
  }), []);

  useEffect(() => () => {
    pointGeometry.dispose();
    lineGeometry.dispose();
    pointMaterial.dispose();
    lineMaterial.dispose();
  }, [lineGeometry, lineMaterial, pointGeometry, pointMaterial]);

  useFrame(() => {
    const group = groupRef.current;
    const pointsMaterial = pointsMaterialRef.current;
    const linesMaterial = lineMaterialRef.current;
    if (!group || !pointsMaterial || !linesMaterial) return;

    const sample = resolveMainScene(scrollState.progress);
    const perspective = camera as THREE.PerspectiveCamera;
    const distance = Math.max(1, perspective.position.z);
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5));
    const aspect = size.width / Math.max(1, size.height);
    const halfWidth = halfHeight * aspect;
    const scale = Math.min(halfHeight * 0.76, halfWidth * (aspect > 1.05 ? 0.76 : 0.68));
    const desktopSide = aspect > 1.05 ? sample.side : 0;

    group.scale.setScalar(scale);
    group.position.x += (desktopSide * halfWidth * 0.46 - group.position.x) * 0.12;
    group.position.y += (-halfHeight * 0.015 - group.position.y) * 0.12;
    group.rotation.x += ((reducedMotion ? 0 : scrollState.pointerY * 0.035) - group.rotation.x) * 0.08;
    group.rotation.y += ((reducedMotion ? 0 : scrollState.pointerX * 0.045) - group.rotation.y) * 0.08;

    const targetCameraZ = 5 + (sample.sceneA === 2 ? 0.18 : 0) + (sample.sceneA === 3 ? -0.1 : 0);
    perspective.position.z += (targetCameraZ - perspective.position.z) * 0.08;
    perspective.lookAt(0, 0, 0);

    const motion = reducedMotion ? 0 : 1;
    const uniformSets = [pointsMaterial.uniforms, linesMaterial.uniforms];
    uniformSets.forEach((uniforms) => {
      uniforms.u_scene_a.value = sample.sceneA;
      uniforms.u_scene_b.value = sample.sceneB;
      uniforms.u_blend.value = sample.blend;
      uniforms.u_time.value = scrollState.time;
      uniforms.u_motion.value = motion;
    });
    pointsMaterial.uniforms.u_pixel_ratio.value = gl.getPixelRatio();
    pointsMaterial.uniforms.u_pointer.value.set(scrollState.pointerX, scrollState.pointerY);
    pointsMaterial.uniforms.u_pointer_energy.value = reducedMotion ? 0 : scrollState.pointerEnergy;
    pointsMaterial.uniforms.u_focus.value = reducedMotion ? 0 : scrollState.focusStrength;
    pointsMaterial.uniforms.u_about_progress.value = Math.min(1, scrollState.progress * 4.2);
    pointsMaterial.uniforms.u_research_weight.value = sample.researchWeight;
    pointsMaterial.uniforms.u_opacity.value = sample.opacity;
    linesMaterial.uniforms.u_opacity.value = sample.opacity * (0.035 + sample.experienceWeight * 0.42);
  });

  return (
    <group ref={groupRef} frustumCulled={false}>
      <points geometry={pointGeometry} frustumCulled={false}>
        <primitive ref={pointsMaterialRef} object={pointMaterial} attach="material" />
      </points>
      <lineSegments geometry={lineGeometry} frustumCulled={false}>
        <primitive ref={lineMaterialRef} object={lineMaterial} attach="material" />
      </lineSegments>
    </group>
  );
}

export function PortfolioScene() {
  const tier = useNarrative((value) => value.tier);
  const reducedMotion = useNarrative((value) => value.reducedMotion);
  const [failed, setFailed] = useState(false);
  const [dprMin, dprMax] = DPR_RANGE[tier];
  const targets = useMemo(() => getMainTargets(), []);

  if (failed) return null;

  return (
    <div className={styles.portfolioScene} aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[dprMin, dprMax]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 50, near: 0.1, far: 100, position: [0, 0, 5] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        fallback={null}
        onError={() => setFailed(true)}
      >
        <SceneClock />
        <MainField targets={targets} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
