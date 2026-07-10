import test from 'node:test';
import assert from 'node:assert/strict';
import { ICONOGRAPHY, BRAND_VOICE, DO_DONT, brandChecklist } from './brand.js';
import { spacingScale, elevation, motionSpec } from './designTokens.js';

test('iconography is one family at a single stroke, no emoji', () => {
  assert.equal(ICONOGRAPHY.strokeWidth, 1.5);
  assert.ok(ICONOGRAPHY.sizes.length > 0);
  assert.ok(ICONOGRAPHY.rules.some((r) => /emoji/i.test(r)), 'must forbid emoji icons');
  assert.ok(ICONOGRAPHY.rules.some((r) => /aria-label/i.test(r)), 'must require labels on icon-only controls');
});

test('voice has a principle + guidance for every entry', () => {
  assert.ok(BRAND_VOICE.length >= 3);
  for (const v of BRAND_VOICE) {
    assert.ok(v.principle.length > 0);
    assert.ok(v.guidance.length > 0);
  }
});

test("do/don't guardrails ban the off-identity choices", () => {
  const dont = DO_DONT.dont.join(' ').toLowerCase();
  assert.match(dont, /purple|indigo|violet/);
  assert.match(dont, /serif/);
  assert.match(dont, /emoji/);
  assert.match(dont, /glow/);
  assert.ok(DO_DONT.do.length >= 4);
});

test('the brand checklist names the single-accent and mono-data rules', () => {
  const list = brandChecklist().join(' ').toLowerCase();
  assert.match(list, /one accent/);
  assert.match(list, /monospace/);
  assert.match(list, /reduced-motion/);
});

test('spacing is the 4px rhythm and shape/elevation stay neutral', () => {
  assert.deepEqual(spacingScale(), [4, 8, 12, 16, 24, 32, 48, 64]);
  assert.ok(spacingScale().every((s) => s % 4 === 0));
  // elevation must be neutral black — never a coloured/accent glow
  for (const e of elevation()) assert.ok(/rgba\((?:0,\s*0,\s*0|255,\s*255,\s*255)/.test(e.value), `${e.name} must be neutral`);
});

test('motion animates transform/opacity only and keeps one signature loop', () => {
  const spec = motionSpec();
  assert.ok(spec.some((m) => /breathe/i.test(m.name)), 'the live dot is the signature loop');
  const values = spec.map((m) => `${m.name} ${m.value} ${m.use}`).join(' ').toLowerCase();
  assert.doesNotMatch(values, /\bwidth\b|\bheight\b|\btop\b|\bleft\b/, 'never animate layout properties');
});
