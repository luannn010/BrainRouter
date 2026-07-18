import test from 'node:test';
import assert from 'node:assert/strict';
import { rulerStep, rulerTicks } from './canvasRulers.js';

test('the tick pitch grows as the canvas zooms out so labels never crowd', () => {
  assert.equal(rulerStep(1), 100);
  assert.equal(rulerStep(0.2), 500);
  assert.ok(rulerStep(0.02) >= 2500);
  assert.ok(rulerStep(4) <= 25);
});

test('ticks span the visible length and carry world values', () => {
  const ticks = rulerTicks(600, 1, 0, 100);
  assert.deepEqual(ticks[0], { value: 0, offset: 0 });
  assert.equal(ticks[ticks.length - 1].offset <= 600, true);
  assert.equal(ticks.every((tick) => tick.offset >= 0), true);
});

test('panning shifts the ticks and exposes the world values now on screen', () => {
  const ticks = rulerTicks(600, 1, -250, 100);
  assert.equal(ticks[0].value, 300, 'the first tick at or past the left edge is 300 world px in');
  assert.equal(ticks[0].offset, 50);
});

test('a world origin pushed right exposes negative world values', () => {
  const ticks = rulerTicks(600, 1, 250, 100);
  assert.equal(ticks[0].value, -200);
  assert.equal(ticks[0].offset, 50);
});

test('zooming scales the spacing between ticks', () => {
  const ticks = rulerTicks(600, 0.5, 0, 100);
  assert.equal(ticks[1].offset - ticks[0].offset, 50);
});

test('degenerate inputs return a finite, bounded tick list', () => {
  assert.deepEqual(rulerTicks(0, 1, 0, 100), [{ value: 0, offset: 0 }]);
  assert.equal(rulerTicks(600, 0, 0, 100).length > 0, true);
  assert.ok(rulerTicks(1e6, 1, 0, 1).length <= 512, 'a tiny explicit pitch is capped, not hung on');
});
