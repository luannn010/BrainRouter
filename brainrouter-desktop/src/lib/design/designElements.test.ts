import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDraftOperations, extractDesignElements, elementRefFor, componentElements, resolvePickedElement, type DraftOperation } from './designElements.js';

const HTML = `<main><h1>Welcome</h1><button data-testid="continue">Continue</button><section><p>Details</p></section></main>`;

test('resolves a picked prototype element for both the component rail and inspector', () => {
  const elements = extractDesignElements(`<main><section data-component-id="hero"><button data-testid="continue">Continue</button></section></main>`);
  const picked = resolvePickedElement(elements, { testid: 'continue', tag: 'button', label: '[data-testid="continue"]' });
  assert.equal(picked?.ref, 'button[data-testid="continue"]');
  assert.deepEqual(componentElements(elements).map((element) => element.ref), ['section:0', 'button[data-testid="continue"]']);
});

test('extracts a stable layer tree with semantic metadata and nesting depth', () => {
  const elements = extractDesignElements(HTML);
  assert.deepEqual(elements.map((element) => ({ ref: element.ref, tag: element.tag, text: element.text, depth: element.depth })), [
    { ref: 'main:0', tag: 'main', text: 'Welcome Continue Details', depth: 0 },
    { ref: 'h1:0', tag: 'h1', text: 'Welcome', depth: 1 },
    { ref: 'button[data-testid="continue"]', tag: 'button', text: 'Continue', depth: 1 },
    { ref: 'section:0', tag: 'section', text: 'Details', depth: 1 },
    { ref: 'p:0', tag: 'p', text: 'Details', depth: 2 },
  ]);
  assert.equal(elementRefFor(elements[1]), 'h1:0');
});

test('applies only supported draft operations and leaves scripts untouched', () => {
  const operations: DraftOperation[] = [
    { elementRef: 'button[data-testid="continue"]', property: 'text', value: 'Save changes' },
    { elementRef: 'button[data-testid="continue"]', property: 'backgroundColor', value: '#34C28E' },
    { elementRef: 'button[data-testid="continue"]', property: 'fontSize', value: 16 },
    { elementRef: 'button[data-testid="continue"]', property: 'unknown' as never, value: 'ignored' },
  ];
  const result = applyDraftOperations(`${HTML}<script>window.keepMe = true;</script>`, operations);
  assert.match(result, />Save changes<\/button>/);
  assert.match(result, /--br-fill:#34C28E/);
  assert.match(result, /font-size:16px/);
  assert.match(result, /window\.keepMe = true/);
  assert.doesNotMatch(result, /ignored/);
});
