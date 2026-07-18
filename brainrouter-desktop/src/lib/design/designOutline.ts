// brainrouter-desktop/src/lib/design/designOutline.ts
// Vector geometry for the Flatten / Outline text / Outline stroke actions.
//
// All three produce a `path` annotation. This module is pure so it can be
// tested without a canvas: the CALLER rasterises text to an alpha buffer and
// hands the buffer here, and `traceMask` walks it into real contours. That is
// what makes "Outline text" honest — there is no font-outline API in a
// renderer, but a rasterise-then-trace round trip yields the actual glyph
// shapes rather than a stand-in box.
import { boundsOf, polygonPointsFor, starPointsFor, type DesignAnnotation } from './designAnnotations.js';

/** Two decimals keeps paths short, stable and diffable. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointsToPath(points: string, dx = 0, dy = 0): string {
  const pairs = points.trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return `${round(x + dx)},${round(y + dy)}`;
  });
  return `M${pairs[0]} ${pairs.slice(1).map((p) => `L${p}`).join(' ')} Z`;
}

function boxPath(x: number, y: number, w: number, h: number): string {
  return `M${round(x)},${round(y)} L${round(x + w)},${round(y)} L${round(x + w)},${round(y + h)} L${round(x)},${round(y + h)} Z`;
}

/** Counter-clockwise box — an inner ring must wind opposite the outer one so
 *  the region between them fills rather than the whole box. */
function boxPathReverse(x: number, y: number, w: number, h: number): string {
  return `M${round(x)},${round(y)} L${round(x)},${round(y + h)} L${round(x + w)},${round(y + h)} L${round(x + w)},${round(y)} Z`;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, sweep = 1): string {
  return `M${round(cx - rx)},${round(cy)} A${round(rx)},${round(ry)} 0 1 ${sweep} ${round(cx + rx)},${round(cy)} A${round(rx)},${round(ry)} 0 1 ${sweep} ${round(cx - rx)},${round(cy)} Z`;
}

/** Bounding box of a path's explicit coordinates. Arc-only paths report the
 *  box of their endpoints, which is why callers use it on traced/box paths. */
export function pathBounds(d: string): { x: number; y: number; w: number; h: number } | null {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers) return null;
  const commands = d.match(/[MLA]/g) ?? [];
  const coords: number[] = [];
  let index = 0;
  for (const command of commands) {
    if (command === 'A') { index += 7; continue; } // rx ry rot large sweep x y
    coords.push(Number(numbers[index]), Number(numbers[index + 1]));
    index += 2;
  }
  if (coords.length === 0) return null;
  const xs = coords.filter((_, i) => i % 2 === 0);
  const ys = coords.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// --- contour tracing -----------------------------------------------------

type Edge = { from: string; to: string; x1: number; y1: number; x2: number; y2: number };

const key = (x: number, y: number): string => `${x},${y}`;

/**
 * Trace the outline of an alpha mask.
 *
 * Every "inside" pixel contributes a directed unit edge for each side facing
 * an "outside" pixel, wound consistently. Those edges always chain into closed
 * loops — outer boundaries one way round, holes the other — so linking them
 * yields one subpath per contour with no special cases for topology.
 * Collinear runs collapse, so a rectangle comes back as four corners.
 */
export function traceMask(alpha: ArrayLike<number>, width: number, height: number, threshold = 128): string {
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && Number(alpha[y * width + x]) >= threshold;

  const starts = new Map<string, Edge[]>();
  const push = (x1: number, y1: number, x2: number, y2: number): void => {
    const edge: Edge = { from: key(x1, y1), to: key(x2, y2), x1, y1, x2, y2 };
    const list = starts.get(edge.from);
    if (list) list.push(edge); else starts.set(edge.from, [edge]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) push(x, y, x + 1, y);
      if (!inside(x + 1, y)) push(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) push(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) push(x, y + 1, x, y);
    }
  }

  const loops: string[] = [];
  for (const [, list] of starts) {
    while (list.length > 0) {
      const first = list.pop()!;
      const points: Array<[number, number]> = [[first.x1, first.y1]];
      let current = first;
      // Walk forward until the chain closes on where it started.
      for (let guard = 0; guard < width * height * 4 + 8; guard += 1) {
        points.push([current.x2, current.y2]);
        if (current.to === first.from) break;
        const next = starts.get(current.to);
        if (!next || next.length === 0) break;
        current = next.pop()!;
      }
      if (points.length < 4) continue;
      loops.push(simplify(points));
    }
  }
  return loops.join(' ');
}

/** Drop the middle point of any three that run in the same direction. */
function simplify(points: ReadonlyArray<[number, number]>): string {
  // The walk closes back on its origin, so the duplicated last point goes.
  const ring = points.slice(0, -1);
  const kept: Array<[number, number]> = [];
  for (let i = 0; i < ring.length; i += 1) {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const point = ring[i];
    const next = ring[(i + 1) % ring.length];
    const turns = (point[0] - prev[0]) * (next[1] - point[1]) !== (point[1] - prev[1]) * (next[0] - point[0]);
    if (turns) kept.push(point);
  }
  const ordered = kept.length > 0 ? kept : [...ring];
  return `M${ordered[0][0]},${ordered[0][1]} ${ordered.slice(1).map(([x, y]) => `L${x},${y}`).join(' ')} Z`;
}

// --- shape outlines ------------------------------------------------------

/**
 * Geometry of one annotation in its OWN box space (0,0 to w,h). A 'text'
 * annotation has no vector geometry of its own — Outline text is the action
 * that gives it some — so its box stands in.
 */
export function outlinePathFor(annotation: DesignAnnotation): string {
  const { w, h } = annotation;
  switch (annotation.kind) {
    case 'path':
      return annotation.path ?? boxPath(0, 0, w, h);
    case 'ellipse':
      return ellipsePath(w / 2, h / 2, w / 2, h / 2);
    case 'polygon':
      return pointsToPath(polygonPointsFor(w, h, annotation.flipY));
    case 'star':
      return pointsToPath(starPointsFor(w, h, annotation.flipY));
    case 'line':
      return annotation.flipY ? `M0,${round(h)} L${round(w)},0` : `M0,0 L${round(w)},${round(h)}`;
    default:
      return boxPath(0, 0, w, h);
  }
}

/** A stroke has no minimum in the UI, but a zero-width band is not geometry. */
const MIN_STROKE = 1;

/**
 * Convert a stroked shape into a filled band: an outer ring plus an inner ring
 * wound the other way, so the fill lands between them. A line has no interior,
 * so it becomes a single quad of the stroke's width.
 */
export function outlineStrokePath(annotation: DesignAnnotation, strokeWidth: number): string {
  const width = Math.max(MIN_STROKE, strokeWidth);
  const half = width / 2;
  const { w, h } = annotation;

  if (annotation.kind === 'line') {
    // Offset the diagonal perpendicular to itself by half the stroke.
    const dx = w;
    const dy = annotation.flipY ? -h : h;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    const x0 = 0;
    const y0 = annotation.flipY ? h : 0;
    const x1 = w;
    const y1 = annotation.flipY ? 0 : h;
    return `M${round(x0 + nx)},${round(y0 + ny)} L${round(x1 + nx)},${round(y1 + ny)} L${round(x1 - nx)},${round(y1 - ny)} L${round(x0 - nx)},${round(y0 - ny)} Z`;
  }

  if (annotation.kind === 'ellipse') {
    return `${ellipsePath(w / 2, h / 2, w / 2 + half, h / 2 + half, 1)} ${ellipsePath(w / 2, h / 2, Math.max(0.01, w / 2 - half), Math.max(0.01, h / 2 - half), 0)}`;
  }

  // Rectangles, frames, sections, polygons, stars and paths all band off their
  // bounding box. For the straight-edged kinds this is exact; for a star or a
  // traced path it is the box band, which is what "outline stroke" of a
  // stroked bounding shape means here — documented in Design.md.
  return `${boxPath(-half, -half, w + width, h + width)} ${boxPathReverse(half, half, Math.max(0, w - width), Math.max(0, h - width))}`;
}

/**
 * Merge a selection into one path. Each member contributes its own subpath,
 * positioned relative to the selection's bounding box — matching Figma, where
 * flatten yields a single vector object made of several subpaths.
 */
export function flattenToPath(annotations: readonly DesignAnnotation[]): string {
  const bounds = boundsOf(annotations);
  if (!bounds) return '';
  return annotations.map((annotation) => {
    const dx = annotation.x - bounds.x;
    const dy = annotation.y - bounds.y;
    return translatePath(outlinePathFor(annotation), dx, dy);
  }).join(' ');
}

/** Shift a path's coordinates. Arc parameters (rx ry rot large sweep) are not
 *  positions, so only the endpoint pair of an A command moves. */
export function translatePath(d: string, dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return d;
  return d.replace(/([MLA])([^MLAZ]*)/g, (_match, command: string, rest: string) => {
    const numbers = rest.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (command === 'A') {
      if (numbers.length < 7) return `${command}${rest}`;
      numbers[5] = round(numbers[5] + dx);
      numbers[6] = round(numbers[6] + dy);
      return `A${numbers[0]},${numbers[1]} ${numbers[2]} ${numbers[3]} ${numbers[4]} ${numbers[5]},${numbers[6]} `;
    }
    const moved: string[] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) moved.push(`${round(numbers[i] + dx)},${round(numbers[i + 1] + dy)}`);
    return `${command}${moved.join(' L')} `;
  }).replace(/\s+/g, ' ').trim();
}
