// brainrouter-desktop/src/lib/design/designComponents.ts
// Reusable components: a selection promoted into a snippet, or a snippet
// generated from a prompt. They persist in the CanvasDocument, so a component
// captured on one board is still there next session.
import type { CanvasComponent } from './canvasModel.js';
import { boundsOf, type DesignAnnotation } from './designAnnotations.js';
import { outlinePathFor, translatePath } from './designOutline.js';

let counter = 0;
function nextId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `component-${Date.now()}-${counter += 1}`;
}

/** Captured labels are author-controlled but end up inside an SVG document. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serialise a selection into a standalone SVG. Shapes contribute their outline
 * geometry, text contributes its words — so the component renders on its own
 * anywhere, with no dependency on the board it came from.
 */
export function componentFromSelection(name: string, annotations: readonly DesignAnnotation[]): CanvasComponent {
  const bounds = boundsOf(annotations);
  if (!bounds) throw new Error('a component needs at least one annotation');
  const width = Math.max(1, bounds.w);
  const height = Math.max(1, bounds.h);
  const body = annotations.map((annotation) => {
    const dx = annotation.x - bounds.x;
    const dy = annotation.y - bounds.y;
    if (annotation.kind === 'text') {
      return `<text x="${dx}" y="${dy + annotation.h * 0.75}" font-size="${Math.max(8, Math.round(annotation.h * 0.72))}" fill="currentColor">${escapeXml(annotation.label)}</text>`;
    }
    const d = translatePath(outlinePathFor(annotation), dx, dy);
    return `<path d="${escapeXml(d)}" fill="none" stroke="currentColor" stroke-width="2" />`;
  }).join('');
  return {
    id: nextId(),
    name,
    width,
    height,
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`,
  };
}

/** Wrap generated markup as a component. Sizes are floored at 1 because the
 *  document validator rejects a zero-sized component. */
export function componentFromHtml(name: string, html: string, size: { w: number; h: number }): CanvasComponent {
  if (!html.trim()) throw new Error('a component needs html');
  return {
    id: nextId(),
    name,
    html,
    width: Math.max(1, Math.round(size.w)),
    height: Math.max(1, Math.round(size.h)),
  };
}

/** "Card", then "Card 2", "Card 3" — the first name not already taken. */
export function uniqueComponentName(list: readonly CanvasComponent[], base: string): string {
  const taken = new Set(list.map((component) => component.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function addComponent(list: readonly CanvasComponent[], component: CanvasComponent): CanvasComponent[] {
  const at = list.findIndex((item) => item.id === component.id);
  if (at < 0) return [...list, component];
  return list.map((item, index) => index === at ? component : item);
}
