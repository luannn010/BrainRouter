import React from 'react';
import { Icon } from '../../icons.js';
import type { PrototypeEntry } from '../../lib/design/prototypeMeta.js';
import type { DesignElement } from '../../lib/design/designElements.js';
import type { CanvasComponent } from '../../lib/design/canvasModel.js';
import type { DesignAnnotation } from '../../lib/design/designAnnotations.js';
import { canvasLayerRows, type LayerRow } from '../../lib/design/designLayers.js';

/**
 * Two tabs. Assets, Components and Scales were read-only inventories derived
 * from the current HTML; components are canvas objects now, so the only things
 * worth switching between are the files and what is on the canvas.
 */
export type DesignResource = 'files' | 'design';

const RESOURCES: Array<{ id: DesignResource; label: string; icon: string }> = [
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'design', label: 'Design', icon: 'layers' },
];

export function DesignResourceRail({ activeResource, onResourceChange, entries, selected, onSelect, elements, selectedRef, onLayerSelect, components, annotations, selectedAnnoIds, onAnnotationSelect }: {
  activeResource: DesignResource;
  onResourceChange: (resource: DesignResource) => void;
  entries: PrototypeEntry[];
  selected: PrototypeEntry | null;
  onSelect: (id: string) => void;
  elements: DesignElement[];
  selectedRef: string | null;
  onLayerSelect: (ref: string) => void;
  /** Resolves a packed layer's component name in the canvas tree. */
  components: readonly CanvasComponent[];
  annotations: readonly DesignAnnotation[];
  selectedAnnoIds: readonly string[];
  onAnnotationSelect: (id: string, additive: boolean) => void;
}): React.ReactElement {
  return <aside className="ds-resource-rail" aria-label="Design resources">
    <div className="ds-resource-tabs" role="tablist" aria-label="Resource types">
      {RESOURCES.map((resource) => <button key={resource.id} type="button" role="tab" aria-selected={activeResource === resource.id} className={`ds-resource-tab${activeResource === resource.id ? ' is-active' : ''}`} onClick={() => onResourceChange(resource.id)}>
        <Icon name={resource.icon} size={14} /><span>{resource.label}</span>
      </button>)}
    </div>
    <div className="ds-resource-content">
      {activeResource === 'files' && <>
        <div className="ds-resource-section"><span className="ds-eyebrow">Flows</span><span className="ds-resource-count">{entries.length}</span></div>
        <ul className="ds-filelist ds-resource-list">{entries.map((entry) => <li key={entry.id}><button type="button" className={`ds-fileitem${selected?.id === entry.id ? ' is-selected' : ''}`} aria-current={selected?.id === entry.id} onClick={() => onSelect(entry.id)}><span className="ds-fileitem-title"><Icon name="file" size={12} />{entry.title}</span><span className="ds-fileitem-path" data-mono>{entry.path}</span></button></li>)}</ul>
      </>}
      {activeResource === 'design' && <>
        <CanvasLayerTree rows={canvasLayerRows(annotations, components)} selectedIds={selectedAnnoIds} onSelect={onAnnotationSelect} />
        <DesignLayerTree elements={elements} selectedRef={selectedRef} onSelect={onLayerSelect} />
      </>}
    </div>
  </aside>;
}

/**
 * Objects drawn on the canvas. Separate from the DOM tree below it because
 * they are different things: these are yours, those are the prototype's.
 * Multi-select, unlike the DOM tree — it mirrors the canvas selection.
 */
function CanvasLayerTree({ rows, selectedIds, onSelect }: {
  rows: LayerRow[];
  selectedIds: readonly string[];
  onSelect: (id: string, additive: boolean) => void;
}): React.ReactElement {
  return <>
    <div className="ds-resource-section"><span className="ds-eyebrow">Canvas</span><span className="ds-resource-count">{rows.length}</span></div>
    {rows.length
      ? <div className="ds-layer-tree" role="tree" aria-multiselectable="true" aria-label="Canvas layers">
        {rows.map((row) => <button key={row.id} type="button" role="treeitem"
          aria-selected={selectedIds.includes(row.id)} aria-level={row.depth + 1}
          className={`ds-layer-row${selectedIds.includes(row.id) ? ' is-selected' : ''}${row.hidden ? ' is-hidden' : ''}${row.locked ? ' is-locked' : ''}`}
          style={{ paddingLeft: 10 + row.depth * 14 }}
          onClick={(e) => onSelect(row.id, e.shiftKey)}>
          <Icon name={row.icon} size={11} />
          <span>{row.label}</span>
          {/* A hidden layer draws nothing on the canvas, so the rail is the
              only place its state is legible — and the only way to unhide it. */}
          {row.hidden ? <Icon name="eye" size={11} /> : null}
          <small data-mono>{row.componentName ?? row.meta}</small>
        </button>)}
      </div>
      : <p className="ds-empty">Nothing drawn yet. Use the Frame, Shape or Text tools, or right-click to create a component.</p>}
  </>;
}

function DesignLayerTree({ elements, selectedRef, onSelect }: { elements: DesignElement[]; selectedRef: string | null; onSelect: (ref: string) => void }): React.ReactElement {
  return <><div className="ds-resource-section"><span className="ds-eyebrow">Layers</span><span className="ds-resource-count">{elements.length}</span></div><div className="ds-layer-tree" role="tree" aria-label="Prototype layers">{elements.map((element) => <button key={element.ref} type="button" role="treeitem" aria-selected={selectedRef === element.ref} className={`ds-layer-row${selectedRef === element.ref ? ' is-selected' : ''}`} style={{ paddingLeft: 10 + element.depth * 14 }} onClick={() => onSelect(element.ref)}><Icon name={element.tag === 'button' ? 'bolt' : element.childCount ? 'chev-down' : 'file'} size={11} /><span>{element.attributes['aria-label'] || element.text || element.tag}</span><small data-mono>{element.tag}</small></button>)}</div></>;
}
