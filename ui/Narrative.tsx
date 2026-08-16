'use client';

import { useEffect } from 'react';
import { startNarrativeDriver } from '@/lib/narrative/driver';
import { useNarrative } from '@/lib/narrative/store';
import { Stage } from '@/scene/Stage';
import { SiteHeader, ProgressLine, ScrollCue } from './Chrome';
import { Portfolio } from './Portfolio';

/**
 * The page shell owns one scroll driver, one persistent WebGL stage, and one
 * readable portfolio. The visual field carries the continuous narrative; the
 * foreground remains ordinary, navigable document content.
 */
export function Narrative() {
  const setReducedMotion = useNarrative((s) => s.setReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener('change', apply);

    const stop = startNarrativeDriver({ reducedMotion: query.matches });
    return () => {
      query.removeEventListener('change', apply);
      stop();
    };
  }, [setReducedMotion]);

  return (
    <>
      <Stage />
      <SiteHeader />
      <ProgressLine />
      <ScrollCue />
      <Portfolio />
    </>
  );
}
