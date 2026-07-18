// brainrouter-desktop/src/panels/design/inspector/ShapeInspector.tsx
// Properties for a selected canvas shape, mirroring what OpenPencil's Design
// tab exposes: position and size, appearance (opacity, corner radius), fill,
// stroke, and type size/weight for text. Editing applies to the whole
// selection, so changing a fill with three shapes selected fills all three.
import React from 'react';
import type { DesignAnnotation } from '../../../lib/design/designAnnotations.js';
import { styleValue, type StyleField } from '../../../lib/design/annotationStyle.js';
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
  /** With a mixed selection the first shape leads, as it does in Figma. */
  const style = (field: StyleField): string => String(styleValue(head, field));
  const number = (field: StyleField) => (value: string): void => { if (value.trim()) onStyle(field, Number(value)); };

  return <>
    <Section title="Position" icon="constraint">
      <Row>
        <Field label="X" type="number" value={String(Math.round(head.x))} onChange={(v) => { if (v.trim()) onGeometry('x', Number(v)); }} />
        <Field label="Y" type="number" value={String(Math.round(head.y))} onChange={(v) => { if (v.trim()) onGeometry('y', Number(v)); }} />
      </Row>
      <Row>
        <Field label="W" type="number" value={String(Math.round(head.w))} onChange={(v) => { if (v.trim()) onGeometry('w', Number(v)); }} />
        <Field label="H" type="number" value={String(Math.round(head.h))} onChange={(v) => { if (v.trim()) onGeometry('h', Number(v)); }} />
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

    {head.kind === 'text' ? (
      <Section title="Typography" icon="text">
        <Row>
          <Field label="Size" type="number" value={style('fontSize')} onChange={number('fontSize')} />
          <Field label="Weight" type="number" value={style('fontWeight')} onChange={number('fontWeight')} />
        </Row>
      </Section>
    ) : null}

    {selected.length > 1 ? <p className="ds-inspector-hint">{selected.length} layers selected — edits apply to all of them.</p> : null}
  </>;
}
