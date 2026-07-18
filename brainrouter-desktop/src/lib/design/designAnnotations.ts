// brainrouter-desktop/src/lib/design/designAnnotations.ts
// The Frame/Shape/Text tools draw a host-DOM annotation layer ABOVE the
// prototype preview — redlines, never edits to the prototype's HTML. All
// coordinates are stage-base px (the unscaled .ds-stage space); the layer is
// rendered inside the zoom-scaled stage, so annotations track zoom for free
// and only pointer input needs unscaling (clientToStagePoint).

import type { CanvasAutoLayout } from './canvasModel.js';

/** 'frame'/'section' are labeled regions; 'path' is baked vector geometry
 *  produced by Flatten / Outline text / Outline stroke; the rest are drawn
 *  shapes and text. */
export type AnnotationKind = 'frame' | 'section' | 'rectangle' | 'line' | 'ellipse' | 'polygon' | 'star' | 'text' | 'path';

export interface StagePoint { x: number; y: number }
export interface StageRect { x: number; y: number; w: number; h: number }

export interface DesignAnnotation extends StageRect {
  id: string;
  kind: AnnotationKind;
  /** Frame/Section name chip ("Frame 1") or the text annotation's content. */
  label: string;
  /** Flip flags — visual for line/polygon/star; recorded for every kind. */
  flipX?: boolean;
  flipY?: boolean;
  hidden?: boolean;
  locked?: boolean;
  /** Group or frame this annotation belongs to. */
  groupId?: string;
  /** This annotation clips its siblings in the same group. */
  mask?: boolean;
  /** SVG path data in the annotation's own box space — set for kind 'path'. */
  path?: string;
  /** Set on a container to lay its members out automatically. */
  autoLayout?: CanvasAutoLayout;
  /** The component this layer was packed into, if any. Components live in the
   *  canvas document while annotations live per-prototype, so this can dangle
   *  if the component is deleted — readers treat a missing id as unpacked. */
  componentId?: string;
  // --- appearance (see annotationStyle.ts) — unset means "the kind's default" ---
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  /** Percentage, 0–100. */
  opacity?: number;
  fontSize?: number;
  fontWeight?: number;
}

/** Drags smaller than this are treated as clicks, not draws. */
export const MIN_DRAG_PX = 4;
export const DEFAULT_TEXT_SIZE = { w: 160, h: 24 };
/** Offset applied to duplicates and keyboard pastes so copies don't stack. */
export const DUPLICATE_OFFSET = 12;
/** Breathing room a "Frame selection" container leaves around its members. */
export const FRAME_PADDING = 24;

export function normalizeRect(a: StagePoint, b: StagePoint): StageRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/**
 * Shift-drag while drawing: a square, or a circle for an ellipse. The larger
 * axis wins so the shape follows the pointer rather than shrinking under it,
 * and the corner opposite the anchor is the one that moves — dragging up and
 * left from the anchor still grows away from it.
 */
export function constrainRect(anchor: StagePoint, point: StagePoint): StageRect {
  const size = Math.max(Math.abs(point.x - anchor.x), Math.abs(point.y - anchor.y));
  return {
    x: point.x < anchor.x ? anchor.x - size : anchor.x,
    y: point.y < anchor.y ? anchor.y - size : anchor.y,
    w: size,
    h: size,
  };
}

/** Which way the drag ran — a line drawn bottom-left→top-right must render as
 *  the rising diagonal of its normalized rect, not the falling one. */
export function dragFlip(a: StagePoint, b: StagePoint): { flipX: boolean; flipY: boolean } {
  return { flipX: b.x < a.x, flipY: b.y < a.y };
}

export function isClick(rect: StageRect): boolean {
  return rect.w < MIN_DRAG_PX && rect.h < MIN_DRAG_PX;
}

/** Map a client-space pointer position into stage-base coordinates. layerLeft/
 *  layerTop come from the SCALED layer's getBoundingClientRect, so dividing by
 *  the zoom factor lands in base space. */
export function clientToStagePoint(clientX: number, clientY: number, layerLeft: number, layerTop: number, zoom: number): StagePoint {
  const scale = zoom / 100 || 1;
  return { x: (clientX - layerLeft) / scale, y: (clientY - layerTop) / scale };
}

let idCounter = 0;
function nextId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `anno-${Date.now()}-${idCounter += 1}`;
}

export function createAnnotation(kind: AnnotationKind, rect: StageRect, opts?: { id?: string; label?: string; flipX?: boolean; flipY?: boolean }): DesignAnnotation {
  const base: DesignAnnotation = { id: opts?.id ?? nextId(), kind, label: opts?.label ?? '', x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  if (opts?.flipX) base.flipX = true;
  if (opts?.flipY) base.flipY = true;
  return base;
}

const GROUP_LABEL_PREFIX: Partial<Record<AnnotationKind, string>> = { frame: 'Frame', section: 'Section' };

/** "Frame N" / "Section N" — first number not already taken. */
export function nextGroupLabel(kind: AnnotationKind, existing: readonly DesignAnnotation[]): string {
  const prefix = GROUP_LABEL_PREFIX[kind] ?? 'Frame';
  const taken = new Set(existing.map((a) => a.label));
  let n = 1;
  while (taken.has(`${prefix} ${n}`)) n += 1;
  return `${prefix} ${n}`;
}

function rectContains(a: DesignAnnotation, p: StagePoint): boolean {
  return p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h;
}

/** Array order is z-order (last = topmost). Hidden and locked annotations are
 *  transparent to normal clicks — like Figma, a locked layer can't be grabbed. */
export function hitTest(list: readonly DesignAnnotation[], p: StagePoint): DesignAnnotation | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const a = list[i];
    if (!a.hidden && !a.locked && rectContains(a, p)) return a;
  }
  return null;
}

/** Right-click targeting: locked annotations must stay reachable so the
 *  context menu can unlock them; only hidden ones are transparent. */
export function hitTestIncludingLocked(list: readonly DesignAnnotation[], p: StagePoint): DesignAnnotation | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const a = list[i];
    if (!a.hidden && rectContains(a, p)) return a;
  }
  return null;
}

export function moveAnnotation(list: readonly DesignAnnotation[], id: string, dx: number, dy: number): DesignAnnotation[] {
  return list.map((a) => a.id === id ? { ...a, x: a.x + dx, y: a.y + dy } : a);
}

export function setAnnotationLabel(list: readonly DesignAnnotation[], id: string, label: string): DesignAnnotation[] {
  return list.map((a) => a.id === id ? { ...a, label } : a);
}

export function removeAnnotation(list: readonly DesignAnnotation[], id: string): DesignAnnotation[] {
  return list.filter((a) => a.id !== id);
}

/** A copy is a new object, not the same one — being packed into a component is
 *  a fact about the original. Carrying the link would also leak it across
 *  prototypes, since the clipboard outlives a prototype switch. */
function unpacked(a: DesignAnnotation): DesignAnnotation {
  if (a.componentId === undefined) return a;
  const { componentId, ...rest } = a;
  void componentId;
  return rest;
}

/** Copy with a small offset, appended on top. Returns the new list + id. */
export function duplicateAnnotation(list: readonly DesignAnnotation[], id: string): { list: DesignAnnotation[]; id: string | null } {
  const source = list.find((a) => a.id === id);
  if (!source) return { list: [...list], id: null };
  const copy = unpacked({ ...source, id: nextId(), x: source.x + DUPLICATE_OFFSET, y: source.y + DUPLICATE_OFFSET });
  return { list: [...list, copy], id: copy.id };
}

/** Paste a clipboard annotation centered at a stage point (context menu's
 *  "Paste here"), or offset from its origin when no point is given (Ctrl+V). */
export function pasteAnnotation(list: readonly DesignAnnotation[], clipboard: DesignAnnotation, at?: StagePoint): { list: DesignAnnotation[]; id: string } {
  const copy = unpacked(at
    ? { ...clipboard, id: nextId(), x: at.x - clipboard.w / 2, y: at.y - clipboard.h / 2 }
    : { ...clipboard, id: nextId(), x: clipboard.x + DUPLICATE_OFFSET, y: clipboard.y + DUPLICATE_OFFSET });
  return { list: [...list, copy], id: copy.id };
}

export function bringToFront(list: readonly DesignAnnotation[], id: string): DesignAnnotation[] {
  const target = list.find((a) => a.id === id);
  return target ? [...list.filter((a) => a.id !== id), target] : [...list];
}

export function sendToBack(list: readonly DesignAnnotation[], id: string): DesignAnnotation[] {
  const target = list.find((a) => a.id === id);
  return target ? [target, ...list.filter((a) => a.id !== id)] : [...list];
}

export function flipAnnotation(list: readonly DesignAnnotation[], id: string, axis: 'x' | 'y'): DesignAnnotation[] {
  const key = axis === 'x' ? 'flipX' : 'flipY';
  return list.map((a) => a.id === id ? { ...a, [key]: !a[key] } : a);
}

export function toggleAnnotationFlag(list: readonly DesignAnnotation[], id: string, flag: 'hidden' | 'locked'): DesignAnnotation[] {
  return list.map((a) => a.id === id ? { ...a, [flag]: !a[flag] } : a);
}

// --- containers: groups, frames and masks ---

/** Smallest box covering every annotation in the list. */
export function boundsOf(list: readonly DesignAnnotation[]): StageRect | null {
  if (list.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const a of list) {
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + a.w);
    maxY = Math.max(maxY, a.y + a.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function membersOf(list: readonly DesignAnnotation[], groupId: string | null): DesignAnnotation[] {
  return groupId ? list.filter((a) => a.groupId === groupId) : [];
}

/** An invisible container: members move together but nothing is drawn for it.
 *  Grouping one annotation would be meaningless, so it is a no-op. */
export function groupAnnotations(list: readonly DesignAnnotation[], ids: readonly string[]): { list: DesignAnnotation[]; groupId: string | null } {
  const chosen = new Set(ids);
  if (list.filter((a) => chosen.has(a.id)).length < 2) return { list: [...list], groupId: null };
  const groupId = nextId();
  return { list: list.map((a) => chosen.has(a.id) ? { ...a, groupId } : a), groupId };
}

export function ungroupAnnotations(list: readonly DesignAnnotation[], ids: readonly string[]): DesignAnnotation[] {
  const chosen = new Set(ids);
  return list.map((a) => {
    if (!chosen.has(a.id) || a.groupId === undefined) return a;
    const { groupId, ...rest } = a;
    void groupId;
    return rest;
  });
}

/** A visible titled container, in contrast to a group: it draws a box around
 *  the selection, adopts it, and sits BEHIND its members so it reads as
 *  something they are inside rather than something covering them. */
export function frameSelection(list: readonly DesignAnnotation[], ids: readonly string[]): { list: DesignAnnotation[]; id: string | null } {
  const chosen = new Set(ids);
  const members = list.filter((a) => chosen.has(a.id));
  const bounds = boundsOf(members);
  if (!bounds) return { list: [...list], id: null };
  const frame = createAnnotation('frame', {
    x: bounds.x - FRAME_PADDING,
    y: bounds.y - FRAME_PADDING,
    w: bounds.w + FRAME_PADDING * 2,
    h: bounds.h + FRAME_PADDING * 2,
  }, { label: nextGroupLabel('frame', list) });
  const adopted = list.map((a) => chosen.has(a.id) ? { ...a, groupId: frame.id } : a);
  const firstMember = adopted.findIndex((a) => chosen.has(a.id));
  const at = firstMember < 0 ? adopted.length : firstMember;
  return { list: [...adopted.slice(0, at), frame, ...adopted.slice(at)], id: frame.id };
}

/** Exactly one mask per group — promoting a new one demotes the old. */
export function setMask(list: readonly DesignAnnotation[], id: string): DesignAnnotation[] {
  const target = list.find((a) => a.id === id);
  if (!target) return [...list];
  return list.map((a) => {
    if (a.id === id) return { ...a, mask: true };
    if (a.groupId !== target.groupId || !a.mask) return a;
    const { mask, ...rest } = a;
    void mask;
    return rest;
  });
}

// --- SVG geometry for the drawn shapes (viewBox `0 0 w h`) ---

/** Triangle points; flipY points it downward. */
export function polygonPointsFor(w: number, h: number, flipY?: boolean): string {
  return flipY ? `0,0 ${w},0 ${w / 2},${h}` : `${w / 2},0 0,${h} ${w},${h}`;
}

/** Five-point star inscribed in the rect; flipY turns it upside down. */
export function starPointsFor(w: number, h: number, flipY?: boolean): string {
  const cx = w / 2;
  const cy = h / 2;
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5 + (flipY ? Math.PI : 0);
    const rx = (i % 2 === 0 ? 0.5 : 0.19) * w;
    const ry = (i % 2 === 0 ? 0.5 : 0.19) * h;
    points.push(`${(cx + rx * Math.cos(angle)).toFixed(2)},${(cy + ry * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(' ');
}

// --- persistence (same per-prototype keying convention as the draft store) ---

export const ANNOTATIONS_STORAGE_KEY = 'brainrouter.design-tab.annotations';

export function annotationsKey(workspaceRoot: string | undefined, protoId: string): string {
  return `${workspaceRoot ?? 'unknown'}:${protoId}`;
}

const KINDS: readonly string[] = ['frame', 'section', 'rectangle', 'line', 'ellipse', 'polygon', 'star', 'text', 'path'];
const LAYOUT_DIRECTIONS: readonly string[] = ['row', 'column'];
const LAYOUT_ALIGNS: readonly string[] = ['start', 'center', 'end'];

function parseAutoLayout(value: unknown): CanvasAutoLayout | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.direction !== 'string' || !LAYOUT_DIRECTIONS.includes(raw.direction)) return undefined;
  if (typeof raw.align !== 'string' || !LAYOUT_ALIGNS.includes(raw.align)) return undefined;
  const numbers = ['gap', 'padX', 'padY'] as const;
  if (numbers.some((key) => typeof raw[key] !== 'number' || !Number.isFinite(raw[key] as number))) return undefined;
  return {
    direction: raw.direction as CanvasAutoLayout['direction'],
    gap: raw.gap as number,
    padX: raw.padX as number,
    padY: raw.padY as number,
    align: raw.align as CanvasAutoLayout['align'],
  };
}

function parseAnnotation(value: unknown): DesignAnnotation | null {
  if (typeof value !== 'object' || value === null) return null;
  const a = value as Partial<Omit<DesignAnnotation, 'kind'>> & { kind?: string };
  const kind = a.kind === 'shape' ? 'rectangle' : a.kind; // pre-flyout stores used 'shape'
  if (typeof a.id !== 'string' || !kind || !KINDS.includes(kind)) return null;
  if (typeof a.label !== 'string') return null;
  if (typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.w !== 'number' || typeof a.h !== 'number') return null;
  // A path annotation IS its geometry; without it there is nothing to render.
  if (kind === 'path' && (typeof a.path !== 'string' || !a.path.trim())) return null;
  const parsed: DesignAnnotation = { id: a.id, kind: kind as AnnotationKind, label: a.label, x: a.x, y: a.y, w: a.w, h: a.h };
  if (a.flipX === true) parsed.flipX = true;
  if (a.flipY === true) parsed.flipY = true;
  if (a.hidden === true) parsed.hidden = true;
  if (a.locked === true) parsed.locked = true;
  if (a.mask === true) parsed.mask = true;
  if (typeof a.groupId === 'string' && a.groupId.trim()) parsed.groupId = a.groupId;
  if (typeof a.componentId === 'string' && a.componentId.trim()) parsed.componentId = a.componentId;
  // Appearance. Colours are re-checked on the way out too (cssForAnnotation),
  // so a hand-edited store cannot smuggle a value into an inline style.
  if (typeof a.fill === 'string' && a.fill.trim()) parsed.fill = a.fill;
  if (typeof a.stroke === 'string' && a.stroke.trim()) parsed.stroke = a.stroke;
  for (const field of ['strokeWidth', 'radius', 'opacity', 'fontSize', 'fontWeight'] as const) {
    const value = a[field];
    if (typeof value === 'number' && Number.isFinite(value)) parsed[field] = value;
  }
  if (typeof a.path === 'string' && a.path.trim()) parsed.path = a.path;
  const autoLayout = parseAutoLayout(a.autoLayout);
  if (autoLayout) parsed.autoLayout = autoLayout;
  return parsed;
}

/** Corrupt or missing input parses to an empty store; malformed entries drop. */
export function parseAnnotationStore(raw: string | null): Record<string, DesignAnnotation[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const store: Record<string, DesignAnnotation[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) store[key] = value.map(parseAnnotation).filter((a): a is DesignAnnotation => a !== null);
    }
    return store;
  } catch {
    return {};
  }
}

export function serializeAnnotationStore(store: Record<string, DesignAnnotation[]>): string {
  return JSON.stringify(store);
}
