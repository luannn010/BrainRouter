import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResetBoundary } from './boundaryReset.js';

test('a boundary holding an error clears when the key changes', () => {
  assert.equal(shouldResetBoundary('designs', 'brands', true), true);
});

test('a boundary with no error never needs resetting', () => {
  // Resetting a healthy boundary would throw away the children's state for
  // nothing — switching tabs must not remount a view that is working.
  assert.equal(shouldResetBoundary('designs', 'brands', false), false);
});

test('the same key does not clear a live error', () => {
  // Re-rendering the same broken view must keep showing the fallback, or the
  // view remounts, throws again, and the panel flickers in a loop.
  assert.equal(shouldResetBoundary('designs', 'designs', true), false);
});
