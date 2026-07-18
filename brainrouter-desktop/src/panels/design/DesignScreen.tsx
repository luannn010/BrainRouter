// brainrouter-desktop/src/panels/design/DesignScreen.tsx
// One screen on the design canvas. Only the active screen carries the live
// webview, and that surface is a separate always-mounted layer positioned over
// this frame (see DesignsView) — moving it between frames would tear down and
// rebuild the guest on every selection change. Every other screen renders a
// static, pointer-inert snapshot, so a twenty-screen board costs one guest.
import React from 'react';
import { Icon } from '../../icons.js';
import type { CanvasNode } from '../../lib/design/canvasModel.js';
import type { Device } from './PreviewCanvas.js';

export const DEVICE_SIZE: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  tablet: { w: 820, h: 1180 },
  phone: { w: 390, h: 844 },
};

export function DesignScreen({ node, title, content, active, selected }: {
  node: CanvasNode;
  title: string;
  content: string | null;
  /** The live surface covers this frame, so its body stays empty. */
  active: boolean;
  selected: boolean;
}): React.ReactElement | null {
  if (node.hidden) return null;
  const flips = [node.flipX ? 'scaleX(-1)' : '', node.flipY ? 'scaleY(-1)' : ''].filter(Boolean).join(' ');
  const classes = ['ds-screen', selected ? 'is-selected' : '', active ? 'is-active' : '', node.locked ? 'is-locked' : ''].filter(Boolean).join(' ');
  return <div className={classes} data-screen-id={node.prototypeId}
    style={{ left: node.position.x, top: node.position.y, width: node.width, height: node.height, zIndex: node.zIndex }}>
    <div className="ds-screen-head" title={title}>
      <Icon name="file" size={11} />
      <span>{title}</span>
      <small data-mono>{Math.round(node.width)}×{Math.round(node.height)}</small>
    </div>
    <div className="ds-screen-body" style={flips ? { transform: flips } : undefined}>
      {active || !content
        ? <div className="ds-screen-blank" />
        : <iframe className="ds-screen-doc" sandbox="allow-scripts" srcDoc={content} tabIndex={-1} title={title} />}
    </div>
  </div>;
}
