'use client';

import { useEffect, useState } from 'react';
import { useNarrative } from '@/lib/narrative/store';
import { PARTICLE_COUNT } from '@/lib/perf';
import { packStates, type PackedStates } from './pack';

/**
 * The state texture, built once per visit.
 *
 * It used to be owned by the grain field. Now the node tier reads the same
 * buffer on the CPU, so ownership moved up to the stage: two consumers must not
 * mean two workers, two buffers, or two subtly different fields.
 *
 * Built off the main thread; the opening moment is the worst possible time for
 * a hitch. Falls back to a synchronous build where workers are absent.
 */
export function usePackedStates(): PackedStates | null {
  const tier = useNarrative((s) => s.tier);
  const count = PARTICLE_COUNT[tier];
  const [packed, setPacked] = useState<PackedStates | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (typeof Worker === 'undefined') {
      setPacked(packStates(count));
      return;
    }

    const worker = new Worker(new URL('./pack.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<PackedStates>) => {
      if (!cancelled) setPacked(event.data);
      worker.terminate();
    };
    worker.onerror = () => {
      if (!cancelled) setPacked(packStates(count));
      worker.terminate();
    };
    worker.postMessage({ count });

    return () => {
      cancelled = true;
      worker.terminate();
    };
  }, [count]);

  return packed;
}
