import test from 'node:test';
import assert from 'node:assert/strict';
import { MIXED, SCRUB_THRESHOLD, isCommittable, scrubbedValue, sharedValue } from './inspectorFields.js';

test('one value reads as itself', () => {
  assert.equal(sharedValue(['#ff0000']), '#ff0000');
});

test('agreeing values read as the agreed value', () => {
  assert.equal(sharedValue(['12', '12', '12']), '12');
});

test('disagreeing values read as Mixed', () => {
  assert.equal(sharedValue(['12', '14']), MIXED);
});

test('an empty selection reads as empty, not Mixed', () => {
  // Nothing selected is not a disagreement — "Mixed" there would be a lie in
  // the other direction.
  assert.equal(sharedValue([]), '');
});

test('Mixed is never committed as a value', () => {
  // It is a label. Number("Mixed") is NaN, which would wipe every selected
  // shape's property the moment the field blurred.
  assert.equal(isCommittable(MIXED), false);
  assert.equal(isCommittable(''), false);
  assert.equal(isCommittable('   '), false);
  assert.equal(isCommittable('0'), true);
  assert.equal(isCommittable('-4.5'), true);
});

test('the scrub threshold matches the OpenPencil NumberField', () => {
  assert.equal(SCRUB_THRESHOLD, 2);
});

test('scrubbing moves the value by pointer distance times the step', () => {
  assert.equal(scrubbedValue(100, 10, 1, 1), 110);
  assert.equal(scrubbedValue(100, -10, 1, 1), 90);
});

test('a coarser step scrubs faster', () => {
  assert.equal(scrubbedValue(0, 10, 5, 1), 50);
});

test('sensitivity scales the movement', () => {
  assert.equal(scrubbedValue(0, 10, 1, 0.5), 5);
});

test('scrubbing rounds to whole steps so the field never shows noise', () => {
  // A half-pixel of pointer travel must not put 0.5 in a pixel field.
  assert.equal(scrubbedValue(20, 3, 1, 0.5), 22, '3 * 0.5 = 1.5 rounds to 2');
});
