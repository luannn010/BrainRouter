import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_SCHEMA_VERSION,
  canvasEdgeId,
  canvasNodeId,
  createCanvasDocument,
  defaultCanvasPosition,
  mergeCanvasDocument,
  layoutCanvasNodes,
  validateCanvasDocument,
} from './canvasModel.js';

test('creates deterministic node ids and four-column default positions', () => {
  const document = createCanvasDocument([{ id: 'sign-in' }, { id: 'register' }, { id: 'sign-out' }, { id: 'welcome' }, { id: 'settings' }]);
  assert.equal(document.version, CANVAS_SCHEMA_VERSION);
  assert.deepEqual(document.nodes.map((node) => node.id), [
    'prototype:sign-in', 'prototype:register', 'prototype:sign-out', 'prototype:welcome', 'prototype:settings',
  ]);
  assert.deepEqual(document.nodes[4].position, defaultCanvasPosition(4));
  assert.deepEqual(document.preferences, { layoutMode: 'manual', gridEnabled: true, snapEnabled: true, gridSize: 24 });
});

test('rejects malformed documents and invalid ids', () => {
  assert.throws(() => canvasNodeId('  '), /prototype id/);
  assert.throws(() => canvasEdgeId('', 'target'), /edge endpoints/);
  assert.throws(() => validateCanvasDocument({ version: 99 }), /unsupported Canvas schema/);
  assert.throws(() => validateCanvasDocument({ version: 1, nodes: [], groups: [], edges: [], annotations: [], preferences: { layoutMode: 'freeform', gridSize: 24 } }), /layoutMode/);
});

test('merges saved positions with newly discovered prototypes', () => {
  const defaults = createCanvasDocument([{ id: 'a' }, { id: 'b' }]);
  const saved = { ...defaults, nodes: [{ ...defaults.nodes[0], position: { x: 800, y: 120 } }] };
  const merged = mergeCanvasDocument(saved, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.deepEqual(merged.nodes.map((node) => node.prototypeId), ['a', 'b', 'c']);
  assert.deepEqual(merged.nodes[0].position, { x: 800, y: 120 });
  assert.deepEqual(merged.nodes[1].position, defaultCanvasPosition(1));
  assert.deepEqual(merged.nodes[2].position, defaultCanvasPosition(2));
});

test('keeps removed prototypes restorable without deleting their source entry', () => {
  const defaults = createCanvasDocument([{ id: 'a' }, { id: 'b' }]);
  const saved = { ...defaults, hiddenPrototypeIds: ['b'] };
  const merged = mergeCanvasDocument(saved, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.deepEqual(merged.nodes.map((node) => node.prototypeId), ['a', 'c']);
  assert.deepEqual(merged.hiddenPrototypeIds, ['b']);
});

test('layout modes are deterministic and manual mode preserves positions', () => {
  const document = createCanvasDocument([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const moved = { ...document.nodes[0], position: { x: 777, y: 333 } };
  assert.deepEqual(layoutCanvasNodes([moved], 'manual')[0].position, { x: 777, y: 333 });
  assert.deepEqual(layoutCanvasNodes(document.nodes, 'flow').map((node) => node.position), [{ x: 0, y: 0 }, { x: 476, y: 0 }, { x: 0, y: 750 }]);
});

test('a v1 document upgrades to v2 with an empty component list', () => {
  const v1 = {
    version: 1,
    nodes: [{ id: 'prototype:home', prototypeId: 'home', position: { x: 12, y: 24 }, width: 380, height: 654, zIndex: 0 }],
    groups: [], edges: [], annotations: [], hiddenPrototypeIds: [],
    preferences: { layoutMode: 'manual', gridEnabled: true, snapEnabled: true, gridSize: 24 },
  };
  const parsed = validateCanvasDocument(v1);
  assert.equal(parsed.version, CANVAS_SCHEMA_VERSION);
  assert.deepEqual(parsed.components, []);
  assert.deepEqual(parsed.nodes[0].position, { x: 12, y: 24 }, 'the upgrade preserves placement');
});

test('node state flags survive a round trip and default to unset', () => {
  const doc = createCanvasDocument([{ id: 'home' }]);
  const flagged = validateCanvasDocument({
    ...doc,
    nodes: [{ ...doc.nodes[0], hidden: true, locked: true, flipX: true, flipY: false }],
  });
  assert.equal(flagged.nodes[0].hidden, true);
  assert.equal(flagged.nodes[0].locked, true);
  assert.equal(flagged.nodes[0].flipX, true);
  assert.equal(flagged.nodes[0].flipY, undefined, 'a false flag is dropped rather than stored');
  assert.equal(validateCanvasDocument(doc).nodes[0].hidden, undefined);
});

test('a group carries an optional auto layout spec', () => {
  const doc = createCanvasDocument([{ id: 'home' }]);
  const group = { id: 'g1', name: 'Row', position: { x: 0, y: 0 }, width: 100, height: 100, collapsed: false };
  const withGroup = validateCanvasDocument({
    ...doc,
    groups: [{ ...group, autoLayout: { direction: 'row', gap: 16, padX: 8, padY: 8, align: 'center' } }],
  });
  assert.deepEqual(withGroup.groups[0].autoLayout, { direction: 'row', gap: 16, padX: 8, padY: 8, align: 'center' });
  assert.equal(validateCanvasDocument({ ...doc, groups: [group] }).groups[0].autoLayout, undefined);
  assert.throws(() => validateCanvasDocument({
    ...doc,
    groups: [{ ...group, autoLayout: { direction: 'diagonal', gap: 1, padX: 1, padY: 1, align: 'center' } }],
  }), /autoLayout\.direction/);
});

test('components are validated and kept', () => {
  const doc = createCanvasDocument([{ id: 'home' }]);
  const withComponent = validateCanvasDocument({
    ...doc,
    components: [{ id: 'c1', name: 'Primary button', html: '<button>Go</button>', width: 120, height: 40 }],
  });
  assert.equal(withComponent.components.length, 1);
  assert.equal(withComponent.components[0].name, 'Primary button');
  assert.throws(() => validateCanvasDocument({ ...doc, components: [{ id: '', name: 'x', html: 'y', width: 1, height: 1 }] }), /components\[0\]\.id/);
  assert.throws(() => validateCanvasDocument({ ...doc, components: [{ id: 'c1', name: 'x', html: 'y', width: 0, height: 1 }] }), /components\[0\]\.width/);
});

test('a future schema version is still rejected', () => {
  assert.throws(() => validateCanvasDocument({ version: 99 }), /unsupported Canvas schema/);
});
