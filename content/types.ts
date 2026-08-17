/**
 * Shared content types.
 *
 * Everything a human edits lives in `content/`. Nothing in here should import
 * from `scene/` or `lib/` — content is data, and the rest of the app reads it.
 */

/**
 * Semantic labels used by content hover/focus affordances. The persistent
 * section scene has its own four visual modes; these labels never create
 * additional scroll anchors.
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
