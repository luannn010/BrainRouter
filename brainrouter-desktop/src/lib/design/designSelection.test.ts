import test from 'node:test';
import assert from 'node:assert/strict';
import {
  idsOfKind, isSelected, marqueeSelect, rectsIntersect, sameRef,
  selectOnly, selectionBounds, toggleSelection, type SelectableItem,
} from './designSelection.js';

const items: SelectableItem[] = [
  { kind: 'screen', id: 'home', bounds: { x: 0, y: 0, w: 380, h: 654 } },
  { kind: 'screen', id: 'about', bounds: { x: 480, y: 0, w: 380, h: 654 } },
  { kind: 'annotation', id: 'a1', bounds: { x: 40, y: 40, w: 100, h: 40 } },
];

test('toggle adds then removes a ref and never duplicates it', () => {
  const one = toggleSelection([], { kind: 'screen', id: 'home' });
  assert.equal(one.length, 1);
  const twice = toggleSelection(one, { kind: 'screen', id: 'home' });
  assert.deepEqual(twice, []);
  const both = toggleSelection(one, { kind: 'annotation', id: 'home' });
  assert.equal(both.length, 2, 'the same id in a different kind is a different object');
});

test('selectOnly replaces the selection and clears on null', () => {
  assert.deepEqual(selectOnly({ kind: 'screen', id: 'home' }), [{ kind: 'screen', id: 'home' }]);
  assert.deepEqual(selectOnly(null), []);
});

test('membership tests are kind-aware', () => {
  const sel = selectOnly({ kind: 'screen', id: 'home' });
  assert.equal(isSelected(sel, 'screen', 'home'), true);
  assert.equal(isSelected(sel, 'annotation', 'home'), false);
  assert.equal(sameRef({ kind: 'screen', id: 'a' }, { kind: 'screen', id: 'a' }), true);
  assert.equal(sameRef({ kind: 'screen', id: 'a' }, { kind: 'annotation', id: 'a' }), false);
});

test('idsOfKind extracts one kind in selection order', () => {
  const sel = [
    { kind: 'annotation' as const, id: 'a1' },
    { kind: 'screen' as const, id: 'home' },
    { kind: 'annotation' as const, id: 'a2' },
  ];
  assert.deepEqual(idsOfKind(sel, 'annotation'), ['a1', 'a2']);
  assert.deepEqual(idsOfKind(sel, 'screen'), ['home']);
});

test('rect intersection includes touching edges but excludes separated rects', () => {
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), true);
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 }), false);
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 11, w: 10, h: 10 }), false);
});

test('a marquee selects every item it touches', () => {
  assert.deepEqual(marqueeSelect(items, { x: -10, y: -10, w: 60, h: 60 }), [
    { kind: 'screen', id: 'home' },
    { kind: 'annotation', id: 'a1' },
  ]);
  assert.deepEqual(marqueeSelect(items, { x: 900, y: 900, w: 10, h: 10 }), []);
});

test('selection bounds union every selected item and ignore the rest', () => {
  const sel = [{ kind: 'screen' as const, id: 'home' }, { kind: 'annotation' as const, id: 'a1' }];
  assert.deepEqual(selectionBounds(items, sel), { x: 0, y: 0, w: 380, h: 654 });
  assert.deepEqual(
    selectionBounds(items, [{ kind: 'screen', id: 'home' }, { kind: 'screen', id: 'about' }]),
    { x: 0, y: 0, w: 860, h: 654 },
  );
  assert.equal(selectionBounds(items, []), null);
  assert.equal(selectionBounds(items, [{ kind: 'screen', id: 'ghost' }]), null);
});
