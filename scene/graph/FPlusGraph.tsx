'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { SceneState } from '@/content/types';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { sceneAnchors } from '@/lib/narrative/sceneMap';
import { sceneClock } from '../sceneFrame';
import { FPLUS_BLACK_PIXEL, FPLUS_FINAL_FRAGMENT, FPLUS_FINAL_VERTEX, FPLUS_SMOKE_FRAGMENT, FPLUS_SMOKE_VERTEX } from './fplusShaders';
import {
  createFPlusField,
  FPLUS_NODE_COUNT,
  FPLUS_POINT_SIZE,
  type FPlusField,
} from './fplusTargets';

const FPLUS_CAMERA_DISTANCE = 5.9;
const FPLUS_MORPH_GAIN = -0.26;
const FPLUS_EDGE_OPACITY = 0.06;
const FPLUS_AFTERIMAGE_DAMP = 0.82;

const BASE_BACKGROUND = '#080909';
const NODE_COLOR = '#ECE9E1';
const EDGE_COLOR = '#8296AA';
const COOL_COLOR = '#8296AA';
const WARM_COLOR = '#C87552';
const RESEARCH_COLOR = '#B49A65';
const COOL_THREE_COLOR = new THREE.Color(COOL_COLOR);
const WARM_THREE_COLOR = new THREE.Color(WARM_COLOR);
const RESEARCH_THREE_COLOR = new THREE.Color(RESEARCH_COLOR);

type FinalPass = ShaderPass & {
  material: THREE.ShaderMaterial;
};

interface GraphRuntime {
  field: FPlusField;
  root: THREE.Group;
  points: THREE.Points;
  edges: THREE.LineSegments;
  dust: THREE.Points;
  pointGeometry: THREE.BufferGeometry;
  edgeGeometry: THREE.BufferGeometry;
  dustGeometry: THREE.BufferGeometry;
  pointMaterial: THREE.PointsMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
  dustMaterial: THREE.PointsMaterial;
  smoke: THREE.Mesh;
  smokeMaterial: THREE.ShaderMaterial;
  environment: THREE.Mesh;
  environmentGeometry: THREE.SphereGeometry;
  environmentMaterial: THREE.MeshBasicMaterial;
  sprite: THREE.CanvasTexture | null;
  environmentTexture: THREE.CanvasTexture | null;
  mainComposer: EffectComposer;
  dustComposer: EffectComposer | null;
  bloomPass: UnrealBloomPass;
  afterimagePass: AfterimagePass | null;
  finalPass: FinalPass;
  blackTexture: THREE.DataTexture;
  dustScene: THREE.Scene;
  positions: Float32Array;
  edgePositions: Float32Array;
  displacement: Float32Array;
  targetPositions: THREE.Vector3[];
  candidateState: SceneState;
  activeState: SceneState;
  candidateFrames: number;
  shapeInitialized: boolean;
  shapeAmount: number;
  pointScale: number;
  groupX: number;
  groupY: number;
  yaw: number;
  pitch: number;
  anchorOffset: number;
  time: number;
  pageHeightRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  finePointer: boolean;
  pointerLocalX: number;
  pointerLocalY: number;
  pointerNdc: THREE.Vector3;
  pointerRay: THREE.Vector3;
  pointerWorld: THREE.Vector3;
  pointerDirection: THREE.Vector3;
  tilt: THREE.Euler;
  tiltQuaternion: THREE.Quaternion;
  groupOffset: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  cameraOffset: THREE.Vector3;
  cameraDistance: number;
  previousBackground: THREE.Color | THREE.Texture | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

function createRandom(seed = 0x243f6a88) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSprite() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.78, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createEnvironmentTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#1d2a30');
  gradient.addColorStop(0.42, '#11191c');
  gradient.addColorStop(1, BASE_BACKGROUND);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 512);

  const radial = (x: number, y: number, radius: number, color: string) => {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 1024, 512);
  };

  radial(300, 150, 260, 'rgba(200,117,82,0.22)');
  radial(760, 220, 240, 'rgba(130,150,170,0.25)');
  radial(520, 60, 180, 'rgba(236,233,225,0.14)');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createDustGeometry(width: number) {
  const random = createRandom(0x7f4a7c15);
  const count = 950;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const gold = new THREE.Color(WARM_COLOR);
  const cool = new THREE.Color(COOL_COLOR);
  const white = new THREE.Color(NODE_COLOR);

  for (let index = 0; index < count; index += 1) {
    const z = 5.2 - Math.pow(random(), 1.3) * 21;
    const extent = 3 + (5.2 - z) * 0.5;
    positions[index * 3] = (random() - 0.5) * 2 * extent;
    positions[index * 3 + 1] = (random() - 0.5) * 2 * extent;
    positions[index * 3 + 2] = z;

    const color = random() < 0.33 ? gold : random() < 0.5 ? cool : white;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, width < 700 ? 560 : count);
  return geometry;
}

function disposePass(pass: { dispose?: () => void } | null) {
  pass?.dispose?.();
}

function updateAnchorInfluence(runtime: GraphRuntime, progress: number, axisIsHorizontal: boolean) {
  const anchors = sceneAnchors();
  const viewport = axisIsHorizontal ? runtime.viewportWidth : runtime.viewportHeight;
  let visibility = 0;
  let winningState = runtime.candidateState;
  let winningOffset = runtime.anchorOffset;

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    const next = anchors[index + 1];
    const previous = anchors[index - 1];
    const span = Math.max(
      0.012,
      next ? next.progress - anchor.progress : anchor.progress - (previous?.progress ?? 0),
    );
    const distance = Math.abs(progress - anchor.progress);
    const fullInfluence = span * 0.4;
    const fadeDistance = span * 0.5;
    const influence = Math.max(0, 1 - Math.max(0, distance - fullInfluence) / fadeDistance);

    if (influence > visibility) {
      visibility = influence;
      winningState = anchor.state;
      winningOffset = clamp((progress - anchor.progress) / span, -0.7, 0.7);
    }
  }

  // Keep viewport in the formula even though the normalized progress cancels
  // it out. This mirrors the production anchor math and protects the fallback
  // path when the DOM is still being measured.
  if (viewport <= 0) visibility = 0;

  if (winningState !== runtime.candidateState) {
    runtime.candidateState = winningState;
    runtime.candidateFrames = 0;
  } else {
    runtime.candidateFrames += 1;
  }

  if (runtime.candidateFrames >= 8) {
    runtime.activeState = runtime.candidateState;
    runtime.shapeInitialized = true;
  }
  runtime.anchorOffset += (winningOffset - runtime.anchorOffset) * 0.045;
  if (runtime.shapeInitialized) {
    runtime.shapeAmount += (visibility - runtime.shapeAmount) * 0.045;
  } else {
    runtime.shapeAmount = 0;
  }
}

function updateRuntime(
  runtime: GraphRuntime,
  camera: THREE.PerspectiveCamera,
  delta: number,
  reducedMotion: boolean,
  tier: 'high' | 'mid' | 'low',
) {
  const { field } = runtime;
  const progress = clamp(scrollState.progress, 0, 1);
  const axisIsHorizontal = typeof document !== 'undefined' && document.documentElement.dataset.heroAxis === 'x';
  const energy = reducedMotion ? 0 : scrollState.pointerEnergy;
  runtime.time = sceneClock.time;

  updateAnchorInfluence(runtime, progress, axisIsHorizontal);

  const shapeAmount = clamp(runtime.shapeAmount, 0, 1);
  const cloudAmount = 1 - shapeAmount;
  const heroPointerWindow = progress * runtime.pageHeightRatio < 0.15;
  const target = field.targets[runtime.activeState];
  const targetColor =
    runtime.activeState === 'graph' || runtime.activeState === 'human'
      ? RESEARCH_THREE_COLOR
      : runtime.activeState === 'volume' || runtime.activeState === 'uncertainty'
        ? WARM_THREE_COLOR
        : COOL_THREE_COLOR;

  for (let index = 0; index < FPLUS_NODE_COUNT; index += 1) {
    const targetPoint = runtime.targetPositions[index];
    const desired = target[index];
    if (runtime.candidateFrames < 8 && runtime.activeState === runtime.candidateState) {
      targetPoint.copy(desired);
    } else {
      targetPoint.x += (desired.x - targetPoint.x) * 0.06;
      targetPoint.y += (desired.y - targetPoint.y) * 0.06;
      targetPoint.z += (desired.z - targetPoint.z) * 0.06;
    }

    const phase = field.phases[index];
    const seed = field.seed[index];
    const cloudX =
      seed.x * runtime.pointScale +
      Math.sin(runtime.time * 0.5 + phase) * ((0.13 + energy * 0.3) * cloudAmount) +
      Math.sin(runtime.time * 1.4 + phase * 2.1) * (energy * 0.06 * cloudAmount);
    const cloudY =
      seed.y * runtime.pointScale +
      Math.cos(runtime.time * 0.4 + phase) * ((0.13 + energy * 0.3) * cloudAmount) +
      Math.cos(runtime.time * 1.2 + phase * 1.7) * (energy * 0.06 * cloudAmount);
    const cloudZ =
      seed.z * runtime.pointScale +
      Math.sin(runtime.time * 0.45 + phase * 1.3) * ((0.13 + energy * 0.3) * cloudAmount) +
      Math.sin(runtime.time * 1.6 + phase) * (energy * 0.06 * cloudAmount);

    let displacementX = 0;
    let displacementY = 0;
    if (!reducedMotion && runtime.finePointer && shapeAmount > 0.15 && heroPointerWindow) {
      const offsetX = runtime.pointerLocalX - targetPoint.x;
      const offsetY = runtime.pointerLocalY - targetPoint.y;
      const squaredDistance = offsetX * offsetX + offsetY * offsetY;
      if (squaredDistance < 0.36) {
        const falloff = 1 - (Math.sqrt(squaredDistance) || 1e-4) / 0.6;
        const angle =
          Math.atan2(-offsetY, -offsetX) +
          (field.directionHash[index] - 0.5) * 1.8 +
          Math.sin(runtime.time * 7 + phase) * 0.25;
        const magnitude = falloff * falloff * 0.55 * (0.45 + field.magnitudeHash[index] * 1.3);
        displacementX = Math.cos(angle) * magnitude;
        displacementY = Math.sin(angle) * magnitude;
      }
    }

    const displacementIndex = index * 3;
    const xRate = Math.abs(displacementX) > Math.abs(runtime.displacement[displacementIndex]) ? 0.42 : 0.055;
    const yRate = Math.abs(displacementY) > Math.abs(runtime.displacement[displacementIndex + 1]) ? 0.42 : 0.055;
    runtime.displacement[displacementIndex] +=
      (displacementX - runtime.displacement[displacementIndex]) * xRate;
    runtime.displacement[displacementIndex + 1] +=
      (displacementY - runtime.displacement[displacementIndex + 1]) * yRate;

    const breathing = 0.03 * (0.25 + 0.75 * cloudAmount);
    const shapeX = targetPoint.x + Math.sin(runtime.time * 0.9 + phase) * breathing + runtime.displacement[displacementIndex];
    const shapeY = targetPoint.y + Math.cos(runtime.time * 0.8 + phase) * breathing + runtime.displacement[displacementIndex + 1];
    const shapeZ = targetPoint.z + runtime.displacement[displacementIndex + 2];

    runtime.positions[displacementIndex] = cloudX * cloudAmount + shapeX * shapeAmount;
    runtime.positions[displacementIndex + 1] = cloudY * cloudAmount + shapeY * shapeAmount;
    runtime.positions[displacementIndex + 2] = cloudZ * cloudAmount + shapeZ * shapeAmount;
  }

  const positionAttribute = runtime.pointGeometry.getAttribute('position') as THREE.BufferAttribute;
  positionAttribute.needsUpdate = true;
  for (let index = 0; index < field.edges.length; index += 1) {
    const edge = field.edges[index];
    const source = edge.a * 3;
    const targetIndex = edge.b * 3;
    const destination = index * 6;
    runtime.edgePositions[destination] = runtime.positions[source];
    runtime.edgePositions[destination + 1] = runtime.positions[source + 1];
    runtime.edgePositions[destination + 2] = runtime.positions[source + 2];
    runtime.edgePositions[destination + 3] = runtime.positions[targetIndex];
    runtime.edgePositions[destination + 4] = runtime.positions[targetIndex + 1];
    runtime.edgePositions[destination + 5] = runtime.positions[targetIndex + 2];
  }
  (runtime.edgeGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

  const width = runtime.viewportWidth;
  const mobile = width < 700;
  const scale = (1 + progress * 0.55) * (1 + shapeAmount * FPLUS_MORPH_GAIN) * (mobile ? 0.55 : 1);
  runtime.root.scale.setScalar(scale);

  const scrollPages = progress * runtime.pageHeightRatio;
  runtime.pointScale += (1 + Math.sin(scrollPages * 0.9) * 0.4 - runtime.pointScale) * 0.04;

  const orbit = progress * Math.PI * 1.5 * (axisIsHorizontal ? 2.4 : 1);
  const cameraDistance = FPLUS_CAMERA_DISTANCE - smoothstep(0, 0.22, progress) * 2.6;
  const verticalOrbit = Math.sin(progress * Math.PI) * 0.18;
  const orbitRadius = Math.cos(verticalOrbit) * cameraDistance;
  runtime.cameraTarget.set(
    Math.sin(orbit) * orbitRadius,
    Math.sin(verticalOrbit) * cameraDistance,
    Math.cos(orbit) * orbitRadius,
  );
  camera.position.lerp(runtime.cameraTarget, 0.08);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  runtime.cameraDistance = cameraDistance;

  const centroid = field.centroids[runtime.activeState];
  const targetGroupX = mobile
    ? (0.25 - centroid.x * scale) * shapeAmount
    : 1.7 * cloudAmount + 0.9 * shapeAmount;
  const targetGroupY = mobile
    ? (0.65 - centroid.y * scale) * shapeAmount + Math.sin(runtime.time * 0.8) * 0.07
    : Math.sin(runtime.time * 0.8) * 0.07;
  runtime.groupX += (targetGroupX - runtime.groupX) * 0.06;
  runtime.groupY += (targetGroupY - runtime.groupY) * 0.06;

  const centredPointerX = scrollState.pointerX * 0.5;
  const centredPointerY = -scrollState.pointerY * 0.5;
  const targetYaw = centredPointerX * (1.15 + energy * 0.8) * cloudAmount - runtime.anchorOffset * 0.3 * shapeAmount;
  const targetPitch = centredPointerY * (0.85 + energy * 0.6) * cloudAmount;
  runtime.yaw += (targetYaw - runtime.yaw) * 0.05 + 0.0014 * cloudAmount;
  runtime.pitch += (targetPitch - runtime.pitch) * 0.05;
  runtime.tilt.set(runtime.pitch, runtime.yaw, 0, 'XYZ');
  runtime.tiltQuaternion.setFromEuler(runtime.tilt);
  runtime.root.quaternion.copy(camera.quaternion).multiply(runtime.tiltQuaternion);
  runtime.cameraOffset.set(runtime.groupX, runtime.groupY, -cameraDistance).applyQuaternion(camera.quaternion);
  runtime.root.position.copy(camera.position).add(runtime.cameraOffset);

  const currentColor = runtime.pointMaterial.color;
  currentColor.lerp(targetColor, 0.045);
  runtime.edgeMaterial.color.copy(currentColor);
  runtime.edgeMaterial.opacity = FPLUS_EDGE_OPACITY;
  runtime.dust.rotation.y = runtime.time * (axisIsHorizontal ? 0.04 : 0.02);
  runtime.smokeMaterial.uniforms.uTime.value = reducedMotion ? 0 : runtime.time;
  runtime.smokeMaterial.uniforms.uAspect.value = runtime.viewportWidth / Math.max(1, runtime.viewportHeight);
  runtime.smokeMaterial.uniforms.uZoom.value = FPLUS_CAMERA_DISTANCE / Math.max(cameraDistance, 0.1);

  const pointerActive =
    !reducedMotion && runtime.finePointer && shapeAmount > 0.15 && heroPointerWindow;
  if (pointerActive) {
    runtime.pointerNdc.set(scrollState.pointerX, scrollState.pointerY, 0.5).unproject(camera);
    runtime.pointerDirection.copy(runtime.pointerNdc).sub(camera.position).normalize();
    const distance = (runtime.root.position.z - camera.position.z) / (runtime.pointerDirection.z || 1e-4);
    runtime.pointerWorld.copy(camera.position).addScaledVector(runtime.pointerDirection, distance);
    runtime.pointerLocalX = (runtime.pointerWorld.x - runtime.root.position.x) / (scale || 1);
    runtime.pointerLocalY = (runtime.pointerWorld.y - runtime.root.position.y) / (scale || 1);
  } else {
    runtime.pointerLocalX = 999;
    runtime.pointerLocalY = 999;
  }

  const dustCount = width < 700 ? 560 : 950;
  runtime.dustGeometry.setDrawRange(0, tier === 'low' ? Math.min(280, dustCount) : dustCount);
  runtime.bloomPass.enabled = tier !== 'low';
  runtime.bloomPass.strength = tier === 'high' ? 0.9 : tier === 'mid' ? 0.65 : 0.25;
  if (runtime.afterimagePass) runtime.afterimagePass.enabled = tier !== 'low' && !reducedMotion;
  runtime.finalPass.material.uniforms.uPartMix.value =
    runtime.dustComposer && tier !== 'low' && !reducedMotion ? 1 : 0;
}

export function FPlusGraph() {
  const { scene, camera, gl, size } = useThree();
  const tier = useNarrative((state) => state.tier);
  const reducedMotion = useNarrative((state) => state.reducedMotion);
  const fieldRef = useRef<FPlusField | null>(null);
  const runtimeRef = useRef<GraphRuntime | null>(null);
  const tierRef = useRef(tier);
  const reducedRef = useRef(reducedMotion);
  const sizeRef = useRef(size);
  if (!fieldRef.current) fieldRef.current = createFPlusField();

  useEffect(() => {
    tierRef.current = tier;
    reducedRef.current = reducedMotion;
  }, [tier, reducedMotion]);

  useEffect(() => {
    sizeRef.current = size;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.viewportWidth = size.width;
    runtime.viewportHeight = size.height;
    runtime.pageHeightRatio = Math.max(
      1,
      (document.documentElement.scrollHeight - window.innerHeight) / Math.max(1, window.innerHeight),
    );
    runtime.mainComposer.setSize(size.width, size.height);
    runtime.dustComposer?.setSize(size.width, size.height);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.aspect = size.width / Math.max(1, size.height);
    perspectiveCamera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const previousBackground = scene.background;
    const sprite = createSprite();
    const environmentTexture = createEnvironmentTexture();
    const root = new THREE.Group();
    root.position.set(1.7, 0, 0);
    scene.add(root);

    const positions = new Float32Array(FPLUS_NODE_COUNT * 3);
    const targetPositions = field.targets.signal.map((point) => point.clone());
    for (let index = 0; index < FPLUS_NODE_COUNT; index += 1) {
      positions[index * 3] = field.seed[index].x;
      positions[index * 3 + 1] = field.seed[index].y;
      positions[index * 3 + 2] = field.seed[index].z;
    }
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(FPLUS_NODE_COUNT * 3).fill(1), 3));
    const pointMaterial = new THREE.PointsMaterial({
      color: NODE_COLOR,
      size: FPLUS_POINT_SIZE,
      sizeAttenuation: false,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pointGeometry, pointMaterial);
    points.frustumCulled = false;
    root.add(points);

    const edgePositions = new Float32Array(field.edges.length * 6);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: EDGE_COLOR,
      transparent: true,
      opacity: FPLUS_EDGE_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.frustumCulled = false;
    root.add(edges);

    const dustGeometry = createDustGeometry(size.width);
    const dustMaterial = new THREE.PointsMaterial({
      size: 0.045,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    dust.layers.set(1);
    const dustScene = new THREE.Scene();
    dustScene.add(dust);

    const environmentGeometry = new THREE.SphereGeometry(40, 48, 48);
    const environmentMaterial = new THREE.MeshBasicMaterial({
      map: environmentTexture,
      color: '#26353b',
      side: THREE.BackSide,
    });
    const environment = new THREE.Mesh(environmentGeometry, environmentMaterial);
    environment.renderOrder = -2;
    scene.add(environment);

    const smokeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: size.width / Math.max(1, size.height) },
        uTeal: { value: new THREE.Color(COOL_COLOR) },
        uGold: { value: new THREE.Color(WARM_COLOR) },
        uAmp: { value: 0.12 },
        uZoom: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: FPLUS_SMOKE_VERTEX,
      fragmentShader: FPLUS_SMOKE_FRAGMENT,
    });
    const smoke = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), smokeMaterial);
    smoke.frustumCulled = false;
    smoke.renderOrder = -1;
    scene.add(smoke);

    const blackTexture = new THREE.DataTexture(FPLUS_BLACK_PIXEL, 1, 1, THREE.RGBAFormat);
    blackTexture.needsUpdate = true;
    const mainComposer = new EffectComposer(gl);
    mainComposer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.9, 0.72, 0.85);
    mainComposer.addPass(bloomPass);
    const finalPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tParticles: { value: blackTexture },
        uPartMix: { value: 0 },
      },
      vertexShader: FPLUS_FINAL_VERTEX,
      fragmentShader: FPLUS_FINAL_FRAGMENT,
    }) as FinalPass;
    finalPass.renderToScreen = true;
    mainComposer.addPass(finalPass);

    const dustComposer = size.width >= 700 && !reducedMotion ? new EffectComposer(gl) : null;
    let afterimagePass: AfterimagePass | null = null;
    if (dustComposer) {
      camera.layers.set(1);
      dustComposer.addPass(new RenderPass(dustScene, camera, undefined, new THREE.Color(0, 0, 0), 1));
      afterimagePass = new AfterimagePass(FPLUS_AFTERIMAGE_DAMP);
      dustComposer.addPass(afterimagePass);
      dustComposer.setSize(size.width, size.height);
      camera.layers.set(0);
    }
    mainComposer.setSize(size.width, size.height);

    scene.background = new THREE.Color(BASE_BACKGROUND);
    const runtime: GraphRuntime = {
      field,
      root,
      points,
      edges,
      dust,
      pointGeometry,
      edgeGeometry,
      dustGeometry,
      pointMaterial,
      edgeMaterial,
      dustMaterial,
      smoke,
      smokeMaterial,
      environment,
      environmentGeometry,
      environmentMaterial,
      sprite,
      environmentTexture,
      mainComposer,
      dustComposer,
      bloomPass,
      afterimagePass,
      finalPass,
      blackTexture,
      dustScene,
      positions,
      edgePositions,
      displacement: new Float32Array(FPLUS_NODE_COUNT * 3),
      targetPositions,
      candidateState: 'signal',
      activeState: 'signal',
      candidateFrames: 0,
      shapeInitialized: false,
      shapeAmount: 0,
      pointScale: 1.7,
      groupX: 1.7,
      groupY: 0,
      yaw: 0,
      pitch: 0,
      anchorOffset: 0,
      time: 0,
      pageHeightRatio: Math.max(
        1,
        (document.documentElement.scrollHeight - window.innerHeight) / Math.max(1, window.innerHeight),
      ),
      viewportWidth: size.width,
      viewportHeight: size.height,
      finePointer: window.matchMedia('(pointer: fine)').matches,
      pointerLocalX: 999,
      pointerLocalY: 999,
      pointerNdc: new THREE.Vector3(),
      pointerRay: new THREE.Vector3(),
      pointerWorld: new THREE.Vector3(),
      pointerDirection: new THREE.Vector3(),
      tilt: new THREE.Euler(0, 0, 0, 'XYZ'),
      tiltQuaternion: new THREE.Quaternion(),
      groupOffset: new THREE.Vector3(),
      cameraTarget: new THREE.Vector3(0, 0, FPLUS_CAMERA_DISTANCE),
      cameraOffset: new THREE.Vector3(),
      cameraDistance: FPLUS_CAMERA_DISTANCE,
      previousBackground,
    };
    runtimeRef.current = runtime;

    const oldAutoClear = gl.autoClear;
    gl.autoClear = false;
    camera.layers.set(0);

    return () => {
      runtimeRef.current = null;
      gl.autoClear = oldAutoClear;
      camera.layers.set(0);
      mainComposer.dispose();
      dustComposer?.dispose();
      disposePass(bloomPass);
      disposePass(afterimagePass);
      disposePass(finalPass);
      pointGeometry.dispose();
      edgeGeometry.dispose();
      dustGeometry.dispose();
      smoke.geometry.dispose();
      smokeMaterial.dispose();
      environmentGeometry.dispose();
      environmentMaterial.dispose();
      pointMaterial.dispose();
      edgeMaterial.dispose();
      dustMaterial.dispose();
      sprite?.dispose();
      environmentTexture?.dispose();
      blackTexture.dispose();
      scene.remove(root, environment, smoke);
      dustScene.remove(dust);
      scene.background = previousBackground;
    };
  }, [camera, gl, scene]);

  useFrame((_, delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      gl.render(scene, camera);
      return;
    }

    runtime.viewportWidth = sizeRef.current.width;
    runtime.viewportHeight = sizeRef.current.height;
    updateRuntime(runtime, camera as THREE.PerspectiveCamera, delta, reducedRef.current, tierRef.current);

    const previousLayers = camera.layers.mask;
    if (runtime.dustComposer && runtime.finalPass.material.uniforms.uPartMix.value > 0) {
      camera.layers.set(1);
      runtime.dustComposer.render(delta);
      camera.layers.set(0);
      runtime.finalPass.material.uniforms.tParticles.value = runtime.dustComposer.readBuffer.texture;
    } else {
      runtime.finalPass.material.uniforms.tParticles.value = runtime.blackTexture;
      camera.layers.set(0);
    }
    runtime.mainComposer.render(delta);
    camera.layers.mask = previousLayers;
  }, 1);

  return null;
}
