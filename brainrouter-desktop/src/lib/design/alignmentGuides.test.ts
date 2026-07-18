import test from 'node:test';
import assert from 'node:assert/strict';
import { SNAP_THRESHOLD, snapToNeighbours, type GuideBox } from './alignmentGuides.js';

const neighbour: GuideBox = { x: 100, y: 100, w: 200, h: 200 };

test('the threshold matches OpenPencil SNAP_THRESHOLD', () => {
  assert.equal(SNAP_THRESHOLD, 5);
});

test('a near-miss on a left edge snaps flush and reports a guide', () => {
  const result = snapToNeighbours({ x: 104, y: 400, w: 200, h: 200 }, [neighbour]);
  assert.equal(result.x, 100, 'the left edges line up');
  assert.equal(result.y, 400, 'the untouched axis is left alone');
  assert.ok(result.guides.some((g) => g.axis === 'x' && g.at === 100), 'a vertical guide marks the shared edge');
});

test('a left edge snaps to a neighbour right edge, so boxes butt together', () => {
  // Moving left edge 297 vs neighbour right edge 300 — 3 away.
  const result = snapToNeighbours({ x: 297, y: 400, w: 50, h: 50 }, [neighbour]);
  assert.equal(result.x, 300);
});

test('centres snap to centres', () => {
  // Moving centre 203 vs neighbour centre 200 — 3 away.
  const result = snapToNeighbours({ x: 153, y: 400, w: 100, h: 100 }, [neighbour]);
  assert.equal(result.x + 50, 200, 'the centres align');
});

test('an edge never snaps to a centre', () => {
  // Left edge 198 is 2 from the neighbour's centre (200) — well inside the
  // threshold — but OpenPencil pairs edges with edges and centres with centres
  // only, so this must not move. Width 64 keeps this box's own centre (230)
  // and right edge (262) clear of every neighbour line, so a centre-to-centre
  // snap cannot rescue the assertion and hide the real behaviour.
  const result = snapToNeighbours({ x: 198, y: 400, w: 64, h: 64 }, [neighbour]);
  assert.equal(result.x, 198, 'left-to-centre is not a candidate pair');
  assert.deepEqual(result.guides, []);
});

test('a box further away than the threshold is left exactly where it is', () => {
  const far = { x: 100 + SNAP_THRESHOLD + 1, y: 400, w: 200, h: 200 };
  const result = snapToNeighbours(far, [neighbour]);
  assert.equal(result.x, far.x);
  assert.deepEqual(result.guides, []);
});

test('the closest candidate wins when two neighbours both qualify', () => {
  const nearer: GuideBox = { x: 103, y: 600, w: 50, h: 50 };
  const result = snapToNeighbours({ x: 104, y: 900, w: 50, h: 50 }, [neighbour, nearer]);
  assert.equal(result.x, 103, 'snaps to the edge at 103, not the one at 100');
});

test('both axes snap independently in one move', () => {
  const result = snapToNeighbours({ x: 103, y: 98, w: 50, h: 50 }, [neighbour]);
  assert.equal(result.x, 100);
  assert.equal(result.y, 100);
  assert.equal(result.guides.length, 2, 'one guide per axis');
});

test('with no neighbours nothing moves', () => {
  const alone = { x: 7, y: 9, w: 10, h: 10 };
  const result = snapToNeighbours(alone, []);
  assert.equal(result.x, 7);
  assert.equal(result.y, 9);
  assert.deepEqual(result.guides, []);
});

test('a guide spans both boxes so it visibly connects them', () => {
  const result = snapToNeighbours({ x: 104, y: 400, w: 200, h: 200 }, [neighbour]);
  const guide = result.guides.find((g) => g.axis === 'x');
  assert.ok(guide, 'there is a vertical guide');
  assert.ok(guide.from <= 100, 'it reaches the top of the neighbour');
  assert.ok(guide.to >= 600, 'it reaches the bottom of the dragged box');
});
