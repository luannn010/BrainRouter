import test from 'node:test';
import assert from 'node:assert/strict';
import { isEditableTarget, shouldArmElementPicker, toolForKey } from './designTools.js';

test('every toolbar shortcut maps to its tool and variant, case-insensitively', () => {
  const expected = {
    v: { tool: 'select' },
    h: { tool: 'hand' },
    f: { tool: 'frame', frameKind: 'frame' },
    s: { tool: 'inspect' },
    r: { tool: 'shape', shapeKind: 'rectangle' },
    l: { tool: 'shape', shapeKind: 'line' },
    o: { tool: 'shape', shapeKind: 'ellipse' },
    t: { tool: 'text' },
    i: { tool: 'inspect' },
  } as const;
  for (const [key, sel] of Object.entries(expected)) {
    assert.deepEqual(toolForKey(key), sel);
    assert.deepEqual(toolForKey(key.toUpperCase()), sel);
  }
});

test('unmapped keys return null', () => {
  assert.equal(toolForKey('x'), null);
  assert.equal(toolForKey('Escape'), null);
  assert.equal(toolForKey('F5'), null);
  assert.equal(toolForKey(''), null);
});

test('isEditableTarget flags text-entry surfaces only', () => {
  assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
  assert.equal(isEditableTarget({ tagName: 'textarea' }), true);
  assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV' }), false);
  assert.equal(isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget(undefined), false);
});

test('select and inspect modes arm the element picker', () => {
  assert.equal(shouldArmElementPicker('select'), true);
  assert.equal(shouldArmElementPicker('inspect'), true);
  assert.equal(shouldArmElementPicker('frame'), false);
  assert.equal(shouldArmElementPicker('hand'), false);
});
