import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDesignChatHandoff } from './designChatHandoff.js';

test('routes a non-empty design prompt to the main Code composer', () => {
  assert.deepEqual(buildDesignChatHandoff('  Make the selected button larger  '), { mode: 'code', prompt: 'Make the selected button larger' });
});

test('does not route an empty design prompt', () => {
  assert.equal(buildDesignChatHandoff('   '), null);
});

