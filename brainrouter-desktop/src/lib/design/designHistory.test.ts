import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, canRedo, canUndo, emptyHistory, pushHistory, redo, undo } from './designHistory.js';

const h0 = emptyHistory<string>('a');

test('a fresh history has nothing to undo or redo', () => {
  assert.equal(canUndo(h0), false);
  assert.equal(canRedo(h0), false);
  assert.equal(h0.present, 'a');
});

test('undo walks back and redo walks forward again', () => {
  const h = pushHistory(pushHistory(h0, 'b'), 'c');
  assert.equal(h.present, 'c');
  const back = undo(h);
  assert.equal(back.present, 'b');
  assert.equal(undo(back).present, 'a');
  assert.equal(redo(back).present, 'c');
});

test('undo and redo at the ends are no-ops rather than errors', () => {
  assert.equal(undo(h0), h0);
  assert.equal(redo(h0), h0);
  const h = pushHistory(h0, 'b');
  assert.equal(redo(h), h, 'nothing has been undone, so there is nothing to redo');
});

test('a new edit after an undo discards the abandoned branch', () => {
  const h = undo(pushHistory(pushHistory(h0, 'b'), 'c'));
  assert.equal(h.present, 'b');
  const branched = pushHistory(h, 'd');
  assert.equal(branched.present, 'd');
  assert.equal(canRedo(branched), false, 'c is gone — it was not on the path taken');
  assert.equal(undo(branched).present, 'b');
});

test('pushing the value already present does not add a step', () => {
  const h = pushHistory(h0, 'a');
  assert.equal(canUndo(h), false, 'a no-op edit should not cost an undo press');
});

test('history is bounded, and it drops the oldest entries', () => {
  let h = emptyHistory<number>(0);
  for (let i = 1; i <= HISTORY_LIMIT + 25; i += 1) h = pushHistory(h, i);
  assert.equal(h.past.length, HISTORY_LIMIT);
  assert.equal(h.present, HISTORY_LIMIT + 25);
  // Walking all the way back lands on the oldest surviving entry, not on 0.
  let walked = h;
  while (canUndo(walked)) walked = undo(walked);
  assert.equal(walked.present, 25);
});

test('the caller keeps its own value type', () => {
  const h = pushHistory(emptyHistory<{ n: number }>({ n: 1 }), { n: 2 });
  assert.deepEqual(undo(h).present, { n: 1 });
});
