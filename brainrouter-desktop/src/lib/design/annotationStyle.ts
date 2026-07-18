// brainrouter-desktop/src/lib/design/annotationStyle.ts
// Appearance for canvas annotations — the properties OpenPencil's Design tab
// exposes for a drawn shape: fill, stroke, corner radius, opacity, and type
// size/weight for text. Pure, so the clamping and the colour guard are testable.
import type { AnnotationKind, DesignAnnotation } from './designAnnotations.js';

export const ANNOTATION_STYLE_FIELDS = ['fill', 'stroke', 'strokeWidth', 'radius', 'opacity', 'fontSize', 'fontWeight'] as const;
export type StyleField = typeof ANNOTATION_STYLE_FIELDS[number];

export function isStyleField(value: string): value is StyleField {
  return (ANNOTATION_STYLE_FIELDS as readonly string[]).includes(value);
}

export interface AnnotationStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  /** Percentage, 0–100 — the unit the panel shows. */
  opacity: number;
  fontSize: number;
  fontWeight: number;
}

export const DEFAULT_STYLE: AnnotationStyle = {
  fill: 'rgba(52, 194, 142, 0.14)',
  stroke: '#34C28E',
  strokeWidth: 2,
  radius: 4,
  opacity: 100,
  fontSize: 14,
  fontWeight: 500,
};

/** Containers and strokes-only kinds start unfilled, as they do in Figma. */
const UNFILLED: ReadonlySet<AnnotationKind> = new Set<AnnotationKind>(['frame', 'section', 'line', 'text', 'component']);

export function defaultStyleFor(kind: AnnotationKind): AnnotationStyle {
  return UNFILLED.has(kind) ? { ...DEFAULT_STYLE, fill: 'transparent' } : { ...DEFAULT_STYLE };
}

/**
 * Colours land in an inline style, so they are allowlisted rather than escaped:
 * hex, rgb/rgba, hsl/hsla, or a bare keyword. Anything carrying a semicolon,
 * a url(), or a function we did not name is refused — a style attribute is a
 * place where "close enough" becomes a way to inject CSS.
 */
const COLOR = /^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\(\s*[\d.,%\s/]+\)|[a-z]{3,20})$/i;

export function sanitizeColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  return COLOR.test(trimmed) ? trimmed : null;
}

const RANGES: Record<Exclude<StyleField, 'fill' | 'stroke'>, { min: number; max: number }> = {
  strokeWidth: { min: 0, max: 100 },
  radius: { min: 0, max: 999 },
  opacity: { min: 0, max: 100 },
  fontSize: { min: 1, max: 400 },
  fontWeight: { min: 100, max: 900 },
};

/** The stored value for one field, or the kind's default when unset. */
export function styleValue(annotation: DesignAnnotation, field: StyleField): string | number {
  const stored = annotation[field];
  if (stored !== undefined && stored !== null) return stored as string | number;
  return defaultStyleFor(annotation.kind)[field];
}

/** Patch one field across the chosen annotations. A refused value is a no-op. */
export function setAnnotationStyle(
  list: readonly DesignAnnotation[],
  ids: readonly string[],
  field: StyleField,
  value: string | number,
): DesignAnnotation[] {
  const chosen = new Set(ids);
  let next: string | number;
  if (field === 'fill' || field === 'stroke') {
    const color = sanitizeColor(String(value));
    if (!color) return [...list];
    next = color;
  } else {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return [...list];
    const range = RANGES[field];
    next = Math.min(range.max, Math.max(range.min, Math.round(numeric)));
  }
  return list.map((a) => chosen.has(a.id) ? { ...a, [field]: next } : a);
}

/** Plain style object for the overlay. Kept framework-free so this stays pure. */
export function cssForAnnotation(annotation: DesignAnnotation): Record<string, string | number | undefined> {
  const defaults = defaultStyleFor(annotation.kind);
  const color = (field: 'fill' | 'stroke'): string => {
    const raw = annotation[field];
    return (raw !== undefined && sanitizeColor(String(raw))) || defaults[field];
  };
  const num = (field: 'strokeWidth' | 'radius' | 'opacity' | 'fontSize' | 'fontWeight'): number => {
    const raw = annotation[field];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : defaults[field];
  };

  const css: Record<string, string | number | undefined> = { opacity: num('opacity') / 100 };

  if (annotation.kind === 'text') {
    // For type, the fill IS the ink — there is no box to paint.
    css.color = color('fill');
    css.fontSize = `${num('fontSize')}px`;
    css.fontWeight = num('fontWeight');
    return css;
  }

  // Shapes drawn as SVG carry their paint on the <svg> children, not the box.
  // A component paints itself — a box behind it would just cover its markup.
  if (annotation.kind === 'line' || annotation.kind === 'ellipse' || annotation.kind === 'polygon' || annotation.kind === 'star' || annotation.kind === 'path' || annotation.kind === 'component') {
    return css;
  }

  css.background = color('fill');
  css.borderColor = color('stroke');
  css.borderWidth = `${num('strokeWidth')}px`;
  css.borderStyle = 'solid';
  css.borderRadius = `${num('radius')}px`;
  return css;
}

/** Paint for the SVG-rendered kinds, where fill/stroke are attributes. */
export function svgPaintFor(annotation: DesignAnnotation): { fill: string; stroke: string; strokeWidth: number } {
  const defaults = defaultStyleFor(annotation.kind);
  const pick = (field: 'fill' | 'stroke'): string => {
    const raw = annotation[field];
    return (raw !== undefined && sanitizeColor(String(raw))) || defaults[field];
  };
  const width = annotation.strokeWidth;
  return {
    fill: annotation.kind === 'line' ? 'none' : pick('fill'),
    stroke: pick('stroke'),
    strokeWidth: typeof width === 'number' && Number.isFinite(width) ? width : defaults.strokeWidth,
  };
}
