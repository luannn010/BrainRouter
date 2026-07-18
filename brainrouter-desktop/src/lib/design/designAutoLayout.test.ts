import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO_LAYOUT, applyAutoLayout, autoLayoutAnnotations } from './designAutoLayout.js';
import { createAnnotation, type DesignAnnotation } from './designAnnotations.js';
import type { CanvasAutoLayout } from './canvasModel.js';

const frame = { x: 100, y: 50, w: 500, h: 500 };
const members = [
  { x: 0, y: 0, w: 60, h: 20 },
  { x: 0, y: 0, w: 40, h: 40 },
  { x: 0, y: 0, w: 80, h: 10 },
];

test('a row places members left to right from the padding, separated by the gap', () => {
  const layout: CanvasAutoLayout = { direction: 'row', gap: 10, padX: 8, padY: 6, align: 'start' };
  const result = applyAutoLayout(frame, members, layout);
  assert.deepEqual(result.members.map((m) => m.x), [108, 178, 228]);
  assert.equal(result.members.every((m) => m.y === 56), true, 'align start flushes to the top padding');
});

test('a row hugs its members: padding, widths and gaps, nothing else', () => {
  const layout: CanvasAutoLayout = { direction: 'row', gap: 10, padX: 8, padY: 6, align: 'start' };
  const result = applyAutoLayout(frame, members, layout);
  assert.equal(result.frame.w, 8 * 2 + (60 + 40 + 80) + 10 * 2);
  assert.equal(result.frame.h, 6 * 2 + 40, 'the tallest member sets the height');
  assert.equal(result.frame.x, 100, 'auto layout moves children, not the frame');
  assert.equal(result.frame.y, 50);
});

test('a column stacks members down the block axis', () => {
  const layout: CanvasAutoLayout = { direction: 'column', gap: 10, padX: 8, padY: 6, align: 'start' };
  const result = applyAutoLayout(frame, members, layout);
  assert.deepEqual(result.members.map((m) => m.y), [56, 86, 136]);
  assert.equal(result.members.every((m) => m.x === 108), true);
  assert.equal(result.frame.h, 6 * 2 + (20 + 40 + 10) + 10 * 2);
  assert.equal(result.frame.w, 8 * 2 + 80, 'the widest member sets the width');
});

test('cross-axis alignment centres and flushes', () => {
  const centred = applyAutoLayout(frame, members, { direction: 'row', gap: 0, padX: 0, padY: 0, align: 'center' });
  // Tallest member is 40, so the band is 40 tall and each member centres in it.
  assert.deepEqual(centred.members.map((m) => m.y), [50 + 10, 50, 50 + 15]);
  const end = applyAutoLayout(frame, members, { direction: 'row', gap: 0, padX: 0, padY: 0, align: 'end' });
  assert.deepEqual(end.members.map((m) => m.y), [50 + 20, 50, 50 + 30]);
});

test('an empty container collapses to its padding rather than to zero or NaN', () => {
  const result = applyAutoLayout(frame, [], DEFAULT_AUTO_LAYOUT);
  assert.equal(result.members.length, 0);
  assert.equal(result.frame.w, DEFAULT_AUTO_LAYOUT.padX * 2);
  assert.equal(result.frame.h, DEFAULT_AUTO_LAYOUT.padY * 2);
  assert.ok(Number.isFinite(result.frame.w) && Number.isFinite(result.frame.h));
});

test('a single member needs no gaps', () => {
  const result = applyAutoLayout(frame, [members[0]], { direction: 'row', gap: 99, padX: 4, padY: 4, align: 'start' });
  assert.equal(result.frame.w, 4 * 2 + 60);
});

test('autoLayoutAnnotations repositions a container’s members without mutating the input', () => {
  const container: DesignAnnotation = {
    ...createAnnotation('frame', { x: 0, y: 0, w: 10, h: 10 }, { id: 'f', label: 'Frame 1' }),
    autoLayout: { direction: 'row', gap: 10, padX: 8, padY: 8, align: 'start' },
  };
  const list: DesignAnnotation[] = [
    container,
    { ...createAnnotation('rectangle', { x: 999, y: 999, w: 50, h: 20 }, { id: 'a' }), groupId: 'f' },
    { ...createAnnotation('rectangle', { x: 999, y: 999, w: 30, h: 40 }, { id: 'b' }), groupId: 'f' },
    createAnnotation('text', { x: 5, y: 5, w: 10, h: 10 }, { id: 'loose' }),
  ];
  const laid = autoLayoutAnnotations(list, 'f');
  assert.deepEqual(laid.find((a) => a.id === 'a')!.x, 8);
  assert.deepEqual(laid.find((a) => a.id === 'b')!.x, 68);
  assert.equal(laid.find((a) => a.id === 'f')!.w, 8 * 2 + 80 + 10);
  assert.deepEqual(laid.find((a) => a.id === 'loose')!.x, 5, 'a non-member is untouched');
  assert.equal(list[1].x, 999, 'the input list is not mutated');
});

test('autoLayoutAnnotations is a no-op for a container with no layout or no such id', () => {
  const list: DesignAnnotation[] = [
    createAnnotation('frame', { x: 0, y: 0, w: 10, h: 10 }, { id: 'f' }),
    { ...createAnnotation('rectangle', { x: 7, y: 7, w: 5, h: 5 }, { id: 'a' }), groupId: 'f' },
  ];
  assert.deepEqual(autoLayoutAnnotations(list, 'f'), list);
  assert.deepEqual(autoLayoutAnnotations(list, 'nope'), list);
});
