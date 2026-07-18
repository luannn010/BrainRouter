// brainrouter-desktop/src/lib/design/designConstraints.ts
// Figma constraints describe how a layer reacts when its parent resizes. The DOM
// equivalent is which insets are pinned and which are released: pin one edge and
// the layer rides it, pin both and it stretches, use percentages and it scales.
// Only an out-of-flow element (absolute/fixed) obeys insets, so the inspector
// shows the picker as advisory for anything still in normal flow.

import type { CssDeclaration } from './designProperties.js';

export type HorizontalConstraint = 'left' | 'right' | 'left-right' | 'center' | 'scale';
export type VerticalConstraint = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';

export const HORIZONTAL_CONSTRAINTS: readonly { value: HorizontalConstraint; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'left-right', label: 'Left and right' },
  { value: 'center', label: 'Center' },
  { value: 'scale', label: 'Scale' },
];

export const VERTICAL_CONSTRAINTS: readonly { value: VerticalConstraint; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'top-bottom', label: 'Top and bottom' },
  { value: 'center', label: 'Center' },
  { value: 'scale', label: 'Scale' },
];

/** The layer's measured insets and size within its offset parent, in px. */
export type ConstraintBox = { offsetLeft: number; offsetTop: number; offsetRight: number; offsetBottom: number; width: number; height: number };

export function constraintsApply(position: string): boolean {
  return position === 'absolute' || position === 'fixed';
}

/** Trims float noise without dropping sub-pixel precision that matters at 4dp. */
function percent(part: number, whole: number): string {
  return `${Number((part / whole * 100).toFixed(4))}%`;
}

export function constraintDeclarations(axis: 'h' | 'v', value: string, box: ConstraintBox): CssDeclaration[] {
  const startProperty = axis === 'h' ? 'left' : 'top';
  const endProperty = axis === 'h' ? 'right' : 'bottom';
  const sizeProperty = axis === 'h' ? 'width' : 'height';
  const marginProperty = axis === 'h' ? 'margin-left' : 'margin-top';
  const start = axis === 'h' ? box.offsetLeft : box.offsetTop;
  const end = axis === 'h' ? box.offsetRight : box.offsetBottom;
  const size = axis === 'h' ? box.width : box.height;
  const parent = start + size + end;

  const startKeyword = axis === 'h' ? 'left' : 'top';
  const endKeyword = axis === 'h' ? 'right' : 'bottom';
  const stretchKeyword = axis === 'h' ? 'left-right' : 'top-bottom';

  if (value === startKeyword) return [[startProperty, `${start}px`], [endProperty, 'auto']];
  if (value === endKeyword) return [[startProperty, 'auto'], [endProperty, `${end}px`]];
  if (value === stretchKeyword) return [[startProperty, `${start}px`], [endProperty, `${end}px`], [sizeProperty, 'auto']];
  if (value === 'center') return [[startProperty, '50%'], [endProperty, 'auto'], [marginProperty, `${-Math.round(size / 2)}px`]];
  if (value === 'scale') {
    if (parent <= 0) return [];
    return [[startProperty, percent(start, parent)], [endProperty, 'auto'], [sizeProperty, percent(size, parent)]];
  }
  return [];
}
