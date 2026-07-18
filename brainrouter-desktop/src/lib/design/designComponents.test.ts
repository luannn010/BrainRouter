import test from 'node:test';
import assert from 'node:assert/strict';
import { addComponent, componentFromHtml, componentFromSelection, uniqueComponentName } from './designComponents.js';
import { createAnnotation } from './designAnnotations.js';

const rect = createAnnotation('rectangle', { x: 10, y: 10, w: 40, h: 20 }, { id: 'a' });
const label = createAnnotation('text', { x: 20, y: 40, w: 60, h: 16 }, { id: 'b', label: 'Go' });

test('a component from a selection takes the selection box as its size', () => {
  const component = componentFromSelection('Card', [rect, label]);
  assert.equal(component.width, 70);
  assert.equal(component.height, 46);
  assert.equal(component.name, 'Card');
  assert.ok(component.id);
});

test('the captured html is a self-contained svg of the members', () => {
  const { html } = componentFromSelection('Card', [rect, label]);
  assert.ok(html.startsWith('<svg'), 'renderable on its own');
  assert.ok(html.includes('viewBox="0 0 70 46"'));
  assert.ok(html.includes('<path'), 'the rectangle contributes geometry');
  assert.ok(html.includes('>Go</text>'), 'the text contributes its words');
});

test('captured text is escaped rather than injected', () => {
  const nasty = createAnnotation('text', { x: 0, y: 0, w: 10, h: 10 }, { id: 'x', label: '<script>alert(1)</script>&' });
  const { html } = componentFromSelection('Bad', [nasty]);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp;'));
});

test('an empty selection is not a component', () => {
  assert.throws(() => componentFromSelection('Nothing', []), /at least one/);
});

test('a component from generated html keeps the html and a positive size', () => {
  const component = componentFromHtml('Button', '<button>Go</button>', { w: 120, h: 40 });
  assert.equal(component.html, '<button>Go</button>');
  assert.deepEqual([component.width, component.height], [120, 40]);
  assert.throws(() => componentFromHtml('Empty', '   ', { w: 10, h: 10 }), /html/);
  const floored = componentFromHtml('Tiny', '<i/>', { w: 0, h: -5 });
  assert.ok(floored.width > 0 && floored.height > 0, 'a zero size would fail document validation');
});

test('names avoid collisions by suffixing', () => {
  const list = [componentFromHtml('Card', '<i/>', { w: 10, h: 10 })];
  assert.equal(uniqueComponentName(list, 'Card'), 'Card 2');
  const two = addComponent(list, componentFromHtml('Card 2', '<i/>', { w: 10, h: 10 }));
  assert.equal(uniqueComponentName(two, 'Card'), 'Card 3');
  assert.equal(uniqueComponentName([], 'Card'), 'Card');
});

test('adding replaces a component with the same id rather than duplicating it', () => {
  const first = componentFromHtml('Card', '<i/>', { w: 10, h: 10 });
  const updated = { ...first, name: 'Renamed' };
  const list = addComponent(addComponent([], first), updated);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Renamed');
});
