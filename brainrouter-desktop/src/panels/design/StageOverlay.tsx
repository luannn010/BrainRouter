// brainrouter-desktop/src/panels/design/StageOverlay.tsx
// The annotation/mask layer above the preview surface. Three jobs: (1) capture
// pointer input for the frame/shape/text draw tools and the hand tool (the
// <webview>/<iframe> underneath swallows mouse events otherwise), (2) render
// the redline annotations, and (3) host the Figma-style right-click menu. It
// lives INSIDE the zoom-scaled .ds-stage, so annotations are stored in
// stage-base px and track zoom for free — only incoming pointer positions need
// unscaling.
import React, { useRef, useState } from 'react';
import type { DesignTool, FrameKind, ShapeKind } from '../../lib/design/designTools.js';
import {
  DEFAULT_TEXT_SIZE, boundsOf, bringToFront, clientToStagePoint, createAnnotation, dragFlip,
  duplicateAnnotation, flipAnnotation, frameSelection, groupAnnotations, hitTest,
  hitTestIncludingLocked, isClick, membersOf, nextGroupLabel, normalizeRect,
  pasteAnnotation, polygonPointsFor, removeAnnotation, sendToBack, setAnnotationLabel,
  setMask, starPointsFor, ungroupAnnotations,
  type AnnotationKind, type DesignAnnotation, type StagePoint, type StageRect,
} from '../../lib/design/designAnnotations.js';
import { cssForAnnotation, svgPaintFor } from '../../lib/design/annotationStyle.js';
import { DEFAULT_AUTO_LAYOUT, autoLayoutAnnotations } from '../../lib/design/designAutoLayout.js';
import { flattenToPath, outlinePathFor, outlineStrokePath, traceMask, translatePath } from '../../lib/design/designOutline.js';
import { DesignContextMenu, type MenuAction } from './DesignContextMenu.js';

/** Stroke width the redline shapes are drawn with — see .ds-anno in the CSS. */
const ANNOTATION_STROKE = 2;

/**
 * Rasterise a text annotation and trace its glyph contours.
 *
 * There is no font-outline API in a renderer, so the only way to get real
 * letterforms is to draw them and read the pixels back. The tracing itself is
 * pure (designOutline.traceMask); this function is the small DOM-touching part.
 * Returns null when there is no canvas or nothing to trace.
 */
function traceTextOutline(annotation: DesignAnnotation): string | null {
  const w = Math.max(1, Math.round(annotation.w));
  const h = Math.max(1, Math.round(annotation.h));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !annotation.label.trim()) return null;
  const style = getComputedStyle(document.body);
  const size = Math.max(8, Math.round(h * 0.72));
  ctx.font = `${size}px ${style.fontFamily || 'sans-serif'}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(annotation.label, 0, h / 2);
  const { data } = ctx.getImageData(0, 0, w, h);
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
  const path = traceMask(alpha, w, h);
  return path || null;
}

type Gesture =
  | { kind: 'draw'; anchor: StagePoint; draw: AnnotationKind }
  | { kind: 'move'; id: string; start: StagePoint; base: DesignAnnotation[] };

type MenuState = { x: number; y: number; point: StagePoint; targetId: string | null };

/** SVG body for the drawn shapes; frame/section/rectangle/text are CSS boxes. */
function ShapeSvg({ a }: { a: DesignAnnotation }): React.ReactElement | null {
  const w = Math.max(a.w, 1);
  const h = Math.max(a.h, 1);
  const paint = svgPaintFor(a);
  // A line drawn upward is the rising diagonal; a flip on either axis mirrors it.
  const rising = (a.flipX ?? false) !== (a.flipY ?? false);
  const common = { vectorEffect: 'non-scaling-stroke' as const };
  let body: React.ReactElement | null = null;
  if (a.kind === 'line') body = rising ? <line x1={0} y1={h} x2={w} y2={0} {...common} /> : <line x1={0} y1={0} x2={w} y2={h} {...common} />;
  else if (a.kind === 'ellipse') body = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
  else if (a.kind === 'polygon') body = <polygon points={polygonPointsFor(w, h, a.flipY)} {...common} />;
  else if (a.kind === 'star') body = <polygon points={starPointsFor(w, h, a.flipY)} {...common} />;
  // Baked geometry from Flatten / Outline: fill it, so an outlined glyph reads
  // as a solid letterform rather than a wireframe of itself.
  else if (a.kind === 'path' && a.path) body = <path d={a.path} fillRule="evenodd" {...common} />;
  if (!body) return null;
  // Paint comes from the annotation, so the Design panel's fill/stroke controls
  // reach the SVG kinds too — not just the CSS-box ones.
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden
    fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.strokeWidth}>{body}</svg>;
}

export function StageOverlay({ tool, frameKind, shapeKind, zoom, annotations, selectedIds, clipboard, onSelect, onChange, onClipboardChange, onCreateComponent, onQuickChat, onCreated }: {
  tool: DesignTool;
  frameKind: FrameKind;
  shapeKind: ShapeKind;
  zoom: number;
  annotations: DesignAnnotation[];
  /** Shift-click accumulates; Group/Frame/Flatten act on the whole set. */
  selectedIds: readonly string[];
  clipboard: DesignAnnotation | null;
  onSelect: (ids: string[]) => void;
  onChange: (next: DesignAnnotation[]) => void;
  onClipboardChange: (a: DesignAnnotation | null) => void;
  onCreateComponent: (members: DesignAnnotation[]) => void;
  onQuickChat: () => void;
  /** Fired once something has been drawn, so the tool can hand back to Select. */
  onCreated: () => void;
}): React.ReactElement {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<{ rect: StageRect; kind: AnnotationKind; flipX: boolean; flipY: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);

  // select/inspect keep pointer-events:none on the layer so clicks reach the
  // guest pick script; individual annotations stay clickable in select mode.
  const interactive = tool === 'hand' || tool === 'frame' || tool === 'shape' || tool === 'text';

  const toStage = (clientX: number, clientY: number): StagePoint => {
    const r = layerRef.current?.getBoundingClientRect();
    return clientToStagePoint(clientX, clientY, r?.left ?? 0, r?.top ?? 0, zoom);
  };

  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  /** The objects an action applies to: the whole selection, or just the
   *  right-clicked one when the click landed outside the selection. */
  const actOn = (targetId: string | null): DesignAnnotation[] => {
    if (targetId && !selectedIds.includes(targetId)) {
      const one = annotations.find((a) => a.id === targetId);
      return one ? [one] : [];
    }
    return annotations.filter((a) => selectedIds.includes(a.id));
  };

  /**
   * A group's mask clips its siblings. Each annotation is its own positioned
   * box, so the mask's geometry is translated into that box's coordinate space
   * and applied as `clip-path: path(...)` — no shared defs, no id collisions.
   */
  const clipFor = (a: DesignAnnotation): string | undefined => {
    if (!a.groupId || a.mask) return undefined;
    const mask = annotations.find((other) => other.groupId === a.groupId && other.mask);
    if (!mask) return undefined;
    return `path('${translatePath(outlinePathFor(mask), mask.x - a.x, mask.y - a.y)}')`;
  };

  const commitEdit = (cancelled: boolean): void => {
    const id = editingId;
    if (!id) return;
    setEditingId(null);
    const current = annotations.find((a) => a.id === id);
    if (!current) return;
    const label = cancelled ? current.label : editingValue.trim();
    if (!label) { onChange(removeAnnotation(annotations, id)); onSelect([]); return; }
    if (!cancelled) onChange(setAnnotationLabel(annotations, id, label));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    setMenu(null);
    // Hand: let the event bubble to the shell's pan handler — the layer only
    // exists to mask the preview surface in that mode.
    if (e.button !== 0 || tool === 'hand' || tool === 'inspect') return;
    const p = toStage(e.clientX, e.clientY);
    // A creation tool always creates. Hit-testing first would mean that with
    // the Rectangle tool armed, starting a drag on top of an existing shape
    // moved that shape instead of drawing — which is not what any editor does.
    const hit = tool === 'select' ? hitTest(annotations, p) : null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    if (hit) {
      onSelect(e.shiftKey
        ? (selectedIds.includes(hit.id) ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id])
        : (selectedIds.includes(hit.id) ? [...selectedIds] : [hit.id]));
      gestureRef.current = { kind: 'move', id: hit.id, start: p, base: annotations };
      return;
    }
    if (tool === 'text') {
      const a = createAnnotation('text', { x: p.x, y: p.y, w: DEFAULT_TEXT_SIZE.w, h: DEFAULT_TEXT_SIZE.h });
      onChange([...annotations, a]);
      onSelect([a.id]);
      setEditingId(a.id);
      setEditingValue('');
      onCreated();
      return;
    }
    if (tool === 'frame' || tool === 'shape') {
      const draw = tool === 'frame' ? frameKind : shapeKind;
      gestureRef.current = { kind: 'draw', anchor: p, draw };
      setDraft({ rect: { x: p.x, y: p.y, w: 0, h: 0 }, kind: draw, flipX: false, flipY: false });
      return;
    }
    onSelect([]); // select-mode click on empty layer space (between annotations)
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = gestureRef.current;
    if (!g) return;
    const p = toStage(e.clientX, e.clientY);
    if (g.kind === 'draw') { setDraft({ rect: normalizeRect(g.anchor, p), kind: g.draw, ...dragFlip(g.anchor, p) }); return; }
    // Move from the pointer-down snapshot, not the live list — no drift. The
    // whole selection travels together, plus anything grouped with it.
    const dx = p.x - g.start.x;
    const dy = p.y - g.start.y;
    const moving = new Set(selectedIds.includes(g.id) ? selectedIds : [g.id]);
    for (const id of [...moving]) {
      const groupId = g.base.find((a) => a.id === id)?.groupId;
      if (groupId) for (const member of membersOf(g.base, groupId)) moving.add(member.id);
    }
    onChange(g.base.map((a) => moving.has(a.id) ? { ...a, x: a.x + dx, y: a.y + dy } : a));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || g.kind !== 'draw') return;
    setDraft(null);
    // Compute the rect from the anchor + THIS event — the draft state can lag
    // a render behind, which would drop a drag finished within one frame.
    const end = toStage(e.clientX, e.clientY);
    const rect = normalizeRect(g.anchor, end);
    if (isClick(rect)) { onSelect([]); return; }
    const isGroup = g.draw === 'frame' || g.draw === 'section';
    const flip = g.draw === 'line' ? dragFlip(g.anchor, end) : undefined;
    const a = createAnnotation(g.draw, rect, { label: isGroup ? nextGroupLabel(g.draw, annotations) : undefined, ...flip });
    onChange([...annotations, a]);
    onSelect([a.id]);
    // One shape per press of the tool — hand back to Select so the next drag
    // moves what was just drawn instead of drawing another one.
    onCreated();
  };

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (tool === 'inspect') return;
    const p = toStage(e.clientX, e.clientY);
    // Locked annotations stay right-clickable so they can be unlocked.
    const hit = hitTestIncludingLocked(annotations, p);
    // Nothing here — let the canvas open its own screen-level menu instead.
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.includes(hit.id)) onSelect([hit.id]);
    setMenu({ x: e.clientX, y: e.clientY, point: p, targetId: hit.id });
  };

  /** Replace a set of annotations with one baked 'path' covering their box. */
  const bakeToPath = (members: readonly DesignAnnotation[], d: string, label: string): void => {
    const bounds = boundsOf(members);
    if (!bounds || !d) return;
    const ids = new Set(members.map((a) => a.id));
    const first = annotations.findIndex((a) => ids.has(a.id));
    const baked: DesignAnnotation = { ...createAnnotation('path', bounds, { label }), path: d };
    const groupId = members[0]?.groupId;
    if (groupId) baked.groupId = groupId;
    const rest = annotations.filter((a) => !ids.has(a.id));
    const at = Math.min(first < 0 ? rest.length : first, rest.length);
    onChange([...rest.slice(0, at), baked, ...rest.slice(at)]);
    onSelect([baked.id]);
  };

  const applyMenuAction = (action: MenuAction): void => {
    const m = menu;
    if (!m) return;
    const target = m.targetId ? annotations.find((a) => a.id === m.targetId) ?? null : null;
    const members = actOn(m.targetId);
    const ids = members.map((a) => a.id);

    if (action === 'copy' && target) onClipboardChange({ ...target });
    else if (action === 'cut' && target) { onClipboardChange({ ...target }); onChange(annotations.filter((a) => !ids.includes(a.id))); onSelect([]); }
    else if (action === 'paste' && clipboard) { const { list, id } = pasteAnnotation(annotations, clipboard, m.point); onChange(list); onSelect([id]); }
    else if (action === 'paste-replace' && clipboard && target) {
      // Same geometry, the clipboard's content — Figma's "paste over".
      onChange(annotations.map((a) => a.id === target.id ? { ...clipboard, id: a.id, x: a.x, y: a.y, w: a.w, h: a.h } : a));
    }
    else if (action === 'duplicate' && target) { const { list, id } = duplicateAnnotation(annotations, target.id); onChange(list); if (id) onSelect([id]); }
    else if (action === 'delete') { onChange(annotations.filter((a) => !ids.includes(a.id))); onSelect([]); }
    else if (action === 'front') onChange(ids.reduce<DesignAnnotation[]>((list, id) => bringToFront(list, id), [...annotations]));
    else if (action === 'back') onChange([...ids].reverse().reduce<DesignAnnotation[]>((list, id) => sendToBack(list, id), [...annotations]));
    else if (action === 'group') { const { list } = groupAnnotations(annotations, ids); onChange(list); }
    else if (action === 'ungroup') onChange(ungroupAnnotations(annotations, membersOf(annotations, target?.groupId ?? null).map((a) => a.id)));
    else if (action === 'frame') { const { list, id } = frameSelection(annotations, ids); onChange(list); if (id) onSelect([id]); }
    else if (action === 'auto-layout' && target) {
      const withLayout = annotations.map((a) => a.id === target.id ? { ...a, autoLayout: a.autoLayout ?? DEFAULT_AUTO_LAYOUT } : a);
      onChange(autoLayoutAnnotations(withLayout, target.id));
    }
    else if (action === 'mask' && target) onChange(setMask(annotations, target.id));
    else if (action === 'flatten') bakeToPath(members, flattenToPath(members), 'Flattened');
    else if (action === 'outline-text' && target) {
      const traced = traceTextOutline(target);
      if (traced) bakeToPath([target], traced, target.label);
    }
    else if (action === 'outline-stroke' && target) bakeToPath([target], outlineStrokePath(target, ANNOTATION_STROKE), target.label || 'Outline');
    else if (action === 'create-component') onCreateComponent(members);
    else if (action === 'create-component-chat') onQuickChat();
    else if (action === 'toggle-hidden') { onChange(annotations.map((a) => ids.includes(a.id) ? { ...a, hidden: !a.hidden } : a)); onSelect([]); }
    else if (action === 'toggle-locked') onChange(annotations.map((a) => ids.includes(a.id) ? { ...a, locked: !a.locked } : a));
    else if (action === 'flip-x') onChange(ids.reduce<DesignAnnotation[]>((list, id) => flipAnnotation(list, id, 'x'), [...annotations]));
    else if (action === 'flip-y') onChange(ids.reduce<DesignAnnotation[]>((list, id) => flipAnnotation(list, id, 'y'), [...annotations]));
    else if (action === 'show-all') onChange(annotations.map((a) => a.hidden ? { ...a, hidden: false } : a));
  };

  return (
    <div ref={layerRef} data-tool={tool}
      className={`ds-anno-layer${interactive ? ' is-interactive' : ''}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}>
      {annotations.map((a) => a.hidden ? null : (
        <div key={a.id}
          className={`ds-anno ds-anno--${a.kind}${selectedIds.includes(a.id) ? ' is-selected' : ''}${a.locked ? ' is-locked' : ''}${a.mask ? ' ds-anno--mask' : ''}`}
          style={{ left: a.x, top: a.y, width: a.w, height: a.h, clipPath: clipFor(a), ...cssForAnnotation(a) }}
          onDoubleClick={a.kind === 'text' ? () => { setEditingId(a.id); setEditingValue(a.label); } : undefined}>
          <ShapeSvg a={a} />
          {a.kind === 'frame' || a.kind === 'section' ? <span className="ds-anno-label">{a.label}</span> : null}
          {a.kind === 'text' && editingId !== a.id ? a.label : null}
          {editingId === a.id ? (
            <input className="ds-anno-input" autoFocus value={editingValue} aria-label="Annotation text"
              onChange={(ev) => setEditingValue(ev.target.value)}
              onBlur={() => commitEdit(false)}
              onPointerDown={(ev) => ev.stopPropagation()}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); commitEdit(false); }
                else if (ev.key === 'Escape') { ev.stopPropagation(); commitEdit(true); }
              }} />
          ) : null}
        </div>
      ))}
      {draft ? (
        <div className={`ds-anno ds-anno--draft ds-anno--${draft.kind}`} style={{ left: draft.rect.x, top: draft.rect.y, width: draft.rect.w, height: draft.rect.h }}>
          {/* The in-progress shape previews with the same paint it will be
              created with, so what you drag out is what you get. */}
          <ShapeSvg a={{ id: 'draft', label: '', kind: draft.kind, x: draft.rect.x, y: draft.rect.y, w: draft.rect.w, h: draft.rect.h, flipX: draft.flipX, flipY: draft.flipY }} />
        </div>
      ) : null}
      {menu ? (
        <DesignContextMenu x={menu.x} y={menu.y}
          target={(() => {
            const hit = menu.targetId ? annotations.find((a) => a.id === menu.targetId) ?? null : null;
            return hit ? { kind: 'annotation' as const, annotation: hit } : null;
          })()}
          selectionCount={actOn(menu.targetId).length}
          clipboardFilled={clipboard !== null}
          hiddenCount={annotations.filter((a) => a.hidden).length}
          onAction={applyMenuAction}
          onClose={() => setMenu(null)} />
      ) : null}
    </div>
  );
}
