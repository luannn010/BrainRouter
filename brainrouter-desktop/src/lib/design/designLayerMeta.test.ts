import test from 'node:test';
import assert from 'node:assert/strict';
import type { DesignElement } from './designElements.js';
import { isTextLayer, layerDisplayName, layerIconFor, layerKindFor, layerKindLabel } from './designLayerMeta.js';

function element(patch: Partial<DesignElement>): DesignElement {
  return { ref: 'div:0', tag: 'div', text: '', depth: 0, testid: null, componentId: null, attributes: {}, childCount: 0, ...patch };
}

test('classifies layers by tag and content', () => {
  assert.equal(layerKindFor(element({ tag: 'h1', text: 'Dashboard' })), 'text');
  assert.equal(layerKindFor(element({ tag: 'p', text: 'Body copy' })), 'text');
  assert.equal(layerKindFor(element({ tag: 'img' })), 'image');
  assert.equal(layerKindFor(element({ tag: 'button', text: 'Continue' })), 'control');
  assert.equal(layerKindFor(element({ tag: 'ul', childCount: 3 })), 'list');
  assert.equal(layerKindFor(element({ tag: 'section', childCount: 4 })), 'frame');
  assert.equal(layerKindFor(element({ tag: 'div', childCount: 2 })), 'frame');
  assert.equal(layerKindFor(element({ tag: 'span' })), 'node');
});

test('a wrapper that only holds other elements is not a text layer', () => {
  // A <div> whose extracted text is just its descendants' text must not offer
  // typography editing — the edit would land on the wrapper, not the words.
  assert.equal(isTextLayer(element({ tag: 'div', text: 'Revenue $12,480', childCount: 3 })), false);
  assert.equal(isTextLayer(element({ tag: 'h1', text: 'Dashboard', childCount: 0 })), true);
  assert.equal(isTextLayer(element({ tag: 'span', text: '+14%', childCount: 0 })), true);
  assert.equal(isTextLayer(element({ tag: 'button', text: 'Continue', childCount: 0 })), true);
  assert.equal(isTextLayer(element({ tag: 'h1', text: '', childCount: 0 })), false);
  assert.equal(isTextLayer(element({ tag: 'img' })), false);
});

test('picks a glyph and a human label per kind', () => {
  assert.equal(layerIconFor(element({ tag: 'h1', text: 'Dashboard' })), 'text');
  assert.equal(layerIconFor(element({ tag: 'img' })), 'image');
  assert.equal(layerIconFor(element({ tag: 'button', text: 'Go' })), 'bolt');
  assert.equal(layerIconFor(element({ tag: 'section', childCount: 2 })), 'frame');
  assert.equal(layerKindLabel(element({ tag: 'h1', text: 'Dashboard' })), 'Text');
  assert.equal(layerKindLabel(element({ tag: 'section', childCount: 2 })), 'Frame');
});

test('names a layer the way the canvas would', () => {
  assert.equal(layerDisplayName(element({ tag: 'h1', text: 'Dashboard', childCount: 0 })), 'Dashboard');
  assert.equal(layerDisplayName(element({ tag: 'section', attributes: { 'aria-label': 'Chart' }, childCount: 3 })), 'Chart');
  assert.equal(layerDisplayName(element({ tag: 'section', componentId: 'hero', childCount: 3 })), 'hero');
  assert.equal(layerDisplayName(element({ tag: 'div', childCount: 4 })), 'div');
  // Long text is trimmed so the inspector header cannot wrap to three lines.
  assert.equal(layerDisplayName(element({ tag: 'p', text: 'x'.repeat(60), childCount: 0 })), `${'x'.repeat(32)}…`);
});
