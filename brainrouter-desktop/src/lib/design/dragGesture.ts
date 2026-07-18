// Pointer deltas, in SCREEN pixels, before the view scale divides them into
// world units. Threshold and axis-lock both belong here rather than in the
// pointer handler so they can be tested without a DOM.

/**
 * How far the pointer must travel before a press becomes a drag. Below this a
 * press is a click: without it, the drift in an ordinary trackpad click nudged
 * the screen and persisted the nudge on release.
 *
 * 3px matches OpenPencil's MOVE_DRAG_START_THRESHOLD_PX.
 */
export const DRAG_THRESHOLD = 3;

/**
 * Radial, not per-axis — a diagonal drift of 2.5,2.5 is further than 3px even
 * though neither axis is. Compared squared, as OpenPencil does, so exactly
 * threshold counts as a drag and no square root is taken per pointermove.
 */
export function passedThreshold(dx: number, dy: number): boolean {
  return dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD;
}

/**
 * Shift constrains a drag to one axis. This goes BEYOND the OpenPencil
 * reference, which uses shift for constrain-proportions on resize and rotation
 * snapping but has no axis lock on move — lining a screen up horizontally
 * without drifting vertically is worth the divergence.
 *
 * The dominant axis wins; a tie resolves to horizontal so the result is always
 * axis-aligned rather than silently falling back to free movement.
 */
export function constrainDelta(dx: number, dy: number, lock: boolean): { dx: number; dy: number } {
  if (!lock) return { dx, dy };
  return Math.abs(dy) > Math.abs(dx) ? { dx: 0, dy } : { dx, dy: 0 };
}
