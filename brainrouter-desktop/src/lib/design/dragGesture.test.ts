import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAG_THRESHOLD, constrainDelta, passedThreshold } from './dragGesture.js';

test('the threshold matches OpenPencil MOVE_DRAG_START_THRESHOLD_PX', () => {
  assert.equal(DRAG_THRESHOLD, 3);
});

test('a hand that drifts inside the threshold is still a click', () => {
  assert.equal(passedThreshold(0, 0), false);
  assert.equal(passedThreshold(2, 0), false);
  assert.equal(passedThreshold(2, 2), false, '2.83 away is inside a 3px radius');
});

test('landing exactly on the threshold counts as a drag', () => {
  // OpenPencil compares dx*dx + dy*dy >= 3*3, so 3px is a drag, not a click.
  assert.equal(passedThreshold(3, 0), true);
  assert.equal(passedThreshold(0, -3), true);
});

test('the threshold is radial, not per-axis', () => {
  // Neither axis reaches 3, but the distance is 3.6.
  assert.equal(passedThreshold(-2.5, 2.5), true);
});

test('axis lock keeps the larger movement and zeroes the other', () => {
  assert.deepEqual(constrainDelta(40, 6, true), { dx: 40, dy: 0 });
  assert.deepEqual(constrainDelta(6, -40, true), { dx: 0, dy: -40 });
});

test('an exactly diagonal locked drag still picks one axis', () => {
  // A tie must not fall through to free movement — the point of the lock is
  // that the result is always axis-aligned.
  const locked = constrainDelta(20, -20, true);
  assert.ok(locked.dx === 0 || locked.dy === 0, 'one axis is zero');
});

test('without the lock the delta passes through untouched', () => {
  assert.deepEqual(constrainDelta(40, 6, false), { dx: 40, dy: 6 });
});
