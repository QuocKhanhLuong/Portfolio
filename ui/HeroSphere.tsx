'use client';

import { useEffect, useRef } from 'react';
import { COLOR } from '@/lib/narrative/timeline';
import { useNarrative } from '@/lib/narrative/store';
import { subscribeFrame } from '@/lib/narrative/ticker';

/**
 * Hero sphere: a substantial 3D object that sits in the hero section.
 * Renders procedurally with depth-sorted characters, animated with gentle rotation
 * and responding to pointer movement.
 */
export function HeroSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    rotation: { x: 0, y: 0 },
    time: 0,
    pointerX: 0,
    pointerY: 0,
    handoff: 0,
  });

  const reducedMotion = useNarrative((s) => s.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    const unsubscribe = subscribeFrame((frame) => {
      const state = stateRef.current;
      const inSignalTransition = frame.stateA === 'signal' && frame.stateB === 'pixel';
      const target = inSignalTransition || frame.stateA === 'signal' ? frame.blend : 1;
      state.handoff += (target - state.handoff) * (reducedMotion ? 1 : 0.18);
      canvas.style.opacity = `${1 - state.handoff * 0.86}`;
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      stateRef.current.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      stateRef.current.pointerY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const draw = () => {
      if (!canvas || !context || width < 1 || height < 1) return;

      const state = stateRef.current;
      const chars = '·∘○◯◌●';
      const points: { x: number; y: number; z: number; char: string }[] = [];
      const radius = Math.min(width, height) * 0.35;
      const centerX = width / 2;
      const centerY = height / 2;

      // Update rotation
      if (!reducedMotion) {
        state.time += 0.016;
        state.rotation.y += 0.003;
        state.rotation.x += state.pointerY * 0.0008;
      }

      // Generate sphere points
      for (let phi = 0; phi < Math.PI * 2; phi += 0.25) {
        for (let theta = 0; theta < Math.PI; theta += 0.25) {
          let x = Math.sin(theta) * Math.cos(phi);
          let y = Math.sin(theta) * Math.sin(phi);
          let z = Math.cos(theta);

          // The persistent WebGL signal state is the same spherical shell. A
          // small flattening/relief as it hands off keeps the explicit hero
          // object visually connected to that field instead of popping away.
          const deformation = state.handoff;
          const relief = 1 + deformation * Math.sin(phi * 3 + state.time * 0.8) * 0.08;
          x *= (1 - deformation * 0.18) * relief;
          y *= (1 + deformation * 0.05) * relief;
          z *= relief;

          // Apply rotation
          const cosY = Math.cos(state.rotation.y);
          const sinY = Math.sin(state.rotation.y);
          const cosX = Math.cos(state.rotation.x);
          const sinX = Math.sin(state.rotation.x);

          let tempX = x * cosY - z * sinY;
          let tempZ = x * sinY + z * cosY;
          x = tempX;
          z = tempZ;

          tempX = x;
          let tempY = y * cosX - z * sinX;
          tempZ = y * sinX + z * cosX;
          x = tempX;
          y = tempY;
          z = tempZ;

          const depth = (z + 1) / 2;
          points.push({
            x: centerX + x * radius,
            y: centerY + y * radius,
            z,
            char: chars[Math.floor(depth * (chars.length - 1))],
          });
        }
      }

      // Sort by depth
      points.sort((a, b) => a.z - b.z);

      // Clear canvas
      context.fillStyle = 'transparent';
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw points
      context.font = `${Math.max(7, Math.min(11, width / 22))}px IBM Plex Mono, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const inkColor = COLOR.ink;
      const coolColor = COLOR.cool;

      points.forEach((point) => {
        const depth = (point.z + 1) / 2;
        const mix = 0.35 + depth * 0.5;
        const alpha = (0.15 + depth * 0.35) * (1 - state.handoff * 0.42);

        const r = Math.round(inkColor[0] * 255 * (1 - mix) + coolColor[0] * 255 * mix);
        const g = Math.round(inkColor[1] * 255 * (1 - mix) + coolColor[1] * 255 * mix);
        const b = Math.round(inkColor[2] * 255 * (1 - mix) + coolColor[2] * 255 * mix);

        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        context.fillText(point.char, point.x, point.y);
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', handlePointerMove);
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', handlePointerMove);
      unsubscribe();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
      aria-hidden="true"
    />
  );
}
