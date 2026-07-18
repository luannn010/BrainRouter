// brainrouter-desktop/src/panels/design/inspector/DesignPropertiesPanel.tsx
// Position → Constraints → Layout → Appearance → [Typography] → Fill → Stroke →
// Effects. Every field reads through `read`, which prefers a draft operation and
// falls back to the measured computed style, so the panel always shows a real
// value rather than an invented placeholder.
import React from 'react';
import { Field, Row, SegmentedIcons, Section, Swatch, ToggleRow } from './InspectorControls.js';
import { constraintsApply, HORIZONTAL_CONSTRAINTS, VERTICAL_CONSTRAINTS } from '../../../lib/design/designConstraints.js';
import { transformsApply, type MeasuredElement } from '../../../lib/design/designMeasure.js';
import type { DesignElement, DraftProperty } from '../../../lib/design/designElements.js';

export type InspectorEdit = (property: DraftProperty, value: string | number | boolean) => void;
export type InspectorRead = (property: DraftProperty) => string;

const ALIGN_X = [
  { value: 'start', icon: 'align-left', title: 'Align left' },
  { value: 'center', icon: 'align-center-x', title: 'Align horizontal centers' },
  { value: 'end', icon: 'align-right', title: 'Align right' },
] as const;

const ALIGN_Y = [
  { value: 'start', icon: 'align-top', title: 'Align top' },
  { value: 'center', icon: 'align-center-y', title: 'Align vertical centers' },
  { value: 'end', icon: 'align-bottom', title: 'Align bottom' },
] as const;

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'] as const;

const SIZING_HINT = 'Accepts a number (px), a percentage, auto, fill or hug.';

export function DesignPropertiesPanel({ element, measured, read, edit, typography }: { element: DesignElement; measured: MeasuredElement | null; read: InspectorRead; edit: InspectorEdit; typography?: React.ReactNode }): React.ReactElement {
  const constraintsBind = constraintsApply(measured?.position ?? 'static');
  // translate/scale/rotate are no-ops on a non-replaced inline box, so the
  // offset and flip controls are disabled there instead of latching on nothing.
  const canTransform = transformsApply(measured);
  const box = measured?.box ?? null;
  return <>
    <Section title="Position" icon="cursor" action={box ? <small className="ds-measure-readout" data-mono>{`${box.x}, ${box.y}`}</small> : null}>
      <SegmentedIcons label="Horizontal alignment" value={read('justifySelf')} onChange={(value) => edit('justifySelf', value)} options={ALIGN_X} />
      <SegmentedIcons label="Vertical alignment" value={read('alignSelf')} onChange={(value) => edit('alignSelf', value)} options={ALIGN_Y} />
      <Row>
        <Field label="X" type="number" prefix="X" disabled={!canTransform} value={read('translateX')} onChange={(value) => edit('translateX', Number(value) || 0)} title="Horizontal offset from the layer's laid-out position" />
        <Field label="Y" type="number" prefix="Y" disabled={!canTransform} value={read('translateY')} onChange={(value) => edit('translateY', Number(value) || 0)} title="Vertical offset from the layer's laid-out position" />
      </Row>
      <Row>
        <Field label="Rotation" type="number" suffix="°" disabled={!canTransform} value={read('rotation')} onChange={(value) => edit('rotation', Number(value) || 0)} />
        <div className="ds-field">
          <span className="ds-field-label">Flip</span>
          <SegmentedIcons label="Flip" value="" disabled={!canTransform} onChange={(value) => edit(value === 'h' ? 'flipH' : 'flipV', true)} options={[{ value: 'h', icon: 'flip-h', title: 'Flip horizontally' }, { value: 'v', icon: 'flip-v', title: 'Flip vertically' }]} />
        </div>
      </Row>
      {measured && !canTransform ? <p className="ds-field-hint">This layer is an inline box, so offset, rotation and flip have no effect. Set W or H to give it a box first.</p> : null}
    </Section>

    <Section title="Constraints" icon="constraint">
      {!constraintsBind ? <p className="ds-inspector-note">This layer is in normal flow (<code>position: {measured?.position ?? 'static'}</code>), so constraints are advisory until it is positioned.</p> : null}
      <Row>
        <Field label="Horizontal constraint" value={read('constraintH')} onChange={(value) => edit('constraintH', value)} options={HORIZONTAL_CONSTRAINTS.map((item) => ({ value: item.value, label: item.label }))} />
        <Field label="Vertical constraint" value={read('constraintV')} onChange={(value) => edit('constraintV', value)} options={VERTICAL_CONSTRAINTS.map((item) => ({ value: item.value, label: item.label }))} />
      </Row>
    </Section>

    <Section title="Layout" icon="layout">
      <Row>
        <Field label="W" prefix="W" value={read('width')} onChange={(value) => edit('width', value)} title={SIZING_HINT} />
        <Field label="H" prefix="H" value={read('height')} onChange={(value) => edit('height', value)} title={SIZING_HINT} />
      </Row>
      <Row>
        <Field label="Padding" type="number" value={read('padding')} onChange={(value) => edit('padding', Number(value) || 0)} />
        <Field label="Radius" type="number" value={read('borderRadius')} onChange={(value) => edit('borderRadius', Number(value) || 0)} />
      </Row>
    </Section>

    <Section title="Appearance" icon="eye">
      <Row>
        <Field label="Blend mode" value={read('blendMode')} onChange={(value) => edit('blendMode', value)} options={BLEND_MODES.map((mode) => ({ value: mode, label: mode === 'normal' ? 'Pass through' : mode }))} />
        <Field label="Opacity" type="number" suffix="%" value={read('opacity')} onChange={(value) => edit('opacity', Number(value) || 0)} />
      </Row>
      <ToggleRow label="Visible" checked={read('visibility') !== 'false'} onChange={(checked) => edit('visibility', checked)} />
    </Section>

    {typography}

    <Section title="Fill" icon="palette">
      <Swatch label="Fill" value={read('backgroundColor')} alpha={read('fillOpacity')} onChange={(value) => edit('backgroundColor', value)} onAlphaChange={(value) => edit('fillOpacity', Number(value) || 0)} />
      <Swatch label="Text" value={read('color')} alpha={read('textOpacity')} onChange={(value) => edit('color', value)} onAlphaChange={(value) => edit('textOpacity', Number(value) || 0)} />
    </Section>

    <Section title="Stroke" icon="square">
      <Swatch label="Stroke" value={read('strokeColor')} alpha="100" onChange={(value) => edit('strokeColor', value)} onAlphaChange={() => { /* stroke alpha rides the colour value */ }} />
      <Row>
        <Field label="Align" value={read('strokeAlign')} onChange={(value) => edit('strokeAlign', value)} options={[{ value: 'inside', label: 'Inside' }, { value: 'outside', label: 'Outside' }]} />
        <Field label="W" type="number" prefix="W" value={read('strokeWidth')} onChange={(value) => edit('strokeWidth', Number(value) || 0)} />
      </Row>
    </Section>

    <Section title="Effects" icon="effects" defaultOpen={false}>
      <Row>
        <Field label="Shadow" value={read('shadowKind')} onChange={(value) => edit('shadowKind', value)} options={[{ value: 'drop', label: 'Drop shadow' }, { value: 'inner', label: 'Inner shadow' }]} />
        <Field label="Colour" value={read('shadowColor')} onChange={(value) => edit('shadowColor', value)} />
      </Row>
      <Row>
        <Field label="X" type="number" prefix="X" value={read('shadowX')} onChange={(value) => edit('shadowX', Number(value) || 0)} />
        <Field label="Y" type="number" prefix="Y" value={read('shadowY')} onChange={(value) => edit('shadowY', Number(value) || 0)} />
      </Row>
      <Row>
        <Field label="Blur" type="number" value={read('shadowBlur')} onChange={(value) => edit('shadowBlur', Number(value) || 0)} />
        <Field label="Spread" type="number" value={read('shadowSpread')} onChange={(value) => edit('shadowSpread', Number(value) || 0)} />
      </Row>
      <Row>
        <Field label="Layer blur" type="number" value={read('blur')} onChange={(value) => edit('blur', Number(value) || 0)} />
        <Field label="Backdrop blur" type="number" value={read('backdropBlur')} onChange={(value) => edit('backdropBlur', Number(value) || 0)} />
      </Row>
    </Section>

    <p className="ds-inspector-note" data-mono>{element.testid ? `[data-testid="${element.testid}"]` : element.ref}</p>
  </>;
}
