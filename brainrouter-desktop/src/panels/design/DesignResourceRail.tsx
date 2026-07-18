import React from 'react';
import { Icon } from '../../icons.js';
import type { PrototypeEntry } from '../../lib/design/prototypeMeta.js';
import { componentElements, type DesignElement } from '../../lib/design/designElements.js';
import type { CanvasComponent } from '../../lib/design/canvasModel.js';

/** Drag payload the canvas listens for when a saved component is dropped. */
export const COMPONENT_DRAG_TYPE = 'application/x-brainrouter-component';

export type DesignResource = 'files' | 'assets' | 'components' | 'scales' | 'design';

const RESOURCES: Array<{ id: DesignResource; label: string; icon: string }> = [
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'assets', label: 'Assets', icon: 'palette' },
  { id: 'components', label: 'Components', icon: 'layout' },
  { id: 'scales', label: 'Scales', icon: 'chart' },
];

export function DesignResourceRail({ activeResource, onResourceChange, entries, selected, onSelect, elements, selectedRef, onLayerSelect, components, onDeleteComponent }: {
  activeResource: DesignResource;
  onResourceChange: (resource: DesignResource) => void;
  entries: PrototypeEntry[];
  selected: PrototypeEntry | null;
  onSelect: (id: string) => void;
  elements: DesignElement[];
  selectedRef: string | null;
  onLayerSelect: (ref: string) => void;
  /** Saved components from the canvas document — draggable onto the canvas. */
  components: readonly CanvasComponent[];
  onDeleteComponent: (id: string) => void;
}): React.ReactElement {
  return <aside className="ds-resource-rail" aria-label="Design resources">
    <div className="ds-resource-tabs" role="tablist" aria-label="Resource types">
      {RESOURCES.map((resource) => <button key={resource.id} type="button" role="tab" aria-selected={activeResource === resource.id} className={`ds-resource-tab${activeResource === resource.id ? ' is-active' : ''}`} onClick={() => onResourceChange(resource.id)}>
        <Icon name={resource.icon} size={14} /><span>{resource.label}</span>
      </button>)}
      <button type="button" role="tab" aria-selected={activeResource === 'design'} className={`ds-resource-tab${activeResource === 'design' ? ' is-active' : ''}`} onClick={() => onResourceChange('design')}>
        <Icon name="layers" size={14} /><span>Design</span>
      </button>
    </div>
    <div className="ds-resource-content">
      {activeResource === 'files' && <>
        <div className="ds-resource-section"><span className="ds-eyebrow">Flows</span><span className="ds-resource-count">{entries.length}</span></div>
        <ul className="ds-filelist ds-resource-list">{entries.map((entry) => <li key={entry.id}><button type="button" className={`ds-fileitem${selected?.id === entry.id ? ' is-selected' : ''}`} aria-current={selected?.id === entry.id} onClick={() => onSelect(entry.id)}><span className="ds-fileitem-title"><Icon name="file" size={12} />{entry.title}</span><span className="ds-fileitem-path" data-mono>{entry.path}</span></button></li>)}</ul>
      </>}
      {activeResource === 'assets' && <ResourceList title="Assets" items={elements.filter((element) => ['img', 'svg', 'video', 'canvas'].includes(element.tag)).map((element) => `${element.tag} · ${element.ref}`)} empty="No image or media assets detected." />}
      {activeResource === 'components' && <>
        <SavedComponentList components={components} onDelete={onDeleteComponent} />
        <ComponentList elements={componentElements(elements)} selectedRef={selectedRef} onSelect={onLayerSelect} />
      </>}
      {activeResource === 'scales' && <ResourceList title="Scales" items={['Typography · 12 / 14 / 16 / 20 / 28', 'Spacing · 4 / 8 / 12 / 16 / 24', 'Radius · 4 / 6 / 10 / 12', 'Signal · #34C28E']} empty="Select a flow to inspect its design scales." />}
      {activeResource === 'design' && <DesignLayerTree elements={elements} selectedRef={selectedRef} onSelect={onLayerSelect} />}
    </div>
  </aside>;
}

function ResourceList({ title, items, empty }: { title: string; items: string[]; empty: string }): React.ReactElement {
  return <><div className="ds-resource-section"><span className="ds-eyebrow">{title}</span><span className="ds-resource-count">{items.length}</span></div>{items.length ? <ul className="ds-resource-list ds-inventory-list">{items.map((item) => <li key={item}><span>{item}</span></li>)}</ul> : <p className="ds-empty">{empty}</p>}</>;
}

/** Components saved on this board. Dragging one onto the canvas places it. */
function SavedComponentList({ components, onDelete }: { components: readonly CanvasComponent[]; onDelete: (id: string) => void }): React.ReactElement {
  return <>
    <div className="ds-resource-section"><span className="ds-eyebrow">Saved</span><span className="ds-resource-count">{components.length}</span></div>
    {components.length
      ? <ul className="ds-resource-list ds-component-list">{components.map((component) => <li key={component.id}>
        <div className="ds-component-card" draggable
          onDragStart={(e) => { e.dataTransfer.setData(COMPONENT_DRAG_TYPE, component.id); e.dataTransfer.effectAllowed = 'copy'; }}>
          {/* Component markup can come from a model. It renders in a sandbox
              with NO allow-scripts, so an inline onerror= handler is inert —
              stripping <script> alone would not be enough here, because this
              rail lives in the renderer origin that holds the bridge. */}
          <iframe className="ds-component-preview" aria-hidden="true" tabIndex={-1} title={component.name}
            sandbox="" srcDoc={component.html} />
          <span className="ds-component-name">{component.name}</span>
          <small data-mono>{Math.round(component.width)}×{Math.round(component.height)}</small>
          <button type="button" className="ds-iconbtn" aria-label={`Delete component ${component.name}`} onClick={() => onDelete(component.id)}>
            <Icon name="close" size={11} />
          </button>
        </div>
      </li>)}</ul>
      : <p className="ds-empty">Right-click a selection and choose Create component to save one here.</p>}
  </>;
}

function ComponentList({ elements, selectedRef, onSelect }: { elements: DesignElement[]; selectedRef: string | null; onSelect: (ref: string) => void }): React.ReactElement {
  return <><div className="ds-resource-section"><span className="ds-eyebrow">Components</span><span className="ds-resource-count">{elements.length}</span></div>{elements.length ? <div className="ds-layer-tree" role="list" aria-label="Prototype components">{elements.map((element) => <button key={element.ref} type="button" className={`ds-layer-row${selectedRef === element.ref ? ' is-selected' : ''}`} aria-pressed={selectedRef === element.ref} onClick={() => onSelect(element.ref)}><Icon name={element.tag === 'button' ? 'bolt' : 'file'} size={11} /><span>{element.componentId || element.text || element.tag}</span><small data-mono>{element.testid || element.tag}</small></button>)}</div> : <p className="ds-empty">No reusable component candidates detected.</p>}</>;
}

function DesignLayerTree({ elements, selectedRef, onSelect }: { elements: DesignElement[]; selectedRef: string | null; onSelect: (ref: string) => void }): React.ReactElement {
  return <><div className="ds-resource-section"><span className="ds-eyebrow">Layers</span><span className="ds-resource-count">{elements.length}</span></div><div className="ds-layer-tree" role="tree" aria-label="Prototype layers">{elements.map((element) => <button key={element.ref} type="button" role="treeitem" aria-selected={selectedRef === element.ref} className={`ds-layer-row${selectedRef === element.ref ? ' is-selected' : ''}`} style={{ paddingLeft: 10 + element.depth * 14 }} onClick={() => onSelect(element.ref)}><Icon name={element.tag === 'button' ? 'bolt' : element.childCount ? 'chev-down' : 'file'} size={11} /><span>{element.attributes['aria-label'] || element.text || element.tag}</span><small data-mono>{element.tag}</small></button>)}</div></>;
}
