import React from 'react';
import type { CanvasNode } from '../../lib/design/canvasModel.js';
import type { PrototypeFrame } from '../../lib/design/useCanvasFrames.js';
import { extractPrototypeTransitions } from '../../lib/design/flowExtraction.js';

export function CanvasInspector({ frame, node, onOpen, onFocus, onClear, onRemove }: {
  frame: PrototypeFrame | null;
  node: CanvasNode | null;
  onOpen: () => void;
  onFocus: () => void;
  onClear: () => void;
  onRemove: () => void;
}): React.ReactElement {
  if (!frame || !node) {
    return <aside className="ds-canvas-inspector" aria-label="Canvas inspector"><p className="ds-inspector-empty">Select a flow frame to inspect it.</p></aside>;
  }
  const testidCount = (frame.content.match(/data-testid\s*=/gi) ?? []).length;
  const transitionCount = extractPrototypeTransitions(frame.content).transitions.length;
  return (
    <aside className="ds-canvas-inspector" aria-label="Canvas inspector">
      <div className="ds-inspector-head"><span className="ds-eyebrow">Inspect</span><button className="ds-iconbtn" onClick={onClear} aria-label="Clear selection">×</button></div>
      <h2 className="ds-inspector-title">{frame.title}</h2>
      <p className="ds-inspector-path" data-mono>{frame.path}</p>
      <dl className="ds-inspector-list">
        <dt>Position</dt><dd data-mono>{Math.round(node.position.x)}, {Math.round(node.position.y)}</dd>
        <dt>Viewport</dt><dd data-mono>{node.width} × {node.height}</dd>
        <dt>HTML size</dt><dd data-mono>{frame.content.length.toLocaleString()} bytes</dd>
        <dt>Interactive hooks</dt><dd data-mono>{testidCount} testid{testidCount === 1 ? '' : 's'}</dd>
        <dt>Transitions</dt><dd data-mono>{transitionCount}</dd>
      </dl>
      <div className="ds-inspector-actions">
        <button className="ds-iconbtn" onClick={onFocus}>Focus</button>
        <button className="ds-iconbtn ds-iconbtn--accent" onClick={onOpen}>Open in Designs</button>
        <button className="ds-iconbtn" onClick={onRemove}>Remove from canvas</button>
      </div>
    </aside>
  );
}
