/**
 * Shared content types.
 *
 * Everything a human edits lives in `content/`. Nothing in here should import
 * from `scene/` or `lib/` — content is data, and the rest of the app reads it.
 */

export type Locale = 'en' | 'vi';

/** A string that exists in both languages. */
export type Localized = Record<Locale, string>;

/** A paragraph list, so copy can breathe without HTML in the data files. */
export type LocalizedBlock = Record<Locale, string[]>;

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

export interface Act {
  id: ActId;
  /** Two-digit marker shown in the rail and the act kicker. */
  index: string;
  /** Short uppercase name — rail label and kicker. Not translated: these read as system labels. */
  label: string;
  /** Scroll weight relative to other acts. 1 unit ≈ one viewport of scroll. */
  weight: number;
  /** Scene states this act traverses, in order. */
  states: SceneState[];
  headline: Localized;
  lead?: Localized;
  body?: LocalizedBlock;
  /**
   * Where the copy sits, so it never fights the motif. The scene offsets the
   * field to the opposite side.
   */
  align: 'center' | 'left' | 'right';
  /**
   * Redaction only appears where degradation carries meaning: the opening
   * signal, the first reach of curiosity, and the loss of certainty.
   * `resolve` runs Redaction → serif; `dissolve` runs serif → Redaction.
   */
  redaction?: 'resolve' | 'dissolve';
}
