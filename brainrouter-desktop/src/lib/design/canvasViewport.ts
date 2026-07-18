// brainrouter-desktop/src/lib/design/canvasViewport.ts
// Pan/zoom math shared by the Canvas tab and the Designs stage, so a gesture
// means the same thing on both surfaces. Pure: no DOM, no React.
//
// A Viewport maps world space to screen space as `screen = world * scale + (x, y)`.
// `x`/`y` are the screen-space position of the world origin — exactly what the
// world layer's `translate(x, y) scale(scale)` renders, in that order.

export interface Viewport {
  /** Screen px per world px. */
  scale: number;
  /** Screen-space x of the world origin. */
  x: number;
  /** Screen-space y of the world origin. */
  y: number;
}

export interface ViewPoint { x: number; y: number }
export interface ViewBounds { x: number; y: number; w: number; h: number }

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

/** One wheel notch. Matches the Canvas tab's long-standing feel. */
const ZOOM_STEP = 1.1;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Zoom about a screen-space anchor, keeping the world point under that anchor
 * fixed. Returns the input object when the scale is already at a limit, so a
 * caller can skip the re-render.
 */
export function zoomAt(view: Viewport, factor: number, cx: number, cy: number): Viewport {
  const scale = clampScale(view.scale * factor);
  if (scale === view.scale) return view;
  const ratio = scale / view.scale;
  return { scale, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio };
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { scale: view.scale, x: view.x + dx, y: view.y + dy };
}

export function screenToWorld(view: Viewport, cx: number, cy: number): ViewPoint {
  return { x: (cx - view.x) / view.scale, y: (cy - view.y) / view.scale };
}

export function worldToScreen(view: Viewport, wx: number, wy: number): ViewPoint {
  return { x: wx * view.scale + view.x, y: wy * view.scale + view.y };
}

/**
 * Frame `bounds` inside a viewW x viewH viewport. Never magnifies past 1:1 — a
 * single small screen should sit at natural size rather than filling the wall.
 */
export function fitBounds(bounds: ViewBounds, viewW: number, viewH: number, padding = 48): Viewport {
  const w = Math.max(1, bounds.w);
  const h = Math.max(1, bounds.h);
  const availW = Math.max(1, viewW - padding * 2);
  const availH = Math.max(1, viewH - padding * 2);
  const scale = clampScale(Math.min(availW / w, availH / h, 1));
  return {
    scale,
    x: (viewW - w * scale) / 2 - bounds.x * scale,
    y: (viewH - h * scale) / 2 - bounds.y * scale,
  };
}

export type WheelGesture =
  | { kind: 'zoom'; factor: number }
  | { kind: 'pan'; dx: number; dy: number };

/**
 * Interpret a wheel event. Ctrl/Cmd + wheel zooms (a trackpad pinch reports
 * itself the same way); plain wheel pans; Shift + wheel pans sideways off
 * deltaY, which is how a mouse without a horizontal wheel scrolls across.
 */
export function wheelGesture(e: { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): WheelGesture {
  if (e.ctrlKey || e.metaKey) return { kind: 'zoom', factor: e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP };
  if (e.shiftKey) return { kind: 'pan', dx: -e.deltaY, dy: 0 };
  return { kind: 'pan', dx: -e.deltaX, dy: -e.deltaY };
}

/** Round to the grid. A grid of 0 or 1 means "no snapping". */
export function snapTo(value: number, grid: number): number {
  if (!Number.isFinite(grid) || grid <= 1) return value;
  return Math.round(value / grid) * grid;
}
