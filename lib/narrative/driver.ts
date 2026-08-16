'use client';

import Lenis from 'lenis';
import { currentActIndex } from './interpolate';
import { scrollState, useNarrative } from './store';
import { emitFrame } from './ticker';

/**
 * The one place in the application that listens to scroll.
 *
 * It owns Lenis, the smoothing, the velocity estimate and the pointer, writes
 * them into `scrollState`, and pushes the act index into the store only when it
 * actually changes. Components read `scrollState` inside their own frame loops.
 * If you find yourself adding a scroll listener somewhere else, add it here
 * instead.
 */

let lenis: Lenis | null = null;
let rafId = 0;
let disposed = true;

export interface DriverOptions {
  reducedMotion: boolean;
}

export function startNarrativeDriver({ reducedMotion }: DriverOptions): () => void {
  disposed = false;

  if (!reducedMotion) {
    lenis = new Lenis({
      // Long, heavy damping: the page should feel like it has mass.
      lerp: 0.075,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      syncTouch: true,
    });
  }

  let lastTime = performance.now();
  let lastProgress = 0;
  const startTime = lastTime;

  const readTarget = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? window.scrollY / max : 0;
  };

  const tick = (now: number) => {
    if (disposed) return;
    lenis?.raf(now);

    const dt = Math.min(0.1, (now - lastTime) / 1000) || 0.016;
    lastTime = now;

    scrollState.target = readTarget();

    // Lenis already smooths the document scroll; this second, gentler pass
    // decouples the scene from any residual step in the reported position.
    const ease = reducedMotion ? 1 : 1 - Math.pow(0.0016, dt);
    scrollState.progress += (scrollState.target - scrollState.progress) * ease;

    const instantaneous = (scrollState.progress - lastProgress) / dt;
    lastProgress = scrollState.progress;
    // Velocity is itself smoothed, otherwise a single wheel notch spikes it.
    scrollState.velocity += (instantaneous - scrollState.velocity) * Math.min(1, dt * 8);

    scrollState.time = (now - startTime) / 1000;

    // Pointer influence decays whenever the pointer is not moving, so a parked
    // cursor stops deforming the field.
    scrollState.pointerStrength *= Math.pow(0.35, dt);

    const act = currentActIndex(scrollState.progress);
    if (act !== useNarrative.getState().actIndex) useNarrative.getState().setActIndex(act);

    emitFrame();

    rafId = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: PointerEvent) => {
    scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    scrollState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    scrollState.pointerStrength = 1;
  };

  const onPointerLeave = () => {
    scrollState.pointerStrength = 0;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });

  scrollState.progress = scrollState.target = readTarget();
  lastProgress = scrollState.progress;
  rafId = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    lenis?.destroy();
    lenis = null;
  };
}
