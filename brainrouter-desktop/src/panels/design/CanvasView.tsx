// brainrouter-desktop/src/panels/design/CanvasView.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasFrames, type PrototypeFrame } from '../../lib/design/useCanvasFrames.js';
import { useCanvasDocument } from '../../lib/design/useCanvasDocument.js';
import { createCanvasDocument, layoutCanvasNodes, type CanvasNode, type CanvasPoint, type CanvasLayoutMode } from '../../lib/design/canvasModel.js';
import { fitBounds, snapTo, wheelGesture, zoomAt } from '../../lib/design/canvasViewport.js';
import { CanvasInspector } from './CanvasInspector.js';

/** Frame geometry — one screen in a flow. */
const FRAME_W = 380;
const FRAME_H = 620;
const HEAD_H = 34;
const GAP_X = 96;
const GAP_Y = 96;
const PER_ROW = 4;

type Pt = { x: number; y: number };

/** Grid flow: left-to-right, wrapping every PER_ROW frames. */
function frameOrigin(i: number): Pt {
  const col = i % PER_ROW;
  const row = Math.floor(i / PER_ROW);
  return { x: col * (FRAME_W + GAP_X), y: row * (FRAME_H + HEAD_H + GAP_Y) };
}

function worldSize(nodes: readonly Pick<CanvasNode, 'position' | 'width' | 'height'>[]): { w: number; h: number } {
  if (nodes.length === 0) return { w: FRAME_W, h: FRAME_H + HEAD_H };
  return nodes.reduce((size, node) => ({
    w: Math.max(size.w, node.position.x + node.width),
    h: Math.max(size.h, node.position.y + node.height + HEAD_H),
  }), { w: FRAME_W, h: FRAME_H + HEAD_H });
}

/**
 * One prototype rendered as a sandboxed srcdoc iframe. The iframe never takes
 * pointer events — the Canvas is a map, not a play surface; interaction lives in
 * the Designs tab. `sandbox="allow-scripts"` (without allow-same-origin) gives it
 * a unique opaque origin, so a prototype can run its own JS but cannot reach us.
 */
const Frame = memo(function Frame({ frame, position, selected, onSelect, onOpen }: {
  frame: PrototypeFrame;
  position: CanvasPoint;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}): React.ReactElement {
  return (
    <div className={`ds-frame${selected ? ' is-selected' : ''}`} data-node-id={frame.id} style={{ left: position.x, top: position.y, width: FRAME_W }}>
      <button
        type="button"
        className="ds-frame-head"
        aria-pressed={selected}
        onClick={() => onSelect(frame.id)}
        onDoubleClick={() => onOpen(frame.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(frame.id); }}
        title={`${frame.title} — double-click (or Enter) to open in Designs`}
      >
        <span className="ds-frame-title">{frame.title}</span>
        <span className="ds-frame-path" data-mono>{frame.path}</span>
      </button>
      <div className="ds-frame-body" data-node-id={frame.id} style={{ height: FRAME_H }}>
        <iframe
          className="ds-frame-doc"
          title={frame.title}
          sandbox="allow-scripts"
          srcDoc={frame.content}
          tabIndex={-1}
        />
      </div>
    </div>
  );
});

/** Flow connectors between consecutive frames on the same row. */
function Connectors({ frames, positions }: { frames: readonly PrototypeFrame[]; positions: ReadonlyMap<string, CanvasPoint> }): React.ReactElement | null {
  const count = frames.length;
  if (frames.length < 2) return null;
  const nodes = frames.map((frame) => ({ position: positions.get(frame.id) ?? { x: 0, y: 0 }, width: FRAME_W, height: FRAME_H }));
  const { w, h } = worldSize(nodes);
  const paths: React.ReactElement[] = [];
  for (let i = 0; i + 1 < frames.length; i++) {
    if ((i + 1) % PER_ROW === 0) continue; // last in row — no wrap connector
    const a = positions.get(frames[i].id) ?? { x: 0, y: 0 };
    const b = positions.get(frames[i + 1].id) ?? { x: 0, y: 0 };
    const y = a.y + HEAD_H + FRAME_H / 2;
    const x1 = a.x + FRAME_W;
    const x2 = b.x;
    const mid = (x1 + x2) / 2;
    paths.push(<path key={i} d={`M ${x1} ${y} C ${mid} ${y}, ${mid} ${y}, ${x2 - 8} ${y}`} />);
  }
  if (paths.length === 0) return null;
  return (
    <svg className="ds-flow" width={w} height={h} aria-hidden="true">
      <defs>
        <marker id="ds-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
        </marker>
      </defs>
      <g stroke="currentColor" strokeWidth={1.5} fill="none" markerEnd="url(#ds-arrow)">{paths}</g>
    </svg>
  );
}

export function CanvasView({ onOpenInDesigns }: { onOpenInDesigns: (id: string) => void }): React.ReactElement {
  const { frames, truncated, loading, error, refresh } = useCanvasFrames();
  const entries = useMemo(() => frames.map((frame) => ({ id: frame.id })), [frames]);
  const canvas = useCanvasDocument(entries);
  const hiddenIds = useMemo(() => new Set(canvas.document.hiddenPrototypeIds), [canvas.document.hiddenPrototypeIds]);
  const visibleFrames = useMemo(() => frames.filter((frame) => !hiddenIds.has(frame.id)), [frames, hiddenIds]);
  const hiddenFrames = useMemo(() => frames.filter((frame) => hiddenIds.has(frame.id)), [frames, hiddenIds]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState<Pt>({ x: 48, y: 48 });
  // The zoom callback reads the live pan without re-creating itself per pan.
  const panRef = useRef(pan);
  panRef.current = pan;
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const nodeDragRef = useRef<{ id: string; x: number; y: number; start: CanvasPoint } | null>(null);
  const [dragPreview, setDragPreview] = useState<ReadonlyMap<string, CanvasPoint>>(new Map());

  const positions = useMemo(() => {
    const map = new Map<string, CanvasPoint>();
    const laidOut = layoutCanvasNodes(canvas.document.nodes, canvas.document.preferences.layoutMode);
    for (const node of laidOut) map.set(node.prototypeId, dragPreview.get(node.prototypeId) ?? node.position);
    return map;
  }, [canvas.document.nodes, canvas.document.preferences.layoutMode, dragPreview]);
  const nodesForSize = useMemo(() => layoutCanvasNodes(canvas.document.nodes, canvas.document.preferences.layoutMode).map((node) => ({ ...node, position: positions.get(node.prototypeId) ?? node.position })), [canvas.document.nodes, canvas.document.preferences.layoutMode, positions]);

  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const { w, h } = worldSize(nodesForSize);
    const view = fitBounds({ x: 0, y: 0, w, h }, host.clientWidth, host.clientHeight, 32);
    setZoom(view.scale);
    setPan({ x: view.x, y: view.y });
  }, [nodesForSize]);

  // Fit once the first frame set lands.
  useEffect(() => { if (frames.length) fit(); }, [frames.length, fit]);

  const zoomAtPoint = useCallback((factor: number, cx: number, cy: number) => {
    setZoom((z) => {
      const next = zoomAt({ scale: z, x: panRef.current.x, y: panRef.current.y }, factor, cx, cy);
      if (next.scale === z) return z;
      setPan({ x: next.x, y: next.y });
      return next.scale;
    });
  }, []);

  /** Buttons and +/- zoom about the viewport centre, so the view never lurches. */
  const zoomCenter = useCallback((factor: number) => {
    const host = hostRef.current;
    if (host) zoomAtPoint(factor, host.clientWidth / 2, host.clientHeight / 2);
  }, [zoomAtPoint]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const gesture = wheelGesture(e);
    if (gesture.kind === 'zoom') zoomAtPoint(gesture.factor, e.clientX - rect.left, e.clientY - rect.top);
    else setPan((p) => ({ x: p.x + gesture.dx, y: p.y + gesture.dy }));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    const frame = target.closest<HTMLElement>('.ds-frame');
    if (frame && !target.closest('.ds-frame-head')) {
      const id = frame.dataset.nodeId;
      const node = id ? canvas.document.nodes.find((item) => item.prototypeId === id) : undefined;
      if (node) {
        setSelected(id ?? null);
        nodeDragRef.current = { id: node.prototypeId, x: e.clientX, y: e.clientY, start: node.position };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (target.closest('.ds-frame-head')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const nodeDrag = nodeDragRef.current;
    if (nodeDrag) {
      const raw = { x: nodeDrag.start.x + (e.clientX - nodeDrag.x) / zoom, y: nodeDrag.start.y + (e.clientY - nodeDrag.y) / zoom };
      const grid = canvas.document.preferences.snapEnabled ? canvas.document.preferences.gridSize : 1;
      const next = { x: snapTo(raw.x, grid), y: snapTo(raw.y, grid) };
      setDragPreview((current) => new Map(current).set(nodeDrag.id, next));
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    const nodeDrag = nodeDragRef.current;
    if (nodeDrag) {
      const position = dragPreview.get(nodeDrag.id);
      if (position) canvas.save({ ...canvas.document, nodes: canvas.document.nodes.map((node) => node.prototypeId === nodeDrag.id ? { ...node, position } : node) });
      nodeDragRef.current = null;
      setDragPreview(new Map());
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      return;
    }
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = 64;
    if (e.key === '+' || e.key === '=') { zoomCenter(1.1); e.preventDefault(); }
    else if (e.key === '-') { zoomCenter(1 / 1.1); e.preventDefault(); }
    else if (e.key === '0') { fit(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { setPan((p) => ({ ...p, x: p.x + step })); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { setPan((p) => ({ ...p, x: p.x - step })); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setPan((p) => ({ ...p, y: p.y + step })); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { setPan((p) => ({ ...p, y: p.y - step })); e.preventDefault(); }
  };

  const selectedFrame = frames.find((frame) => frame.id === selected) ?? null;
  const selectedNode = canvas.document.nodes.find((node) => node.prototypeId === selected) ?? null;
  const focusSelected = (): void => {
    if (!selectedNode || !hostRef.current) return;
    const position = positions.get(selectedNode.prototypeId) ?? selectedNode.position;
    setPan({ x: hostRef.current.clientWidth / 2 - (position.x + FRAME_W / 2) * zoom, y: hostRef.current.clientHeight / 2 - (position.y + FRAME_H / 2) * zoom });
  };
  const setLayoutMode = (layoutMode: CanvasLayoutMode): void => canvas.save({ ...canvas.document, preferences: { ...canvas.document.preferences, layoutMode } });
  const setCanvasPreference = (key: 'gridEnabled' | 'snapEnabled'): void => canvas.save({ ...canvas.document, preferences: { ...canvas.document.preferences, [key]: !canvas.document.preferences[key] } });
  const setPrototypeVisible = (id: string, visible: boolean): void => {
    const hidden = new Set(canvas.document.hiddenPrototypeIds);
    if (visible) hidden.delete(id); else hidden.add(id);
    canvas.save({ ...canvas.document, hiddenPrototypeIds: [...hidden] });
    if (!visible && selected === id) setSelected(null);
  };
  const restorePrototypeAt = (id: string, clientX?: number, clientY?: number): void => {
    const hidden = new Set(canvas.document.hiddenPrototypeIds);
    hidden.delete(id);
    const existing = canvas.document.nodes.find((node) => node.prototypeId === id);
    if (existing || clientX === undefined || clientY === undefined || !hostRef.current) {
      setPrototypeVisible(id, true);
      return;
    }
    const rect = hostRef.current.getBoundingClientRect();
    const position = { x: Math.max(0, (clientX - rect.left - pan.x) / zoom), y: Math.max(0, (clientY - rect.top - pan.y) / zoom) };
    const seed = createCanvasDocument([{ id }]).nodes[0];
    canvas.save({ ...canvas.document, hiddenPrototypeIds: [...hidden], nodes: [...canvas.document.nodes, { ...seed, position, zIndex: canvas.document.nodes.length }] });
    setSelected(id);
  };
  const onLibraryDragStart = (event: React.DragEvent<HTMLButtonElement>, id: string): void => {
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
  };
  const minimap = nodesForSize.length > 0 ? (
    <div className="ds-minimap" aria-label="Canvas minimap">
      {nodesForSize.map((node) => <span key={node.id} className={`ds-minimap-node${selected === node.prototypeId ? ' is-selected' : ''}`} style={{ left: `${Math.min(94, (node.position.x / Math.max(1, worldSize(nodesForSize).w)) * 94)}%`, top: `${Math.min(94, (node.position.y / Math.max(1, worldSize(nodesForSize).h)) * 94)}%` }} />)}
    </div>
  ) : null;

  return (
    <div className="ds-canvaslayout">
      <div className="ds-canvaswrap">
      <div className="ds-canvas-bar">
        <span className="ds-eyebrow">Flows</span>
        <span className="ds-mono ds-canvas-count" data-mono>{visibleFrames.length} frame{visibleFrames.length === 1 ? '' : 's'} on board</span>
        {truncated && <span className="ds-mono ds-canvas-warn" data-mono>capped</span>}
        <span className="ds-nav-spacer" />
        <button className="ds-iconbtn" onClick={() => zoomCenter(1 / 1.1)} aria-label="Zoom out">−</button>
        <span className="ds-mono ds-zoom" data-mono>{Math.round(zoom * 100)}%</span>
        <button className="ds-iconbtn" onClick={() => zoomCenter(1.1)} aria-label="Zoom in">+</button>
        <button className="ds-iconbtn" onClick={fit}>Fit</button>
        <button className={`ds-iconbtn${canvas.document.preferences.gridEnabled ? ' is-active' : ''}`} onClick={() => setCanvasPreference('gridEnabled')} aria-pressed={canvas.document.preferences.gridEnabled}>Grid</button>
        <button className={`ds-iconbtn${canvas.document.preferences.snapEnabled ? ' is-active' : ''}`} onClick={() => setCanvasPreference('snapEnabled')} aria-pressed={canvas.document.preferences.snapEnabled}>Snap</button>
        <select className="ds-select" value={canvas.document.preferences.layoutMode} onChange={(e) => setLayoutMode(e.target.value as CanvasLayoutMode)} aria-label="Canvas layout mode">
          <option value="manual">Manual</option><option value="flow">Flow</option><option value="grid">Grid layout</option>
        </select>
        <button className="ds-iconbtn" onClick={refresh}>Refresh</button>
      </div>
      <details className="ds-flow-library" open={hiddenFrames.length > 0}>
        <summary>Flow library <span data-mono>{frames.length} available · {hiddenFrames.length} off canvas</span></summary>
        <div className="ds-flow-library-list">{frames.map((frame) => <button key={frame.id} type="button" draggable onDragStart={(event) => onLibraryDragStart(event, frame.id)} onClick={() => restorePrototypeAt(frame.id)} className={hiddenIds.has(frame.id) ? 'is-off-canvas' : ''} title="Drag onto the canvas to add this flow"><span>{frame.title}</span><small>{hiddenIds.has(frame.id) ? 'Add to canvas' : 'On canvas'}</small></button>)}</div>
      </details>

      <div
        ref={hostRef}
        className={`ds-canvas${canvas.document.preferences.gridEnabled ? '' : ' ds-canvas--no-grid'}`}
        role="application"
        aria-label="Prototype flow canvas — drag to pan, ctrl+wheel to zoom, 0 to fit"
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
        onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (id) restorePrototypeAt(id, event.clientX, event.clientY); }}
      >
        {loading && frames.length === 0 && <div className="ds-empty">Loading prototypes…</div>}
        {error && <div className="ds-empty ds-error">{error}</div>}
        {!loading && !error && frames.length === 0 && (
          <div className="ds-empty">No flows yet. Generate one from the Fix chat, then Refresh.</div>
        )}

        <div className="ds-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <Connectors frames={visibleFrames} positions={positions} />
          {visibleFrames.map((f) => (
            <Frame key={f.id} frame={f} position={positions.get(f.id) ?? { x: 0, y: 0 }} selected={selected === f.id} onSelect={setSelected} onOpen={onOpenInDesigns} />
          ))}
        </div>
        {minimap}
      </div>
      </div>
      <CanvasInspector frame={selectedFrame} node={selectedNode} onOpen={() => selected && onOpenInDesigns(selected)} onFocus={focusSelected} onClear={() => setSelected(null)} onRemove={() => selected && setPrototypeVisible(selected, false)} />
    </div>
  );
}
