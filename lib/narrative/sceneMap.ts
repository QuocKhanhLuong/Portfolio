import { SCENE_STATES, type SceneState } from '@/content/types';

/**
 * Where each scene state sits on the scroll axis.
 *
 * This used to be a table of weighted "acts" that had no relationship to the
 * page anyone actually scrolls through: the field could arrive at the medical
 * state while the reader was still in the project list. The anchors are now
 * *measured* from the DOM. Any element carrying `data-scene="<state>"` becomes
 * an anchor at the scroll position where its centre reaches the viewport
 * centre, so a project row and its field state are on screen together.
 */

export interface SceneAnchor {
  state: SceneState;
  /** Index into SCENE_STATES — used directly as a shader state selector. */
  stateIndex: number;
  /** Global scroll progress, 0–1. */
  progress: number;
}

const anchor = (state: SceneState, progress: number): SceneAnchor => ({
  state,
  stateIndex: SCENE_STATES.indexOf(state),
  progress,
});

/**
 * Used before the first measurement (and on the server): the ten states spread
 * evenly. Replaced on mount by the real DOM layout.
 */
const FALLBACK: SceneAnchor[] = SCENE_STATES.map((state, i) =>
  anchor(state, SCENE_STATES.length === 1 ? 0.5 : i / (SCENE_STATES.length - 1)),
);

let anchors: SceneAnchor[] = FALLBACK;

export const sceneAnchors = (): SceneAnchor[] => anchors;

/** Smallest allowed gap between anchors, so a transition never becomes a snap. */
const MIN_GAP = 0.012;

function isSceneState(value: string | undefined): value is SceneState {
  return !!value && (SCENE_STATES as string[]).includes(value);
}

/**
 * Re-measure every `data-scene` element. Cheap enough to run on resize and on
 * every ScrollTrigger refresh; it is the same layout read ScrollTrigger already
 * forces, so it adds no extra reflow when called from a refresh handler.
 */
export function measureSceneAnchors(root: ParentNode = document): SceneAnchor[] {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) {
    anchors = FALLBACK;
    return anchors;
  }

  const scrollY = window.scrollY;
  const half = window.innerHeight * 0.5;
  const measured: SceneAnchor[] = [];

  root.querySelectorAll<HTMLElement>('[data-scene]').forEach((element) => {
    const state = element.dataset.scene;
    if (!isSceneState(state)) return;

    const box = element.getBoundingClientRect();
    // Where the page must be scrolled to for this element's centre to sit at
    // the centre of the viewport. Tall elements therefore anchor at their
    // middle, which is where the reader is when they are reading it.
    const centre = box.top + scrollY + box.height * 0.5;
    const progress = Math.min(1, Math.max(0, (centre - half) / max));

    const previous = measured[measured.length - 1];
    // Consecutive elements requesting the same state describe one stretch of
    // page, not two transitions: keep the first and let the run widen it.
    if (previous && previous.state === state) return;
    measured.push(anchor(state, progress));
  });

  if (measured.length < 2) {
    anchors = FALLBACK;
    return anchors;
  }

  // Elements are read in document order, so progress is already sorted apart
  // from ties in short pages. Enforce the ordering rather than trusting it.
  for (let i = 1; i < measured.length; i += 1) {
    const floor = measured[i - 1].progress + MIN_GAP;
    if (measured[i].progress < floor) measured[i].progress = floor;
  }
  // Renormalise if clamping pushed the tail past the end of the page.
  const last = measured[measured.length - 1].progress;
  if (last > 1) {
    const scale = 1 / last;
    measured.forEach((a) => {
      a.progress *= scale;
    });
  }

  anchors = measured;
  return anchors;
}

/** Index of the anchor whose stretch of page currently holds the reader. */
export function currentSceneIndex(progress: number): number {
  const list = anchors;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (progress >= list[i].progress) return i;
  }
  return 0;
}
