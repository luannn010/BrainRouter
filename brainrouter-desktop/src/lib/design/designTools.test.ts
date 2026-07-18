import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_FOR_KEY, isEditableTarget, revertsToSelect, shouldArmElementPicker, toolForKey } from './designTools.js';

test('every toolbar shortcut maps to its tool and variant, case-insensitively', () => {
  const expected = {
    v: { tool: 'select' },
    h: { tool: 'hand' },
    f: { tool: 'frame', frameKind: 'frame' },
    s: { tool: 'frame', frameKind: 'section' },
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

test('tool shortcuts follow the OpenPencil map', () => {
  assert.deepEqual(toolForKey('v'), { tool: 'select' });
  assert.deepEqual(toolForKey('h'), { tool: 'hand' });
  assert.deepEqual(toolForKey('f'), { tool: 'frame', frameKind: 'frame' });
  assert.deepEqual(toolForKey('s'), { tool: 'frame', frameKind: 'section' }, 'S is Section there, not Inspect');
  assert.deepEqual(toolForKey('r'), { tool: 'shape', shapeKind: 'rectangle' });
  assert.deepEqual(toolForKey('o'), { tool: 'shape', shapeKind: 'ellipse' });
  assert.deepEqual(toolForKey('l'), { tool: 'shape', shapeKind: 'line' });
  assert.deepEqual(toolForKey('t'), { tool: 'text' });
  assert.equal(toolForKey('p'), null, 'no pen tool on this surface');
});

test('polygon and star stay flyout-only, as they are in OpenPencil', () => {
  const bound = Object.values(TOOL_FOR_KEY).map((s) => s.shapeKind).filter(Boolean);
  assert.equal(bound.includes('polygon'), false);
  assert.equal(bound.includes('star'), false);
});

test('creation tools hand back to Select; modes do not', () => {
  assert.equal(revertsToSelect('shape'), true);
  assert.equal(revertsToSelect('frame'), true);
  assert.equal(revertsToSelect('text'), true);
  assert.equal(revertsToSelect('select'), false);
  assert.equal(revertsToSelect('hand'), false);
  assert.equal(revertsToSelect('inspect'), false);
});
