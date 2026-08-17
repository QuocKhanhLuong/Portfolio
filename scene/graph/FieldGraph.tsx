'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SceneState } from '@/content/types';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { FIELD_EDGE_OPACITY, FIELD_NODE_COUNT, FIELD_POINT_SIZE, getField, type Field } from './fieldTargets';

const NODE_COLOR = '#ECE9E1';
const EDGE_COLOR = '#8296AA';
const WARM_COLOR = '#C87552';
const RESEARCH_COLOR = '#B49A65';
const HERO_GRAPH_RADIUS = 2.35;

interface FieldRuntime {
  field: Field;
  root: THREE.Group;
  points: THREE.Points;
  edges: THREE.LineSegments;
  pointGeometry: THREE.BufferGeometry;
  edgeGeometry: THREE.BufferGeometry;
  pointMaterial: THREE.PointsMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
  sprite: THREE.CanvasTexture | null;
  positions: Float32Array;
  edgePositions: Float32Array;
  targetPositions: THREE.Vector3[];
  time: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createSprite() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 48, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function colorForState(state: SceneState) {
  if (state === 'volume' || state === 'uncertainty') return new THREE.Color(WARM_COLOR);
  if (state === 'human' || state === 'graph' || state === 'constellation') return new THREE.Color(RESEARCH_COLOR);
  return new THREE.Color(EDGE_COLOR);
}

function updateRuntime(
  runtime: FieldRuntime,
  camera: THREE.PerspectiveCamera,
  state: SceneState,
  reducedMotion: boolean,
  pointSize: number,
  placement: FieldPlacement,
) {
  const { field } = runtime;
  const progress = clamp(scrollState.progress, 0, 1);
  const target = field.targets[state];
  const stateIndex = field.states.indexOf(state);
  const pointerX = scrollState.pointerX;
  const pointerY = scrollState.pointerY;
  const energy = reducedMotion ? 0 : scrollState.pointerEnergy;
  runtime.time = scrollState.time;

  for (let index = 0; index < FIELD_NODE_COUNT; index += 1) {
    const offset = index * 3;
    const desired = target[index];
    const targetPoint = runtime.targetPositions[index];
    targetPoint.lerp(desired, reducedMotion ? 1 : 0.1);

    const phase = field.phases[index];
    const spread = 0.05 + energy * 0.08;
    const drift = reducedMotion ? 0 : 0.06 + field.magnitudeHash[index] * 0.08;
    const cloudWeight = 0.18;
    const shapeWeight = 1 - cloudWeight;
    const cloudX = field.seed[index].x * 0.62 + Math.sin(runtime.time * 0.45 + phase) * spread;
    const cloudY = field.seed[index].y * 0.62 + Math.cos(runtime.time * 0.38 + phase * 1.2) * spread;
    const cloudZ = field.seed[index].z * 0.62 + Math.sin(runtime.time * 0.34 + phase * 0.8) * spread;

    const pointerDistance = Math.hypot(pointerX - targetPoint.x * 0.45, pointerY - targetPoint.y * 0.45);
    const pointerFalloff = reducedMotion ? 0 : clamp(1 - pointerDistance / 0.95, 0, 1);
    const pointerDirection = field.directionHash[index] * Math.PI * 2;
    const pointerPush = pointerFalloff * pointerFalloff * (0.08 + energy * 0.18);

    runtime.positions[offset] =
      cloudX * cloudWeight + targetPoint.x * shapeWeight + Math.cos(pointerDirection) * pointerPush;
    runtime.positions[offset + 1] =
      cloudY * cloudWeight + targetPoint.y * shapeWeight + Math.sin(pointerDirection) * pointerPush;
    runtime.positions[offset + 2] = cloudZ * cloudWeight + targetPoint.z * shapeWeight + Math.sin(runtime.time + phase) * drift * 0.04;
  }

  (runtime.pointGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  for (let index = 0; index < field.edges.length; index += 1) {
    const edge = field.edges[index];
    const source = edge.a * 3;
    const destination = edge.b * 3;
    const output = index * 6;
    runtime.edgePositions[output] = runtime.positions[source];
    runtime.edgePositions[output + 1] = runtime.positions[source + 1];
    runtime.edgePositions[output + 2] = runtime.positions[source + 2];
    runtime.edgePositions[output + 3] = runtime.positions[destination];
    runtime.edgePositions[output + 4] = runtime.positions[destination + 1];
    runtime.edgePositions[output + 5] = runtime.positions[destination + 2];
  }
  (runtime.edgeGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

  const panelDrift = reducedMotion ? 0 : Math.sin(progress * Math.PI * 2 + stateIndex * 0.8) * 0.16;
  let targetX = 0;
  let targetY = panelDrift;
  let scale = camera.aspect > 1 ? 1 : 0.84;

  if (placement === 'hero') {
    const viewportHalfHeight = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const viewportHalfWidth = viewportHalfHeight * Math.max(camera.aspect, 0.1);
    const wideFactor = clamp((camera.aspect - 1.1) / 0.7, 0, 1);
    const centerFraction = THREE.MathUtils.lerp(0.38, 0.44, wideFactor);
    const desiredScale = THREE.MathUtils.lerp(0.82, 0.98, wideFactor);
    const horizontalFit = camera.aspect > 1
      ? (viewportHalfWidth * 0.58) / HERO_GRAPH_RADIUS
      : desiredScale;

    targetX = viewportHalfWidth * centerFraction;
    targetY = -viewportHalfHeight * 0.04;
    scale = Math.min(desiredScale, horizontalFit);
  }

  runtime.root.position.x += (targetX - runtime.root.position.x) * 0.12;
  runtime.root.position.y += (targetY - runtime.root.position.y) * 0.12;
  runtime.root.rotation.x += ((reducedMotion ? 0 : pointerY * 0.08) - runtime.root.rotation.x) * 0.08;
  runtime.root.rotation.y += ((reducedMotion ? 0 : pointerX * 0.1) - runtime.root.rotation.y) * 0.08;
  runtime.root.scale.setScalar(scale);

  const targetColor = colorForState(state);
  runtime.pointMaterial.color.lerp(targetColor, reducedMotion ? 1 : 0.12);
  runtime.pointMaterial.size = pointSize;
  runtime.edgeMaterial.color.copy(runtime.pointMaterial.color);
  runtime.edgeMaterial.opacity = FIELD_EDGE_OPACITY;
}

export type FieldPlacement = 'panel' | 'hero';

export interface FieldGraphProps {
  state: SceneState;
  active: boolean;
  placement?: FieldPlacement;
}

export function FieldGraph({ state, active, placement = 'panel' }: FieldGraphProps) {
  const { camera, scene, size } = useThree();
  const tier = useNarrative((value) => value.tier);
  const reducedMotion = useNarrative((value) => value.reducedMotion);
  const fieldRef = useRef<Field | null>(null);
  const runtimeRef = useRef<FieldRuntime | null>(null);
  const activeRef = useRef(active);
  const stateRef = useRef(state);

  if (!fieldRef.current) fieldRef.current = getField();

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.aspect = size.width / Math.max(1, size.height);
    perspectiveCamera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const sprite = createSprite();
    const root = new THREE.Group();
    scene.add(root);

    const positions = new Float32Array(FIELD_NODE_COUNT * 3);
    const targetPositions = field.targets.signal.map((point) => point.clone());
    for (let index = 0; index < FIELD_NODE_COUNT; index += 1) {
      positions[index * 3] = field.seed[index].x;
      positions[index * 3 + 1] = field.seed[index].y;
      positions[index * 3 + 2] = field.seed[index].z;
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pointMaterial = new THREE.PointsMaterial({
      color: NODE_COLOR,
      size: FIELD_POINT_SIZE,
      sizeAttenuation: false,
      map: sprite,
      transparent: true,
      opacity: 0.94,
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
      opacity: FIELD_EDGE_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.frustumCulled = false;
    root.add(edges);

    runtimeRef.current = {
      field,
      root,
      points,
      edges,
      pointGeometry,
      edgeGeometry,
      pointMaterial,
      edgeMaterial,
      sprite,
      positions,
      edgePositions,
      targetPositions,
      time: 0,
    };

    return () => {
      runtimeRef.current = null;
      pointGeometry.dispose();
      edgeGeometry.dispose();
      pointMaterial.dispose();
      edgeMaterial.dispose();
      sprite?.dispose();
      scene.remove(root);
    };
  }, [camera, scene]);

  useFrame(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !activeRef.current) return;
    const pointSize = FIELD_POINT_SIZE * (tier === 'low' ? 0.82 : tier === 'mid' ? 0.92 : 1);
    updateRuntime(runtime, camera as THREE.PerspectiveCamera, stateRef.current, reducedMotion, pointSize, placement);
  });

  return null;
}
