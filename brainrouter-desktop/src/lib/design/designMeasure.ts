// brainrouter-desktop/src/lib/design/designMeasure.ts
// The inspector shows what the element ACTUALLY is, not what a draft says it
// should be — so every field is seeded from getComputedStyle inside the preview
// and only overridden where a draft operation exists. The snippet built here is
// evaluated in the guest document (webview executeJavaScript, or the dev picker
// over postMessage) and must return JSON-serializable data only.

import { REF_RESOLVER_JS, type DraftProperty } from './designProperties.js';
import type { ConstraintBox } from './designConstraints.js';

export type MeasuredBox = ConstraintBox & { x: number; y: number };

export type MeasuredElement = {
  ref: string;
  box: MeasuredBox;
  /** Computed `position` — decides whether constraints actually bind. */
  position: string;
  /** Computed `display` of the offset parent — decides whether self-alignment binds. */
  parentDisplay: string;
  /** `scrollHeight`: how tall the content actually is. `box.height - contentHeight`
   *  is the block-axis free space, which is the only thing vertical alignment can
   *  move things around in. */
  contentHeight: number;
  styles: Record<string, string>;
};

/** Individual transform properties (`translate`/`scale`/`rotate`) have no effect
 *  on a non-replaced inline box, and most text tags are inline by default — so
 *  the Position controls are disabled rather than latching on a no-op. */
export function transformsApply(measured: MeasuredElement | null): boolean {
  if (!measured) return false;
  const display = (measured.styles['display'] ?? '').trim();
  return display !== 'inline' && display !== 'none';
}

/** `align-content` distributes leftover block-axis space. An auto-height box has
 *  none, and an inline box has no block-axis content box at all — in both cases
 *  the control would latch, record a draft operation, and move nothing. */
export function verticalAlignApplies(measured: MeasuredElement | null): boolean {
  if (!measured) return false;
  const display = (measured.styles['display'] ?? '').trim();
  if (display === 'inline' || display === 'none') return false;
  return measured.box.height - measured.contentHeight > 0.5;
}

export const MEASURED_CSS_PROPERTIES: readonly string[] = [
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-style',
  'direction', 'text-align', 'align-content', 'text-transform', 'text-overflow', 'white-space',
  'text-decoration-line', 'font-variant-ligatures', 'font-kerning',
  'color', 'background-color', 'opacity', 'mix-blend-mode', 'border-radius', 'padding',
  'border-top-width', 'border-top-color', 'border-top-style', 'box-sizing',
  'box-shadow', 'filter', 'backdrop-filter', 'justify-self', 'align-self', 'rotate', 'display',
];

export function buildMeasureScript(ref: string): string {
  return `(function(){${REF_RESOLVER_JS}
var ref = ${JSON.stringify(ref)};
var el = __brResolve(ref);
if (!el) return null;
var rect = el.getBoundingClientRect();
var parent = el.offsetParent || document.documentElement;
var parentRect = parent.getBoundingClientRect();
var cs = getComputedStyle(el);
var keys = ${JSON.stringify(MEASURED_CSS_PROPERTIES)};
var styles = {};
for (var i = 0; i < keys.length; i++) styles[keys[i]] = cs.getPropertyValue(keys[i]);
return {
  ref: ref,
  box: {
    x: rect.left, y: rect.top, width: rect.width, height: rect.height,
    offsetLeft: rect.left - parentRect.left,
    offsetTop: rect.top - parentRect.top,
    offsetRight: parentRect.right - rect.right,
    offsetBottom: parentRect.bottom - rect.bottom
  },
  position: cs.position,
  parentDisplay: getComputedStyle(parent).display,
  contentHeight: el.scrollHeight,
  styles: styles
};
})()`;
}

function numberFrom(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

export function parseMeasurement(raw: unknown): MeasuredElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.ref !== 'string') return null;
  const box = record.box;
  if (!box || typeof box !== 'object') return null;
  const styles = record.styles;
  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) return null;
  const source = box as Record<string, unknown>;
  return {
    ref: record.ref,
    box: {
      x: numberFrom(source.x), y: numberFrom(source.y),
      width: numberFrom(source.width), height: numberFrom(source.height),
      offsetLeft: numberFrom(source.offsetLeft), offsetTop: numberFrom(source.offsetTop),
      offsetRight: numberFrom(source.offsetRight), offsetBottom: numberFrom(source.offsetBottom),
    },
    position: typeof record.position === 'string' ? record.position : 'static',
    parentDisplay: typeof record.parentDisplay === 'string' ? record.parentDisplay : 'block',
    contentHeight: numberFrom(record.contentHeight),
    styles: styles as Record<string, string>,
  };
}

/** `rgb(236, 239, 242)` → `#ECEFF2`; fully transparent → `transparent`. */
function hexFrom(value: string): string {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!match) return value.trim();
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return value.trim();
  if (parts.length > 3 && parts[3] === 0) return 'transparent';
  return `#${parts.slice(0, 3).map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Strips the unit so a number input can hold the value. */
function bare(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'normal' || trimmed === 'none' || trimmed === 'auto') return '0';
  const number = Number.parseFloat(trimmed);
  return Number.isFinite(number) ? String(Number(number.toFixed(2))) : trimmed;
}

export function measuredValueFor(measured: MeasuredElement | null, property: DraftProperty): string {
  if (!measured) return '';
  const styles = measured.styles;
  switch (property) {
    case 'width': return String(measured.box.width);
    case 'height': return String(measured.box.height);
    case 'translateX': return '0';
    case 'translateY': return '0';
    case 'rotation': return bare(styles['rotate'] ?? '0');
    case 'fontFamily': return (styles['font-family'] ?? '').split(',')[0].replace(/["']/g, '').trim();
    case 'fontSize': return bare(styles['font-size'] ?? '');
    case 'fontWeight': return (styles['font-weight'] ?? '400').trim();
    case 'lineHeight': return bare(styles['line-height'] ?? '');
    case 'letterSpacing': return bare(styles['letter-spacing'] ?? '');
    case 'fontStyle': return (styles['font-style'] ?? 'normal').trim();
    case 'direction': return (styles['direction'] ?? 'ltr').trim();
    // Computed `text-align` reports the writing-mode-relative keyword.
    case 'textAlign': {
      const value = (styles['text-align'] ?? '').trim();
      return value === 'start' ? 'left' : value === 'end' ? 'right' : value;
    }
    // `normal` means NO vertical alignment is applied. Reporting it as 'start'
    // would pre-select "top" in the segmented control and imply the layer is
    // aligned when it is not — return empty so nothing is selected.
    case 'verticalAlign': {
      const value = (styles['align-content'] ?? '').trim();
      return value === 'normal' ? '' : value;
    }
    case 'textTransform': return (styles['text-transform'] ?? 'none').trim();
    case 'truncation': return (styles['text-overflow'] ?? '').trim() === 'ellipsis' ? 'ellipsis' : 'disabled';
    case 'textDecoration': return (styles['text-decoration-line'] ?? 'none').trim();
    case 'ligatures': return (styles['font-variant-ligatures'] ?? '').includes('no-common') ? 'false' : 'true';
    case 'kerning': return (styles['font-kerning'] ?? '') === 'none' ? 'false' : 'true';
    case 'contextualAlternates': return 'true';
    case 'color': return hexFrom(styles['color'] ?? '');
    case 'backgroundColor': return hexFrom(styles['background-color'] ?? '');
    case 'textOpacity': return '100';
    case 'fillOpacity': return '100';
    case 'opacity': return String(Math.round(Number.parseFloat(styles['opacity'] ?? '1') * 100));
    case 'blendMode': return (styles['mix-blend-mode'] ?? 'normal').trim();
    case 'borderRadius': return bare(styles['border-radius'] ?? '');
    case 'padding': return bare(styles['padding'] ?? '');
    case 'strokeColor': return hexFrom(styles['border-top-color'] ?? '');
    case 'strokeWidth': return bare(styles['border-top-width'] ?? '');
    case 'strokeAlign': return (styles['box-sizing'] ?? '') === 'border-box' ? 'inside' : 'outside';
    case 'justifySelf': return (styles['justify-self'] ?? 'start').trim();
    case 'alignSelf': return (styles['align-self'] ?? 'start').trim();
    // Nothing in CSS reports "which edge is this pinned to", so the pickers
    // default to the leading edge — the same default Figma gives a new layer.
    case 'constraintH': return 'left';
    case 'constraintV': return 'top';
    case 'blur': return '0';
    case 'backdropBlur': return '0';
    case 'shadowX': case 'shadowY': case 'shadowBlur': case 'shadowSpread': return '0';
    case 'shadowColor': return '#000000';
    case 'shadowKind': return 'drop';
    default: return '';
  }
}
