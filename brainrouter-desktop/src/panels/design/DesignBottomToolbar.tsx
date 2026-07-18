import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../icons.js';
import type { DesignTool, FrameKind, ShapeKind } from '../../lib/design/designTools.js';

// The tool union lives in lib/design/designTools.ts (with the shortcut map);
// re-exported here so existing importers keep working.
export type { DesignTool };

const FRAME_VARIANTS: Array<{ kind: FrameKind; icon: string; label: string; shortcut: string }> = [
  { kind: 'frame', icon: 'frame', label: 'Frame', shortcut: 'F' },
  { kind: 'section', icon: 'section', label: 'Section', shortcut: '' },
];
const SHAPE_VARIANTS: Array<{ kind: ShapeKind; icon: string; label: string; shortcut: string }> = [
  { kind: 'rectangle', icon: 'square', label: 'Rectangle', shortcut: 'R' },
  { kind: 'line', icon: 'line', label: 'Line', shortcut: 'L' },
  { kind: 'ellipse', icon: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { kind: 'polygon', icon: 'polygon', label: 'Polygon', shortcut: '' },
  { kind: 'star', icon: 'star', label: 'Star', shortcut: '' },
];

/** Figma-style split tool button: the main button activates the tool with its
 *  current variant; the chevron opens a flyout to switch variants. */
function SplitTool<K extends string>({ toolId, active, variants, current, open, onOpenChange, onPick }: {
  toolId: DesignTool;
  active: boolean;
  variants: ReadonlyArray<{ kind: K; icon: string; label: string; shortcut: string }>;
  current: K;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (kind: K | null) => void;
}): React.ReactElement {
  const variant = variants.find((v) => v.kind === current) ?? variants[0];
  return (
    <div className="ds-tool-split" data-tool={toolId}>
      <button type="button" className={`ds-tool-button${active ? ' is-active' : ''}`}
        aria-pressed={active} aria-label={`${variant.label}${variant.shortcut ? ` (${variant.shortcut})` : ''}`}
        title={`${variant.label}${variant.shortcut ? ` · ${variant.shortcut}` : ''}`}
        onClick={() => onPick(null)}>
        <Icon name={variant.icon} size={15} />
      </button>
      <button type="button" className="ds-tool-chevron" aria-label={`${toolId} tool options`}
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => onOpenChange(!open)}>
        <Icon name="chev-down" size={8} />
      </button>
      {open ? (
        <div className="ds-tool-flyout" role="menu">
          {variants.map((v) => (
            <button key={v.kind} type="button" role="menuitem" className={`ds-flyout-item${current === v.kind ? ' is-current' : ''}`}
              onClick={() => onPick(v.kind)}>
              <Icon name={v.icon} size={14} />
              <span>{v.label}</span>
              <kbd>{v.shortcut}</kbd>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DesignBottomToolbar({ tool, onToolChange, frameKind, shapeKind, onFrameKindChange, onShapeKindChange, zoom, onZoomChange, onFit }: {
  tool: DesignTool;
  onToolChange: (tool: DesignTool) => void;
  frameKind: FrameKind;
  shapeKind: ShapeKind;
  onFrameKindChange: (kind: FrameKind) => void;
  onShapeKindChange: (kind: ShapeKind) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
}): React.ReactElement {
  const [flyout, setFlyout] = useState<'frame' | 'shape' | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!flyout) return;
    const close = (e: PointerEvent): void => { if (!rootRef.current?.contains(e.target as Node)) setFlyout(null); };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setFlyout(null); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onKey); };
  }, [flyout]);

  const plain = (id: DesignTool, icon: string, label: string, shortcut: string): React.ReactElement => (
    <button key={id} type="button" className={`ds-tool-button${tool === id ? ' is-active' : ''}`}
      aria-pressed={tool === id} aria-label={`${label} (${shortcut})`} title={`${label} · ${shortcut}`}
      onClick={() => { onToolChange(id); setFlyout(null); }}>
      <Icon name={icon} size={15} />
    </button>
  );

  return <div className="ds-bottom-toolbar" role="toolbar" aria-label="Design tools" ref={rootRef}>
    <div className="ds-tool-group">
      {plain('select', 'cursor', 'Select', 'V')}
      <SplitTool toolId="frame" active={tool === 'frame'} variants={FRAME_VARIANTS} current={frameKind}
        open={flyout === 'frame'} onOpenChange={(o) => setFlyout(o ? 'frame' : null)}
        onPick={(kind) => { if (kind) onFrameKindChange(kind); onToolChange('frame'); setFlyout(null); }} />
      <SplitTool toolId="shape" active={tool === 'shape'} variants={SHAPE_VARIANTS} current={shapeKind}
        open={flyout === 'shape'} onOpenChange={(o) => setFlyout(o ? 'shape' : null)}
        onPick={(kind) => { if (kind) onShapeKindChange(kind); onToolChange('shape'); setFlyout(null); }} />
      {plain('text', 'text', 'Text', 'T')}
      {plain('hand', 'hand', 'Hand', 'H')}
      {plain('inspect', 'inspect', 'Inspect', 'I')}
    </div>
    <span className="ds-tool-divider" />
    <button type="button" className="ds-zoom-button" aria-label="Zoom out" onClick={() => onZoomChange(Math.max(25, zoom - 10))}>−</button><span className="ds-zoom-value" data-mono>{zoom}%</span><button type="button" className="ds-zoom-button" aria-label="Zoom in" onClick={() => onZoomChange(Math.min(200, zoom + 10))}>+</button><button type="button" className="ds-zoom-button" aria-label="Fit prototype" title="Fit prototype" onClick={onFit}><Icon name="expand" size={14} /></button>
  </div>;
}
