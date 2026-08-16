/**
 * Shared content types.
 *
 * Everything a human edits lives in `content/`. Nothing in here should import
 * from `scene/` or `lib/` — content is data, and the rest of the app reads it.
 */

/**
 * The ten states the motif field passes through. Sections and project rows
 * anchor themselves to these by name; see `lib/narrative/sceneMap.ts`.
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

