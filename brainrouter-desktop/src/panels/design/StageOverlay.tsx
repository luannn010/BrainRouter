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
  DEFAULT_TEXT_SIZE, bringToFront, clientToStagePoint, createAnnotation, dragFlip,
  duplicateAnnotation, flipAnnotation, hitTest, hitTestIncludingLocked, isClick,
  moveAnnotation, nextGroupLabel, normalizeRect, pasteAnnotation, polygonPointsFor,
  removeAnnotation, sendToBack, setAnnotationLabel, starPointsFor, toggleAnnotationFlag,
  type AnnotationKind, type DesignAnnotation, type StagePoint, type StageRect,
} from '../../lib/design/designAnnotations.js';
import { DesignContextMenu, type MenuAction } from './DesignContextMenu.js';

type Gesture =
  | { kind: 'draw'; anchor: StagePoint; draw: AnnotationKind }
  | { kind: 'move'; id: string; start: StagePoint; base: DesignAnnotation[] };

type MenuState = { x: number; y: number; point: StagePoint; targetId: string | null };

/** SVG body for the drawn shapes; frame/section/rectangle/text are CSS boxes. */
function ShapeSvg({ a }: { a: Pick<DesignAnnotation, 'kind' | 'w' | 'h' | 'flipX' | 'flipY'> }): React.ReactElement | null {
  const w = Math.max(a.w, 1);
  const h = Math.max(a.h, 1);
  // A line drawn upward is the rising diagonal; a flip on either axis mirrors it.
  const rising = (a.flipX ?? false) !== (a.flipY ?? false);
  const common = { vectorEffect: 'non-scaling-stroke' as const };
  let body: React.ReactElement | null = null;
  if (a.kind === 'line') body = rising ? <line x1={0} y1={h} x2={w} y2={0} {...common} /> : <line x1={0} y1={0} x2={w} y2={h} {...common} />;
  else if (a.kind === 'ellipse') body = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
  else if (a.kind === 'polygon') body = <polygon points={polygonPointsFor(w, h, a.flipY)} {...common} />;
  else if (a.kind === 'star') body = <polygon points={starPointsFor(w, h, a.flipY)} {...common} />;
  if (!body) return null;
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>{body}</svg>;
}

export function StageOverlay({ tool, frameKind, shapeKind, zoom, annotations, selectedId, clipboard, onSelect, onChange, onClipboardChange }: {
  tool: DesignTool;
  frameKind: FrameKind;
  shapeKind: ShapeKind;
  zoom: number;
  annotations: DesignAnnotation[];
  selectedId: string | null;
  clipboard: DesignAnnotation | null;
  onSelect: (id: string | null) => void;
  onChange: (next: DesignAnnotation[]) => void;
  onClipboardChange: (a: DesignAnnotation | null) => void;
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

  const commitEdit = (cancelled: boolean): void => {
    const id = editingId;
    if (!id) return;
    setEditingId(null);
    const current = annotations.find((a) => a.id === id);
    if (!current) return;
    const label = cancelled ? current.label : editingValue.trim();
    if (!label) { onChange(removeAnnotation(annotations, id)); onSelect(null); return; }
    if (!cancelled) onChange(setAnnotationLabel(annotations, id, label));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    setMenu(null);
    // Hand: let the event bubble to the shell's pan handler — the layer only
    // exists to mask the preview surface in that mode.
    if (e.button !== 0 || tool === 'hand' || tool === 'inspect') return;
    const p = toStage(e.clientX, e.clientY);
    const hit = hitTest(annotations, p);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    if (hit) {
      onSelect(hit.id);
      gestureRef.current = { kind: 'move', id: hit.id, start: p, base: annotations };
      return;
    }
    if (tool === 'text') {
      const a = createAnnotation('text', { x: p.x, y: p.y, w: DEFAULT_TEXT_SIZE.w, h: DEFAULT_TEXT_SIZE.h });
      onChange([...annotations, a]);
      onSelect(a.id);
      setEditingId(a.id);
      setEditingValue('');
      return;
    }
    if (tool === 'frame' || tool === 'shape') {
      const draw = tool === 'frame' ? frameKind : shapeKind;
      gestureRef.current = { kind: 'draw', anchor: p, draw };
      setDraft({ rect: { x: p.x, y: p.y, w: 0, h: 0 }, kind: draw, flipX: false, flipY: false });
      return;
    }
    onSelect(null); // select-mode click on empty layer space (between annotations)
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = gestureRef.current;
    if (!g) return;
    const p = toStage(e.clientX, e.clientY);
    if (g.kind === 'draw') setDraft({ rect: normalizeRect(g.anchor, p), kind: g.draw, ...dragFlip(g.anchor, p) });
    // Move from the pointer-down snapshot, not the live list — no drift.
    else onChange(moveAnnotation(g.base, g.id, p.x - g.start.x, p.y - g.start.y));
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
    if (isClick(rect)) { onSelect(null); return; }
    const isGroup = g.draw === 'frame' || g.draw === 'section';
    const flip = g.draw === 'line' ? dragFlip(g.anchor, end) : undefined;
    const a = createAnnotation(g.draw, rect, { label: isGroup ? nextGroupLabel(g.draw, annotations) : undefined, ...flip });
    onChange([...annotations, a]);
    onSelect(a.id);
  };

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (tool === 'inspect') return;
    e.preventDefault();
    const p = toStage(e.clientX, e.clientY);
    // Locked annotations stay right-clickable so they can be unlocked.
    const hit = hitTestIncludingLocked(annotations, p);
    if (hit) onSelect(hit.id);
    setMenu({ x: e.clientX, y: e.clientY, point: p, targetId: hit?.id ?? null });
  };

  const applyMenuAction = (action: MenuAction): void => {
    const m = menu;
    if (!m) return;
    const target = m.targetId ? annotations.find((a) => a.id === m.targetId) ?? null : null;
    if (action === 'copy' && target) onClipboardChange({ ...target });
    else if (action === 'cut' && target) { onClipboardChange({ ...target }); onChange(removeAnnotation(annotations, target.id)); onSelect(null); }
    else if (action === 'paste' && clipboard) { const { list, id } = pasteAnnotation(annotations, clipboard, m.point); onChange(list); onSelect(id); }
    else if (action === 'duplicate' && target) { const { list, id } = duplicateAnnotation(annotations, target.id); onChange(list); if (id) onSelect(id); }
    else if (action === 'delete' && target) { onChange(removeAnnotation(annotations, target.id)); onSelect(null); }
    else if (action === 'front' && target) onChange(bringToFront(annotations, target.id));
    else if (action === 'back' && target) onChange(sendToBack(annotations, target.id));
    else if (action === 'toggle-hidden' && target) { onChange(toggleAnnotationFlag(annotations, target.id, 'hidden')); onSelect(null); }
    else if (action === 'toggle-locked' && target) onChange(toggleAnnotationFlag(annotations, target.id, 'locked'));
    else if (action === 'flip-x' && target) onChange(flipAnnotation(annotations, target.id, 'x'));
    else if (action === 'flip-y' && target) onChange(flipAnnotation(annotations, target.id, 'y'));
    else if (action === 'show-all') onChange(annotations.map((a) => a.hidden ? { ...a, hidden: false } : a));
  };

  return (
    <div ref={layerRef} data-tool={tool}
      className={`ds-anno-layer${interactive ? ' is-interactive' : ''}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}>
      {annotations.map((a) => a.hidden ? null : (
        <div key={a.id}
          className={`ds-anno ds-anno--${a.kind}${a.id === selectedId ? ' is-selected' : ''}${a.locked ? ' is-locked' : ''}`}
          style={{ left: a.x, top: a.y, width: a.w, height: a.h }}
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
          <ShapeSvg a={{ kind: draft.kind, w: draft.rect.w, h: draft.rect.h, flipX: draft.flipX, flipY: draft.flipY }} />
        </div>
      ) : null}
      {menu ? (
        <DesignContextMenu x={menu.x} y={menu.y}
          target={menu.targetId ? annotations.find((a) => a.id === menu.targetId) ?? null : null}
          clipboardFilled={clipboard !== null}
          hiddenCount={annotations.filter((a) => a.hidden).length}
          onAction={applyMenuAction}
          onClose={() => setMenu(null)} />
      ) : null}
    </div>
  );
}
