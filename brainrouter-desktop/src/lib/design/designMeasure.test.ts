import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasureScript, measuredValueFor, parseMeasurement, transformsApply, verticalAlignApplies, type MeasuredElement } from './designMeasure.js';

const RAW = {
  ref: 'section:2',
  box: { x: 76, y: 180, width: 424.4, height: 200, offsetLeft: 76, offsetTop: 180, offsetRight: 100, offsetBottom: 220 },
  position: 'absolute',
  parentDisplay: 'block',
  contentHeight: 120,
  styles: {
    'font-size': '16px', 'font-weight': '600', 'line-height': '19.2px', 'letter-spacing': 'normal',
    'color': 'rgb(236, 239, 242)', 'background-color': 'rgba(0, 0, 0, 0)', 'opacity': '1',
    'border-radius': '10px', 'text-align': 'start', 'text-transform': 'none', 'font-style': 'normal',
    'border-top-width': '1px', 'border-top-color': 'rgb(230, 230, 235)',
    'display': 'block', 'align-content': 'normal',
  },
};

function withStyles(patch: Record<string, string>, contentHeight = 120): MeasuredElement {
  const measured = parseMeasurement({ ...RAW, contentHeight }) as MeasuredElement;
  return { ...measured, styles: { ...measured.styles, ...patch } };
}

test('embeds the ref as JSON and reuses the shared resolver', () => {
  const script = buildMeasureScript('button[data-testid="continue"]');
  assert.match(script, /__brResolve/);
  assert.ok(script.includes(JSON.stringify('button[data-testid="continue"]')));
  assert.match(script, /getBoundingClientRect/);
  assert.match(script, /getComputedStyle/);
  assert.match(script, /scrollHeight/);
});

test('parses a measurement and rounds the box to whole pixels', () => {
  const measured = parseMeasurement(RAW);
  assert.equal(measured?.ref, 'section:2');
  assert.equal(measured?.box.width, 424);
  assert.equal(measured?.box.x, 76);
  assert.equal(measured?.position, 'absolute');
  assert.equal(measured?.contentHeight, 120);
  assert.equal(measured?.styles['font-size'], '16px');
});

test('refuses anything that is not a measurement', () => {
  assert.equal(parseMeasurement(null), null);
  assert.equal(parseMeasurement('nope'), null);
  assert.equal(parseMeasurement({ ref: 'a' }), null);
  assert.equal(parseMeasurement({ ...RAW, box: null }), null);
  assert.equal(parseMeasurement({ ...RAW, styles: 'no' }), null);
});

test('turns computed CSS into the value an inspector field should show', () => {
  const measured = parseMeasurement(RAW) as MeasuredElement;
  assert.equal(measuredValueFor(measured, 'fontSize'), '16');
  assert.equal(measuredValueFor(measured, 'lineHeight'), '19.2');
  assert.equal(measuredValueFor(measured, 'fontWeight'), '600');
  assert.equal(measuredValueFor(measured, 'borderRadius'), '10');
  assert.equal(measuredValueFor(measured, 'opacity'), '100');
  assert.equal(measuredValueFor(measured, 'width'), '424');
  assert.equal(measuredValueFor(measured, 'height'), '200');
  assert.equal(measuredValueFor(measured, 'strokeWidth'), '1');
  // `normal` letter-spacing is 0 to a designer, and `start` alignment is left.
  assert.equal(measuredValueFor(measured, 'letterSpacing'), '0');
  assert.equal(measuredValueFor(measured, 'textAlign'), 'left');
  // Colours come back as rgb(); the swatch needs hex.
  assert.equal(measuredValueFor(measured, 'color'), '#ECEFF2');
  assert.equal(measuredValueFor(measured, 'backgroundColor'), 'transparent');
  assert.equal(measuredValueFor(measured, 'strokeColor'), '#E6E6EB');
  // CSS cannot report which edge a layer is pinned to, so the pickers default
  // to the leading edge rather than showing an empty select.
  assert.equal(measuredValueFor(measured, 'constraintH'), 'left');
  assert.equal(measuredValueFor(measured, 'constraintV'), 'top');
});

test('an unmeasured element yields empty strings rather than throwing', () => {
  assert.equal(measuredValueFor(null, 'fontSize'), '');
  assert.equal(measuredValueFor(null, 'textAlign'), '');
});

test('reports no vertical alignment rather than pretending it is top-aligned', () => {
  // Computed `normal` means nothing is applied; showing 'start' would pre-select
  // "top" and make an unaligned layer look aligned.
  assert.equal(measuredValueFor(withStyles({}), 'verticalAlign'), '');
  assert.equal(measuredValueFor(withStyles({ 'align-content': 'center' }), 'verticalAlign'), 'center');
});

test('gates the controls that would otherwise latch on a no-op', () => {
  // align-content can only move content that has block-axis free space.
  assert.equal(verticalAlignApplies(withStyles({}, 120)), true);   // 200px box, 120px content
  assert.equal(verticalAlignApplies(withStyles({}, 200)), false);  // auto-height: box == content
  assert.equal(verticalAlignApplies(withStyles({ display: 'inline' }, 120)), false);
  assert.equal(verticalAlignApplies(null), false);
  // Individual transform properties do nothing on a non-replaced inline box.
  assert.equal(transformsApply(withStyles({ display: 'block' })), true);
  assert.equal(transformsApply(withStyles({ display: 'inline-block' })), true);
  assert.equal(transformsApply(withStyles({ display: 'inline' })), false);
  assert.equal(transformsApply(null), false);
});
