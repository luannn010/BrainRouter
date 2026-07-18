import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_SCREEN, RESIZE_HANDLES, resizeRect } from './screenResize.js';

const start = { x: 100, y: 100, w: 400, h: 300 };
const plain = { grid: 1, min: 10 };

test('every corner and edge handle is offered', () => {
  assert.deepEqual([...RESIZE_HANDLES], ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
});

test('dragging the south-east corner grows width and height only', () => {
  assert.deepEqual(resizeRect(start, 'se', 40, 20, plain), { x: 100, y: 100, w: 440, h: 320 });
});

test('dragging a north or west edge moves the origin and keeps the far edge pinned', () => {
  const north = resizeRect(start, 'n', 0, 30, plain);
  assert.deepEqual(north, { x: 100, y: 130, w: 400, h: 270 });
  assert.equal(north.y + north.h, start.y + start.h, 'the bottom edge does not move');
  const west = resizeRect(start, 'w', 50, 0, plain);
  assert.equal(west.x + west.w, start.x + start.w, 'the right edge does not move');
});

test('an edge handle only moves its own axis', () => {
  assert.deepEqual(resizeRect(start, 'e', 40, 999, plain), { x: 100, y: 100, w: 440, h: 300 });
  assert.deepEqual(resizeRect(start, 's', 999, 20, plain), { x: 100, y: 100, w: 400, h: 320 });
});

test('resizing snaps the moving edges to the grid', () => {
  const box = resizeRect(start, 'se', 37, 37, { grid: 24, min: 10 });
  assert.equal((box.x + box.w) % 24, 0, 'the right edge lands on the grid');
  assert.equal((box.y + box.h) % 24, 0, 'the bottom edge lands on the grid');
  const nw = resizeRect(start, 'nw', 37, 37, { grid: 24, min: 10 });
  assert.equal(nw.x % 24, 0, 'the moving left edge lands on the grid');
  assert.equal(nw.x + nw.w, start.x + start.w, 'the pinned right edge is untouched by snapping');
});

test('a screen never collapses past the minimum, and the pinned edge stays pinned', () => {
  const squashed = resizeRect(start, 'se', -9999, -9999, { grid: 1, min: 80 });
  assert.deepEqual(squashed, { x: 100, y: 100, w: 80, h: 80 });
  const fromNW = resizeRect(start, 'nw', 9999, 9999, { grid: 1, min: 80 });
  assert.equal(fromNW.w, 80);
  assert.equal(fromNW.h, 80);
  assert.equal(fromNW.x + fromNW.w, start.x + start.w, 'clamping does not drag the far edge along');
  assert.equal(fromNW.y + fromNW.h, start.y + start.h);
});

test('the default minimum is a screen you can still see and grab', () => {
  assert.ok(MIN_SCREEN >= 48);
  assert.deepEqual(resizeRect(start, 'se', -9999, -9999, { grid: 1, min: MIN_SCREEN }), { x: 100, y: 100, w: MIN_SCREEN, h: MIN_SCREEN });
});

test('a zero delta is an exact no-op even with snapping on', () => {
  assert.deepEqual(resizeRect({ x: 13, y: 17, w: 401, h: 301 }, 'se', 0, 0, { grid: 24, min: 10 }), { x: 13, y: 17, w: 401, h: 301 });
});

test('rounding keeps sizes whole so the readout never shows fractions', () => {
  const box = resizeRect(start, 'se', 10.4, 20.6, plain);
  assert.equal(Number.isInteger(box.w), true);
  assert.equal(Number.isInteger(box.h), true);
});
