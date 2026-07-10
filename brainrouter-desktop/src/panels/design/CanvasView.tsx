// brainrouter-desktop/src/panels/design/CanvasView.tsx
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasFrames, type PrototypeFrame } from '../../lib/design/useCanvasFrames.js';

/** Frame geometry — one screen in a flow. */
const FRAME_W = 380;
const FRAME_H = 620;
const HEAD_H = 34;
const GAP_X = 96;
const GAP_Y = 96;
const PER_ROW = 4;

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;

type Pt = { x: number; y: number };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Grid flow: left-to-right, wrapping every PER_ROW frames. */
function frameOrigin(i: number): Pt {
  const col = i % PER_ROW;
  const row = Math.floor(i / PER_ROW);
  return { x: col * (FRAME_W + GAP_X), y: row * (FRAME_H + HEAD_H + GAP_Y) };
}

function worldSize(count: number): { w: number; h: number } {
  if (count === 0) return { w: FRAME_W, h: FRAME_H + HEAD_H };
  const cols = Math.min(count, PER_ROW);
  const rows = Math.ceil(count / PER_ROW);
  return { w: cols * FRAME_W + (cols - 1) * GAP_X, h: rows * (FRAME_H + HEAD_H) + (rows - 1) * GAP_Y };
}

/**
 * One prototype rendered as a sandboxed srcdoc iframe. The iframe never takes
 * pointer events — the Canvas is a map, not a play surface; interaction lives in
 * the Designs tab. `sandbox="allow-scripts"` (without allow-same-origin) gives it
 * a unique opaque origin, so a prototype can run its own JS but cannot reach us.
 */
const Frame = memo(function Frame({ frame, index, selected, onSelect, onOpen }: {
  frame: PrototypeFrame;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}): React.ReactElement {
  const { x, y } = frameOrigin(index);
  return (
    <div className={`ds-frame${selected ? ' is-selected' : ''}`} style={{ left: x, top: y, width: FRAME_W }}>
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
      <div className="ds-frame-body" style={{ height: FRAME_H }}>
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
function Connectors({ count }: { count: number }): React.ReactElement | null {
  if (count < 2) return null;
  const { w, h } = worldSize(count);
  const paths: React.ReactElement[] = [];
  for (let i = 0; i + 1 < count; i++) {
    if ((i + 1) % PER_ROW === 0) continue; // last in row — no wrap connector
    const a = frameOrigin(i);
    const b = frameOrigin(i + 1);
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState<Pt>({ x: 48, y: 48 });
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const { w, h } = worldSize(frames.length);
    const cw = host.clientWidth - 64;
    const ch = host.clientHeight - 64;
    const z = clamp(Math.min(cw / w, ch / h), MIN_ZOOM, 1);
    setZoom(z);
    setPan({ x: (host.clientWidth - w * z) / 2, y: (host.clientHeight - h * z) / 2 });
  }, [frames.length]);

  // Fit once the first frame set lands.
  useEffect(() => { if (frames.length) fit(); }, [frames.length, fit]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setZoom((z) => {
      const nz = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      if (nz === z) return z;
      setPan((p) => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
      return nz;
    });
  }, []);

  /** Buttons and +/- zoom about the viewport centre, so the view never lurches. */
  const zoomCenter = useCallback((factor: number) => {
    const host = hostRef.current;
    if (host) zoomAt(factor, host.clientWidth / 2, host.clientHeight / 2);
  }, [zoomAt]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      setPan((p) => ({ x: p.x - (e.shiftKey ? e.deltaY : e.deltaX), y: p.y - (e.shiftKey ? 0 : e.deltaY) }));
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as HTMLElement).closest('.ds-frame-head')) return; // let the frame handle it
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
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

  return (
    <div className="ds-canvaswrap">
      <div className="ds-canvas-bar">
        <span className="ds-eyebrow">Flows</span>
        <span className="ds-mono ds-canvas-count" data-mono>{frames.length} frame{frames.length === 1 ? '' : 's'}</span>
        {truncated && <span className="ds-mono ds-canvas-warn" data-mono>capped</span>}
        <span className="ds-nav-spacer" />
        <button className="ds-iconbtn" onClick={() => zoomCenter(1 / 1.1)} aria-label="Zoom out">−</button>
        <span className="ds-mono ds-zoom" data-mono>{Math.round(zoom * 100)}%</span>
        <button className="ds-iconbtn" onClick={() => zoomCenter(1.1)} aria-label="Zoom in">+</button>
        <button className="ds-iconbtn" onClick={fit}>Fit</button>
        <button className="ds-iconbtn" onClick={refresh}>Refresh</button>
      </div>

      <div
        ref={hostRef}
        className="ds-canvas"
        role="application"
        aria-label="Prototype flow canvas — drag to pan, ctrl+wheel to zoom, 0 to fit"
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {loading && frames.length === 0 && <div className="ds-empty">Loading prototypes…</div>}
        {error && <div className="ds-empty ds-error">{error}</div>}
        {!loading && !error && frames.length === 0 && (
          <div className="ds-empty">No prototypes yet. Generate one from the Fix chat, then Refresh.</div>
        )}

        <div className="ds-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <Connectors count={frames.length} />
          {frames.map((f, i) => (
            <Frame key={f.id} frame={f} index={i} selected={selected === f.id} onSelect={setSelected} onOpen={onOpenInDesigns} />
          ))}
        </div>
      </div>
    </div>
  );
}
