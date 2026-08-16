'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RESEARCH_EDGES } from '@/content/research';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import { liveFrame } from '@/lib/narrative/ticker';
import { EDGE_REBUILD_INTERVAL, NODE_COUNT, NODE_SCALE } from '@/lib/perf';
import { edgeFragmentShader, edgeVertexShader } from '@/scene/shaders/edges';
import { nodeFragmentShader, nodeVertexShader } from '@/scene/shaders/node';
import type { PackedStates } from '@/scene/states/pack';
import { MAX_FOCUS_MIX, SCENE_INDEX, sceneClock, scenePointer } from '../sceneFrame';
import { buildEdges, createEdgeBuffers, refreshEdgePositions } from './edges';
import { buildNodeField, updateNodes, type NodeUpdate } from './nodes';

/**
 * The readable layer: a few hundred nodes drawn from the same field the grain
 * shader draws, joined by a bounded proximity network that becomes the research
 * topology where the research topology is what is being talked about.
 *
 * Positions are recomputed every frame. Topology is rebuilt at a lower rate
 * while the page is calm and at full rate while it is moving, because during a
 * morph a stale neighbour list is visible as edges snapping late.
 */
export function GraphLayer({ packed }: { packed: PackedStates }) {
  const tier = useNarrative((s) => s.tier);
  const reducedMotion = useNarrative((s) => s.reducedMotion);
  const { gl } = useThree();

  const nodes = useRef<THREE.Points>(null);
  const edges = useRef<THREE.LineSegments>(null);

  const field = useMemo(() => buildNodeField(packed, NODE_COUNT[tier]), [packed, tier]);
  const buffers = useMemo(
    () => createEdgeBuffers(field.count, field.semanticEdgeCount),
    [field],
  );

  const nodeGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(field.position, 3));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(field.brightness, 1));
    geo.setAttribute('aLens', new THREE.BufferAttribute(field.lens, 1));
    geo.setAttribute('aScan', new THREE.BufferAttribute(field.scan, 1));
    geo.setAttribute('aConfidence', new THREE.BufferAttribute(field.confidence, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    return geo;
  }, [field]);

  const edgeGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buffers.position, 3));
    geo.setAttribute('aWeight', new THREE.BufferAttribute(buffers.weight, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(buffers.kind, 1));
    geo.setAttribute('aArc', new THREE.BufferAttribute(buffers.arc, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    geo.setDrawRange(0, 0);
    return geo;
  }, [buffers]);

  const nodeUniforms = useMemo(
    () => ({
      uSize: { value: 9 * NODE_SCALE[tier] },
      uPixelRatio: { value: 1 },
      uCore: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uOpacity: { value: 0 },
    }),
    [tier],
  );

  const edgeUniforms = useMemo(
    () => ({
      uCore: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uOpacity: { value: 0 },
      uSemantic: { value: 0 },
      uTime: { value: 0 },
      uDash: { value: 1.6 },
    }),
    [],
  );

  useEffect(() => {
    nodeUniforms.uPixelRatio.value = gl.getPixelRatio();
  }, [gl, nodeUniforms]);

  useEffect(
    () => () => {
      nodeGeometry.dispose();
      edgeGeometry.dispose();
    },
    [nodeGeometry, edgeGeometry],
  );

  const update = useMemo<NodeUpdate>(
    () => ({
      frame: liveFrame,
      index: {
        pixel: SCENE_INDEX.pixel,
        cloud: SCENE_INDEX.cloud,
        volume: SCENE_INDEX.volume,
        human: SCENE_INDEX.human,
        uncertainty: SCENE_INDEX.uncertainty,
        graph: SCENE_INDEX.graph,
        constellation: SCENE_INDEX.constellation,
      },
      time: 0,
      focusState: 0,
      focusMix: 0,
      scanX: 0,
      pointerX: 0,
      pointerY: 0,
      pointerStrength: 0,
      edgeCount: RESEARCH_EDGES.length,
      reducedMotion,
      delta: 1 / 60,
    }),
    [reducedMotion],
  );

  const frameCount = useRef(0);

  useFrame((_, delta) => {
    const frame = liveFrame;
    const key = frame.graph;

    update.time = sceneClock.time;
    update.focusState = scrollState.focusState;
    update.focusMix = Math.min(scrollState.focusStrength, MAX_FOCUS_MIX);
    update.scanX = scrollState.scanX;
    update.pointerX = scenePointer.x;
    update.pointerY = scenePointer.y;
    update.pointerStrength = scrollState.pointerStrength;
    update.reducedMotion = reducedMotion;
    update.delta = Math.min(0.1, delta) || 1 / 60;

    updateNodes(field, packed, update);

    // Topology rebuild rate. While the field is morphing or the page is moving,
    // a two-frame-old neighbour list is visible as edges arriving late, so the
    // interval collapses to every frame. When nothing is happening, three.
    frameCount.current += 1;
    const moving =
      Math.abs(scrollState.velocity) > 0.05 || (frame.blend > 0.001 && frame.blend < 0.999);
    const interval = moving ? 1 : EDGE_REBUILD_INTERVAL;

    if (frameCount.current % interval === 0) {
      buildEdges(field, key, buffers);
      edgeGeometry.setDrawRange(0, buffers.count * 2);
      (edgeGeometry.getAttribute('aKind') as THREE.BufferAttribute).needsUpdate = true;
    } else {
      refreshEdgePositions(field, key, buffers);
    }

    (edgeGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (edgeGeometry.getAttribute('aWeight') as THREE.BufferAttribute).needsUpdate = true;
    (edgeGeometry.getAttribute('aArc') as THREE.BufferAttribute).needsUpdate = true;

    (nodeGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (nodeGeometry.getAttribute('aBrightness') as THREE.BufferAttribute).needsUpdate = true;
    (nodeGeometry.getAttribute('aLens') as THREE.BufferAttribute).needsUpdate = true;
    (nodeGeometry.getAttribute('aScan') as THREE.BufferAttribute).needsUpdate = true;
    (nodeGeometry.getAttribute('aConfidence') as THREE.BufferAttribute).needsUpdate = true;

    const { core, accent } = frame.palette;
    nodeUniforms.uCore.value.setRGB(core[0], core[1], core[2]);
    nodeUniforms.uAccent.value.setRGB(accent[0], accent[1], accent[2]);
    nodeUniforms.uOpacity.value = key.nodeOpacity;
    nodeUniforms.uSize.value = 9 * NODE_SCALE[tier] * key.nodeSize;

    edgeUniforms.uCore.value.setRGB(core[0], core[1], core[2]);
    edgeUniforms.uAccent.value.setRGB(accent[0], accent[1], accent[2]);
    edgeUniforms.uOpacity.value = key.edgeOpacity;
    edgeUniforms.uSemantic.value = key.semantic;
    edgeUniforms.uTime.value = reducedMotion ? 0 : sceneClock.time;

    if (nodes.current) nodes.current.visible = key.nodeOpacity > 0.005;
    if (edges.current) edges.current.visible = buffers.count > 0 && key.edgeOpacity > 0.003;
  });

  return (
    <>
      <lineSegments ref={edges} geometry={edgeGeometry} frustumCulled={false} renderOrder={1}>
        <shaderMaterial
          uniforms={edgeUniforms}
          vertexShader={edgeVertexShader}
          fragmentShader={edgeFragmentShader}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </lineSegments>
      <points ref={nodes} geometry={nodeGeometry} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          uniforms={nodeUniforms}
          vertexShader={nodeVertexShader}
          fragmentShader={nodeFragmentShader}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </>
  );
}
