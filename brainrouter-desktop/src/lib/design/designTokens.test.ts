// brainrouter-desktop/src/lib/design/designTokens.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_INSTRUMENT, colorTokens, heatRamp, typeScale, radii } from './designTokens.js';

// hue (0–360) of a #rrggbb color, or null for non-hex (e.g. rgba()) values
function hexHue(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h;
}

test('canonical Memory Instrument values are exact', () => {
  assert.equal(MEMORY_INSTRUMENT.accent, '#34C28E');
  assert.equal(MEMORY_INSTRUMENT.surfaceBase, '#0B0D0F');
  assert.equal(MEMORY_INSTRUMENT.surfaceRaised, '#14171A');
  assert.equal(MEMORY_INSTRUMENT.text, '#ECEFF2');
  assert.equal(MEMORY_INSTRUMENT.heat.hot, '#E0A063');
  assert.equal(MEMORY_INSTRUMENT.heat.cold, '#3C434B');
  assert.equal(MEMORY_INSTRUMENT.danger, '#E5675F');
});

test('colorTokens exposes exactly one accent and no AI-purple/indigo/violet', () => {
  const cols = colorTokens();
  const accents = cols.filter((c) => c.token === '--ds-accent');
  assert.equal(accents.length, 1);
  assert.equal(accents[0].value, '#34C28E');
  // a real guard: no token sits in the indigo/violet band (~255°–300°), the AI-design cliché
  for (const c of cols) {
    const h = hexHue(c.value);
    assert.ok(h === null || h < 255 || h > 300, `${c.name} (${c.value}) is in the AI-purple band`);
  }
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
