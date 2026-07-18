// brainrouter-desktop/src/panels/design/DesignScreen.tsx
// One screen on the design canvas. Only the active screen carries the live
// webview, and that surface is a separate always-mounted layer positioned over
// this frame (see DesignsView) — moving it between frames would tear down and
// rebuild the guest on every selection change. Every other screen renders a
// static, pointer-inert snapshot, so a twenty-screen board costs one guest.
import React from 'react';
import { Icon } from '../../icons.js';
import type { CanvasNode } from '../../lib/design/canvasModel.js';
import { RESIZE_HANDLES } from '../../lib/design/screenResize.js';
import type { Device } from './PreviewCanvas.js';

export const DEVICE_SIZE: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  tablet: { w: 820, h: 1180 },
  phone: { w: 390, h: 844 },
};

/** Screen px the header and handles hold, whatever the canvas zoom is. */
const CHROME_PX = 22;
const HANDLE_PX = 10;

export function DesignScreen({ node, title, content, active, selected, scale }: {
  node: CanvasNode;
  title: string;
  content: string | null;
  /** The live surface covers this frame, so its body stays empty. */
  active: boolean;
  selected: boolean;
  /** Canvas zoom — chrome is counter-scaled by it so it never shrinks away. */
  scale: number;
}): React.ReactElement | null {
  if (node.hidden) return null;
  const flips = [node.flipX ? 'scaleX(-1)' : '', node.flipY ? 'scaleY(-1)' : ''].filter(Boolean).join(' ');
  const classes = ['ds-screen', selected ? 'is-selected' : '', active ? 'is-active' : '', node.locked ? 'is-locked' : ''].filter(Boolean).join(' ');
  // The world layer scales everything; chrome divides that back out so the grab
  // targets stay the same physical size at 10% zoom and at 400%.
  const inv = 1 / (scale || 1);
  const chrome = CHROME_PX * inv;
  const handle = HANDLE_PX * inv;

  return <div className={classes} data-screen-id={node.prototypeId}
    style={{ left: node.position.x, top: node.position.y, width: node.width, height: node.height, zIndex: node.zIndex }}>
    <div className="ds-screen-head" title={title} data-screen-id={node.prototypeId}
      style={{ top: -chrome, height: chrome, fontSize: 11 * inv, gap: 6 * inv, padding: `0 ${2 * inv}px` }}>
      <Icon name={node.locked ? 'pin' : 'file'} size={Math.round(11 * inv)} />
      <span>{title}</span>
      <small data-mono style={{ fontSize: 9 * inv }}>{Math.round(node.width)}×{Math.round(node.height)}</small>
    </div>
    <div className="ds-screen-body" style={flips ? { transform: flips } : undefined}>
      {active || !content
        ? <div className="ds-screen-blank" />
        : <iframe className="ds-screen-doc" sandbox="allow-scripts" srcDoc={content} tabIndex={-1} title={title} />}
    </div>
    {/* Handles live on the selected screen only, above the live surface, and
        are counter-scaled so they stay grabbable however far you zoom out. */}
    {selected && !node.locked ? RESIZE_HANDLES.map((id) => (
      <span key={id} className={`ds-screen-resize ds-screen-resize--${id}`} data-resize={id} data-screen-id={node.prototypeId}
        style={{ width: handle, height: handle, borderWidth: Math.max(1, inv) }} />
    )) : null}
  </div>;
}
