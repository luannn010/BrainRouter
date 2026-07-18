// brainrouter-desktop/src/panels/design/inspector/ShapeInspector.tsx
// Properties for the selected canvas shapes. Section order follows OpenPencil's
// DesignPanel — Position, Appearance, Typography, Fill, Stroke — and, as it
// does, Typography is dropped from a multi-selection rather than shown for
// whichever member happens to be first. Editing applies to the whole
// selection, so changing a fill with three shapes selected fills all three.
import React from 'react';
import type { DesignAnnotation } from '../../../lib/design/designAnnotations.js';
import { styleValue, type StyleField } from '../../../lib/design/annotationStyle.js';
import { isCommittable, sharedValue } from '../../../lib/design/inspectorFields.js';
import { Field, Row, Section, Swatch } from './InspectorControls.js';

/** Kinds whose box is painted; a line or a baked path has no fill of its own. */
const FILLABLE = new Set(['frame', 'section', 'rectangle', 'ellipse', 'polygon', 'star', 'text']);
const ROUNDABLE = new Set(['frame', 'section', 'rectangle']);

export function ShapeInspector({ selected, onGeometry, onStyle }: {
  selected: readonly DesignAnnotation[];
  onGeometry: (field: 'x' | 'y' | 'w' | 'h', value: number) => void;
  onStyle: (field: StyleField, value: string | number) => void;
}): React.ReactElement | null {
  const head = selected[0];
  if (!head) return null;
  const many = selected.length > 1;

  // Every field speaks for the WHOLE selection. Reading `head` alone showed the
  // first shape's value as though it were the selection's, so editing it
  // silently overwrote the others with a number the user never saw.
  const style = (field: StyleField): string => sharedValue(selected.map((shape) => String(styleValue(shape, field))));
  const geometry = (field: 'x' | 'y' | 'w' | 'h'): string => sharedValue(selected.map((shape) => String(Math.round(shape[field]))));
  const number = (field: StyleField) => (value: string): void => { if (isCommittable(value)) onStyle(field, Number(value)); };
  const geo = (field: 'x' | 'y' | 'w' | 'h') => (value: string): void => { if (isCommittable(value)) onGeometry(field, Number(value)); };

  return <>
    <Section title="Position" icon="constraint">
      <Row>
        <Field label="X" type="number" value={geometry('x')} onChange={geo('x')} />
        <Field label="Y" type="number" value={geometry('y')} onChange={geo('y')} />
      </Row>
      <Row>
        <Field label="W" type="number" value={geometry('w')} onChange={geo('w')} />
        <Field label="H" type="number" value={geometry('h')} onChange={geo('h')} />
      </Row>
    </Section>

    <Section title="Appearance" icon="effects">
      <Row>
        <Field label="Opacity" type="number" suffix="%" value={style('opacity')} onChange={number('opacity')} />
        {ROUNDABLE.has(head.kind)
          ? <Field label="Radius" type="number" value={style('radius')} onChange={number('radius')} />
          : <Field label="Radius" value="—" disabled title={`A ${head.kind} has no corners to round.`} onChange={() => undefined} />}
      </Row>
    </Section>

    {head.kind === 'text' && !many ? (
      <Section title="Typography" icon="text">
        <Row>
          <Field label="Size" type="number" value={style('fontSize')} onChange={number('fontSize')} />
          <Field label="Weight" type="number" step={100} value={style('fontWeight')} onChange={number('fontWeight')} />
        </Row>
      </Section>
    ) : null}

    <Section title="Fill" icon="palette">
      {FILLABLE.has(head.kind)
        ? <Swatch label={head.kind === 'text' ? 'Text' : 'Fill'} value={style('fill')}
            alpha={style('opacity')} onChange={(v) => onStyle('fill', v)} onAlphaChange={number('opacity')} />
        : <p className="ds-inspector-hint">A {head.kind} is drawn with its stroke — it has no fill.</p>}
    </Section>

    <Section title="Stroke" icon="line">
      <Swatch label="Stroke" value={style('stroke')} onChange={(v) => onStyle('stroke', v)} />
      <Row>
        <Field label="Width" type="number" value={style('strokeWidth')} onChange={number('strokeWidth')} />
      </Row>
    </Section>

    {many ? <p className="ds-inspector-hint">{selected.length} layers selected — edits apply to all of them.</p> : null}
  </>;
}
