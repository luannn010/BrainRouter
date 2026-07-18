// brainrouter-desktop/src/panels/design/DesignContextMenu.tsx
// Figma-style right-click menu for the annotation layer. Rendered through a
// portal: the stage is transform-scaled, and a transformed ancestor would turn
// position:fixed into stage-relative coordinates.
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DesignAnnotation } from '../../lib/design/designAnnotations.js';

export type MenuAction =
  | 'copy' | 'cut' | 'paste' | 'duplicate' | 'delete'
  | 'front' | 'back' | 'toggle-hidden' | 'toggle-locked' | 'flip-x' | 'flip-y'
  | 'show-all';

type Item =
  | { sep: true }
  | { label: string; shortcut?: string; action?: MenuAction; enabled: boolean };

const MENU_WIDTH = 232;

export function DesignContextMenu({ x, y, target, clipboardFilled, hiddenCount, onAction, onClose }: {
  x: number;
  y: number;
  target: DesignAnnotation | null;
  clipboardFilled: boolean;
  /** Hidden annotations are click-transparent, so "Show all" is their only way back. */
  hiddenCount: number;
  onAction: (action: MenuAction) => void;
  onClose: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const has = target !== null;
  // The greyed rows mirror Figma's menu for familiarity; they act on concepts
  // (components, auto layout, masks…) that don't exist for redline annotations.
  const items: Item[] = [
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy', enabled: has },
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut', enabled: has },
    { label: 'Paste here', shortcut: 'Ctrl+V', action: 'paste', enabled: clipboardFilled },
    { label: 'Paste to replace', enabled: false },
    { sep: true },
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: 'duplicate', enabled: has },
    { label: 'Delete', shortcut: '⌫', action: 'delete', enabled: has },
    { sep: true },
    { label: 'Bring to front', shortcut: ']', action: 'front', enabled: has },
    { label: 'Send to back', shortcut: '[', action: 'back', enabled: has },
    { sep: true },
    { label: 'Group selection', shortcut: 'Ctrl+G', enabled: false },
    { label: 'Frame selection', shortcut: 'Ctrl+Alt+G', enabled: false },
    { label: 'Add auto layout', shortcut: 'Shift+A', enabled: false },
    { label: 'Use as mask', shortcut: 'Ctrl+Alt+M', enabled: false },
    { label: 'Flatten', shortcut: 'Alt+Shift+F', enabled: false },
    { label: 'Outline text', enabled: false },
    { label: 'Outline stroke', enabled: false },
    { sep: true },
    { label: 'Create component', shortcut: 'Ctrl+Alt+K', enabled: false },
    { sep: true },
    { label: 'Show/Hide', shortcut: 'Ctrl+Shift+H', action: 'toggle-hidden', enabled: has },
    ...(hiddenCount > 0 ? [{ label: `Show all (${hiddenCount})`, action: 'show-all' as const, enabled: true }] : []),
    { label: target?.locked ? 'Unlock' : 'Lock/Unlock', shortcut: 'Ctrl+Shift+L', action: 'toggle-locked', enabled: has },
    { label: 'Flip horizontal', shortcut: 'Shift+H', action: 'flip-x', enabled: has },
    { label: 'Flip vertical', shortcut: 'Shift+V', action: 'flip-y', enabled: has },
  ];

  const left = Math.max(4, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const estHeight = items.length * 26;
  const top = Math.max(4, Math.min(y, window.innerHeight - Math.min(estHeight, window.innerHeight - 16) - 8));

  return createPortal(
    <div ref={ref} className="ds-ctx-menu" role="menu" style={{ left, top, width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, i) => 'sep' in item
        ? <div key={i} className="ds-ctx-sep" />
        : (
          <button key={i} type="button" role="menuitem" className="ds-ctx-item" disabled={!item.enabled}
            onClick={item.action && item.enabled ? () => { onAction(item.action!); onClose(); } : undefined}>
            <span>{item.label}</span>
            {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
          </button>
        ))}
    </div>,
    document.body,
  );
}
