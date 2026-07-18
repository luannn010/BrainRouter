// What an inspector field shows for a selection, and how dragging on one
// changes it. Both are pure so they can be tested without a DOM — the panel
// itself is .tsx and unreachable by the test runner.

/**
 * Shown when a multi-selection disagrees. Naming the disagreement beats showing
 * the first member's value as if it spoke for the rest: the user edits what
 * they see, and would overwrite the others blind.
 */
export const MIXED = 'Mixed';

/** The value every member shares, `MIXED` when they disagree, `''` when empty. */
export function sharedValue(values: readonly string[]): string {
  if (values.length === 0) return '';
  const first = values[0];
  return values.every((value) => value === first) ? first : MIXED;
}

/**
 * Whether a field's text is a real value to write back. `MIXED` is a label, not
 * a number — committing it would put NaN into every selected shape.
 */
export function isCommittable(value: string): boolean {
  return value.trim().length > 0 && value !== MIXED;
}

/**
 * How far the pointer must travel across a numeric field before the press
 * counts as a scrub rather than a click that focuses it for typing. 2px,
 * matching OpenPencil's NumberFieldRoot.
 */
export const SCRUB_THRESHOLD = 2;

/**
 * The value after dragging `dx` screen pixels from where the scrub began.
 * Rounded to whole steps: half a pixel of travel must not leave 0.5 in a field
 * that measures pixels.
 */
export function scrubbedValue(start: number, dx: number, step: number, sensitivity: number): number {
  return start + Math.round(dx * sensitivity) * step;
}
