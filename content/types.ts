/**
 * Shared content types.
 *
 * Everything a human edits lives in `content/`. Nothing in here should import
 * from `scene/` or `lib/` — content is data, and the rest of the app reads it.
 */

/**
 * The ten states the motif field passes through. Acts map onto these; several
 * acts hold two, which is how pacing is expressed.
 */
export type SceneState =
  | 'signal'
  | 'pixel'
  | 'image'
  | 'features'
  | 'cloud'
  | 'volume'
  | 'human'
  | 'uncertainty'
  | 'graph'
  | 'constellation';

export const SCENE_STATES: SceneState[] = [
  'signal',
  'pixel',
  'image',
  'features',
  'cloud',
  'volume',
  'human',
  'uncertainty',
  'graph',
  'constellation',
];

export type ActId =
  | 'signal'
  | 'curiosity'
  | 'representation'
  | 'depth'
  | 'consequence'
  | 'uncertainty'
  | 'frontier'
  | 'return';

/**
 * Internal scene-timeline metadata. It is deliberately separate from the
 * visible portfolio sections: scroll can keep pacing the field without forcing
 * the foreground into a chapter-by-chapter narrative.
 */
export interface Act {
  id: ActId;
  /** Stable internal marker used when inspecting the scene timeline. */
  index: string;
  /** Internal label; it is not rendered as foreground copy. */
  label: string;
  /** Scroll weight relative to other acts. 1 unit ≈ one viewport of scroll. */
  weight: number;
  /** Scene states this act traverses, in order. */
  states: SceneState[];
}
