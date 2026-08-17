'use client';

import { useEffect } from 'react';
import { startNarrativeDriver } from '@/lib/narrative/driver';
import { useNarrative } from '@/lib/narrative/store';
import { detectTier } from '@/lib/perf';
import { SpecimenScope } from '@/scene/SpecimenScope';
import { SiteHeader, ViewfinderHUD, BottomNote } from './Chrome';
import { Portfolio } from './Portfolio';

/**
 * Specimen Scope Narrative shell:
 * - One full-screen 1000-particle scope canvas (#scope)
 * - Viewfinder HUD overlay (.hud) with corner brackets, live coordinates, reticle, and N=1000 readout
 * - Centred navigation (.nav) with active section tracking
 * - Centred specimen sections
 */
export function Narrative() {
  const setReducedMotion = useNarrative((s) => s.setReducedMotion);
  const setTier = useNarrative((s) => s.setTier);

  useEffect(() => {
    setTier(detectTier());
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener('change', apply);

    const stop = startNarrativeDriver({ reducedMotion: query.matches });
    return () => {
      query.removeEventListener('change', apply);
      stop();
    };
  }, [setReducedMotion, setTier]);

  return (
    <>
      <SpecimenScope />
      <ViewfinderHUD />
      <SiteHeader />
      <Portfolio />
      <BottomNote />
    </>
  );
}
