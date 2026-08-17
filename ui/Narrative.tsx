'use client';

import { useEffect } from 'react';
import { startNarrativeDriver } from '@/lib/narrative/driver';
import { useNarrative } from '@/lib/narrative/store';
import { detectTier } from '@/lib/perf';
import { SiteHeader, ProgressLine, ScrollCue } from './Chrome';
import { Portfolio } from './Portfolio';
import { PortfolioScene } from '@/scene/PortfolioScene';

/**
 * The page shell owns one scroll driver, one persistent main scene, and a
 * readable portfolio. The foreground remains ordinary, navigable document
 * content; section visuals are states of the shared scene, not DOM widgets.
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
      <PortfolioScene />
      <Portfolio />
    </>
  );
}
