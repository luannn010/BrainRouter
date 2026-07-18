import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOTATION_STYLE_FIELDS, DEFAULT_STYLE, cssForAnnotation, defaultStyleFor,
  isStyleField, sanitizeColor, setAnnotationStyle, styleValue,
} from './annotationStyle.js';
import { createAnnotation, type DesignAnnotation } from './designAnnotations.js';

const rect = (over: Partial<DesignAnnotation> = {}): DesignAnnotation => ({
  ...createAnnotation('rectangle', { x: 0, y: 0, w: 100, h: 50 }, { id: 'r' }),
  ...over,
});

test('the panel exposes the properties OpenPencil puts in its Design tab', () => {
  assert.deepEqual([...ANNOTATION_STYLE_FIELDS], ['fill', 'stroke', 'strokeWidth', 'radius', 'opacity', 'fontSize', 'fontWeight']);
  assert.equal(isStyleField('fill'), true);
  assert.equal(isStyleField('nope'), false);
});

test('a colour must be a colour, not an escape hatch into CSS', () => {
  assert.equal(sanitizeColor('#34C28E'), '#34C28E');
  assert.equal(sanitizeColor('rgb(52, 194, 142)'), 'rgb(52, 194, 142)');
  assert.equal(sanitizeColor('transparent'), 'transparent');
  // Anything that could break out of the declaration is refused outright.
  assert.equal(sanitizeColor('red; position:fixed'), null);
  assert.equal(sanitizeColor('url(http://evil/x)'), null);
  assert.equal(sanitizeColor('expression(alert(1))'), null);
  assert.equal(sanitizeColor('  '), null);
});

test('each kind starts from a sensible default rather than an empty box', () => {
  assert.equal(defaultStyleFor('rectangle').fill, DEFAULT_STYLE.fill);
  assert.equal(defaultStyleFor('frame').fill, 'transparent', 'a frame is a container, not a filled box');
  assert.equal(defaultStyleFor('section').fill, 'transparent');
  assert.equal(defaultStyleFor('line').fill, 'transparent');
  assert.equal(defaultStyleFor('text').fontSize, DEFAULT_STYLE.fontSize);
});

test('styleValue reads the annotation, falling back to its kind default', () => {
  assert.equal(styleValue(rect(), 'opacity'), DEFAULT_STYLE.opacity);
  assert.equal(styleValue(rect({ opacity: 40 }), 'opacity'), 40);
  assert.equal(styleValue(rect({ fill: '#ff0000' }), 'fill'), '#ff0000');
});

test('setting a style patches only the chosen annotations and leaves the rest alone', () => {
  const list = [rect({ id: 'a' } as Partial<DesignAnnotation>), rect({ id: 'b' } as Partial<DesignAnnotation>)];
  const next = setAnnotationStyle(list, ['a'], 'fill', '#123456');
  assert.equal(next[0].fill, '#123456');
  assert.equal(next[1].fill, undefined);
  assert.equal(list[0].fill, undefined, 'the input is not mutated');
});

test('a rejected colour leaves the annotation untouched rather than writing junk', () => {
  const list = [rect({ fill: '#111111' })];
  assert.deepEqual(setAnnotationStyle(list, ['r'], 'fill', 'red; content:"x"'), list);
});

test('numeric styles are clamped to their own range', () => {
  const list = [rect()];
  assert.equal(setAnnotationStyle(list, ['r'], 'opacity', 999)[0].opacity, 100);
  assert.equal(setAnnotationStyle(list, ['r'], 'opacity', -5)[0].opacity, 0);
  assert.equal(setAnnotationStyle(list, ['r'], 'strokeWidth', -3)[0].strokeWidth, 0);
  assert.equal(setAnnotationStyle(list, ['r'], 'radius', -3)[0].radius, 0);
  assert.equal(setAnnotationStyle(list, ['r'], 'fontSize', 0)[0].fontSize, 1);
  assert.equal(setAnnotationStyle(list, ['r'], 'opacity', Number.NaN)[0].opacity, undefined, 'NaN is not a value');
});

test('css reflects the annotation, and opacity is a fraction not a percentage', () => {
  const css = cssForAnnotation(rect({ fill: '#123456', stroke: '#abcdef', strokeWidth: 3, radius: 8, opacity: 50 }));
  assert.equal(css.background, '#123456');
  assert.equal(css.borderColor, '#abcdef');
  assert.equal(css.borderWidth, '3px');
  assert.equal(css.borderRadius, '8px');
  assert.equal(css.opacity, 0.5);
});

test('a line and a text layer do not get a box fill or a border', () => {
  const line = cssForAnnotation({ ...createAnnotation('line', { x: 0, y: 0, w: 10, h: 10 }, { id: 'l' }) });
  assert.equal(line.background, undefined);
  assert.equal(line.borderWidth, undefined);
  const text = cssForAnnotation({ ...createAnnotation('text', { x: 0, y: 0, w: 10, h: 10 }, { id: 't' }), fontSize: 18, fontWeight: 700, fill: '#eeeeee' });
  assert.equal(text.fontSize, '18px');
  assert.equal(text.fontWeight, 700);
  assert.equal(text.color, '#eeeeee', 'for text the fill is the ink');
  assert.equal(text.background, undefined);
});

test('css never emits a property whose value was refused', () => {
  const css = cssForAnnotation(rect({ fill: 'javascript:alert(1)' as string }));
  assert.equal(css.background, DEFAULT_STYLE.fill, 'falls back to the default rather than the junk');
});
