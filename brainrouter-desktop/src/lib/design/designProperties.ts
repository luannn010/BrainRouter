// brainrouter-desktop/src/lib/design/designProperties.ts
// One place that answers "what can the inspector edit, and what CSS does that emit".
//
// Composite CSS (translate, scale, box-shadow, colour+alpha) cannot be expressed
// as one property per input — `translate` takes two values, `box-shadow` takes
// six. Rather than make the applier stateful, each contributing property writes
// its own `--br-*` custom property AND re-states the shared shorthand that reads
// them back. The shorthand is identical whoever writes it, so operations stay
// independent and order-insensitive.

import { constraintDeclarations, type ConstraintBox } from './designConstraints.js';

export type DraftProperty =
  | 'text'
  | 'translateX' | 'translateY' | 'rotation' | 'flipH' | 'flipV' | 'justifySelf' | 'alignSelf'
  | 'constraintH' | 'constraintV'
  | 'width' | 'height' | 'padding'
  | 'opacity' | 'blendMode' | 'borderRadius' | 'visibility'
  | 'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight' | 'letterSpacing'
  | 'direction' | 'textAlign' | 'verticalAlign' | 'textTransform' | 'truncation'
  | 'fontStyle' | 'textDecoration' | 'ligatures' | 'contextualAlternates' | 'kerning'
  | 'color' | 'textOpacity' | 'backgroundColor' | 'fillOpacity'
  | 'strokeColor' | 'strokeWidth' | 'strokeAlign'
  | 'shadowKind' | 'shadowX' | 'shadowY' | 'shadowBlur' | 'shadowSpread' | 'shadowColor'
  | 'blur' | 'backdropBlur';

export type DraftOperation = { elementRef: string; property: DraftProperty; value: string | number | boolean };

/** A single CSS declaration, already sanitized and ready to set. */
export type CssDeclaration = readonly [property: string, value: string];

const TRANSLATE = 'var(--br-tx, 0px) var(--br-ty, 0px)';
const SCALE = 'var(--br-sx, 1) var(--br-sy, 1)';
const FILL = 'color-mix(in srgb, var(--br-fill, transparent) calc(var(--br-fill-a, 100) * 1%), transparent)';
const TEXT_FILL = 'color-mix(in srgb, var(--br-text, currentColor) calc(var(--br-text-a, 100) * 1%), transparent)';
const SHADOW = 'var(--br-sh-inset, ) var(--br-sh-x, 0px) var(--br-sh-y, 0px) var(--br-sh-blur, 0px) var(--br-sh-spread, 0px) var(--br-sh-color, transparent)';

// Permits hex, keywords, numbers, units, percentages and function syntax like
// fit-content(…); the second guard below rejects the function names that could
// fetch or execute. `;` `:` `{` `}` `<` `>` `"` `'` and `\` are absent by
// omission — note `:` in particular, since it is what rejects `javascript:` and
// any second declaration smuggled into a value.
const SAFE_VALUE = /^[#\w\s.,%()/+-]+$/;
const UNSAFE_VALUE = /url\(|expression\(|javascript:|@import|\/\*|--br-/i;

export function sanitizeCssValue(raw: string | number | boolean): string | null {
  const value = String(raw).trim();
  if (!value || value.length > 120) return null;
  if (!SAFE_VALUE.test(value)) return null;
  if (UNSAFE_VALUE.test(value)) return null;
  return value;
}

/** Numbers become px; anything else must already carry its own unit. */
function pxValue(raw: string | number | boolean): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${raw}px`;
  const value = sanitizeCssValue(raw);
  if (value === null) return null;
  return /^-?\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}

/** Figma-style sizing keywords, then px, then any explicit unit. */
function dimensionValue(raw: string | number | boolean): string | null {
  const value = sanitizeCssValue(raw);
  if (value === null) return null;
  if (value === 'fill') return '100%';
  if (value === 'hug') return 'fit-content';
  if (value === 'auto') return 'auto';
  return pxValue(raw);
}

/** Inspector percentages (0–100) become the 0–1 CSS ratio. */
function ratioValue(raw: string | number | boolean): string | null {
  const number = Number(raw);
  if (!Number.isFinite(number)) return null;
  return String(Math.min(1, Math.max(0, number / 100)));
}

/** Alpha is consumed as `calc(var(--br-*-a) * 1%)`, so it must be a BARE number.
 *  A value carrying its own unit ("40%") makes the colour declaration invalid at
 *  computed-value time, which resolves to `initial` and silently erases the fill
 *  rather than leaving it alone. parseFloat strips the unit; the clamp keeps the
 *  emitted custom property readable. */
function alphaValue(raw: string | number | boolean): string | null {
  const number = Number.parseFloat(String(raw));
  if (!Number.isFinite(number)) return null;
  return String(Math.min(100, Math.max(0, number)));
}

function keywordValue(raw: string | number | boolean, allowed: readonly string[]): string | null {
  const value = sanitizeCssValue(raw);
  return value !== null && allowed.includes(value) ? value : null;
}

function one(property: string, value: string | null): CssDeclaration[] {
  return value === null ? [] : [[property, value]];
}

function composed(customProperty: string, value: string | null, shorthandProperty: string, shorthand: string): CssDeclaration[] {
  return value === null ? [] : [[customProperty, value], [shorthandProperty, shorthand]];
}

/** `box` is only consulted by the constraint properties, which cannot compute an
 *  inset without knowing where the layer currently sits. */
export function cssDeclarationsFor(property: DraftProperty, value: string | number | boolean, box?: ConstraintBox): CssDeclaration[] {
  switch (property) {
    // `text` rewrites content, not style — the applier handles it separately.
    case 'text': return [];
    case 'visibility': return [['display', value === false ? 'none' : 'block']];

    case 'translateX': return composed('--br-tx', pxValue(value), 'translate', TRANSLATE);
    case 'translateY': return composed('--br-ty', pxValue(value), 'translate', TRANSLATE);
    case 'flipH': return composed('--br-sx', value ? '-1' : '1', 'scale', SCALE);
    case 'flipV': return composed('--br-sy', value ? '-1' : '1', 'scale', SCALE);
    case 'rotation': {
      const number = Number(value);
      return one('rotate', Number.isFinite(number) ? `${number}deg` : null);
    }
    case 'justifySelf': return one('justify-self', keywordValue(value, ['start', 'center', 'end', 'stretch']));
    case 'alignSelf': return one('align-self', keywordValue(value, ['start', 'center', 'end', 'stretch']));

    case 'width': return one('width', dimensionValue(value));
    case 'height': return one('height', dimensionValue(value));
    case 'padding': return one('padding', pxValue(value));

    case 'opacity': return one('opacity', ratioValue(value));
    case 'blendMode': return one('mix-blend-mode', keywordValue(value, ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']));
    case 'borderRadius': return one('border-radius', pxValue(value));

    case 'fontFamily': return one('font-family', sanitizeCssValue(value));
    case 'fontWeight': return one('font-weight', sanitizeCssValue(value));
    case 'fontSize': return one('font-size', pxValue(value));
    case 'lineHeight': return one('line-height', pxValue(value));
    case 'letterSpacing': return one('letter-spacing', pxValue(value));
    case 'direction': return value === 'auto' ? [] : one('direction', keywordValue(value, ['ltr', 'rtl']));
    case 'textAlign': return one('text-align', keywordValue(value, ['left', 'center', 'right', 'justify']));
    // `align-content` aligns a block container's own lines — the closest honest
    // DOM analogue of Figma's vertical text alignment. It distributes LEFTOVER
    // space, so it does nothing on an auto-height box and nothing at all on an
    // inline box. That is Figma's own precondition (vertical alignment is only
    // meaningful on fixed-height text), so the control is gated in the UI by
    // `verticalAlignApplies()` rather than silently emitting dead CSS here.
    case 'verticalAlign': return one('align-content', keywordValue(value, ['start', 'center', 'end']));
    case 'textTransform': return one('text-transform', keywordValue(value, ['none', 'uppercase', 'lowercase', 'capitalize']));
    case 'truncation': return value === 'ellipsis'
      ? [['overflow', 'hidden'], ['white-space', 'nowrap'], ['text-overflow', 'ellipsis']]
      : value === 'clip'
        ? [['overflow', 'hidden'], ['white-space', 'nowrap'], ['text-overflow', 'clip']]
        : [['overflow', 'visible'], ['white-space', 'normal'], ['text-overflow', 'clip']];
    case 'fontStyle': return one('font-style', keywordValue(value, ['normal', 'italic']));
    case 'textDecoration': return one('text-decoration-line', keywordValue(value, ['none', 'underline', 'line-through', 'underline line-through']));
    case 'ligatures': return [['font-variant-ligatures', value ? 'common-ligatures' : 'no-common-ligatures']];
    // Single-quoted: this value is also serialized into the data-br-draft-style
    // HTML attribute by applyDraftOperations, where a double quote would close it.
    case 'contextualAlternates': return [['font-feature-settings', value ? "'calt' 1" : "'calt' 0"]];
    case 'kerning': return [['font-kerning', value ? 'normal' : 'none']];

    case 'color': return composed('--br-text', sanitizeCssValue(value), 'color', TEXT_FILL);
    case 'textOpacity': return composed('--br-text-a', alphaValue(value), 'color', TEXT_FILL);
    case 'backgroundColor': return composed('--br-fill', sanitizeCssValue(value), 'background-color', FILL);
    case 'fillOpacity': return composed('--br-fill-a', alphaValue(value), 'background-color', FILL);

    case 'strokeColor': {
      const colour = sanitizeCssValue(value);
      return colour === null ? [] : [['border-color', colour], ['border-style', 'solid']];
    }
    case 'strokeWidth': {
      const width = pxValue(value);
      return width === null ? [] : [['border-width', width], ['border-style', 'solid']];
    }
    // Inside keeps the stroke within the measured box (border-box); outside and
    // centre let it grow the box, which is what content-box does.
    case 'strokeAlign': return one('box-sizing', value === 'inside' ? 'border-box' : 'content-box');

    // A single space is a valid custom-property value; CSS trims it to empty,
    // which contributes nothing to the shorthand — the drop-shadow (non-inset)
    // case. The `var(--br-sh-inset, )` empty fallback covers the absent case.
    case 'shadowKind': return composed('--br-sh-inset', value === 'inner' ? 'inset' : ' ', 'box-shadow', SHADOW);
    case 'shadowX': return composed('--br-sh-x', pxValue(value), 'box-shadow', SHADOW);
    case 'shadowY': return composed('--br-sh-y', pxValue(value), 'box-shadow', SHADOW);
    case 'shadowBlur': return composed('--br-sh-blur', pxValue(value), 'box-shadow', SHADOW);
    case 'shadowSpread': return composed('--br-sh-spread', pxValue(value), 'box-shadow', SHADOW);
    case 'shadowColor': return composed('--br-sh-color', sanitizeCssValue(value), 'box-shadow', SHADOW);

    case 'blur': {
      const radius = pxValue(value);
      return radius === null ? [] : [['filter', `blur(${radius})`]];
    }
    case 'backdropBlur': {
      const radius = pxValue(value);
      return radius === null ? [] : [['backdrop-filter', `blur(${radius})`]];
    }

    // designConstraints.ts owns the axis rules; without a measured box there is
    // nothing to pin against, so the operation stays inert rather than guessing.
    case 'constraintH': return box ? constraintDeclarations('h', String(value), box) : [];
    case 'constraintV': return box ? constraintDeclarations('v', String(value), box) : [];

    default: return [];
  }
}

/** Resolves a `DesignElement.ref` inside the previewed document. Shared verbatim
 *  by the apply and measure snippets so both agree on what a ref points at. */
export const REF_RESOLVER_JS = `function __brResolve(ref){
  var tid = /data-testid="([^"]+)"/.exec(ref);
  if (tid) return document.querySelector('[data-testid="' + tid[1].replace(/"/g, '\\\\"') + '"]');
  var positional = /^([a-z][\\w-]*):(\\d+)$/.exec(ref);
  if (positional) return document.querySelectorAll(positional[1])[Number(positional[2])] || null;
  return null;
}`;

/** The custom properties that feed one shared shorthand. Custom properties
 *  INHERIT, so a nested layer that sets only half a group would otherwise read
 *  an ancestor's other half — edit a card's shadow colour, then a label's blur,
 *  and the label silently inherits the card's colour. */
const CUSTOM_PROPERTY_GROUPS: readonly (readonly string[])[] = [
  ['--br-tx', '--br-ty'],
  ['--br-sx', '--br-sy'],
  ['--br-fill', '--br-fill-a'],
  ['--br-text', '--br-text-a'],
  ['--br-sh-inset', '--br-sh-x', '--br-sh-y', '--br-sh-blur', '--br-sh-spread', '--br-sh-color'],
];

/** For every group this element touches, reset the members it does NOT set.
 *  `initial` makes a custom property guaranteed-invalid, so the shorthand's
 *  `var(--x, fallback)` supplies the neutral default instead of the inherited
 *  value. Members the element does set are left alone, so two fields in the same
 *  group still compose on one element. */
export function groupResetsFor(declarations: readonly CssDeclaration[]): CssDeclaration[] {
  const written = new Set(declarations.map(([property]) => property));
  const resets: CssDeclaration[] = [];
  for (const group of CUSTOM_PROPERTY_GROUPS) {
    if (!group.some((property) => written.has(property))) continue;
    for (const property of group) if (!written.has(property)) resets.push([property, 'initial']);
  }
  return resets;
}

/** Builds the snippet evaluated inside the preview to apply a draft. Values are
 *  embedded as JSON, so nothing in an operation can escape into script position.
 *  `boxes` supplies the measured geometry the constraint properties need, keyed
 *  by element ref; operations whose ref is absent simply emit no constraint CSS. */
export function buildApplyScript(operations: readonly DraftOperation[], boxes: Record<string, ConstraintBox> = {}): string {
  // Grouped per element so the group resets can be computed once, from the full
  // set of declarations that element receives, and emitted BEFORE them.
  const byRef = new Map<string, { text: string | null; declarations: CssDeclaration[] }>();
  for (const operation of operations) {
    const entry = byRef.get(operation.elementRef) ?? { text: null, declarations: [] };
    if (operation.property === 'text') entry.text = String(operation.value);
    else entry.declarations.push(...cssDeclarationsFor(operation.property, operation.value, boxes[operation.elementRef]));
    byRef.set(operation.elementRef, entry);
  }
  const payload = [...byRef].map(([ref, entry]) => ({
    ref,
    text: entry.text,
    declarations: [...groupResetsFor(entry.declarations), ...entry.declarations],
  })).filter((item) => item.text !== null || item.declarations.length > 0);
  if (payload.length === 0) return '';
  return `(function(){${REF_RESOLVER_JS}
var ops = ${JSON.stringify(payload)};
for (var i = 0; i < ops.length; i++) {
  var op = ops[i];
  var el = __brResolve(op.ref);
  if (!el) continue;
  if (op.text !== null) el.textContent = op.text;
  for (var d = 0; d < op.declarations.length; d++) el.style.setProperty(op.declarations[d][0], op.declarations[d][1]);
}
return { ok: true, applied: ops.length };
})()`;
}
