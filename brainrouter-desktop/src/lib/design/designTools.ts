// brainrouter-desktop/src/lib/design/designTools.ts
// The Designs-editor tool model + keyboard-shortcut mapping. Lives in lib (not
// the toolbar component) so pure logic and tests never import a .tsx file.

export type DesignTool = 'select' | 'hand' | 'frame' | 'shape' | 'text' | 'inspect';

/** Flyout variants — Figma-style split buttons on the bottom toolbar. */
export type FrameKind = 'frame' | 'section';
export type ShapeKind = 'rectangle' | 'line' | 'ellipse' | 'polygon' | 'star';

export interface ToolSelection {
  tool: DesignTool;
  frameKind?: FrameKind;
  shapeKind?: ShapeKind;
}

/**
 * Single-key shortcuts, following OpenPencil's (Figma-compatible) tool map:
 * V move/select, H hand, F frame, S section, R rectangle, O ellipse, L line,
 * T text. Polygon and Star are flyout-only there, and are here too.
 *
 * One deliberate divergence: OpenPencil binds I to an eyedropper, which this
 * editor does not have. I stays on Inspect — the element picker — because that
 * is this surface's reason to exist.
 */
export const TOOL_FOR_KEY: Record<string, ToolSelection> = {
  v: { tool: 'select' },
  h: { tool: 'hand' },
  f: { tool: 'frame', frameKind: 'frame' },
  s: { tool: 'frame', frameKind: 'section' },
  r: { tool: 'shape', shapeKind: 'rectangle' },
  l: { tool: 'shape', shapeKind: 'line' },
  o: { tool: 'shape', shapeKind: 'ellipse' },
  t: { tool: 'text' },
  i: { tool: 'inspect' },
};

/**
 * Tools that make something and then hand back to Select, the way every
 * direct-manipulation editor does — you draw one rectangle, not a field of
 * them. Hand, Select and Inspect are modes and stay put.
 */
export function revertsToSelect(tool: DesignTool): boolean {
  return tool === 'frame' || tool === 'shape' || tool === 'text';
}

export function toolForKey(key: string): ToolSelection | null {
  if (key.length !== 1) return null; // 'F5', 'Tab', … are never tool shortcuts
  return TOOL_FOR_KEY[key.toLowerCase()] ?? null;
}

export function shouldArmElementPicker(tool: DesignTool): boolean {
  return tool === 'select' || tool === 'inspect';
}

/** True when a keystroke belongs to a text field, so shortcuts must not fire. */
export function isEditableTarget(target: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
