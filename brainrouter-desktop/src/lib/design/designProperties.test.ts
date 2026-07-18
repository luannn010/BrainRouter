import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplyScript, cssDeclarationsFor, sanitizeCssValue, type DraftOperation } from './designProperties.js';

test('rejects values that could break out of a declaration', () => {
  assert.equal(sanitizeCssValue('red'), 'red');
  assert.equal(sanitizeCssValue('#34C28E'), '#34C28E');
  assert.equal(sanitizeCssValue(12), '12');
  assert.equal(sanitizeCssValue('red;background:url(x)'), null);
  assert.equal(sanitizeCssValue('url(javascript:alert(1))'), null);
  assert.equal(sanitizeCssValue('a'.repeat(200)), null);
  assert.equal(sanitizeCssValue('   '), null);
});

test('maps simple properties one-to-one with units', () => {
  assert.deepEqual(cssDeclarationsFor('fontSize', 16), [['font-size', '16px']]);
  assert.deepEqual(cssDeclarationsFor('fontWeight', '600'), [['font-weight', '600']]);
  assert.deepEqual(cssDeclarationsFor('letterSpacing', -2), [['letter-spacing', '-2px']]);
  assert.deepEqual(cssDeclarationsFor('opacity', 40), [['opacity', '0.4']]);
  assert.deepEqual(cssDeclarationsFor('rotation', 90), [['rotate', '90deg']]);
});

test('accepts auto, fill and hug for layout dimensions', () => {
  assert.deepEqual(cssDeclarationsFor('width', 'auto'), [['width', 'auto']]);
  assert.deepEqual(cssDeclarationsFor('width', 'fill'), [['width', '100%']]);
  assert.deepEqual(cssDeclarationsFor('height', 'hug'), [['height', 'fit-content']]);
  assert.deepEqual(cssDeclarationsFor('width', 424), [['width', '424px']]);
  assert.deepEqual(cssDeclarationsFor('width', '50%'), [['width', '50%']]);
});

test('composes translate, scale, fill alpha and shadow through custom properties', () => {
  assert.deepEqual(cssDeclarationsFor('translateX', 20), [
    ['--br-tx', '20px'],
    ['translate', 'var(--br-tx, 0px) var(--br-ty, 0px)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('flipH', true), [
    ['--br-sx', '-1'],
    ['scale', 'var(--br-sx, 1) var(--br-sy, 1)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('flipH', false), [
    ['--br-sx', '1'],
    ['scale', 'var(--br-sx, 1) var(--br-sy, 1)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('backgroundColor', '#FFFFFF'), [
    ['--br-fill', '#FFFFFF'],
    ['background-color', 'color-mix(in srgb, var(--br-fill, transparent) calc(var(--br-fill-a, 100) * 1%), transparent)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('fillOpacity', 50), [
    ['--br-fill-a', '50'],
    ['background-color', 'color-mix(in srgb, var(--br-fill, transparent) calc(var(--br-fill-a, 100) * 1%), transparent)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('shadowKind', 'inner')[0], ['--br-sh-inset', 'inset']);
  assert.deepEqual(cssDeclarationsFor('shadowKind', 'drop')[0], ['--br-sh-inset', ' ']);
  assert.equal(cssDeclarationsFor('shadowBlur', 8)[1][0], 'box-shadow');
});

test('expands truncation and text formatting into every declaration they need', () => {
  assert.deepEqual(cssDeclarationsFor('truncation', 'ellipsis'), [
    ['overflow', 'hidden'],
    ['white-space', 'nowrap'],
    ['text-overflow', 'ellipsis'],
  ]);
  assert.deepEqual(cssDeclarationsFor('truncation', 'disabled'), [
    ['overflow', 'visible'],
    ['white-space', 'normal'],
    ['text-overflow', 'clip'],
  ]);
  assert.deepEqual(cssDeclarationsFor('textDecoration', 'underline'), [['text-decoration-line', 'underline']]);
  assert.deepEqual(cssDeclarationsFor('ligatures', false), [['font-variant-ligatures', 'no-common-ligatures']]);
  assert.deepEqual(cssDeclarationsFor('kerning', false), [['font-kerning', 'none']]);
  // Single quotes, not double: this value is also serialized into the
  // data-br-draft-style HTML attribute, and a double quote would close it.
  assert.deepEqual(cssDeclarationsFor('contextualAlternates', true), [['font-feature-settings', "'calt' 1"]]);
  assert.ok(!JSON.stringify(cssDeclarationsFor('contextualAlternates', false)).includes('\\"'));
});

test('clamps alpha to a bare 0-100 number so the colour never goes invalid', () => {
  // color-mix computes `calc(var(--br-fill-a) * 1%)`, so a value carrying its own
  // unit makes the whole declaration invalid-at-computed-value-time and the fill
  // silently disappears. Only bare numbers may reach the custom property.
  assert.deepEqual(cssDeclarationsFor('fillOpacity', '40%')[0], ['--br-fill-a', '40']);
  assert.deepEqual(cssDeclarationsFor('fillOpacity', 150)[0], ['--br-fill-a', '100']);
  assert.deepEqual(cssDeclarationsFor('textOpacity', -20)[0], ['--br-text-a', '0']);
  assert.deepEqual(cssDeclarationsFor('fillOpacity', 'red'), []);
});

test('drops unknown properties and unsafe values instead of emitting CSS', () => {
  assert.deepEqual(cssDeclarationsFor('unknown' as never, 'x'), []);
  assert.deepEqual(cssDeclarationsFor('backgroundColor', 'red;}'), []);
  assert.deepEqual(cssDeclarationsFor('text', 'hello'), []);
});

test('constraints need the measured box, and emit insets once they have it', () => {
  // Without a box there is nothing to pin against, so the operation is inert
  // rather than guessing an inset.
  assert.deepEqual(cssDeclarationsFor('constraintH', 'left'), []);
  const box = { offsetLeft: 76, offsetTop: 180, offsetRight: 100, offsetBottom: 220, width: 424, height: 200 };
  assert.deepEqual(cssDeclarationsFor('constraintH', 'left', box), [['left', '76px'], ['right', 'auto']]);
  assert.deepEqual(cssDeclarationsFor('constraintV', 'top-bottom', box), [['top', '180px'], ['bottom', '220px'], ['height', 'auto']]);
});

test('builds an apply script that resolves refs and sets every declaration', () => {
  const operations: DraftOperation[] = [
    { elementRef: 'button[data-testid="continue"]', property: 'text', value: 'Save' },
    { elementRef: 'button[data-testid="continue"]', property: 'fontSize', value: 16 },
    { elementRef: 'h1:0', property: 'visibility', value: false },
  ];
  const script = buildApplyScript(operations);
  assert.match(script, /data-testid/);
  assert.match(script, /font-size/);
  assert.match(script, /setProperty/);
  // The payload is embedded as JSON, so no operation value can close the script.
  assert.ok(script.includes(JSON.stringify('Save')));
  assert.equal(buildApplyScript([]), '');
});

test('neutralizes the rest of a composite group so nothing inherits from an ancestor', () => {
  // Custom properties INHERIT. Without this, editing a container's shadow and
  // then a descendant's blur would make the descendant pick up the container's
  // colour and inset. Only the members this element does not set are reset.
  const script = buildApplyScript([{ elementRef: 'h1:0', property: 'translateX', value: 20 }]);
  assert.match(script, /\["--br-ty","initial"\]/);
  assert.ok(!script.includes('["--br-tx","initial"]'));
  // Both halves set on the same element: neither may be reset.
  const both = buildApplyScript([
    { elementRef: 'h1:0', property: 'translateX', value: 20 },
    { elementRef: 'h1:0', property: 'translateY', value: 30 },
  ]);
  assert.ok(!both.includes('initial'));
  assert.match(both, /\["--br-tx","20px"\]/);
  assert.match(both, /\["--br-ty","30px"\]/);
  // Groups the element does not touch at all are left alone.
  assert.ok(!script.includes('--br-sh-color'));
});

test('an operation that produces no declarations is dropped from the script', () => {
  // A constraint with no measured box for its ref would otherwise emit an empty
  // entry, and the script would still run for nothing.
  const script = buildApplyScript([{ elementRef: 'h1:0', property: 'constraintH', value: 'left' }]);
  assert.equal(script, '');
  const withBox = buildApplyScript(
    [{ elementRef: 'h1:0', property: 'constraintH', value: 'left' }],
    { 'h1:0': { offsetLeft: 8, offsetTop: 0, offsetRight: 0, offsetBottom: 0, width: 10, height: 10 } },
  );
  assert.match(withBox, /"left","8px"/);
});
