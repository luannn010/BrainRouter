import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenToPath, outlinePathFor, outlineStrokePath, pathBounds, traceMask } from './designOutline.js';
import { createAnnotation } from './designAnnotations.js';

/** Build a w×h alpha buffer with `rects` filled at `value`. */
function mask(w: number, h: number, rects: Array<[number, number, number, number]>, value = 255): Uint8Array {
  const buf = new Uint8Array(w * h);
  for (const [x, y, rw, rh] of rects) {
    for (let yy = y; yy < y + rh; yy += 1) for (let xx = x; xx < x + rw; xx += 1) buf[yy * w + xx] = value;
  }
  return buf;
}

const subpaths = (d: string): number => (d.match(/M/g) ?? []).length;

test('tracing a solid rectangle yields one closed contour on its exact edge', () => {
  const d = traceMask(mask(10, 8, [[2, 1, 3, 3]]), 10, 8);
  assert.equal(subpaths(d), 1);
  assert.ok(d.trim().endsWith('Z'));
  assert.deepEqual(pathBounds(d), { x: 2, y: 1, w: 3, h: 3 });
});

test('two disjoint blobs trace as two separate contours', () => {
  const d = traceMask(mask(12, 6, [[1, 1, 2, 2], [7, 2, 3, 3]]), 12, 6);
  assert.equal(subpaths(d), 2);
});

test('a shape with a hole traces the outer edge and the hole', () => {
  const ring = mask(9, 9, [[1, 1, 7, 7]]);
  for (let y = 3; y < 6; y += 1) for (let x = 3; x < 6; x += 1) ring[y * 9 + x] = 0;
  assert.equal(subpaths(traceMask(ring, 9, 9)), 2);
});

test('an empty mask traces to nothing', () => {
  assert.equal(traceMask(mask(6, 6, []), 6, 6), '');
});

test('the threshold decides what counts as ink', () => {
  const faint = mask(6, 6, [[1, 1, 2, 2]], 0x7f);
  assert.notEqual(traceMask(faint, 6, 6, 100), '');
  assert.equal(traceMask(faint, 6, 6, 200), '');
});

test('collinear pixel edges collapse into single straight runs', () => {
  const d = traceMask(mask(10, 10, [[2, 2, 5, 5]]), 10, 10);
  assert.equal((d.match(/L/g) ?? []).length, 3, 'a rectangle is four corners: one M and three L before Z');
});

test('outlining a rectangle stroke yields an outer and an inner ring', () => {
  const rect = createAnnotation('rectangle', { x: 0, y: 0, w: 40, h: 20 }, { id: 'r' });
  const d = outlineStrokePath(rect, 4);
  assert.equal(subpaths(d), 2);
  assert.deepEqual(pathBounds(d), { x: -2, y: -2, w: 44, h: 24 }, 'the outer ring grows by half the stroke');
});

test('outlining a line stroke yields a single quad band', () => {
  const line = createAnnotation('line', { x: 0, y: 0, w: 30, h: 40 }, { id: 'l' });
  const d = outlineStrokePath(line, 6);
  assert.equal(subpaths(d), 1);
  assert.equal((d.match(/L/g) ?? []).length, 3, 'four corners');
});

test('a hairline stroke still produces a band rather than a degenerate path', () => {
  const rect = createAnnotation('rectangle', { x: 0, y: 0, w: 10, h: 10 }, { id: 'r' });
  const d = outlineStrokePath(rect, 0);
  assert.equal(subpaths(d), 2);
  assert.ok(pathBounds(d)!.w > 0);
});

test('outlinePathFor produces box-local geometry per kind', () => {
  const box = { x: 100, y: 100, w: 20, h: 10 };
  assert.deepEqual(pathBounds(outlinePathFor(createAnnotation('rectangle', box, { id: 'a' }))), { x: 0, y: 0, w: 20, h: 10 });
  assert.equal(subpaths(outlinePathFor(createAnnotation('ellipse', box, { id: 'b' }))), 1);
  assert.equal(subpaths(outlinePathFor(createAnnotation('star', box, { id: 'c' }))), 1);
  const stored = { ...createAnnotation('path', box, { id: 'd' }), path: 'M0,0 L5,5 Z' };
  assert.equal(outlinePathFor(stored), 'M0,0 L5,5 Z');
});

test('flatten merges a selection into one path of subpaths in shared space', () => {
  const list = [
    createAnnotation('rectangle', { x: 10, y: 10, w: 20, h: 20 }, { id: 'a' }),
    createAnnotation('rectangle', { x: 50, y: 30, w: 10, h: 10 }, { id: 'b' }),
  ];
  const d = flattenToPath(list);
  assert.equal(subpaths(d), 2, 'one subpath per member, exactly like Figma flatten');
  assert.deepEqual(pathBounds(d), { x: 0, y: 0, w: 50, h: 30 }, 'geometry is relative to the union box');
});

test('flattening nothing yields nothing', () => {
  assert.equal(flattenToPath([]), '');
});
