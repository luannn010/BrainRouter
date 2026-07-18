// brainrouter-desktop/src/lib/design/designSelection.ts
// One selection model spanning both kinds of thing on the design canvas:
// screens (prototype frames in world space) and annotations (shapes drawn
// inside a screen). The context menu acts on this, so it never has to ask
// which of two selection states is the live one.
import type { ViewBounds } from './canvasViewport.js';

export type SelectionKind = 'screen' | 'annotation';

export interface SelectionRef {
  kind: SelectionKind;
  id: string;
}

export type Selection = readonly SelectionRef[];

export interface SelectableItem extends SelectionRef {
  bounds: ViewBounds;
}

export function sameRef(a: SelectionRef, b: SelectionRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function isSelected(selection: Selection, kind: SelectionKind, id: string): boolean {
  return selection.some((ref) => ref.kind === kind && ref.id === id);
}

/** Shift-click semantics: in the set, remove it; out of it, append it. */
export function toggleSelection(selection: Selection, ref: SelectionRef): Selection {
  return isSelected(selection, ref.kind, ref.id)
    ? selection.filter((item) => !sameRef(item, ref))
    : [...selection, { kind: ref.kind, id: ref.id }];
}

export function selectOnly(ref: SelectionRef | null): Selection {
  return ref ? [{ kind: ref.kind, id: ref.id }] : [];
}

export function idsOfKind(selection: Selection, kind: SelectionKind): string[] {
  return selection.filter((ref) => ref.kind === kind).map((ref) => ref.id);
}

export function rectsIntersect(a: ViewBounds, b: ViewBounds): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/** Rubber-band selection: touching counts, matching how Figma's marquee reads. */
export function marqueeSelect(items: readonly SelectableItem[], marquee: ViewBounds): Selection {
  return items.filter((item) => rectsIntersect(item.bounds, marquee)).map((item) => ({ kind: item.kind, id: item.id }));
}

/** Union of the selected items' boxes, or null when nothing selected resolves. */
export function selectionBounds(items: readonly SelectableItem[], selection: Selection): ViewBounds | null {
  const chosen = items.filter((item) => isSelected(selection, item.kind, item.id));
  if (chosen.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of chosen) {
    minX = Math.min(minX, item.bounds.x);
    minY = Math.min(minY, item.bounds.y);
    maxX = Math.max(maxX, item.bounds.x + item.bounds.w);
    maxY = Math.max(maxY, item.bounds.y + item.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
