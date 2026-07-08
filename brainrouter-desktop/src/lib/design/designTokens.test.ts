// brainrouter-desktop/src/lib/design/designTokens.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_INSTRUMENT, colorTokens, heatRamp, typeScale, radii } from './designTokens.js';

test('canonical Memory Instrument values are exact', () => {
  assert.equal(MEMORY_INSTRUMENT.accent, '#34C28E');
  assert.equal(MEMORY_INSTRUMENT.surfaceBase, '#0B0D0F');
  assert.equal(MEMORY_INSTRUMENT.surfaceRaised, '#14171A');
  assert.equal(MEMORY_INSTRUMENT.text, '#ECEFF2');
  assert.equal(MEMORY_INSTRUMENT.heat.hot, '#E0A063');
  assert.equal(MEMORY_INSTRUMENT.heat.cold, '#3C434B');
  assert.equal(MEMORY_INSTRUMENT.danger, '#E5675F');
});

test('colorTokens exposes exactly one accent and no purple', () => {
  const cols = colorTokens();
  const accents = cols.filter((c) => c.token === '--ds-accent');
  assert.equal(accents.length, 1);
  assert.equal(accents[0].value, '#34C28E');
  assert.ok(cols.every((c) => !/^#([0-9a-f]{2})?(7|8|9)[0-9a-f]ff$/i.test(c.value)), 'no AI-purple');
});

test('heatRamp is the four-stop Ember→Cinder legend, hot first', () => {
  const ramp = heatRamp();
  assert.deepEqual(ramp.map((r) => r.value), ['#E0A063', '#C98F6E', '#6B7480', '#3C434B']);
});

test('typeScale sets all data rows in mono', () => {
  const scale = typeScale();
  const data = scale.find((r) => r.role === 'Data / Metric');
  assert.equal(data?.family, 'mono');
  assert.ok(scale.some((r) => r.role === 'Body' && r.family === 'sans'));
});

test('radii are the architectural 4/6/10/12 set', () => {
  assert.deepEqual(radii().map((r) => r.px), [4, 6, 10, 12]);
});
