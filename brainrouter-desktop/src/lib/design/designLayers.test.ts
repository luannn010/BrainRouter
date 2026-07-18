import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasLayerRows } from './designLayers.js';
import { createAnnotation, type DesignAnnotation } from './designAnnotations.js';
import type { CanvasComponent } from './canvasModel.js';

const anno = (kind: DesignAnnotation['kind'], id: string, label = '', extra: Partial<DesignAnnotation> = {}): DesignAnnotation => ({
  ...createAnnotation(kind, { x: 0, y: 0, w: 10, h: 10 }, { id, label }),
  ...extra,
});

test('canvas layers list the topmost annotation first', () => {
  const rows = canvasLayerRows([anno('rectangle', 'a', 'A'), anno('ellipse', 'b', 'B')], []);
  assert.deepEqual(rows.map((row) => row.id), ['b', 'a'], 'array order is z-order, so the tree reverses it');
  assert.equal(rows[0].kind, 'annotation');
});

test('a frame owns its members and nests them one level in', () => {
  const rows = canvasLayerRows([
    anno('frame', 'f', 'Frame 1'),
    anno('rectangle', 'm1', 'One', { groupId: 'f' }),
    anno('rectangle', 'm2', 'Two', { groupId: 'f' }),
    anno('text', 'loose', 'Loose'),
  ], []);
  assert.deepEqual(rows.map((row) => [row.id, row.depth]), [
    ['loose', 0],
    ['f', 0],
    ['m2', 1],
    ['m1', 1],
  ], 'members follow their frame, topmost member first');
});

test('a member never also appears at the top level', () => {
  const rows = canvasLayerRows([anno('section', 's', 'Section 1'), anno('star', 'm', 'M', { groupId: 's' })], []);
  assert.equal(rows.filter((row) => row.id === 'm').length, 1);
});

test('nesting goes as deep as the containers do', () => {
  // Ctrl+Alt+G over a selection containing a frame nests frame inside frame.
  const rows = canvasLayerRows([
    anno('frame', 'outer', 'Outer'),
    anno('frame', 'inner', 'Inner', { groupId: 'outer' }),
    anno('rectangle', 'leaf', 'Leaf', { groupId: 'inner' }),
  ], []);
  assert.deepEqual(rows.map((row) => [row.id, row.depth]), [
    ['outer', 0], ['inner', 1], ['leaf', 2],
  ], 'a grandchild must not be dropped');
});

test('a containment cycle terminates and still lists every layer once', () => {
  const rows = canvasLayerRows([
    anno('frame', 'a', 'A', { groupId: 'b' }),
    anno('frame', 'b', 'B', { groupId: 'a' }),
  ], []);
  assert.equal(rows.length, 2);
  assert.deepEqual([...rows.map((row) => row.id)].sort(), ['a', 'b']);
});

test('an annotation parented to itself is treated as a root', () => {
  const rows = canvasLayerRows([anno('frame', 'a', 'A', { groupId: 'a' })], []);
  assert.deepEqual(rows.map((row) => [row.id, row.depth]), [['a', 0]]);
});

test('a groupId naming a non-container leaves the layer flat', () => {
  const rows = canvasLayerRows([anno('rectangle', 'r', 'R'), anno('star', 's', 'S', { groupId: 'r' })], []);
  assert.deepEqual(rows.map((row) => [row.id, row.depth]), [['s', 0], ['r', 0]]);
});

test('a plain group with no container annotation stays flat rather than vanishing', () => {
  // groupAnnotations() mints a uuid that matches no annotation, unlike
  // frameSelection() which uses the frame's own id.
  const rows = canvasLayerRows([anno('rectangle', 'a', 'A', { groupId: 'ghost' }), anno('rectangle', 'b', 'B', { groupId: 'ghost' })], []);
  assert.deepEqual(rows.map((row) => [row.id, row.depth]), [['b', 0], ['a', 0]]);
});

test('rows carry a label, a kind badge, a glyph and state flags', () => {
  const rows = canvasLayerRows([anno('rectangle', 'a', 'Card', { hidden: true, locked: true })], []);
  assert.equal(rows[0].label, 'Card');
  assert.equal(rows[0].meta, 'rectangle');
  assert.equal(rows[0].icon, 'square');
  assert.equal(rows[0].hidden, true);
  assert.equal(rows[0].locked, true);
});

test('an unlabelled annotation falls back to its kind rather than showing blank', () => {
  const rows = canvasLayerRows([anno('ellipse', 'a', '')], []);
  assert.equal(rows[0].label, 'Ellipse');
});

test('an annotation packed into a component reports that component', () => {
  const components: CanvasComponent[] = [{ id: 'c1', name: 'Primary card', html: '<i/>', width: 10, height: 10 }];
  const rows = canvasLayerRows([anno('frame', 'f', 'Frame 1', { componentId: 'c1' })], components);
  assert.equal(rows[0].componentName, 'Primary card');
  assert.equal(rows[0].icon, 'layout', 'a packed layer reads as a component');
});

test('a link to a deleted component is treated as unpacked, not shown as stale', () => {
  const rows = canvasLayerRows([anno('frame', 'f', 'Frame 1', { componentId: 'gone' })], []);
  assert.equal(rows[0].componentName, undefined);
  assert.equal(rows[0].icon, 'frame');
});

test('an empty canvas produces no rows', () => {
  assert.deepEqual(canvasLayerRows([], []), []);
});

test('every annotation kind maps to a glyph', () => {
  const kinds: DesignAnnotation['kind'][] = ['frame', 'section', 'rectangle', 'line', 'ellipse', 'polygon', 'star', 'text', 'path'];
  const rows = canvasLayerRows(kinds.map((kind, i) => anno(kind, `k${i}`, kind)), []);
  assert.equal(rows.every((row) => row.icon.length > 0), true);
});
