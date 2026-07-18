import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annotationsKey, bringToFront, clientToStagePoint, createAnnotation, dragFlip,
  duplicateAnnotation, flipAnnotation, hitTest, hitTestIncludingLocked, isClick,
  moveAnnotation, nextGroupLabel, normalizeRect, parseAnnotationStore,
  pasteAnnotation, polygonPointsFor, removeAnnotation, sendToBack,
  serializeAnnotationStore, setAnnotationLabel, starPointsFor, toggleAnnotationFlag,
  boundsOf, frameSelection, groupAnnotations, membersOf, setMask, ungroupAnnotations,
  DUPLICATE_OFFSET,
} from './designAnnotations.js';

test('normalizeRect handles all four drag directions', () => {
  const expected = { x: 2, y: 3, w: 8, h: 4 };
  assert.deepEqual(normalizeRect({ x: 2, y: 3 }, { x: 10, y: 7 }), expected);
  assert.deepEqual(normalizeRect({ x: 10, y: 3 }, { x: 2, y: 7 }), expected);
  assert.deepEqual(normalizeRect({ x: 2, y: 7 }, { x: 10, y: 3 }), expected);
  assert.deepEqual(normalizeRect({ x: 10, y: 7 }, { x: 2, y: 3 }), expected);
});

test('dragFlip records the drag direction for line/polygon rendering', () => {
  assert.deepEqual(dragFlip({ x: 0, y: 0 }, { x: 10, y: 10 }), { flipX: false, flipY: false });
  assert.deepEqual(dragFlip({ x: 0, y: 10 }, { x: 10, y: 0 }), { flipX: false, flipY: true });
  assert.deepEqual(dragFlip({ x: 10, y: 0 }, { x: 0, y: 10 }), { flipX: true, flipY: false });
});

test('isClick treats sub-threshold drags as clicks', () => {
  assert.equal(isClick({ x: 0, y: 0, w: 3, h: 3 }), true);
  assert.equal(isClick({ x: 0, y: 0, w: 4, h: 0 }), false);
  assert.equal(isClick({ x: 0, y: 0, w: 0, h: 12 }), false);
});

test('clientToStagePoint unscales pointer input by the zoom factor', () => {
  assert.deepEqual(clientToStagePoint(150, 90, 50, 40, 100), { x: 100, y: 50 });
  assert.deepEqual(clientToStagePoint(150, 90, 50, 40, 200), { x: 50, y: 25 });
  assert.deepEqual(clientToStagePoint(150, 90, 50, 40, 50), { x: 200, y: 100 });
});

test('hitTest returns the topmost (last) overlapping annotation, null on miss', () => {
  const bottom = createAnnotation('rectangle', { x: 0, y: 0, w: 100, h: 100 }, { id: 'bottom' });
  const top = createAnnotation('frame', { x: 50, y: 50, w: 100, h: 100 }, { id: 'top' });
  const text = createAnnotation('text', { x: 300, y: 300, w: 160, h: 24 }, { id: 'txt' });
  const list = [bottom, top, text];
  assert.equal(hitTest(list, { x: 75, y: 75 })?.id, 'top');
  assert.equal(hitTest(list, { x: 10, y: 10 })?.id, 'bottom');
  assert.equal(hitTest(list, { x: 310, y: 310 })?.id, 'txt');
  assert.equal(hitTest(list, { x: 200, y: 10 }), null);
});

test('hidden and locked annotations are click-transparent; right-click still reaches locked ones', () => {
  const base = createAnnotation('rectangle', { x: 0, y: 0, w: 50, h: 50 }, { id: 'a' });
  const hidden = [{ ...base, hidden: true }];
  const locked = [{ ...base, locked: true }];
  assert.equal(hitTest(hidden, { x: 10, y: 10 }), null);
  assert.equal(hitTest(locked, { x: 10, y: 10 }), null);
  assert.equal(hitTestIncludingLocked(hidden, { x: 10, y: 10 }), null);
  assert.equal(hitTestIncludingLocked(locked, { x: 10, y: 10 })?.id, 'a');
});

test('moveAnnotation is immutable and ignores unknown ids', () => {
  const a = createAnnotation('rectangle', { x: 10, y: 10, w: 20, h: 20 }, { id: 'a' });
  const moved = moveAnnotation([a], 'a', 5, -3);
  assert.deepEqual({ x: moved[0].x, y: moved[0].y }, { x: 15, y: 7 });
  assert.deepEqual({ x: a.x, y: a.y }, { x: 10, y: 10 });
  assert.deepEqual(moveAnnotation([a], 'nope', 5, 5), [a]);
});

test('setAnnotationLabel and removeAnnotation', () => {
  const a = createAnnotation('text', { x: 0, y: 0, w: 160, h: 24 }, { id: 'a', label: 'old' });
  assert.equal(setAnnotationLabel([a], 'a', 'new')[0].label, 'new');
  assert.deepEqual(removeAnnotation([a], 'a'), []);
  assert.equal(removeAnnotation([a], 'other').length, 1);
});

test('nextGroupLabel numbers frames and sections independently', () => {
  assert.equal(nextGroupLabel('frame', []), 'Frame 1');
  const list = [
    createAnnotation('frame', { x: 0, y: 0, w: 1, h: 1 }, { label: 'Frame 1' }),
    createAnnotation('section', { x: 0, y: 0, w: 1, h: 1 }, { label: 'Section 1' }),
  ];
  assert.equal(nextGroupLabel('frame', list), 'Frame 2');
  assert.equal(nextGroupLabel('section', list), 'Section 2');
});

test('duplicateAnnotation appends an offset copy with a fresh id', () => {
  const a = createAnnotation('star', { x: 10, y: 20, w: 30, h: 30 }, { id: 'a' });
  const { list, id } = duplicateAnnotation([a], 'a');
  assert.equal(list.length, 2);
  assert.notEqual(id, 'a');
  assert.deepEqual({ x: list[1].x, y: list[1].y }, { x: 10 + DUPLICATE_OFFSET, y: 20 + DUPLICATE_OFFSET });
  assert.deepEqual(duplicateAnnotation([a], 'missing').id, null);
});

test('pasteAnnotation centers at a point, or offsets without one', () => {
  const clip = createAnnotation('ellipse', { x: 5, y: 5, w: 40, h: 20 }, { id: 'clip' });
  const atPoint = pasteAnnotation([], clip, { x: 100, y: 100 });
  assert.deepEqual({ x: atPoint.list[0].x, y: atPoint.list[0].y }, { x: 80, y: 90 });
  const offset = pasteAnnotation([], clip);
  assert.deepEqual({ x: offset.list[0].x, y: offset.list[0].y }, { x: 5 + DUPLICATE_OFFSET, y: 5 + DUPLICATE_OFFSET });
  assert.notEqual(atPoint.list[0].id, 'clip');
});

test('bringToFront and sendToBack reorder without losing anyone', () => {
  const a = createAnnotation('rectangle', { x: 0, y: 0, w: 1, h: 1 }, { id: 'a' });
  const b = createAnnotation('rectangle', { x: 0, y: 0, w: 1, h: 1 }, { id: 'b' });
  const c = createAnnotation('rectangle', { x: 0, y: 0, w: 1, h: 1 }, { id: 'c' });
  assert.deepEqual(bringToFront([a, b, c], 'a').map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(sendToBack([a, b, c], 'c').map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(bringToFront([a, b], 'zz').map((x) => x.id), ['a', 'b']);
});

test('flip and hidden/locked toggles flip booleans per annotation', () => {
  const a = createAnnotation('line', { x: 0, y: 0, w: 10, h: 10 }, { id: 'a' });
  const flipped = flipAnnotation([a], 'a', 'x');
  assert.equal(flipped[0].flipX, true);
  assert.equal(flipAnnotation(flipped, 'a', 'x')[0].flipX, false);
  const hidden = toggleAnnotationFlag([a], 'a', 'hidden');
  assert.equal(hidden[0].hidden, true);
  assert.equal(toggleAnnotationFlag(hidden, 'a', 'hidden')[0].hidden, false);
  assert.equal(toggleAnnotationFlag([a], 'a', 'locked')[0].locked, true);
});

test('polygon and star geometry stays inside the rect', () => {
  assert.equal(polygonPointsFor(100, 50), '50,0 0,50 100,50');
  assert.equal(polygonPointsFor(100, 50, true), '0,0 100,0 50,50');
  const star = starPointsFor(100, 100).split(' ').map((p) => p.split(',').map(Number));
  assert.equal(star.length, 10);
  for (const [x, y] of star) {
    assert.ok(x >= -1 && x <= 101, `x ${x} in bounds`);
    assert.ok(y >= -1 && y <= 101, `y ${y} in bounds`);
  }
});

test('annotation store round-trips, migrates legacy "shape", and survives corrupt input', () => {
  const key = annotationsKey('D:\\repo', 'flow-1');
  assert.equal(key, 'D:\\repo:flow-1');
  assert.equal(annotationsKey(undefined, 'flow-1'), 'unknown:flow-1');
  const store = { [key]: [createAnnotation('frame', { x: 1, y: 2, w: 3, h: 4 }, { id: 'f1', label: 'Frame 1' })] };
  assert.deepEqual(parseAnnotationStore(serializeAnnotationStore(store)), store);
  assert.deepEqual(parseAnnotationStore(null), {});
  assert.deepEqual(parseAnnotationStore('not json'), {});
  assert.deepEqual(parseAnnotationStore('[1,2]'), {});
  // Legacy 'shape' annotations load as rectangles; malformed entries drop.
  const mixed = JSON.stringify({ k: [
    { id: 'ok', kind: 'shape', label: '', x: 0, y: 0, w: 1, h: 1 },
    { id: 'flags', kind: 'line', label: '', x: 0, y: 0, w: 1, h: 1, flipY: true, locked: true },
    { bogus: true },
  ] });
  const parsed = parseAnnotationStore(mixed).k;
  assert.deepEqual(parsed.map((a) => a.kind), ['rectangle', 'line']);
  assert.equal(parsed[1].flipY, true);
  assert.equal(parsed[1].locked, true);
});

test('grouping stamps one fresh id on every member and ungrouping clears it', () => {
  const list = [
    createAnnotation('rectangle', { x: 0, y: 0, w: 10, h: 10 }, { id: 'a' }),
    createAnnotation('ellipse', { x: 20, y: 0, w: 10, h: 10 }, { id: 'b' }),
    createAnnotation('text', { x: 99, y: 99, w: 10, h: 10 }, { id: 'c' }),
  ];
  const grouped = groupAnnotations(list, ['a', 'b']);
  assert.ok(grouped.groupId);
  assert.equal(grouped.list[0].groupId, grouped.groupId);
  assert.equal(grouped.list[1].groupId, grouped.groupId);
  assert.equal(grouped.list[2].groupId, undefined, 'an unselected annotation is untouched');
  assert.deepEqual(membersOf(grouped.list, grouped.groupId).map((a) => a.id), ['a', 'b']);
  const ungrouped = ungroupAnnotations(grouped.list, ['a', 'b']);
  assert.equal(ungrouped[0].groupId, undefined);
  assert.equal(ungrouped[1].groupId, undefined);
});

test('grouping fewer than two annotations is a no-op', () => {
  const list = [createAnnotation('rectangle', { x: 0, y: 0, w: 10, h: 10 }, { id: 'a' })];
  const grouped = groupAnnotations(list, ['a']);
  assert.equal(grouped.groupId, null);
  assert.equal(grouped.list[0].groupId, undefined);
});

test('bounds union a list and report nothing for an empty one', () => {
  const list = [
    createAnnotation('rectangle', { x: 10, y: 20, w: 30, h: 40 }, { id: 'a' }),
    createAnnotation('ellipse', { x: 50, y: 0, w: 10, h: 10 }, { id: 'b' }),
  ];
  assert.deepEqual(boundsOf(list), { x: 10, y: 0, w: 50, h: 60 });
  assert.equal(boundsOf([]), null);
});

test('framing a selection wraps it in a padded container behind its members', () => {
  const list = [
    createAnnotation('text', { x: 0, y: 0, w: 100, h: 20 }, { id: 'a' }),
    createAnnotation('rectangle', { x: 40, y: 40, w: 60, h: 60 }, { id: 'b' }),
  ];
  const { list: framed, id } = frameSelection(list, ['a', 'b']);
  assert.ok(id);
  const frame = framed.find((a) => a.id === id)!;
  assert.equal(frame.kind, 'frame');
  assert.equal(frame.label, 'Frame 1');
  assert.deepEqual({ x: frame.x, y: frame.y, w: frame.w, h: frame.h }, { x: -24, y: -24, w: 148, h: 148 });
  assert.equal(framed.indexOf(frame), 0, 'the container sits behind what it contains');
  assert.equal(framed.find((a) => a.id === 'a')!.groupId, id);
  assert.equal(framed.find((a) => a.id === 'b')!.groupId, id);
});

test('a mask is exclusive within its group but leaves other groups alone', () => {
  const list = [
    { ...createAnnotation('rectangle', { x: 0, y: 0, w: 10, h: 10 }, { id: 'a' }), groupId: 'g1', mask: true },
    { ...createAnnotation('ellipse', { x: 0, y: 0, w: 10, h: 10 }, { id: 'b' }), groupId: 'g1' },
    { ...createAnnotation('star', { x: 0, y: 0, w: 10, h: 10 }, { id: 'c' }), groupId: 'g2', mask: true },
  ];
  const masked = setMask(list, 'b');
  assert.equal(masked.find((a) => a.id === 'b')!.mask, true);
  assert.equal(masked.find((a) => a.id === 'a')!.mask, undefined, 'the previous mask in g1 is cleared');
  assert.equal(masked.find((a) => a.id === 'c')!.mask, true, 'g2 keeps its own mask');
});

test('a path annotation round-trips and a pathless one is dropped', () => {
  const path = { ...createAnnotation('path', { x: 0, y: 0, w: 10, h: 10 }, { id: 'p' }), path: 'M0,0 L10,0 L10,10 Z' };
  const store = parseAnnotationStore(serializeAnnotationStore({ key: [path] }));
  assert.equal(store.key.length, 1);
  assert.equal(store.key[0].path, 'M0,0 L10,0 L10,10 Z');
  const broken = parseAnnotationStore(JSON.stringify({ key: [{ ...path, path: '' }] }));
  assert.deepEqual(broken.key, [], 'a path annotation with no geometry is not an annotation');
});

test('group, mask and auto-layout state survive persistence', () => {
  const framed = {
    ...createAnnotation('frame', { x: 0, y: 0, w: 100, h: 100 }, { id: 'f' }),
    autoLayout: { direction: 'row' as const, gap: 8, padX: 4, padY: 4, align: 'center' as const },
  };
  const child = { ...createAnnotation('rectangle', { x: 0, y: 0, w: 10, h: 10 }, { id: 'c' }), groupId: 'f', mask: true };
  const store = parseAnnotationStore(serializeAnnotationStore({ key: [framed, child] }));
  assert.deepEqual(store.key[0].autoLayout, { direction: 'row', gap: 8, padX: 4, padY: 4, align: 'center' });
  assert.equal(store.key[1].groupId, 'f');
  assert.equal(store.key[1].mask, true);
});

test('a copy is never claimed as the component the original was packed into', () => {
  const packed = { ...createAnnotation('frame', { x: 0, y: 0, w: 10, h: 10 }, { id: 'f' }), componentId: 'c1' };
  const duplicated = duplicateAnnotation([packed], 'f');
  assert.equal('componentId' in duplicated.list[1], false, 'duplicate drops the pack link');
  const pasted = pasteAnnotation([], packed);
  assert.equal('componentId' in pasted.list[0], false, 'paste drops it too — the clipboard outlives a prototype switch');
  assert.equal(packed.componentId, 'c1', 'the original keeps it');
});

test('a component link round-trips, and a malformed one is dropped', () => {
  const packed = { ...createAnnotation('frame', { x: 0, y: 0, w: 10, h: 10 }, { id: 'f' }), componentId: 'c1' };
  assert.equal(parseAnnotationStore(serializeAnnotationStore({ key: [packed] })).key[0].componentId, 'c1');
  const broken = parseAnnotationStore(JSON.stringify({ key: [{ ...packed, componentId: 42 }] }));
  assert.equal(broken.key[0].componentId, undefined);
});
