import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCALE, MIN_SCALE, clampScale, fitBounds, panBy, screenToWorld,
  snapTo, wheelGesture, worldToScreen, zoomAt,
} from './canvasViewport.js';

test('zoom keeps the point under the cursor pinned', () => {
  const view = { scale: 1, x: 0, y: 0 };
  const before = screenToWorld(view, 300, 200);
  const zoomed = zoomAt(view, 2, 300, 200);
  const after = screenToWorld(zoomed, 300, 200);
  assert.equal(zoomed.scale, 2);
  assert.ok(Math.abs(after.x - before.x) < 1e-9);
  assert.ok(Math.abs(after.y - before.y) < 1e-9);
});

test('zoom clamps and leaves the viewport untouched at the limit', () => {
  const atMax = { scale: MAX_SCALE, x: 10, y: 20 };
  assert.deepEqual(zoomAt(atMax, 2, 0, 0), atMax);
  assert.equal(clampScale(1000), MAX_SCALE);
  assert.equal(clampScale(0), MIN_SCALE);
});

test('screen and world coordinates round-trip through any viewport', () => {
  const view = { scale: 0.75, x: -120, y: 64 };
  const world = screenToWorld(view, 410, 260);
  const screen = worldToScreen(view, world.x, world.y);
  assert.ok(Math.abs(screen.x - 410) < 1e-9);
  assert.ok(Math.abs(screen.y - 260) < 1e-9);
});

test('panning shifts the world without touching scale', () => {
  assert.deepEqual(panBy({ scale: 2, x: 5, y: 5 }, 10, -4), { scale: 2, x: 15, y: 1 });
});

test('fit centres the bounds inside the viewport and never zooms past 1', () => {
  const view = fitBounds({ x: 0, y: 0, w: 1000, h: 500 }, 600, 400, 50);
  assert.equal(view.scale, 0.5); // (600-100)/1000 = 0.5 is tighter than (400-100)/500
  assert.equal(view.x, (600 - 1000 * 0.5) / 2);
  assert.equal(view.y, (400 - 500 * 0.5) / 2);
  assert.ok(fitBounds({ x: 0, y: 0, w: 10, h: 10 }, 600, 400).scale <= 1);
});

test('fit offsets by the bounds origin so off-origin content still centres', () => {
  const view = fitBounds({ x: 200, y: 100, w: 400, h: 200 }, 600, 400, 0);
  const topLeft = worldToScreen(view, 200, 100);
  const bottomRight = worldToScreen(view, 600, 300);
  assert.ok(Math.abs((topLeft.x + bottomRight.x) / 2 - 300) < 1e-9, 'horizontally centred');
  assert.ok(Math.abs((topLeft.y + bottomRight.y) / 2 - 200) < 1e-9, 'vertically centred');
});

test('fit survives an empty or degenerate bounds', () => {
  const view = fitBounds({ x: 0, y: 0, w: 0, h: 0 }, 600, 400);
  assert.ok(Number.isFinite(view.scale) && view.scale > 0);
  assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y));
});

test('ctrl or meta wheel zooms, plain wheel pans, shift wheel pans sideways', () => {
  assert.deepEqual(wheelGesture({ deltaX: 0, deltaY: -100, ctrlKey: true, metaKey: false, shiftKey: false }), { kind: 'zoom', factor: 1.1 });
  assert.deepEqual(wheelGesture({ deltaX: 0, deltaY: 100, ctrlKey: false, metaKey: true, shiftKey: false }), { kind: 'zoom', factor: 1 / 1.1 });
  assert.deepEqual(wheelGesture({ deltaX: 3, deltaY: 40, ctrlKey: false, metaKey: false, shiftKey: false }), { kind: 'pan', dx: -3, dy: -40 });
  assert.deepEqual(wheelGesture({ deltaX: 0, deltaY: 40, ctrlKey: false, metaKey: false, shiftKey: true }), { kind: 'pan', dx: -40, dy: 0 });
});

test('snapping rounds to the grid and passes values through when snapping is off', () => {
  assert.equal(snapTo(37, 24), 48);
  assert.equal(snapTo(-37, 24), -48);
  assert.equal(snapTo(37, 1), 37);
  assert.equal(snapTo(37, 0), 37);
});
