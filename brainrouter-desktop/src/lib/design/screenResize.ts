// brainrouter-desktop/src/lib/design/screenResize.ts
// Resize math for a screen on the design canvas. Pure, so the fiddly parts —
// which edges move, which stay pinned, how snapping and the minimum interact —
// are testable without a pointer.
import { snapTo } from './canvasViewport.js';

/** Clockwise from the top-left, matching the order the handles are rendered. */
export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type ResizeHandle = typeof RESIZE_HANDLES[number];

/** Small enough to be useful, large enough to still grab afterwards. */
export const MIN_SCREEN = 64;

export interface ResizeRect { x: number; y: number; w: number; h: number }

export function isResizeHandle(value: string): value is ResizeHandle {
  return (RESIZE_HANDLES as readonly string[]).includes(value);
}

/**
 * Apply a drag of (dx, dy) in WORLD px to one handle of `start`.
 *
 * A handle moves only the edges it names: the opposite edges stay exactly where
 * they were, including when the drag is clamped at the minimum — otherwise a
 * screen squashed from its top-left would crawl across the canvas.
 */
export function resizeRect(start: ResizeRect, handle: ResizeHandle, dx: number, dy: number, opts: { grid: number; min: number }): ResizeRect {
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const grid = opts.grid;
  const min = Math.max(1, opts.min);

  let { x, y, w, h } = start;

  // Only a real drag moves an edge. Snapping an untouched edge would resize a
  // screen the moment its handle was clicked, which reads as the canvas
  // twitching on its own.
  if (dx !== 0) {
    if (handle.includes('w')) {
      // Snap the edge being dragged, not the delta, so it lands on the grid.
      const nextX = Math.min(snapTo(start.x + dx, grid), right - min);
      x = nextX;
      w = right - nextX;
    } else if (handle.includes('e')) {
      const nextRight = Math.max(snapTo(right + dx, grid), start.x + min);
      w = nextRight - start.x;
    }
  }

  if (dy !== 0) {
    if (handle.includes('n')) {
      const nextY = Math.min(snapTo(start.y + dy, grid), bottom - min);
      y = nextY;
      h = bottom - nextY;
    } else if (handle.includes('s')) {
      const nextBottom = Math.max(snapTo(bottom + dy, grid), start.y + min);
      h = nextBottom - start.y;
    }
  }

  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
