/**
 * How much of the screen the field occupies, and where.
 *
 * The previous composition authored a camera distance per state and let the
 * field land wherever its own coordinates put it. That cannot work: the states
 * are not the same size or even the same shape — the image plane is 4.3 wide
 * and 1.6 tall, the hero shell is a ball, the constellation is five times
 * either — so a distance that frames one of them leaves the rest clipped or, in
 * the hero's case, at 16% of the viewport height, which reads as a smudge
 * behind the copy rather than as an object.
 *
 * So size is authored in screen terms instead. Each state declares the fraction
 * of the viewport it should fill; this module contain-fits the state's measured
 * half-extents into that fraction. Camera distance is then free to do the only
 * thing it should do — decide how much perspective there is — without changing
 * how big anything looks.
 */

/** Vertical half-extent visible at a given distance, in world units. */
export const visibleHalfHeight = (distance: number, fovDegrees: number) =>
  distance * Math.tan(((fovDegrees * Math.PI) / 180) * 0.5);

export interface Composition {
  scale: number;
  offsetX: number;
  offsetY: number;
  /** On-screen half-extents after scaling, for the offset clamp and for debug. */
  halfWidth: number;
  halfHeight: number;
}

/**
 * Narrow viewports get no horizontal offset: there is no side column to sit
 * beside, and the copy runs the full width.
 */
export const isNarrow = (width: number) => width < 820;

/**
 * How far past the viewport width the field may run on a narrow screen.
 *
 * Contain-fitting a portrait viewport is width-limited, and it makes everything
 * tiny: a 2.7:1 image plane contained in a 0.46 aspect viewport is a tenth of
 * the screen high. On a background object that is the wrong trade — it is
 * allowed to run off the sides, the way a photograph bleeds off a page, so long
 * as it keeps its height.
 */
const NARROW_BLEED = 1.7;

export interface ComposeInput {
  /** Measured half-extents of the current state, x/y/z, in field units. */
  halfX: number;
  halfY: number;
  halfZ: number;
  /** Fraction of the viewport the field should fill. */
  fill: number;
  distance: number;
  fovDegrees: number;
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  aspect: number;
}

export function composeField(input: ComposeInput, out: Composition): Composition {
  const { halfY, fill, distance, fovDegrees, aspect } = input;
  const narrow = isNarrow(input.viewportWidth);

  const viewHalfH = visibleHalfHeight(distance, fovDegrees);
  const viewHalfW = viewHalfH * aspect;

  // The camera yaws by up to ~0.6rad, which swings depth into width. Treating
  // the horizontal extent as the larger of x and z means a state does not grow
  // past the frame simply because the camera turned.
  const halfX = Math.max(input.halfX, input.halfZ);

  // Contain: the field is as large as it can be while both axes still fit,
  // then taken to the requested fraction of that. Fitting on one axis only is
  // what left the wide states a quarter of the viewport high.
  const fitHeight = viewHalfH / Math.max(0.02, halfY);
  const fitWidth = viewHalfW / Math.max(0.02, halfX);
  const fit = narrow
    ? Math.min(fitHeight, fitWidth * NARROW_BLEED)
    : Math.min(fitHeight, fitWidth);
  out.scale = fit * fill;

  out.halfWidth = halfX * out.scale;
  out.halfHeight = halfY * out.scale;

  // Offsets are in units of the field's own on-screen half-extent, so shifting
  // it never depends on how big the current state happens to be.
  out.offsetX = narrow ? 0 : input.offsetX * out.halfWidth;
  out.offsetY = input.offsetY * out.halfHeight;

  // Whatever the offset asked for, the object stays inside the frame.
  const marginX = Math.max(0, viewHalfW - out.halfWidth);
  const marginY = Math.max(0, viewHalfH - out.halfHeight);
  out.offsetX = Math.max(-marginX, Math.min(marginX, out.offsetX));
  out.offsetY = Math.max(-marginY, Math.min(marginY, out.offsetY));

  return out;
}
