// brainrouter-desktop/src/panels/design/DesignContextMenu.tsx
// Figma-style right-click menu for the design canvas. Rendered through a
// portal: the world layer is transform-scaled, and a transformed ancestor would
// turn position:fixed into world-relative coordinates.
//
// Every row here does something. Where a row's Figma meaning has no exact
// analogue on an HTML prototype canvas, it is given a definite meaning rather
// than greyed out — see docs/design/Design.md for the table.
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DesignAnnotation } from '../../lib/design/designAnnotations.js';

export type MenuAction =
  | 'copy' | 'cut' | 'paste' | 'paste-replace' | 'duplicate' | 'delete'
  | 'front' | 'back'
  | 'group' | 'ungroup' | 'frame' | 'auto-layout' | 'mask' | 'flatten'
  | 'outline-text' | 'outline-stroke'
  | 'create-component' | 'create-component-chat'
  | 'toggle-hidden' | 'toggle-locked' | 'flip-x' | 'flip-y' | 'show-all';

/** What was right-clicked. Screens live in world space, annotations inside a
 *  screen — the menu is the one place both have to be spoken about at once. */
export type MenuTarget =
  | { kind: 'annotation'; annotation: DesignAnnotation }
  | { kind: 'screen'; id: string; locked: boolean }
  | null;

type Item =
  | { sep: true }
  | { label: string; shortcut?: string; action?: MenuAction; enabled: boolean };

const MENU_WIDTH = 232;
/** Kinds that carry a stroke worth outlining. */
const STROKED = new Set(['rectangle', 'line', 'ellipse', 'polygon', 'star', 'frame', 'section', 'path']);

export function DesignContextMenu({ x, y, target, selectionCount, clipboardFilled, hiddenCount, onAction, onClose }: {
  x: number;
  y: number;
  target: MenuTarget;
  /** How many objects the action would apply to, across both kinds. */
  selectionCount: number;
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
  const anno = target?.kind === 'annotation' ? target.annotation : null;
  const isScreen = target?.kind === 'screen';
  const many = selectionCount >= 2;

  const items: Item[] = [
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy', enabled: has },
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut', enabled: has },
    { label: 'Paste here', shortcut: 'Ctrl+V', action: 'paste', enabled: clipboardFilled },
    { label: 'Paste to replace', action: 'paste-replace', enabled: clipboardFilled && anno !== null },
    { sep: true },
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: 'duplicate', enabled: has },
    // A screen's HTML file is never deleted — it leaves the board and stays
    // restorable — so the row says what it actually does.
    { label: isScreen ? 'Remove from board' : 'Delete', shortcut: '⌫', action: 'delete', enabled: has },
    { sep: true },
    { label: 'Bring to front', shortcut: ']', action: 'front', enabled: has },
    { label: 'Send to back', shortcut: '[', action: 'back', enabled: has },
    { sep: true },
    { label: 'Group selection', shortcut: 'Ctrl+G', action: 'group', enabled: many },
    { label: 'Ungroup', shortcut: 'Ctrl+Shift+G', action: 'ungroup', enabled: Boolean(anno?.groupId) },
    { label: 'Frame selection', shortcut: 'Ctrl+Alt+G', action: 'frame', enabled: anno !== null },
    { label: 'Add auto layout', shortcut: 'Shift+A', action: 'auto-layout', enabled: anno?.kind === 'frame' || anno?.kind === 'section' },
    { label: 'Use as mask', shortcut: 'Ctrl+Alt+M', action: 'mask', enabled: Boolean(anno?.groupId) && anno?.kind !== 'frame' && anno?.kind !== 'section' },
    { label: 'Flatten', shortcut: 'Alt+Shift+F', action: 'flatten', enabled: anno !== null },
    { label: 'Outline text', action: 'outline-text', enabled: anno?.kind === 'text' },
    { label: 'Outline stroke', action: 'outline-stroke', enabled: Boolean(anno && STROKED.has(anno.kind)) },
    { sep: true },
    { label: 'Create component', shortcut: 'Ctrl+Alt+K', action: 'create-component', enabled: has },
    { label: 'Create component with chat…', action: 'create-component-chat', enabled: true },
    { sep: true },
    { label: 'Show/Hide', shortcut: 'Ctrl+Shift+H', action: 'toggle-hidden', enabled: has },
    ...(hiddenCount > 0 ? [{ label: `Show all (${hiddenCount})`, action: 'show-all' as const, enabled: true }] : []),
    { label: target?.kind === 'screen' && target.locked || anno?.locked ? 'Unlock' : 'Lock/Unlock', shortcut: 'Ctrl+Shift+L', action: 'toggle-locked', enabled: has },
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
