'use client';

/**
 * Temporary rendering-path debug switch.
 *
 * `?graphDebug=1` strips the scene back to the graph alone: no atmosphere, no
 * grain, no scroll choreography, no state-dependent opacity — a fixed camera on
 * a centred, forced state, drawn dark enough to be unmistakable. It exists to
 * separate "the graph is not rendering" from "the graph is rendering and the
 * composition is wrong", which are two very different bugs.
 *
 * It is read once from the URL and never from anything else, so production
 * builds behave identically to before unless the flag is explicitly present.
 */

export interface GraphDebug {
  enabled: boolean;
  /** Scene state to hold, by name. Defaults to the hero state. */
  state: string;
}

let cached: GraphDebug | null = null;

export function graphDebug(): GraphDebug {
  if (cached) return cached;
  if (typeof window === 'undefined') return { enabled: false, state: 'signal' };

  const params = new URLSearchParams(window.location.search);
  const flag = params.get('graphDebug');
  cached = {
    enabled: flag === '1' || flag === 'true',
    state: params.get('graphState') ?? 'signal',
  };

  if (cached.enabled) {
    // eslint-disable-next-line no-console
    console.log('[graph] debug mode on — atmosphere and grain hidden, camera frozen');
  }
  return cached;
}
