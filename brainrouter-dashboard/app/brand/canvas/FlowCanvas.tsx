"use client";

import { useMemo, useRef, useState } from "react";
import type { DesignFlow, FlowPosition } from "../studioTypes";
import "./flowCanvas.css";

const CARD_W = 236;
const CARD_H = 144;

function ScreenGlyph({ kind }: { kind: string }) {
  return <span className={`flow-screen-glyph flow-screen-glyph--${kind}`} aria-hidden="true"><span /><span /><span /></span>;
}

export function FlowCanvas({
  flow,
  positions,
  onPositionsChange,
  selectedScreen,
  onSelect,
  onEdit,
  hiddenScreenIds,
  onHide,
  onShow,
}: {
  flow: DesignFlow;
  positions: Record<string, FlowPosition>;
  onPositionsChange: (next: Record<string, FlowPosition>) => void;
  selectedScreen: string;
  onSelect: (id: string) => void;
  onEdit: () => void;
  hiddenScreenIds: string[];
  onHide: (id: string) => void;
  onShow: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const screenById = useMemo(() => new Map(flow.screens.map((screen) => [screen.id, screen])), [flow.screens]);
  const hidden = useMemo(() => new Set(hiddenScreenIds), [hiddenScreenIds]);
  const visibleScreens = useMemo(() => flow.screens.filter((screen) => !hidden.has(screen.id)), [flow.screens, hidden]);
  const hiddenScreens = useMemo(() => flow.screens.filter((screen) => hidden.has(screen.id)), [flow.screens, hidden]);
  const point = (id: string) => positions[id] ?? screenById.get(id) ?? { x: 80, y: 80 };

  const fitFlow = () => {
    const xs = visibleScreens.map((screen) => point(screen.id).x);
    const ys = visibleScreens.map((screen) => point(screen.id).y);
    if (!xs.length) return;
    const minX = Math.min(...xs), minY = Math.min(...ys);
    setZoom(0.82);
    setCamera({ x: 80 - minX * 0.82, y: 80 - minY * 0.82 });
  };

  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-flow-card]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPan({ sx: event.clientX, sy: event.clientY, ox: camera.x, oy: camera.y });
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag) {
      const next = { ...positions, [drag.id]: { x: Math.max(20, drag.ox + (event.clientX - drag.sx) / zoom), y: Math.max(20, drag.oy + (event.clientY - drag.sy) / zoom) } };
      onPositionsChange(next);
    } else if (pan) {
      setCamera({ x: pan.ox + event.clientX - pan.sx, y: pan.oy + event.clientY - pan.sy });
    }
  };
  const endPointer = () => { setDrag(null); setPan(null); };

  return (
    <section className="flow-canvas" aria-label="Flow canvas">
      <div className="flow-canvas__toolbar">
        <div className="flow-canvas__toolbar-group">
          <span className="studio-eyebrow">Canvas</span>
          <span className="flow-canvas__hint">Drag screens to arrange the flow · scroll to zoom · drag empty space to pan</span>
        </div>
        <div className="flow-canvas__toolbar-group">
          <button type="button" className="studio-icon-button" onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))} aria-label="Zoom out">−</button>
          <button type="button" className="flow-canvas__zoom" onClick={() => { setZoom(1); setCamera({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="studio-icon-button" onClick={() => setZoom((value) => Math.min(1.65, value + 0.1))} aria-label="Zoom in">+</button>
          <button type="button" className="studio-ghost-button" onClick={fitFlow}>Fit flow</button>
          {hiddenScreens.length > 0 && <button type="button" className="studio-ghost-button" onClick={() => onShow(hiddenScreens[0].id)}>Show hidden ({hiddenScreens.length})</button>}
          <button type="button" className="studio-primary-button" onClick={onEdit}>Edit selected</button>
        </div>
      </div>
      <div
        ref={stageRef}
        className="flow-canvas__stage"
        onPointerDown={onStagePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(1.65, Math.max(0.45, value * (event.deltaY < 0 ? 1.08 : 0.92)))); }}
      >
        <div className="flow-canvas__world" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${zoom})` }}>
          <svg className="flow-canvas__connectors" width="1200" height="700" aria-hidden="true">
            {flow.connectors.filter((connector) => !hidden.has(connector.from) && !hidden.has(connector.to)).map((connector) => {
              const from = point(connector.from), to = point(connector.to);
              const x1 = from.x + CARD_W, y1 = from.y + CARD_H / 2, x2 = to.x, y2 = to.y + CARD_H / 2;
              const curve = Math.max(60, Math.abs(x2 - x1) * 0.38);
              return <g key={`${connector.from}-${connector.to}`}><path d={`M${x1} ${y1} C${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`} /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10}>{connector.label}</text></g>;
            })}
          </svg>
          {visibleScreens.map((screen) => {
            const pos = point(screen.id);
            const selected = selectedScreen === screen.id;
            return <article
              key={screen.id}
              data-flow-card
              className={`flow-screen-card${selected ? " is-selected" : ""}`}
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={(event) => { event.stopPropagation(); onSelect(screen.id); setDrag({ id: screen.id, sx: event.clientX, sy: event.clientY, ox: pos.x, oy: pos.y }); }}
              onDoubleClick={onEdit}
            >
              <div className="flow-screen-card__topline"><ScreenGlyph kind={screen.kind} /><span className="flow-screen-card__route">{screen.route}</span><span className={`flow-screen-card__status flow-screen-card__status--${screen.status}`}>{screen.status}</span></div>
              <h3>{screen.name}</h3>
              <p>{screen.description}</p>
              {selected && <div className="flow-screen-card__selection"><span>Selected · prompt edits apply here</span><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onHide(screen.id); }}>Hide from canvas</button></div>}
            </article>;
          })}
        </div>
        <div className="flow-canvas__minimap" aria-hidden="true"><span /><span /><span /><span /></div>
      </div>
    </section>
  );
}
