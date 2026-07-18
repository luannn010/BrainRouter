import test from 'node:test';
import assert from 'node:assert/strict';
import { constraintDeclarations, constraintsApply, HORIZONTAL_CONSTRAINTS, VERTICAL_CONSTRAINTS, type ConstraintBox } from './designConstraints.js';

const BOX: ConstraintBox = { offsetLeft: 76, offsetTop: 180, offsetRight: 100, offsetBottom: 220, width: 424, height: 200 };

test('offers the five Figma constraints per axis', () => {
  assert.deepEqual(HORIZONTAL_CONSTRAINTS.map((item) => item.value), ['left', 'right', 'left-right', 'center', 'scale']);
  assert.deepEqual(VERTICAL_CONSTRAINTS.map((item) => item.value), ['top', 'bottom', 'top-bottom', 'center', 'scale']);
});

test('pins to one edge by setting that inset and releasing the other', () => {
  assert.deepEqual(constraintDeclarations('h', 'left', BOX), [['left', '76px'], ['right', 'auto']]);
  assert.deepEqual(constraintDeclarations('h', 'right', BOX), [['left', 'auto'], ['right', '100px']]);
  assert.deepEqual(constraintDeclarations('v', 'top', BOX), [['top', '180px'], ['bottom', 'auto']]);
  assert.deepEqual(constraintDeclarations('v', 'bottom', BOX), [['top', 'auto'], ['bottom', '220px']]);
});

test('stretching pins both edges and releases the fixed size', () => {
  assert.deepEqual(constraintDeclarations('h', 'left-right', BOX), [['left', '76px'], ['right', '100px'], ['width', 'auto']]);
  assert.deepEqual(constraintDeclarations('v', 'top-bottom', BOX), [['top', '180px'], ['bottom', '220px'], ['height', 'auto']]);
});

test('centering uses a 50% inset with a half-size pull-back', () => {
  assert.deepEqual(constraintDeclarations('h', 'center', BOX), [['left', '50%'], ['right', 'auto'], ['margin-left', '-212px']]);
  assert.deepEqual(constraintDeclarations('v', 'center', BOX), [['top', '50%'], ['bottom', 'auto'], ['margin-top', '-100px']]);
});

test('scaling expresses the inset and the size as percentages of the parent', () => {
  // Parent width = 76 + 424 + 100 = 600. Left = 12.6667%, width = 70.6667%.
  const [left, right, width] = constraintDeclarations('h', 'scale', BOX);
  assert.deepEqual(left, ['left', '12.6667%']);
  assert.deepEqual(right, ['right', 'auto']);
  assert.deepEqual(width, ['width', '70.6667%']);
});

test('a zero-sized parent cannot be scaled against, so nothing is emitted', () => {
  const empty: ConstraintBox = { offsetLeft: 0, offsetTop: 0, offsetRight: 0, offsetBottom: 0, width: 0, height: 0 };
  assert.deepEqual(constraintDeclarations('h', 'scale', empty), []);
  assert.deepEqual(constraintDeclarations('h', 'nonsense', BOX), []);
});

test('constraints only bind an out-of-flow element', () => {
  assert.equal(constraintsApply('absolute'), true);
  assert.equal(constraintsApply('fixed'), true);
  assert.equal(constraintsApply('static'), false);
  assert.equal(constraintsApply('relative'), false);
});
