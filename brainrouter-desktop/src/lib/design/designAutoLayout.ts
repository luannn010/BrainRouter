// brainrouter-desktop/src/lib/design/designAutoLayout.ts
// Auto layout for a container: members are placed in list order along the main
// axis and the container hugs them. Pure geometry — every number derives from
// the inputs, so the same container always lays out the same way.
import type { CanvasAutoLayout } from './canvasModel.js';
import { membersOf, type DesignAnnotation, type StageRect } from './designAnnotations.js';

export const DEFAULT_AUTO_LAYOUT: CanvasAutoLayout = { direction: 'row', gap: 12, padX: 16, padY: 16, align: 'start' };

export interface AutoLayoutResult {
  frame: StageRect;
  members: StageRect[];
}

/**
 * Place `members` inside `frame` and resize the frame to hug them. The frame's
 * ORIGIN is preserved — auto layout moves children, not the container, so
 * applying it never makes the thing you clicked jump across the canvas.
 */
export function applyAutoLayout(frame: StageRect, members: readonly StageRect[], layout: CanvasAutoLayout): AutoLayoutResult {
  const row = layout.direction === 'row';
  // Cross-axis extent of the widest/tallest member — the band members align in.
  const band = members.reduce((max, member) => Math.max(max, row ? member.h : member.w), 0);
  const originX = frame.x + layout.padX;
  const originY = frame.y + layout.padY;

  let cursor = 0;
  const placed = members.map((member) => {
    const main = cursor;
    cursor += (row ? member.w : member.h) + layout.gap;
    const size = row ? member.h : member.w;
    const slack = band - size;
    const cross = layout.align === 'center' ? slack / 2 : layout.align === 'end' ? slack : 0;
    return row
      ? { ...member, x: originX + main, y: originY + cross }
      : { ...member, x: originX + cross, y: originY + main };
  });

  // cursor overshoots by one gap once anything was placed.
  const run = members.length === 0 ? 0 : cursor - layout.gap;
  return {
    frame: {
      ...frame,
      w: layout.padX * 2 + (row ? run : band),
      h: layout.padY * 2 + (row ? band : run),
    },
    members: placed,
  };
}

/**
 * Apply a container's stored auto layout to the annotations that belong to it.
 * A container without a layout, or an id that resolves to nothing, is a no-op —
 * callers can run this unconditionally after any edit.
 */
export function autoLayoutAnnotations(list: readonly DesignAnnotation[], containerId: string): DesignAnnotation[] {
  const container = list.find((a) => a.id === containerId);
  if (!container?.autoLayout) return [...list];
  const members = membersOf(list, containerId);
  if (members.length === 0) return [...list];
  const result = applyAutoLayout(container, members, container.autoLayout);
  const placed = new Map(members.map((member, index) => [member.id, result.members[index]]));
  return list.map((a) => {
    if (a.id === containerId) return { ...a, w: result.frame.w, h: result.frame.h };
    const box = placed.get(a.id);
    return box ? { ...a, x: box.x, y: box.y } : a;
  });
}
