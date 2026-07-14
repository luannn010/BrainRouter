import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPrototypeTransitions } from './flowExtraction.js';

test('extracts supported data-go and data-show transitions with testids', () => {
  const result = extractPrototypeTransitions(`<button data-testid="next" data-go="payment">Next</button><a data-show="error">Retry</a>`);
  assert.deepEqual(result.transitions, [
    { kind: 'go', target: 'payment', testid: 'next' },
    { kind: 'show', target: 'error' },
  ]);
  assert.deepEqual(result.warnings, []);
});

test('ignores unrelated markup and reports empty targets', () => {
  const result = extractPrototypeTransitions('<div class="card"></div><button data-go="">Broken</button>');
  assert.deepEqual(result.transitions, []);
  assert.deepEqual(result.warnings, []);
});
