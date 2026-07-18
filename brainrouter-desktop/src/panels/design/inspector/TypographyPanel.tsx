// brainrouter-desktop/src/panels/design/inspector/TypographyPanel.tsx
// Rendered only for a leaf element that actually carries text (see isTextLayer):
// on a wrapper, every one of these edits would land on the box and not the words.
import React from 'react';
import { Icon } from '../../../icons.js';
import { Field, Row, SegmentedIcons, Section, ToggleRow } from './InspectorControls.js';
import { verticalAlignApplies, type MeasuredElement } from '../../../lib/design/designMeasure.js';
import type { InspectorEdit, InspectorRead } from './DesignPropertiesPanel.js';

const WEIGHTS = [
  { value: '300', label: 'Light' }, { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' }, { value: '700', label: 'Bold' }, { value: '800', label: 'Extra Bold' },
];

const DIRECTIONS = [{ value: 'auto', label: 'Auto' }, { value: 'ltr', label: 'Left to right' }, { value: 'rtl', label: 'Right to left' }];
const CASES = [{ value: 'none', label: 'Original' }, { value: 'uppercase', label: 'Upper' }, { value: 'lowercase', label: 'Lower' }, { value: 'capitalize', label: 'Title' }];
const TRUNCATION = [{ value: 'disabled', label: 'Disabled' }, { value: 'ellipsis', label: 'Ellipsis' }, { value: 'clip', label: 'Clip' }];

const TEXT_ALIGN = [
  { value: 'left', icon: 'text-left', title: 'Align text left' },
  { value: 'center', icon: 'text-center', title: 'Align text center' },
  { value: 'right', icon: 'text-right', title: 'Align text right' },
  { value: 'justify', icon: 'text-justify', title: 'Justify text' },
] as const;

const VERTICAL_ALIGN = [
  { value: 'start', icon: 'v-top', title: 'Align text top' },
  { value: 'center', icon: 'v-center', title: 'Align text middle' },
  { value: 'end', icon: 'v-bottom', title: 'Align text bottom' },
] as const;

export function TypographyPanel({ read, edit, measured }: { read: InspectorRead; edit: InspectorEdit; measured: MeasuredElement | null }): React.ReactElement {
  // Figma only offers vertical alignment on a FIXED-height text layer, and CSS
  // agrees: align-content distributes leftover block-axis space, of which an
  // auto-height or inline box has none. Offer the fix instead of a dead control.
  const canAlignVertically = verticalAlignApplies(measured);
  const decoration = read('textDecoration');
  const bold = Number(read('fontWeight')) >= 600;
  // Underline and strike-through are one CSS property, so toggling either has to
  // recompose the pair rather than overwrite it.
  const toggleDecoration = (part: 'underline' | 'line-through'): void => {
    const parts = decoration.split(' ').filter((item) => item === 'underline' || item === 'line-through');
    const next = parts.includes(part) ? parts.filter((item) => item !== part) : [...parts, part];
    edit('textDecoration', next.length ? next.sort().reverse().join(' ') : 'none');
  };
  return <Section title="Typography" icon="text">
    <Field label="Font family" value={read('fontFamily')} onChange={(value) => edit('fontFamily', value)} placeholder="Inter" />
    <Row>
      <Field label="Font weight" value={read('fontWeight')} onChange={(value) => edit('fontWeight', value)} options={WEIGHTS} />
      <Field label="Font size" type="number" value={read('fontSize')} onChange={(value) => edit('fontSize', Number(value) || 0)} />
    </Row>
    <Row>
      <Field label="Line height" type="number" prefix="A" value={read('lineHeight')} onChange={(value) => edit('lineHeight', Number(value) || 0)} />
      <Field label="Letter spacing" type="number" prefix="Aa" value={read('letterSpacing')} onChange={(value) => edit('letterSpacing', Number(value) || 0)} />
    </Row>
    <Field label="Direction" value={read('direction')} onChange={(value) => edit('direction', value)} options={DIRECTIONS} />
    <div className="ds-field"><span className="ds-field-label">Text alignment</span><SegmentedIcons label="Text alignment" value={read('textAlign')} onChange={(value) => edit('textAlign', value)} options={TEXT_ALIGN} /></div>
    <div className="ds-field"><span className="ds-field-label">Vertical text alignment</span>
      <SegmentedIcons label="Vertical text alignment" disabled={!canAlignVertically} value={read('verticalAlign')} onChange={(value) => edit('verticalAlign', value)} options={VERTICAL_ALIGN} />
      {!canAlignVertically ? <p className="ds-field-hint">Needs a fixed height taller than the text{measured ? <> — <button type="button" className="ds-linkbtn" onClick={() => edit('height', Math.max(measured.contentHeight, measured.box.height) + 24)}>set one</button></> : null}.</p> : null}
    </div>
    <Row>
      <Field label="Text case" value={read('textTransform')} onChange={(value) => edit('textTransform', value)} options={CASES} />
      <Field label="Truncation" value={read('truncation')} onChange={(value) => edit('truncation', value)} options={TRUNCATION} />
    </Row>
    <div className="ds-field"><span className="ds-field-label">OpenType features</span>
      <ToggleRow label="Standard ligatures" checked={read('ligatures') !== 'false'} onChange={(checked) => edit('ligatures', checked)} />
      <ToggleRow label="Contextual alternates" checked={read('contextualAlternates') !== 'false'} onChange={(checked) => edit('contextualAlternates', checked)} />
      <ToggleRow label="Kerning" checked={read('kerning') !== 'false'} onChange={(checked) => edit('kerning', checked)} />
    </div>
    <div className="ds-field"><span className="ds-field-label">Text formatting</span>
      <div className="ds-segrow" role="group" aria-label="Text formatting">
        <button type="button" className={`ds-segbtn${bold ? ' is-active' : ''}`} aria-pressed={bold} title="Bold" aria-label="Bold" onClick={() => edit('fontWeight', bold ? '400' : '700')}><Icon name="bold" size={12} /></button>
        <button type="button" className={`ds-segbtn${read('fontStyle') === 'italic' ? ' is-active' : ''}`} aria-pressed={read('fontStyle') === 'italic'} title="Italic" aria-label="Italic" onClick={() => edit('fontStyle', read('fontStyle') === 'italic' ? 'normal' : 'italic')}><Icon name="italic" size={12} /></button>
        <button type="button" className={`ds-segbtn${decoration.includes('underline') ? ' is-active' : ''}`} aria-pressed={decoration.includes('underline')} title="Underline" aria-label="Underline" onClick={() => toggleDecoration('underline')}><Icon name="underline" size={12} /></button>
        <button type="button" className={`ds-segbtn${decoration.includes('line-through') ? ' is-active' : ''}`} aria-pressed={decoration.includes('line-through')} title="Strikethrough" aria-label="Strikethrough" onClick={() => toggleDecoration('line-through')}><Icon name="strike" size={12} /></button>
      </div>
    </div>
  </Section>;
}
