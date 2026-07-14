export const CANVAS_SCHEMA_VERSION = 1 as const;

export type CanvasLayoutMode = 'manual' | 'flow' | 'grid';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasNode {
  id: string;
  prototypeId: string;
  position: CanvasPoint;
  width: number;
  height: number;
  groupId?: string;
  zIndex: number;
}

export interface CanvasGroup {
  id: string;
  name: string;
  position: CanvasPoint;
  width: number;
  height: number;
  collapsed: boolean;
}

export interface CanvasEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  inferred: boolean;
  confirmed: boolean;
}

export interface CanvasAnnotation {
  id: string;
  text: string;
  position: CanvasPoint;
  nodeId?: string;
}

export interface CanvasPreferences {
  layoutMode: CanvasLayoutMode;
  gridEnabled: boolean;
  snapEnabled: boolean;
  gridSize: number;
}

export interface CanvasDocument {
  version: typeof CANVAS_SCHEMA_VERSION;
  nodes: CanvasNode[];
  groups: CanvasGroup[];
  edges: CanvasEdge[];
  annotations: CanvasAnnotation[];
  /** Prototype ids intentionally kept out of the board but available to restore. */
  hiddenPrototypeIds: string[];
  preferences: CanvasPreferences;
}

export interface CanvasPrototypeEntry {
  id: string;
}

export const DEFAULT_CANVAS_PREFERENCES: CanvasPreferences = {
  layoutMode: 'manual',
  gridEnabled: true,
  snapEnabled: true,
  gridSize: 24,
};

const FRAME_WIDTH = 380;
const FRAME_HEIGHT = 654;
const GAP_X = 96;
const GAP_Y = 96;
const COLUMNS = 4;

export function canvasNodeId(prototypeId: string): string {
  const id = prototypeId.trim();
  if (!id) throw new Error('prototype id must not be empty');
  return `prototype:${id}`;
}

export function canvasEdgeId(sourceNodeId: string, targetNodeId: string, label = ''): string {
  if (!sourceNodeId || !targetNodeId) throw new Error('edge endpoints must not be empty');
  return `edge:${sourceNodeId}->${targetNodeId}:${label}`;
}

export function defaultCanvasPosition(index: number): CanvasPoint {
  if (!Number.isInteger(index) || index < 0) throw new Error('node index must be a non-negative integer');
  return {
    x: (index % COLUMNS) * (FRAME_WIDTH + GAP_X),
    y: Math.floor(index / COLUMNS) * (FRAME_HEIGHT + GAP_Y),
  };
}

export function layoutCanvasNodes(nodes: readonly CanvasNode[], mode: CanvasLayoutMode): CanvasNode[] {
  if (mode === 'manual') return nodes.map((node) => ({ ...node, position: { ...node.position } }));
  const columns = mode === 'flow' ? 2 : COLUMNS;
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % columns) * (FRAME_WIDTH + GAP_X),
      y: Math.floor(index / columns) * (FRAME_HEIGHT + GAP_Y),
    },
  }));
}

export function createCanvasDocument(entries: readonly CanvasPrototypeEntry[]): CanvasDocument {
  const nodes = entries.map((entry, index): CanvasNode => ({
    id: canvasNodeId(entry.id),
    prototypeId: entry.id,
    position: defaultCanvasPosition(index),
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    zIndex: index,
  }));

  return {
    version: CANVAS_SCHEMA_VERSION,
    nodes,
    groups: [],
    edges: [],
    annotations: [],
    hiddenPrototypeIds: [],
    preferences: { ...DEFAULT_CANVAS_PREFERENCES },
  };
}

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
  return value;
}

function point(value: unknown, field: string): CanvasPoint {
  if (!value || typeof value !== 'object') throw new Error(`${field} must be an object`);
  const p = value as Record<string, unknown>;
  return { x: finite(p.x, `${field}.x`), y: finite(p.y, `${field}.y`) };
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value;
}

export function validateCanvasDocument(value: unknown): CanvasDocument {
  if (!value || typeof value !== 'object') throw new Error('Canvas document must be an object');
  const raw = value as Record<string, unknown>;
  if (raw.version !== CANVAS_SCHEMA_VERSION) throw new Error(`unsupported Canvas schema version: ${String(raw.version)}`);
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.groups) || !Array.isArray(raw.edges) || !Array.isArray(raw.annotations)) {
    throw new Error('Canvas document collections must be arrays');
  }
  const preferences = raw.preferences;
  if (!preferences || typeof preferences !== 'object') throw new Error('Canvas preferences are required');
  const prefs = preferences as Record<string, unknown>;
  const hiddenPrototypeIds = Array.isArray(raw.hiddenPrototypeIds)
    ? raw.hiddenPrototypeIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    : [];
  if (prefs.layoutMode !== 'manual' && prefs.layoutMode !== 'flow' && prefs.layoutMode !== 'grid') {
    throw new Error('preferences.layoutMode must be manual, flow, or grid');
  }
  const parsed: CanvasDocument = {
    version: CANVAS_SCHEMA_VERSION,
    nodes: raw.nodes.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`nodes[${index}] must be an object`);
      const n = item as Record<string, unknown>;
      const node: CanvasNode = {
        id: stringField(n.id, `nodes[${index}].id`),
        prototypeId: stringField(n.prototypeId, `nodes[${index}].prototypeId`),
        position: point(n.position, `nodes[${index}].position`),
        width: finite(n.width, `nodes[${index}].width`),
        height: finite(n.height, `nodes[${index}].height`),
        zIndex: finite(n.zIndex, `nodes[${index}].zIndex`),
      };
      if (node.width <= 0 || node.height <= 0) throw new Error(`nodes[${index}] dimensions must be positive`);
      if (typeof n.groupId === 'string' && n.groupId.trim()) node.groupId = n.groupId;
      return node;
    }),
    groups: raw.groups.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`groups[${index}] must be an object`);
      const g = item as Record<string, unknown>;
      return {
        id: stringField(g.id, `groups[${index}].id`),
        name: stringField(g.name, `groups[${index}].name`),
        position: point(g.position, `groups[${index}].position`),
        width: finite(g.width, `groups[${index}].width`),
        height: finite(g.height, `groups[${index}].height`),
        collapsed: g.collapsed === true,
      };
    }),
    edges: raw.edges.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`edges[${index}] must be an object`);
      const e = item as Record<string, unknown>;
      return {
        id: stringField(e.id, `edges[${index}].id`),
        sourceNodeId: stringField(e.sourceNodeId, `edges[${index}].sourceNodeId`),
        targetNodeId: stringField(e.targetNodeId, `edges[${index}].targetNodeId`),
        ...(typeof e.label === 'string' && e.label ? { label: e.label } : {}),
        inferred: e.inferred === true,
        confirmed: e.confirmed === true,
      };
    }),
    annotations: raw.annotations.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`annotations[${index}] must be an object`);
      const a = item as Record<string, unknown>;
      return {
        id: stringField(a.id, `annotations[${index}].id`),
        text: stringField(a.text, `annotations[${index}].text`),
        position: point(a.position, `annotations[${index}].position`),
        ...(typeof a.nodeId === 'string' && a.nodeId ? { nodeId: a.nodeId } : {}),
      };
    }),
    hiddenPrototypeIds: Array.from(new Set(hiddenPrototypeIds)),
    preferences: {
      layoutMode: prefs.layoutMode,
      gridEnabled: prefs.gridEnabled !== false,
      snapEnabled: prefs.snapEnabled !== false,
      gridSize: finite(prefs.gridSize, 'preferences.gridSize'),
    },
  };
  if (parsed.preferences.gridSize <= 0) throw new Error('preferences.gridSize must be positive');
  return parsed;
}

export function mergeCanvasDocument(saved: unknown, entries: readonly CanvasPrototypeEntry[]): CanvasDocument {
  const defaults = createCanvasDocument(entries);
  if (saved === undefined || saved === null) return defaults;
  const parsed = validateCanvasDocument(saved);
  const byPrototype = new Map(parsed.nodes.map((node) => [node.prototypeId, node]));
  const hidden = new Set(parsed.hiddenPrototypeIds);
  const nodes = entries.map((entry, index) => hidden.has(entry.id) ? undefined : (byPrototype.get(entry.id) ?? defaults.nodes[index]));
  return { ...parsed, nodes: nodes.filter((node): node is CanvasNode => !!node) };
}
