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

/** Single-key shortcuts, matching the toolbar + flyout hints. S is the
 *  inspect/select shortcut requested by Design Studio; Section remains
 *  available from the Frame flyout. */
export const TOOL_FOR_KEY: Record<string, ToolSelection> = {
  v: { tool: 'select' },
  s: { tool: 'inspect' },
  h: { tool: 'hand' },
  f: { tool: 'frame', frameKind: 'frame' },
  r: { tool: 'shape', shapeKind: 'rectangle' },
  l: { tool: 'shape', shapeKind: 'line' },
  o: { tool: 'shape', shapeKind: 'ellipse' },
  t: { tool: 'text' },
  i: { tool: 'inspect' },
};

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
