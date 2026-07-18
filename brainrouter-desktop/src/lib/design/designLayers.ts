// brainrouter-desktop/src/lib/design/designLayers.ts
// The left rail's Design tab shows two trees: the prototype's DOM layers, and
// the layers drawn on the canvas. This module turns the annotation list into
// the second one — pure, so the ordering and nesting rules are testable.
import type { CanvasComponent } from './canvasModel.js';
import type { AnnotationKind, DesignAnnotation } from './designAnnotations.js';

export interface LayerRow {
  kind: 'annotation';
  /** The annotation's id — what selecting this row selects on the canvas. */
  id: string;
  label: string;
  /** Mono badge on the right: the annotation's kind, or its component. */
  meta: string;
  depth: number;
  icon: string;
  hidden?: boolean;
  locked?: boolean;
  /** Set only when this layer is packed into a component that still exists. */
  componentName?: string;
}

const ICONS: Record<AnnotationKind, string> = {
  frame: 'frame',
  section: 'section',
  rectangle: 'square',
  line: 'line',
  ellipse: 'ellipse',
  polygon: 'polygon',
  star: 'star',
  text: 'text',
  path: 'polygon',
  component: 'layout',
};

/** Containers own their members in the tree; everything else is a leaf. */
function isContainer(annotation: DesignAnnotation): boolean {
  return annotation.kind === 'frame' || annotation.kind === 'section';
}

function titleCase(kind: AnnotationKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * Build the canvas layer tree.
 *
 * Array order is z-order with the last element on top, but a layer tree reads
 * top-down, so rows come back reversed. A frame or section is emitted with its
 * members nested underneath it; a plain group (from Group selection) mints an
 * id that matches no annotation, so its members stay flat rather than
 * disappearing under a parent that does not exist.
 */
export function canvasLayerRows(
  annotations: readonly DesignAnnotation[],
  components: readonly CanvasComponent[],
): LayerRow[] {
  const containerIds = new Set(annotations.filter(isContainer).map((a) => a.id));
  const byComponent = new Map(components.map((component) => [component.id, component]));

  const toRow = (annotation: DesignAnnotation, depth: number): LayerRow => {
    // A link to a component that has since been deleted is a dangling link, not
    // a component — show the layer as what it actually is now.
    const component = annotation.componentId ? byComponent.get(annotation.componentId) : undefined;
    const row: LayerRow = {
      kind: 'annotation',
      id: annotation.id,
      label: annotation.label.trim() || titleCase(annotation.kind),
      meta: component ? 'component' : annotation.kind,
      depth,
      icon: component ? 'layout' : ICONS[annotation.kind],
    };
    if (annotation.hidden) row.hidden = true;
    if (annotation.locked) row.locked = true;
    if (component) row.componentName = component.name;
    return row;
  };

  // A layer's parent is its groupId only when that names a real container.
  // Self-parenting is ignored, and a plain group's synthetic id names nothing.
  const parentOf = (a: DesignAnnotation): string | null =>
    a.groupId && a.groupId !== a.id && containerIds.has(a.groupId) ? a.groupId : null;

  const topmostFirst = [...annotations].reverse();
  const childrenOf = new Map<string, DesignAnnotation[]>();
  const roots: DesignAnnotation[] = [];
  for (const annotation of topmostFirst) {
    const parent = parentOf(annotation);
    if (parent) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), annotation]);
    else roots.push(annotation);
  }

  const rows: LayerRow[] = [];
  const seen = new Set<string>();
  // Recursive so containment nests as deep as it actually goes; `seen` also
  // makes a containment cycle terminate instead of recursing forever.
  const emit = (annotation: DesignAnnotation, depth: number): void => {
    if (seen.has(annotation.id)) return;
    seen.add(annotation.id);
    rows.push(toRow(annotation, depth));
    for (const child of childrenOf.get(annotation.id) ?? []) emit(child, depth + 1);
  };
  for (const root of roots) emit(root, 0);
  // Anything only reachable through a cycle has no root; list it rather than
  // letting it disappear from the only surface that can select it.
  for (const annotation of topmostFirst) emit(annotation, 0);
  return rows;
}
