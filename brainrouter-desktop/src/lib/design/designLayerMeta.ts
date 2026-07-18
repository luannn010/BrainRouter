// brainrouter-desktop/src/lib/design/designLayerMeta.ts
// What kind of layer is this, what does it look like in a list, and may the
// inspector show typography for it. `extractDesignElements` gives every element
// the CONCATENATED text of its descendants, so "has text" alone would let a
// wrapper <div> claim to be a text layer — childCount is the tie-breaker.

import type { DesignElement } from './designElements.js';

export type LayerKind = 'text' | 'frame' | 'image' | 'control' | 'list' | 'node';

const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'li', 'td', 'th', 'strong', 'em', 'small', 'figcaption', 'blockquote', 'code', 'legend', 'summary', 'dt', 'dd']);
const FRAME_TAGS = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'form', 'figure', 'fieldset']);
const IMAGE_TAGS = new Set(['img', 'picture', 'video', 'canvas']);
const CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea']);
const LIST_TAGS = new Set(['ul', 'ol', 'dl', 'table', 'tbody', 'thead']);

const KIND_ICON: Record<LayerKind, string> = { text: 'text', frame: 'frame', image: 'image', control: 'bolt', list: 'list', node: 'square' };
const KIND_LABEL: Record<LayerKind, string> = { text: 'Text', frame: 'Frame', image: 'Image', control: 'Control', list: 'List', node: 'Layer' };

const NAME_LIMIT = 32;

export function layerKindFor(element: DesignElement): LayerKind {
  if (IMAGE_TAGS.has(element.tag)) return 'image';
  if (CONTROL_TAGS.has(element.tag)) return 'control';
  if (LIST_TAGS.has(element.tag)) return 'list';
  if (TEXT_TAGS.has(element.tag) && element.childCount === 0 && element.text) return 'text';
  if (FRAME_TAGS.has(element.tag)) return 'frame';
  return 'node';
}

/** Typography is only offered where an edit would land on the words themselves:
 *  a leaf element that actually carries text. */
export function isTextLayer(element: DesignElement): boolean {
  if (IMAGE_TAGS.has(element.tag)) return false;
  if (element.childCount > 0) return false;
  if (!element.text.trim()) return false;
  return TEXT_TAGS.has(element.tag) || CONTROL_TAGS.has(element.tag);
}

export function layerIconFor(element: DesignElement): string {
  return KIND_ICON[layerKindFor(element)];
}

export function layerKindLabel(element: DesignElement): string {
  return KIND_LABEL[layerKindFor(element)];
}

export function layerDisplayName(element: DesignElement): string {
  const raw = element.attributes['aria-label']?.trim()
    || element.componentId?.trim()
    || (element.childCount === 0 ? element.text.trim() : '')
    || element.testid?.trim()
    || element.tag;
  return raw.length > NAME_LIMIT ? `${raw.slice(0, NAME_LIMIT)}…` : raw;
}
