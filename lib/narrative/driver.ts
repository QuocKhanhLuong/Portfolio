'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { measureSceneAnchors, currentSceneIndex } from './sceneMap';
import { scrollState, useNarrative } from './store';
import { emitFrame } from './ticker';

/**
 * The one place in the application that listens to scroll.
 *
 * Three clocks used to exist here: Lenis had its own rAF, ScrollTrigger updated
 * off the native scroll event, and the scene ran a second exponential smoother
 * on top of Lenis' already-smoothed position. The foreground and the background
 * therefore disagreed about where the page was, by an amount that varied with
 * frame rate. There is now one clock — gsap's ticker — which drives Lenis,
 * which in turn drives ScrollTrigger. The scene reads Lenis' smoothed position
 * directly and does not smooth it again.
 */

let lenis: Lenis | null = null;
let disposed = true;

/** Scroll through the same Lenis owner as the rest of the narrative. */
export function scrollToTop() {
  if (lenis) {
    lenis.scrollTo(0);
    return;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export interface DriverOptions {
  reducedMotion: boolean;
}

export function startNarrativeDriver({ reducedMotion }: DriverOptions): () => void {
  disposed = false;
  gsap.registerPlugin(ScrollTrigger);

  // Cached, because reading scrollHeight every frame forces a layout. It is
  // refreshed from the same event ScrollTrigger uses to remeasure everything.
  let maxScroll = 1;
  const measureExtent = () => {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };
  const nativeProgress = () => window.scrollY / maxScroll;

  if (!reducedMotion) {
    lenis = new Lenis({
      // Long, heavy damping: the page should feel like it has mass. This is the
      // only smoothing applied to scroll anywhere in the app.
      lerp: 0.075,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      syncTouch: true,
    });
    // ScrollTrigger must be told the position Lenis is animating to, not the
    // one the browser reports, or every scrubbed tween trails the page.
    lenis.on('scroll', ScrollTrigger.update);
  }

  const onRefresh = () => {
    measureExtent();
    measureSceneAnchors();
  };
  ScrollTrigger.addEventListener('refresh', onRefresh);

  let lastProgress = nativeProgress();
  let startTime = -1;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = 0;

  const tick = (time: number, deltaMs: number) => {
    if (disposed) return;
    // gsap hands out seconds; Lenis wants milliseconds off the same clock.
    lenis?.raf(time * 1000);

    const dt = Math.min(0.1, deltaMs / 1000) || 0.016;
    if (startTime < 0) startTime = time;

    const target = nativeProgress();
    scrollState.target = target;
    // Lenis already owns the smoothing. Taking its animated position keeps the
    // field, the camera and every ScrollTrigger on the same value.
    scrollState.progress = lenis ? (Number.isFinite(lenis.progress) ? lenis.progress : target) : target;

    const instantaneous = (scrollState.progress - lastProgress) / dt;
    lastProgress = scrollState.progress;
    // Velocity is itself smoothed, otherwise a single wheel notch spikes it.
    scrollState.velocity += (instantaneous - scrollState.velocity) * Math.min(1, dt * 8);

    scrollState.time = time - startTime;

    // The field uses a scalar gesture energy: pointer movement attacks it by the
    // normalized travel distance, then the render loop releases it at .96 per
    // frame. There is intentionally no second velocity smoother here.
    scrollState.pointerEnergy = reducedMotion ? 0 : scrollState.pointerEnergy * 0.96;

    // Foreground project/research focus eases independently from scroll. It is
    // a temporary inspection request, never a second scene timeline.
    const focusEase = reducedMotion ? 1 : 1 - Math.pow(0.002, dt);
    scrollState.focusStrength +=
      (scrollState.focusTargetStrength - scrollState.focusStrength) * focusEase;

    const index = currentSceneIndex(scrollState.progress);
    if (index !== useNarrative.getState().sceneIndex) useNarrative.getState().setSceneIndex(index);

    emitFrame();
  };

  const onPointerMove = (e: PointerEvent) => {
    const pageX = e.clientX / window.innerWidth;
    const pageY = e.clientY / window.innerHeight;
    const x = pageX * 2 - 1;
    const y = -(pageY * 2 - 1);
    const now = performance.now();
    const coarse = e.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches;

    scrollState.pointerX = x;
    scrollState.pointerY = y;
    if (!reducedMotion && !coarse) {
      const previousX = lastPointerTime > 0 ? lastPointerX : pageX;
      const previousY = lastPointerTime > 0 ? lastPointerY : pageY;
      const distance = Math.hypot(pageX - previousX, pageY - previousY);
      scrollState.pointerEnergy = Math.min(0.85, scrollState.pointerEnergy + distance * 3.5);
    }

    lastPointerX = pageX;
    lastPointerY = pageY;
    lastPointerTime = now;
  };

  const releasePointer = () => {
    lastPointerTime = 0;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', releasePointer, { passive: true });
  window.addEventListener('pointercancel', releasePointer, { passive: true });
  window.addEventListener('blur', releasePointer);

  measureExtent();
  scrollState.progress = scrollState.target = nativeProgress();
  lastProgress = scrollState.progress;

  measureSceneAnchors();
  // The DOM entrance tweens have already been created by the time the driver
  // starts; one refresh puts every trigger and every anchor on the same layout.
  ScrollTrigger.refresh();

  // lagSmoothing hides frame drops by lying about elapsed time, which desyncs
  // the scene clock from the scroll position it is supposed to match.
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(tick);

  return () => {
    disposed = true;
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', releasePointer);
    window.removeEventListener('pointercancel', releasePointer);
    window.removeEventListener('blur', releasePointer);
    lenis?.destroy();
    lenis = null;
    scrollState.pointerEnergy = 0;
    scrollState.focusTargetStrength = 0;
    scrollState.focusStrength = 0;
  };
}
