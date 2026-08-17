'use client';

import { useEffect } from 'react';
import { startNarrativeDriver } from '@/lib/narrative/driver';
import { useNarrative } from '@/lib/narrative/store';
import { detectTier } from '@/lib/perf';
import { SiteHeader, ProgressLine, ScrollCue } from './Chrome';
import { Portfolio } from './Portfolio';

/**
 * The page shell owns one scroll driver and a readable portfolio. Each section
 * owns a demand-driven field panel; the foreground remains ordinary,
 * navigable document content.
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
      <SiteHeader />
      <ProgressLine />
      <ScrollCue />
      <Portfolio />
    </>
  );
}
