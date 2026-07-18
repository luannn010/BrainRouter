import React from 'react';
import { Icon } from '../../icons.js';
import { DesignPropertiesPanel } from './inspector/DesignPropertiesPanel.js';
import { TypographyPanel } from './inspector/TypographyPanel.js';
import { ShapeInspector } from './inspector/ShapeInspector.js';
import type { StyleField } from '../../lib/design/annotationStyle.js';
import type { DesignAnnotation } from '../../lib/design/designAnnotations.js';
import { isTextLayer, layerDisplayName, layerIconFor, layerKindLabel } from '../../lib/design/designLayerMeta.js';
import { measuredValueFor, type MeasuredElement } from '../../lib/design/designMeasure.js';
import type { DesignElement, DraftOperation, DraftProperty } from '../../lib/design/designElements.js';

export type InspectorTab = 'design' | 'code' | 'ai';

export function DesignInspector({ element, measured, tab, onTabChange, operations, onOperationChange, onSave, onRevert, onOpenAi, shapes, onShapeGeometry, onShapeStyle }: { element: DesignElement | null; measured: MeasuredElement | null; tab: InspectorTab; onTabChange: (tab: InspectorTab) => void; operations: DraftOperation[]; onOperationChange: (operation: DraftOperation) => void; onSave: () => void; onRevert: () => void; onOpenAi: () => void; shapes: readonly DesignAnnotation[]; onShapeGeometry: (field: 'x' | 'y' | 'w' | 'h', value: number) => void; onShapeStyle: (field: StyleField, value: string | number) => void }): React.ReactElement {
  // A canvas shape wins the panel when one is selected: it is the thing the
  // user just drew, and the prototype's DOM properties do not describe it.
  const shapeMode = shapes.length > 0;
  return <aside className="ds-design-inspector" aria-label="Design inspector">
    <div className="ds-inspector-tabs" role="tablist" aria-label="Inspector modes">{(['design', 'code', 'ai'] as InspectorTab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => onTabChange(item)}>{item === 'ai' ? <Icon name="spark" size={12} /> : null}{item === 'design' ? 'Design' : item === 'code' ? '<> Code' : 'AI'}</button>)}</div>
    {shapeMode && tab === 'design' && <>
      <div className="ds-inspector-head"><Icon name={shapes[0].kind === 'text' ? 'text' : 'square'} size={13} /><strong>{shapes[0].label.trim() || shapes[0].kind}</strong><small data-mono>{shapes.length > 1 ? `${shapes.length} layers` : shapes[0].kind}</small></div>
      <ShapeInspector selected={shapes} onGeometry={onShapeGeometry} onStyle={onShapeStyle} />
    </>}
    {!shapeMode && !element && <div className="ds-inspector-empty"><Icon name="edit" size={18} /><p>Select a layer or use Inspect to edit the prototype.</p></div>}
    {!shapeMode && element && tab === 'design' && <DesignTab element={element} measured={measured} operations={operations} onOperationChange={onOperationChange} onSave={onSave} onRevert={onRevert} />}
    {element && tab === 'code' && <CodeProperties element={element} measured={measured} />}
    {element && tab === 'ai' && <div className="ds-inspector-panel"><span className="ds-eyebrow">AI edit target</span><h2 className="ds-inspector-title">{layerDisplayName(element)}</h2><p className="ds-inspector-copy">Fix Chat will receive this element reference and the current draft properties.</p><code className="ds-code-block">{element.testid ? `[data-testid="${element.testid}"]` : element.ref}</code><button type="button" className="ds-iconbtn ds-iconbtn--accent ds-inspector-wide" onClick={onOpenAi}><Icon name="spark" size={13} /> Open Fix Chat</button></div>}
  </aside>;
}

function DesignTab({ element, measured, operations, onOperationChange, onSave, onRevert }: { element: DesignElement; measured: MeasuredElement | null; operations: DraftOperation[]; onOperationChange: (operation: DraftOperation) => void; onSave: () => void; onRevert: () => void }): React.ReactElement {
  // A draft always wins; otherwise show what the element measured as, so no field
  // ever displays a placeholder the prototype does not actually have.
  const read = (property: DraftProperty): string => {
    const draft = operations.find((item) => item.elementRef === element.ref && item.property === property);
    return draft ? String(draft.value) : measuredValueFor(measured, property);
  };
  const edit = (property: DraftProperty, value: string | number | boolean): void => onOperationChange({ elementRef: element.ref, property, value });
  const dirty = operations.some((item) => item.elementRef === element.ref);
  return <div className="ds-inspector-panel">
    <div className="ds-layer-head">
      <Icon name={layerIconFor(element)} size={13} />
      <strong>{layerDisplayName(element)}</strong>
      <small>{layerKindLabel(element)}</small>
      {dirty ? <span className="ds-layer-dirty" title="Unsaved draft edits">Edited</span> : null}
    </div>
    <DesignPropertiesPanel element={element} measured={measured} read={read} edit={edit}
      typography={isTextLayer(element) ? <TypographyPanel read={read} edit={edit} measured={measured} /> : null} />
    <div className="ds-inspector-actions"><button type="button" className="ds-iconbtn ds-iconbtn--accent" onClick={onSave}>Save draft</button><button type="button" className="ds-iconbtn" onClick={onRevert}>Revert</button></div>
  </div>;
}

function CodeProperties({ element, measured }: { element: DesignElement; measured: MeasuredElement | null }): React.ReactElement {
  return <div className="ds-inspector-panel"><section className="ds-inspector-section"><h3>Element</h3><dl className="ds-inspector-list"><dt>Tag</dt><dd data-mono>&lt;{element.tag}&gt;</dd><dt>Reference</dt><dd data-mono>{element.ref}</dd><dt>Test ID</dt><dd data-mono>{element.testid ?? '—'}</dd><dt>Children</dt><dd data-mono>{element.childCount}</dd><dt>Size</dt><dd data-mono>{measured ? `${measured.box.width} × ${measured.box.height}` : '—'}</dd><dt>Position</dt><dd data-mono>{measured?.position ?? '—'}</dd></dl></section><span className="ds-eyebrow">Text summary</span><p className="ds-inspector-copy">{element.text || 'No text content'}</p></div>;
}
