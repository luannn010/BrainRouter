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
