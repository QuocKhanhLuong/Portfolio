'use client';

import { useEffect, useRef } from 'react';
import { scrollState, useNarrative } from '@/lib/narrative/store';
import styles from './specimen-scope.module.css';

export type ScopeShape =
  | 'signal'
  | 'pixel'
  | 'features'
  | 'graph'
  | 'volume'
  | 'constellation';

interface Particle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  r0: number;
  r1: number;
  ph: number;
  lit: boolean;
  size: number;
}

export const SCOPE_PARTICLE_COUNT = 1000;

function calculateShapeTarget(
  shape: ScopeShape,
  i: number,
  total: number,
  r0: number,
  r1: number,
  rad: number,
): { x: number; y: number } {
  const a = (i / total) * Math.PI * 2;

  switch (shape) {
    case 'signal': {
      // Symmetric oscilloscope wave trace across centre
      const u = i / total;
      const x = (u - 0.5) * rad * 1.5;
      const y =
        (Math.sin(u * 28) * 0.4 +
          Math.sin(u * 11 + 1.3) * 0.2 +
          Math.sin(u * 61) * 0.09) *
        rad *
        0.18 *
        (0.5 + r0);
      return { x, y };
    }
    case 'pixel': {
      // Symmetric grid / scan matrix
      const g = Math.round(Math.sqrt(total));
      const gx = i % g;
      const gy = Math.floor(i / g);
      return {
        x: (gx - (g - 1) / 2) * (rad * 0.54 / g),
        y: (gy - (g - 1) / 2) * (rad * 0.54 / g),
      };
    }
    case 'features': {
      // Scattered keypoints in a soft disc, symmetric
      const r = rad * 0.36 * Math.sqrt(r0);
      return {
        x: Math.cos(a + r1 * 6) * r,
        y: Math.sin(a + r1 * 6) * r,
      };
    }
    case 'graph': {
      // Concentric ring nodes (radial index)
      const ring = 0.1 + 0.32 * ((i % 6) / 5);
      return {
        x: Math.cos(a * 3) * rad * ring,
        y: Math.sin(a * 3) * rad * ring,
      };
    }
    case 'volume': {
      // Layered voxel shells / concentric depth slices
      const sliceIdx = i % 8;
      const sliceR = rad * (0.12 + 0.28 * (sliceIdx / 7));
      const angle = a * 2 + r1 * 0.5;
      return {
        x: Math.cos(angle) * sliceR,
        y: Math.sin(angle) * sliceR * 0.75 + (sliceIdx - 3.5) * 12,
      };
    }
    case 'constellation': {
      // Sparse still stars, wide symmetric
      const r = rad * (0.14 + 0.46 * r0);
      return {
        x: Math.cos(a * 7 + r1 * 6) * r,
        y: Math.sin(a * 5 + r1 * 6) * r,
      };
    }
    default: {
      const r = rad * 0.3;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
  }
}

// Global target state for the scope
let activeScopeState: ScopeShape = 'signal';
const scopeListeners = new Set<(state: ScopeShape) => void>();

export function setScopeState(state: ScopeShape) {
  if (activeScopeState === state) return;
  activeScopeState = state;
  scopeListeners.forEach((fn) => fn(state));
}

export function SpecimenScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useNarrative((s) => s.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let DPR = Math.min(2, window.devicePixelRatio || 1);
    let cx = W / 2;
    let cy = H / 2;

    let mx = 0;
    let my = 0;
    let pmx = 0;
    let pmy = 0;
    let vel = 0;

    const particles: Particle[] = [];
    const N = SCOPE_PARTICLE_COUNT;

    for (let i = 0; i < N; i++) {
      const isLit = Math.random() < 0.22;
      particles.push({
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        r0: Math.random(),
        r1: Math.random(),
        ph: Math.random() * Math.PI * 2,
        lit: isLit,
        size: isLit ? 1.5 : 0.95,
      });
    }

    const rad = () => Math.min(W, H);

    const retarget = (name: ScopeShape) => {
      const currentRad = rad();
      for (let i = 0; i < N; i++) {
        const s = calculateShapeTarget(name, i, N, particles[i].r0, particles[i].r1, currentRad);
        particles[i].tx = s.x;
        particles[i].ty = s.y;
      }
    };

    const resize = () => {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      retarget(activeScopeState);
    };

    resize();
    for (let i = 0; i < N; i++) {
      particles[i].x = particles[i].tx;
      particles[i].y = particles[i].ty;
    }

    const handleResize = () => resize();
    const handlePointerMove = (e: PointerEvent) => {
      mx = e.clientX - cx;
      my = e.clientY - cy;
      scrollState.pointerX = mx / cx;
      scrollState.pointerY = -my / cy;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleStateChange = (state: ScopeShape) => {
      retarget(state);
    };
    scopeListeners.add(handleStateChange);

    let animationFrameId: number;
    let t = 0;

    const frame = () => {
      // Faster motion speed (0.024 vs 0.012)
      t += 0.024;
      vel = vel * 0.88 + Math.hypot(mx - pmx, my - pmy) * 0.12;
      pmx = mx;
      pmy = my;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cx, cy);

      const push = Math.min(1.2, vel * 0.025);

      for (let i = 0; i < N; i++) {
        const p = particles[i];
        // Snappier lerp transition (0.085 per frame)
        p.x += (p.tx - p.x) * 0.085;
        p.y += (p.ty - p.y) * 0.085;

        // Livelier wandering jitter
        const jx = Math.sin(t * 1.4 + p.ph) * 2.2;
        const jy = Math.cos(t * 1.2 + p.ph * 1.3) * 2.2;

        // Velocity-gated pointer repulsion
        let rx = 0;
        let ry = 0;
        if (push > 0.01 && !reducedMotion) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const d = Math.hypot(dx, dy) + 0.001;
          const f = Math.max(0, 1 - d / 260) * push * 26;
          rx = (dx / d) * f;
          ry = (dy / d) * f;
        }

        const x = p.x + jx + rx;
        const y = p.y + jy + ry;

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.lit ? 'rgba(228, 165, 74, 0.94)' : 'rgba(231, 228, 216, 0.44)';
        ctx.fill();
      }

      ctx.restore();

      // Update HUD pointer coordinate readout directly if present
      const coordEl = document.getElementById('hud-coord');
      if (coordEl) {
        coordEl.textContent = `X ${(mx / (cx || 1)).toFixed(2)} · Y ${(-my / (cy || 1)).toFixed(2)}`;
      }

      if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(frame);
      }
    };

    if (reducedMotion) {
      frame();
    } else {
      animationFrameId = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      scopeListeners.delete(handleStateChange);
    };
  }, [reducedMotion]);

  return (
    <>
      <canvas id="scope" ref={canvasRef} className={styles.scopeCanvas} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
    </>
  );
}
