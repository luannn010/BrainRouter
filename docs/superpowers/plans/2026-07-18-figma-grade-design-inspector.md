# Figma-Grade Design Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Design Studio inspector (`Designs` tab → right rail) into a Figma-class properties panel with a layer header icon, Position, Constraints, Layout, Appearance, Typography (text layers only), Fill, Stroke and Effects sections, driven by real measured values read back from the live prototype.

**Architecture:** All property semantics move into pure, unit-tested modules under `brainrouter-desktop/src/lib/design/`. A new `designProperties.ts` owns the editable-property union and the CSS it emits; composite CSS (translate, scale, box-shadow, colour+alpha) is expressed by writing `--br-*` custom properties **plus** one shared shorthand that reads them, so every draft property stays an independent single key. A new `designMeasure.ts` builds a JS snippet that is evaluated inside the preview surface and returns the element's box and computed styles; `PreviewCanvas` gains a `measure(ref)` method that runs it over `executeJavaScript` in Electron and over `postMessage` in the dev browser fallback. The inspector components become thin renderers over `{ element, measured, operations }`.

**Tech Stack:** React 18, TypeScript (strict), Electron `<webview>` / sandboxed `<iframe>` preview, `node:test` + `tsx`, existing Memory Instrument CSS tokens.

**Execution order:** run **Task 3 before Task 1** — Task 1 imports the constraint mapping Task 3 creates. Everything else runs in the order written. Tasks 8 and 9 share one commit because Task 8 leaves the tree non-compiling by design (`DesignsView` has not yet been given the new required prop).

## Global Constraints

- Prototype HTML remains the rendering source of truth. Direct inspector edits are **draft operations only** — they never rewrite the prototype file. Fix Chat stays the only agent-driven source edit path.
- Preview sandboxing is unchanged: the Electron `<webview>` keeps `partition="persist:design-studio"`; the browser fallback `<iframe>` keeps `sandbox="allow-scripts allow-forms"` with **no** `allow-same-origin`. Do not add `allow-same-origin`.
- Every value that reaches CSS must pass the sanitizer in `designProperties.ts`. Never interpolate a raw user value into a style string.
- Imports of local TypeScript modules use the **`.js`** extension (`./designProperties.js`) — `allowImportingTsExtensions` is `false`.
- Tests use `import test from 'node:test'` + `import assert from 'node:assert/strict'`. There is **no** React component test infrastructure in `brainrouter-desktop` (no jsdom, no RTL) — put logic in `src/lib/design/*.ts` and test it there. Do not add a component-test dependency.
- Code style, matching `DesignResourceRail.tsx` / `designTools.ts`: named exports only, `function` declarations for components, explicit `React.ReactElement` return types, props destructured and typed inline in the signature, dense single-line JSX for small helper components, single quotes, 2-space indent.
- `tsconfig.json` is `strict: true` but **without** `noUncheckedIndexedAccess` and **without** `exactOptionalPropertyTypes`.
- The `Icon` component's `name` prop is a plain `string` and `PATHS` is `Record<string, React.ReactNode>` — adding an icon means adding exactly one entry to `PATHS` in `src/icons.tsx`. Icons are drawn on a 16×16 grid, stroke-only (`fill="none" stroke="currentColor" strokeWidth="1.4"` come from the wrapper `<svg>`).
- Run a single test file with: `npx tsx --test "src/lib/design/<name>.test.ts"` from `brainrouter-desktop`.
- Typecheck with: `npm run typecheck` from `brainrouter-desktop`.

## File Structure

**Create (pure logic — unit tested):**

| File | Responsibility |
| :--- | :--- |
| `src/lib/design/designProperties.ts` | The `DraftProperty` union, `DraftOperation`, value sanitizing, `cssDeclarationsFor()`, the shared ref-resolver JS, and `buildApplyScript()`. |
| `src/lib/design/designProperties.test.ts` | Tests for the above. |
| `src/lib/design/designLayerMeta.ts` | Tag → layer icon / kind label / display name, and `isTextLayer()` (gates the Typography section). |
| `src/lib/design/designLayerMeta.test.ts` | Tests for the above. |
| `src/lib/design/designConstraints.ts` | `HorizontalConstraint` / `VerticalConstraint`, their CSS mapping, and applicability. |
| `src/lib/design/designConstraints.test.ts` | Tests for the above. |
| `src/lib/design/designMeasure.ts` | `MeasuredElement`, `buildMeasureScript()`, `parseMeasurement()`, `measuredValueFor()`, and the `transformsApply()` / `verticalAlignApplies()` gates. |
| `src/lib/design/designMeasure.test.ts` | Tests for the above. |

**Create (presentation):**

| File | Responsibility |
| :--- | :--- |
| `src/panels/design/inspector/InspectorControls.tsx` | Shared primitives: collapsible `Section`, `Field`, `PairGrid`, `SegmentedIcons`, `SwatchField`, `ToggleRow`, `NumberField`. |
| `src/panels/design/inspector/DesignPropertiesPanel.tsx` | Position, Constraints, Layout, Appearance, Fill, Stroke, Effects. |
| `src/panels/design/inspector/TypographyPanel.tsx` | The full typography block, rendered only for text layers. |

**Modify:**

| File | Change |
| :--- | :--- |
| `src/lib/design/designElements.ts` | Drop its private property model; re-export from `designProperties.ts`; use `cssDeclarationsFor()` in `applyDraftOperations`. |
| `src/panels/design/PreviewCanvas.tsx` | Use `buildApplyScript()`; add `measure(ref)` to `PreviewHandle` (webview + iframe paths). |
| `vite.config.ts` | Extend the injected dev picker to answer `__brpMeasure` with `__brpMeasured`. |
| `src/panels/design/DesignInspector.tsx` | Becomes the shell: tabs, layer header with icon, empty state, routing to the two panels. |
| `src/panels/design/DesignsView.tsx` | Fetch measurements for the selected element and pass them to the inspector. |
| `src/panels/design/designStudio.css` | Inspector width token, new control styles, responsive drawer. |
| `src/icons.tsx` | Add the layer-kind and alignment/formatting glyphs. |
| `docs/design/Design.md` | Document the inspector sections and the `--br-*` composition pattern. |

---

### Task 1: The editable-property model and the CSS it emits

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designProperties.ts`
- Create: `brainrouter-desktop/src/lib/design/designProperties.test.ts`
- Modify: `brainrouter-desktop/src/lib/design/designElements.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type DraftProperty` — the full union (listed in the implementation below).
  - `type DraftOperation = { elementRef: string; property: DraftProperty; value: string | number | boolean }`
  - `type CssDeclaration = readonly [property: string, value: string]`
  - `cssDeclarationsFor(property: DraftProperty, value: string | number | boolean, box?: ConstraintBox): CssDeclaration[]`
  - `sanitizeCssValue(raw: string | number | boolean): string | null`
  - `REF_RESOLVER_JS: string`
  - `buildApplyScript(operations: readonly DraftOperation[], boxes?: Record<string, ConstraintBox>): string`

> **Ordering note:** this task imports `constraintDeclarations` from `designConstraints.ts`, which Task 3 creates. **Execute Task 3 first**, then return here. Task 3 has no dependencies of its own — it only imports the `CssDeclaration` *type*, which is erased at compile time, so there is no runtime import cycle.

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/designProperties.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplyScript, cssDeclarationsFor, sanitizeCssValue, type DraftOperation } from './designProperties.js';

test('rejects values that could break out of a declaration', () => {
  assert.equal(sanitizeCssValue('red'), 'red');
  assert.equal(sanitizeCssValue('#34C28E'), '#34C28E');
  assert.equal(sanitizeCssValue(12), '12');
  assert.equal(sanitizeCssValue('red;background:url(x)'), null);
  assert.equal(sanitizeCssValue('url(javascript:alert(1))'), null);
  assert.equal(sanitizeCssValue('a'.repeat(200)), null);
  assert.equal(sanitizeCssValue('   '), null);
});

test('maps simple properties one-to-one with units', () => {
  assert.deepEqual(cssDeclarationsFor('fontSize', 16), [['font-size', '16px']]);
  assert.deepEqual(cssDeclarationsFor('fontWeight', '600'), [['font-weight', '600']]);
  assert.deepEqual(cssDeclarationsFor('letterSpacing', -2), [['letter-spacing', '-2px']]);
  assert.deepEqual(cssDeclarationsFor('opacity', 40), [['opacity', '0.4']]);
  assert.deepEqual(cssDeclarationsFor('rotation', 90), [['rotate', '90deg']]);
});

test('accepts auto, fill and hug for layout dimensions', () => {
  assert.deepEqual(cssDeclarationsFor('width', 'auto'), [['width', 'auto']]);
  assert.deepEqual(cssDeclarationsFor('width', 'fill'), [['width', '100%']]);
  assert.deepEqual(cssDeclarationsFor('height', 'hug'), [['height', 'fit-content']]);
  assert.deepEqual(cssDeclarationsFor('width', 424), [['width', '424px']]);
  assert.deepEqual(cssDeclarationsFor('width', '50%'), [['width', '50%']]);
});

test('composes translate, scale, fill alpha and shadow through custom properties', () => {
  assert.deepEqual(cssDeclarationsFor('translateX', 20), [
    ['--br-tx', '20px'],
    ['translate', 'var(--br-tx, 0px) var(--br-ty, 0px)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('flipH', true), [
    ['--br-sx', '-1'],
    ['scale', 'var(--br-sx, 1) var(--br-sy, 1)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('flipH', false), [
    ['--br-sx', '1'],
    ['scale', 'var(--br-sx, 1) var(--br-sy, 1)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('backgroundColor', '#FFFFFF'), [
    ['--br-fill', '#FFFFFF'],
    ['background-color', 'color-mix(in srgb, var(--br-fill, transparent) calc(var(--br-fill-a, 100) * 1%), transparent)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('fillOpacity', 50), [
    ['--br-fill-a', '50'],
    ['background-color', 'color-mix(in srgb, var(--br-fill, transparent) calc(var(--br-fill-a, 100) * 1%), transparent)'],
  ]);
  assert.deepEqual(cssDeclarationsFor('shadowKind', 'inner')[0], ['--br-sh-inset', 'inset']);
  assert.deepEqual(cssDeclarationsFor('shadowKind', 'drop')[0], ['--br-sh-inset', ' ']);
  assert.equal(cssDeclarationsFor('shadowBlur', 8)[1][0], 'box-shadow');
});

test('expands truncation and text formatting into every declaration they need', () => {
  assert.deepEqual(cssDeclarationsFor('truncation', 'ellipsis'), [
    ['overflow', 'hidden'],
    ['white-space', 'nowrap'],
    ['text-overflow', 'ellipsis'],
  ]);
  assert.deepEqual(cssDeclarationsFor('truncation', 'disabled'), [
    ['overflow', 'visible'],
    ['white-space', 'normal'],
    ['text-overflow', 'clip'],
  ]);
  assert.deepEqual(cssDeclarationsFor('textDecoration', 'underline'), [['text-decoration-line', 'underline']]);
  assert.deepEqual(cssDeclarationsFor('ligatures', false), [['font-variant-ligatures', 'no-common-ligatures']]);
  assert.deepEqual(cssDeclarationsFor('kerning', false), [['font-kerning', 'none']]);
  // Single quotes, not double: this value is also serialized into the
  // data-br-draft-style HTML attribute, and a double quote would close it.
  assert.deepEqual(cssDeclarationsFor('contextualAlternates', true), [['font-feature-settings', "'calt' 1"]]);
  assert.ok(!JSON.stringify(cssDeclarationsFor('contextualAlternates', false)).includes('\\"'));
});

test('clamps alpha to a bare 0-100 number so the colour never goes invalid', () => {
  // color-mix computes `calc(var(--br-fill-a) * 1%)`, so a value carrying its own
  // unit makes the whole declaration invalid-at-computed-value-time and the fill
  // silently disappears. Only bare numbers may reach the custom property.
  assert.deepEqual(cssDeclarationsFor('fillOpacity', '40%')[0], ['--br-fill-a', '40']);
  assert.deepEqual(cssDeclarationsFor('fillOpacity', 150)[0], ['--br-fill-a', '100']);
  assert.deepEqual(cssDeclarationsFor('textOpacity', -20)[0], ['--br-text-a', '0']);
  assert.deepEqual(cssDeclarationsFor('fillOpacity', 'red'), []);
});

test('drops unknown properties and unsafe values instead of emitting CSS', () => {
  assert.deepEqual(cssDeclarationsFor('unknown' as never, 'x'), []);
  assert.deepEqual(cssDeclarationsFor('backgroundColor', 'red;}'), []);
  assert.deepEqual(cssDeclarationsFor('text', 'hello'), []);
});

test('constraints need the measured box, and emit insets once they have it', () => {
  // Without a box there is nothing to pin against, so the operation is inert
  // rather than guessing an inset.
  assert.deepEqual(cssDeclarationsFor('constraintH', 'left'), []);
  const box = { offsetLeft: 76, offsetTop: 180, offsetRight: 100, offsetBottom: 220, width: 424, height: 200 };
  assert.deepEqual(cssDeclarationsFor('constraintH', 'left', box), [['left', '76px'], ['right', 'auto']]);
  assert.deepEqual(cssDeclarationsFor('constraintV', 'top-bottom', box), [['top', '180px'], ['bottom', '220px'], ['height', 'auto']]);
});

test('builds an apply script that resolves refs and sets every declaration', () => {
  const operations: DraftOperation[] = [
    { elementRef: 'button[data-testid="continue"]', property: 'text', value: 'Save' },
    { elementRef: 'button[data-testid="continue"]', property: 'fontSize', value: 16 },
    { elementRef: 'h1:0', property: 'visibility', value: false },
  ];
  const script = buildApplyScript(operations);
  assert.match(script, /data-testid/);
  assert.match(script, /font-size/);
  assert.match(script, /setProperty/);
  // The payload is embedded as JSON, so no operation value can close the script.
  assert.ok(script.includes(JSON.stringify('Save')));
  assert.equal(buildApplyScript([]), '');
});

test('neutralizes the rest of a composite group so nothing inherits from an ancestor', () => {
  // Custom properties INHERIT. Without this, editing a container's shadow and
  // then a descendant's blur would make the descendant pick up the container's
  // colour and inset. Only the members this element does not set are reset.
  const script = buildApplyScript([{ elementRef: 'h1:0', property: 'translateX', value: 20 }]);
  assert.match(script, /\["--br-ty","initial"\]/);
  assert.ok(!script.includes('["--br-tx","initial"]'));
  // Both halves set on the same element: neither may be reset.
  const both = buildApplyScript([
    { elementRef: 'h1:0', property: 'translateX', value: 20 },
    { elementRef: 'h1:0', property: 'translateY', value: 30 },
  ]);
  assert.ok(!both.includes('initial'));
  assert.match(both, /\["--br-tx","20px"\]/);
  assert.match(both, /\["--br-ty","30px"\]/);
  // Groups the element does not touch at all are left alone.
  assert.ok(!script.includes('--br-sh-color'));
});

test('an operation that produces no declarations is dropped from the script', () => {
  // A constraint with no measured box for its ref would otherwise emit an empty
  // entry, and the script would still run for nothing.
  const script = buildApplyScript([{ elementRef: 'h1:0', property: 'constraintH', value: 'left' }]);
  assert.equal(script, '');
  const withBox = buildApplyScript(
    [{ elementRef: 'h1:0', property: 'constraintH', value: 'left' }],
    { 'h1:0': { offsetLeft: 8, offsetTop: 0, offsetRight: 0, offsetBottom: 0, width: 10, height: 10 } },
  );
  assert.match(withBox, /"left","8px"/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run from `brainrouter-desktop`:

```
npx tsx --test "src/lib/design/designProperties.test.ts"
```

Expected: FAIL — `Cannot find module './designProperties.js'`.

- [ ] **Step 3: Implement `designProperties.ts`**

Create `brainrouter-desktop/src/lib/design/designProperties.ts`:

```ts
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
// fetch or execute. `;` `{` `}` `<` `>` `"` `'` and `\` are absent by omission.
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
 *  rather than leaving it alone. Number() strips the unit; the clamp keeps the
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

    // A single space is a valid custom-property value that contributes nothing
    // to the shorthand — the drop-shadow (non-inset) case.
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
```

- [ ] **Step 4: Run the test and verify it passes**

```
npx tsx --test "src/lib/design/designProperties.test.ts"
```

Expected: PASS, 11 tests, 0 failures.

- [ ] **Step 5: Point `designElements.ts` at the new model**

In `brainrouter-desktop/src/lib/design/designElements.ts`, replace line 1:

```ts
export type DraftProperty = 'text' | 'color' | 'backgroundColor' | 'fontSize' | 'fontWeight' | 'padding' | 'borderRadius' | 'visibility';
```

with:

```ts
import { cssDeclarationsFor, groupResetsFor, type DraftOperation, type DraftProperty } from './designProperties.js';

export type { DraftOperation, DraftProperty } from './designProperties.js';
```

Then delete the now-duplicated `DraftOperation` type (line 16) and the private `STYLE_PROPERTIES` const and `cssValue` function (lines 95–109), and replace the styles line inside `applyDraftOperations` (currently line 130):

```ts
    const styles = list.map((operation) => cssValue(operation.property, operation.value)).filter((value): value is string => Boolean(value));
```

with:

```ts
    const declarations = list.flatMap((operation) => cssDeclarationsFor(operation.property, operation.value));
    const styles = [...groupResetsFor(declarations), ...declarations].map(([property, value]) => `${property}:${value}`);
```

> Two notes on this string path, which differ from the `setProperty` path in `buildApplyScript`:
> - It writes into the `data-br-draft-style="…"` attribute, so no declaration value may contain a double quote. `contextualAlternates` is single-quoted for exactly this reason — keep it that way.
> - `shadowKind: 'drop'` emits `--br-sh-inset` as a single space, which serializes as `--br-sh-inset: `. That is valid but fragile under style-string round-tripping; the shorthand's `var(--br-sh-inset, )` empty fallback covers it either way.

- [ ] **Step 6: Update the one assertion in `designElements.test.ts` that pinned the old CSS shape**

Background colour now composes through `--br-fill`, so the expected draft-style attribute changes. In `brainrouter-desktop/src/lib/design/designElements.test.ts`, replace:

```ts
  assert.match(result, /data-br-draft-style="background-color:#34C28E;font-size:16px"/);
```

with:

```ts
  assert.match(result, /--br-fill:#34C28E/);
  assert.match(result, /font-size:16px/);
```

- [ ] **Step 7: Run both design test files and verify they pass**

```
npx tsx --test "src/lib/design/designProperties.test.ts" "src/lib/design/designElements.test.ts"
```

Expected: PASS, 0 failures. (Do not gate on a total count — `designElements.test.ts` is pre-existing and its count may have moved.)

- [ ] **Step 8: Commit**

```bash
git add brainrouter-desktop/src/lib/design/designProperties.ts brainrouter-desktop/src/lib/design/designProperties.test.ts brainrouter-desktop/src/lib/design/designElements.ts brainrouter-desktop/src/lib/design/designElements.test.ts
git commit -m "feat(design): model the full inspector property set and its CSS output"
```

---

### Task 2: Layer identity — icon, kind label, and the text-layer gate

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designLayerMeta.ts`
- Create: `brainrouter-desktop/src/lib/design/designLayerMeta.test.ts`
- Modify: `brainrouter-desktop/src/icons.tsx`

**Interfaces:**
- Consumes: `DesignElement` from `./designElements.js` (existing type: `{ ref, tag, text, depth, testid, componentId, attributes, childCount }`).
- Produces:
  - `type LayerKind = 'text' | 'frame' | 'image' | 'control' | 'list' | 'node'`
  - `layerKindFor(element: DesignElement): LayerKind`
  - `layerIconFor(element: DesignElement): string`
  - `layerKindLabel(element: DesignElement): string`
  - `layerDisplayName(element: DesignElement): string`
  - `isTextLayer(element: DesignElement): boolean`

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/designLayerMeta.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { DesignElement } from './designElements.js';
import { isTextLayer, layerDisplayName, layerIconFor, layerKindFor, layerKindLabel } from './designLayerMeta.js';

function element(patch: Partial<DesignElement>): DesignElement {
  return { ref: 'div:0', tag: 'div', text: '', depth: 0, testid: null, componentId: null, attributes: {}, childCount: 0, ...patch };
}

test('classifies layers by tag and content', () => {
  assert.equal(layerKindFor(element({ tag: 'h1', text: 'Dashboard' })), 'text');
  assert.equal(layerKindFor(element({ tag: 'p', text: 'Body copy' })), 'text');
  assert.equal(layerKindFor(element({ tag: 'img' })), 'image');
  assert.equal(layerKindFor(element({ tag: 'button', text: 'Continue' })), 'control');
  assert.equal(layerKindFor(element({ tag: 'ul', childCount: 3 })), 'list');
  assert.equal(layerKindFor(element({ tag: 'section', childCount: 4 })), 'frame');
  assert.equal(layerKindFor(element({ tag: 'div', childCount: 2 })), 'frame');
  assert.equal(layerKindFor(element({ tag: 'span' })), 'node');
});

test('a wrapper that only holds other elements is not a text layer', () => {
  // A <div> whose extracted text is just its descendants' text must not offer
  // typography editing — the edit would land on the wrapper, not the words.
  assert.equal(isTextLayer(element({ tag: 'div', text: 'Revenue $12,480', childCount: 3 })), false);
  assert.equal(isTextLayer(element({ tag: 'h1', text: 'Dashboard', childCount: 0 })), true);
  assert.equal(isTextLayer(element({ tag: 'span', text: '+14%', childCount: 0 })), true);
  assert.equal(isTextLayer(element({ tag: 'button', text: 'Continue', childCount: 0 })), true);
  assert.equal(isTextLayer(element({ tag: 'h1', text: '', childCount: 0 })), false);
  assert.equal(isTextLayer(element({ tag: 'img' })), false);
});

test('picks a glyph and a human label per kind', () => {
  assert.equal(layerIconFor(element({ tag: 'h1', text: 'Dashboard' })), 'text');
  assert.equal(layerIconFor(element({ tag: 'img' })), 'image');
  assert.equal(layerIconFor(element({ tag: 'button', text: 'Go' })), 'bolt');
  assert.equal(layerIconFor(element({ tag: 'section', childCount: 2 })), 'frame');
  assert.equal(layerKindLabel(element({ tag: 'h1', text: 'Dashboard' })), 'Text');
  assert.equal(layerKindLabel(element({ tag: 'section', childCount: 2 })), 'Frame');
});

test('names a layer the way the canvas would', () => {
  assert.equal(layerDisplayName(element({ tag: 'h1', text: 'Dashboard', childCount: 0 })), 'Dashboard');
  assert.equal(layerDisplayName(element({ tag: 'section', attributes: { 'aria-label': 'Chart' }, childCount: 3 })), 'Chart');
  assert.equal(layerDisplayName(element({ tag: 'section', componentId: 'hero', childCount: 3 })), 'hero');
  assert.equal(layerDisplayName(element({ tag: 'div', childCount: 4 })), 'div');
  // Long text is trimmed so the inspector header cannot wrap to three lines.
  assert.equal(layerDisplayName(element({ tag: 'p', text: 'x'.repeat(60), childCount: 0 })), `${'x'.repeat(32)}…`);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```
npx tsx --test "src/lib/design/designLayerMeta.test.ts"
```

Expected: FAIL — `Cannot find module './designLayerMeta.js'`.

- [ ] **Step 3: Implement `designLayerMeta.ts`**

Create `brainrouter-desktop/src/lib/design/designLayerMeta.ts`:

```ts
// brainrouter-desktop/src/lib/design/designLayerMeta.ts
// What kind of layer is this, what does it look like in a list, and may the
// inspector show typography for it. `extractDesignElements` gives every element
// the CONCATENATED text of its descendants, so "has text" alone would let a
// wrapper <div> claim to be a text layer — childCount is the tie-breaker.

import type { DesignElement } from './designElements.js';

export type LayerKind = 'text' | 'frame' | 'image' | 'control' | 'list' | 'node';

const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'li', 'td', 'th', 'strong', 'em', 'small', 'figcaption', 'blockquote', 'code', 'legend', 'summary', 'dt', 'dd']);
const FRAME_TAGS = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'form', 'figure', 'fieldset']);
const IMAGE_TAGS = new Set(['img', 'picture', 'video', 'canvas', 'figure-image']);
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
```

- [ ] **Step 4: Run the test and verify it passes**

```
npx tsx --test "src/lib/design/designLayerMeta.test.ts"
```

Expected: PASS, 4 tests, 0 failures.

- [ ] **Step 5: Add the missing glyphs to `icons.tsx`**

The map already has `text`, `frame`, `bolt`, `square`, `chart`, `eye`, `layers`. Add the following entries to the `PATHS` record in `brainrouter-desktop/src/icons.tsx`, immediately before the closing `};` of the record. Every path is drawn on the 16×16 grid, stroke-only:

```tsx
  image: <><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><circle cx="6" cy="6.75" r="1" /><path d="m3.5 11.5 3-3 2.5 2.5 2-1.5 2.5 2" /></>,
  list: <><path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5" /><circle cx="3" cy="4.5" r="0.8" fill="currentColor" stroke="none" /><circle cx="3" cy="8" r="0.8" fill="currentColor" stroke="none" /><circle cx="3" cy="11.5" r="0.8" fill="currentColor" stroke="none" /></>,
  'align-left': <><path d="M2.5 2.5v11" /><rect x="4.5" y="4" width="8" height="3" rx="0.8" /><rect x="4.5" y="9" width="5" height="3" rx="0.8" /></>,
  'align-center-x': <><path d="M8 2.5v11" /><rect x="3" y="4" width="10" height="3" rx="0.8" /><rect x="5" y="9" width="6" height="3" rx="0.8" /></>,
  'align-right': <><path d="M13.5 2.5v11" /><rect x="3.5" y="4" width="8" height="3" rx="0.8" /><rect x="6.5" y="9" width="5" height="3" rx="0.8" /></>,
  'align-top': <><path d="M2.5 2.5h11" /><rect x="4" y="4.5" width="3" height="8" rx="0.8" /><rect x="9" y="4.5" width="3" height="5" rx="0.8" /></>,
  'align-center-y': <><path d="M2.5 8h11" /><rect x="4" y="3" width="3" height="10" rx="0.8" /><rect x="9" y="5" width="3" height="6" rx="0.8" /></>,
  'align-bottom': <><path d="M2.5 13.5h11" /><rect x="4" y="3.5" width="3" height="8" rx="0.8" /><rect x="9" y="6.5" width="3" height="5" rx="0.8" /></>,
  'flip-h': <><path d="M8 2.5v11" /><path d="M6 5 2.5 8 6 11z" /><path d="M10 5 13.5 8 10 11z" /></>,
  'flip-v': <><path d="M2.5 8h11" /><path d="M5 6 8 2.5 11 6z" /><path d="M5 10 8 13.5 11 10z" /></>,
  bold: <><path d="M5 3h4a2.5 2.5 0 0 1 0 5H5zM5 8h4.5a2.5 2.5 0 0 1 0 5H5z" /></>,
  italic: <><path d="M10.5 3h-3M8.5 13h-3M9.5 3 6.5 13" /></>,
  underline: <><path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 13.5h9" /></>,
  strike: <><path d="M4.5 3.5v3a3.5 3.5 0 0 0 7 0M11.5 12.5v-1a3.5 3.5 0 0 0-7 0v1M2.5 8h11" /></>,
  'text-left': <><path d="M2.5 3.5h11M2.5 6.75h7M2.5 10h11M2.5 13.25h7" /></>,
  'text-center': <><path d="M2.5 3.5h11M4.5 6.75h7M2.5 10h11M4.5 13.25h7" /></>,
  'text-right': <><path d="M2.5 3.5h11M6.5 6.75h7M2.5 10h11M6.5 13.25h7" /></>,
  'text-justify': <><path d="M2.5 3.5h11M2.5 6.75h11M2.5 10h11M2.5 13.25h11" /></>,
  'v-top': <><path d="M3 2.5h10" /><path d="M8 5v8M5.5 7.5 8 5l2.5 2.5" /></>,
  'v-center': <><path d="M3 8h10" /><path d="M8 2.5v3M8 10.5v3" /></>,
  'v-bottom': <><path d="M3 13.5h10" /><path d="M8 3v8M5.5 8.5 8 11l2.5-2.5" /></>,
  constraint: <><rect x="4.5" y="4.5" width="7" height="7" rx="1" /><path d="M2 8h2.5M11.5 8H14M8 2v2.5M8 11.5V14" /></>,
  effects: <><circle cx="6.5" cy="6.5" r="4" /><path d="M9.5 9.5a4 4 0 0 1-3 3" opacity="0.5" /><circle cx="9.5" cy="9.5" r="4" opacity="0.5" /></>,
```

- [ ] **Step 6: Typecheck and commit**

```
npm run typecheck
```

Expected: no errors.

```bash
git add brainrouter-desktop/src/lib/design/designLayerMeta.ts brainrouter-desktop/src/lib/design/designLayerMeta.test.ts brainrouter-desktop/src/icons.tsx
git commit -m "feat(design): classify layers and add inspector glyphs"
```

---

### Task 3: Constraints

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designConstraints.ts`
- Create: `brainrouter-desktop/src/lib/design/designConstraints.test.ts`

**Interfaces:**
- Consumes: `CssDeclaration` from `./designProperties.js`.
- Produces:
  - `type HorizontalConstraint = 'left' | 'right' | 'left-right' | 'center' | 'scale'`
  - `type VerticalConstraint = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale'`
  - `HORIZONTAL_CONSTRAINTS: readonly { value: HorizontalConstraint; label: string }[]`
  - `VERTICAL_CONSTRAINTS: readonly { value: VerticalConstraint; label: string }[]`
  - `constraintDeclarations(axis: 'h' | 'v', value: string, box: ConstraintBox): CssDeclaration[]`
  - `type ConstraintBox = { offsetLeft: number; offsetTop: number; offsetRight: number; offsetBottom: number; width: number; height: number }`
  - `constraintsApply(position: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/designConstraints.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { constraintDeclarations, constraintsApply, HORIZONTAL_CONSTRAINTS, VERTICAL_CONSTRAINTS, type ConstraintBox } from './designConstraints.js';

const BOX: ConstraintBox = { offsetLeft: 76, offsetTop: 180, offsetRight: 100, offsetBottom: 220, width: 424, height: 200 };

test('offers the five Figma constraints per axis', () => {
  assert.deepEqual(HORIZONTAL_CONSTRAINTS.map((item) => item.value), ['left', 'right', 'left-right', 'center', 'scale']);
  assert.deepEqual(VERTICAL_CONSTRAINTS.map((item) => item.value), ['top', 'bottom', 'top-bottom', 'center', 'scale']);
});

test('pins to one edge by setting that inset and releasing the other', () => {
  assert.deepEqual(constraintDeclarations('h', 'left', BOX), [['left', '76px'], ['right', 'auto']]);
  assert.deepEqual(constraintDeclarations('h', 'right', BOX), [['left', 'auto'], ['right', '100px']]);
  assert.deepEqual(constraintDeclarations('v', 'top', BOX), [['top', '180px'], ['bottom', 'auto']]);
  assert.deepEqual(constraintDeclarations('v', 'bottom', BOX), [['top', 'auto'], ['bottom', '220px']]);
});

test('stretching pins both edges and releases the fixed size', () => {
  assert.deepEqual(constraintDeclarations('h', 'left-right', BOX), [['left', '76px'], ['right', '100px'], ['width', 'auto']]);
  assert.deepEqual(constraintDeclarations('v', 'top-bottom', BOX), [['top', '180px'], ['bottom', '220px'], ['height', 'auto']]);
});

test('centering uses a 50% inset with a half-size pull-back', () => {
  assert.deepEqual(constraintDeclarations('h', 'center', BOX), [['left', '50%'], ['right', 'auto'], ['margin-left', '-212px']]);
  assert.deepEqual(constraintDeclarations('v', 'center', BOX), [['top', '50%'], ['bottom', 'auto'], ['margin-top', '-100px']]);
});

test('scaling expresses the inset and the size as percentages of the parent', () => {
  // Parent width = 76 + 424 + 100 = 600. Left = 12.6667%, width = 70.6667%.
  const [left, right, width] = constraintDeclarations('h', 'scale', BOX);
  assert.deepEqual(left, ['left', '12.6667%']);
  assert.deepEqual(right, ['right', 'auto']);
  assert.deepEqual(width, ['width', '70.6667%']);
});

test('a zero-sized parent cannot be scaled against, so nothing is emitted', () => {
  const empty: ConstraintBox = { offsetLeft: 0, offsetTop: 0, offsetRight: 0, offsetBottom: 0, width: 0, height: 0 };
  assert.deepEqual(constraintDeclarations('h', 'scale', empty), []);
  assert.deepEqual(constraintDeclarations('h', 'nonsense', BOX), []);
});

test('constraints only bind an out-of-flow element', () => {
  assert.equal(constraintsApply('absolute'), true);
  assert.equal(constraintsApply('fixed'), true);
  assert.equal(constraintsApply('static'), false);
  assert.equal(constraintsApply('relative'), false);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```
npx tsx --test "src/lib/design/designConstraints.test.ts"
```

Expected: FAIL — `Cannot find module './designConstraints.js'`.

- [ ] **Step 3: Implement `designConstraints.ts`**

Create `brainrouter-desktop/src/lib/design/designConstraints.ts`:

```ts
// brainrouter-desktop/src/lib/design/designConstraints.ts
// Figma constraints describe how a layer reacts when its parent resizes. The DOM
// equivalent is which insets are pinned and which are released: pin one edge and
// the layer rides it, pin both and it stretches, use percentages and it scales.
// Only an out-of-flow element (absolute/fixed) obeys insets, so the inspector
// shows the picker as advisory for anything still in normal flow.

import type { CssDeclaration } from './designProperties.js';

export type HorizontalConstraint = 'left' | 'right' | 'left-right' | 'center' | 'scale';
export type VerticalConstraint = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';

export const HORIZONTAL_CONSTRAINTS: readonly { value: HorizontalConstraint; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'left-right', label: 'Left and right' },
  { value: 'center', label: 'Center' },
  { value: 'scale', label: 'Scale' },
];

export const VERTICAL_CONSTRAINTS: readonly { value: VerticalConstraint; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'top-bottom', label: 'Top and bottom' },
  { value: 'center', label: 'Center' },
  { value: 'scale', label: 'Scale' },
];

/** The layer's measured insets and size within its offset parent, in px. */
export type ConstraintBox = { offsetLeft: number; offsetTop: number; offsetRight: number; offsetBottom: number; width: number; height: number };

export function constraintsApply(position: string): boolean {
  return position === 'absolute' || position === 'fixed';
}

/** Trims float noise without dropping sub-pixel precision that matters at 4dp. */
function percent(part: number, whole: number): string {
  return `${Number((part / whole * 100).toFixed(4))}%`;
}

export function constraintDeclarations(axis: 'h' | 'v', value: string, box: ConstraintBox): CssDeclaration[] {
  const startProperty = axis === 'h' ? 'left' : 'top';
  const endProperty = axis === 'h' ? 'right' : 'bottom';
  const sizeProperty = axis === 'h' ? 'width' : 'height';
  const marginProperty = axis === 'h' ? 'margin-left' : 'margin-top';
  const start = axis === 'h' ? box.offsetLeft : box.offsetTop;
  const end = axis === 'h' ? box.offsetRight : box.offsetBottom;
  const size = axis === 'h' ? box.width : box.height;
  const parent = start + size + end;

  const startKeyword = axis === 'h' ? 'left' : 'top';
  const endKeyword = axis === 'h' ? 'right' : 'bottom';
  const stretchKeyword = axis === 'h' ? 'left-right' : 'top-bottom';

  if (value === startKeyword) return [[startProperty, `${start}px`], [endProperty, 'auto']];
  if (value === endKeyword) return [[startProperty, 'auto'], [endProperty, `${end}px`]];
  if (value === stretchKeyword) return [[startProperty, `${start}px`], [endProperty, `${end}px`], [sizeProperty, 'auto']];
  if (value === 'center') return [[startProperty, '50%'], [endProperty, 'auto'], [marginProperty, `${-Math.round(size / 2)}px`]];
  if (value === 'scale') {
    if (parent <= 0) return [];
    return [[startProperty, percent(start, parent)], [endProperty, 'auto'], [sizeProperty, percent(size, parent)]];
  }
  return [];
}
```

- [ ] **Step 4: Run the test and verify it passes**

```
npx tsx --test "src/lib/design/designConstraints.test.ts"
```

Expected: PASS, 7 tests, 0 failures.

- [ ] **Step 5: Commit**

> Do **not** run `npm run typecheck` at this point. `designConstraints.ts` imports the `CssDeclaration` *type* from `designProperties.js`, which Task 1 creates — `tsx` erases type-only imports so the unit tests pass, but `tsc` would report TS2307 until Task 1 Step 3 lands. The first green typecheck is Task 2 Step 6.

```bash
git add brainrouter-desktop/src/lib/design/designConstraints.ts brainrouter-desktop/src/lib/design/designConstraints.test.ts
git commit -m "feat(design): map Figma constraints onto DOM insets"
```

---

### Task 4: Reading real values back from the preview

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designMeasure.ts`
- Create: `brainrouter-desktop/src/lib/design/designMeasure.test.ts`

**Interfaces:**
- Consumes: `REF_RESOLVER_JS` and `DraftProperty` from `./designProperties.js`; `ConstraintBox` from `./designConstraints.js`.
- Produces:
  - `type MeasuredElement = { ref: string; box: ConstraintBox & { x: number; y: number }; position: string; parentDisplay: string; styles: Record<string, string> }`
  - `MEASURED_CSS_PROPERTIES: readonly string[]`
  - `buildMeasureScript(ref: string): string`
  - `parseMeasurement(raw: unknown): MeasuredElement | null`
  - `measuredValueFor(measured: MeasuredElement | null, property: DraftProperty): string`

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/designMeasure.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasureScript, measuredValueFor, parseMeasurement, transformsApply, verticalAlignApplies, type MeasuredElement } from './designMeasure.js';

const RAW = {
  ref: 'section:2',
  box: { x: 76, y: 180, width: 424.4, height: 200, offsetLeft: 76, offsetTop: 180, offsetRight: 100, offsetBottom: 220 },
  position: 'absolute',
  parentDisplay: 'block',
  contentHeight: 120,
  styles: {
    'font-size': '16px', 'font-weight': '600', 'line-height': '19.2px', 'letter-spacing': 'normal',
    'color': 'rgb(236, 239, 242)', 'background-color': 'rgba(0, 0, 0, 0)', 'opacity': '1',
    'border-radius': '10px', 'text-align': 'start', 'text-transform': 'none', 'font-style': 'normal',
    'border-top-width': '1px', 'border-top-color': 'rgb(230, 230, 235)',
    'display': 'block', 'align-content': 'normal',
  },
};

function withStyles(patch: Record<string, string>, contentHeight = 120): MeasuredElement {
  const measured = parseMeasurement({ ...RAW, contentHeight }) as MeasuredElement;
  return { ...measured, styles: { ...measured.styles, ...patch } };
}

test('embeds the ref as JSON and reuses the shared resolver', () => {
  const script = buildMeasureScript('button[data-testid="continue"]');
  assert.match(script, /__brResolve/);
  assert.ok(script.includes(JSON.stringify('button[data-testid="continue"]')));
  assert.match(script, /getBoundingClientRect/);
  assert.match(script, /getComputedStyle/);
});

test('parses a measurement and rounds the box to whole pixels', () => {
  const measured = parseMeasurement(RAW);
  assert.equal(measured?.ref, 'section:2');
  assert.equal(measured?.box.width, 424);
  assert.equal(measured?.box.x, 76);
  assert.equal(measured?.position, 'absolute');
  assert.equal(measured?.contentHeight, 120);
  assert.equal(measured?.styles['font-size'], '16px');
});

test('refuses anything that is not a measurement', () => {
  assert.equal(parseMeasurement(null), null);
  assert.equal(parseMeasurement('nope'), null);
  assert.equal(parseMeasurement({ ref: 'a' }), null);
  assert.equal(parseMeasurement({ ...RAW, box: null }), null);
  assert.equal(parseMeasurement({ ...RAW, styles: 'no' }), null);
});

test('turns computed CSS into the value an inspector field should show', () => {
  const measured = parseMeasurement(RAW) as MeasuredElement;
  assert.equal(measuredValueFor(measured, 'fontSize'), '16');
  assert.equal(measuredValueFor(measured, 'lineHeight'), '19.2');
  assert.equal(measuredValueFor(measured, 'fontWeight'), '600');
  assert.equal(measuredValueFor(measured, 'borderRadius'), '10');
  assert.equal(measuredValueFor(measured, 'opacity'), '100');
  assert.equal(measuredValueFor(measured, 'width'), '424');
  assert.equal(measuredValueFor(measured, 'height'), '200');
  assert.equal(measuredValueFor(measured, 'strokeWidth'), '1');
  // `normal` letter-spacing is 0 to a designer, and `start` alignment is left.
  assert.equal(measuredValueFor(measured, 'letterSpacing'), '0');
  assert.equal(measuredValueFor(measured, 'textAlign'), 'left');
  // Colours come back as rgb(); the swatch needs hex.
  assert.equal(measuredValueFor(measured, 'color'), '#ECEFF2');
  assert.equal(measuredValueFor(measured, 'backgroundColor'), 'transparent');
  assert.equal(measuredValueFor(measured, 'strokeColor'), '#E6E6EB');
  // CSS cannot report which edge a layer is pinned to, so the pickers default
  // to the leading edge rather than showing an empty select.
  assert.equal(measuredValueFor(measured, 'constraintH'), 'left');
  assert.equal(measuredValueFor(measured, 'constraintV'), 'top');
});

test('an unmeasured element yields empty strings rather than throwing', () => {
  assert.equal(measuredValueFor(null, 'fontSize'), '');
  assert.equal(measuredValueFor(null, 'textAlign'), '');
});

test('reports no vertical alignment rather than pretending it is top-aligned', () => {
  // Computed `normal` means nothing is applied; showing 'start' would pre-select
  // "top" and make an unaligned layer look aligned.
  assert.equal(measuredValueFor(withStyles({}), 'verticalAlign'), '');
  assert.equal(measuredValueFor(withStyles({ 'align-content': 'center' }), 'verticalAlign'), 'center');
});

test('gates the controls that would otherwise latch on a no-op', () => {
  // align-content can only move content that has block-axis free space.
  assert.equal(verticalAlignApplies(withStyles({}, 120)), true);   // 200px box, 120px content
  assert.equal(verticalAlignApplies(withStyles({}, 200)), false);  // auto-height: box == content
  assert.equal(verticalAlignApplies(withStyles({ display: 'inline' }, 120)), false);
  assert.equal(verticalAlignApplies(null), false);
  // Individual transform properties do nothing on a non-replaced inline box.
  assert.equal(transformsApply(withStyles({ display: 'block' })), true);
  assert.equal(transformsApply(withStyles({ display: 'inline-block' })), true);
  assert.equal(transformsApply(withStyles({ display: 'inline' })), false);
  assert.equal(transformsApply(null), false);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```
npx tsx --test "src/lib/design/designMeasure.test.ts"
```

Expected: FAIL — `Cannot find module './designMeasure.js'`.

- [ ] **Step 3: Implement `designMeasure.ts`**

Create `brainrouter-desktop/src/lib/design/designMeasure.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and verify it passes**

```
npx tsx --test "src/lib/design/designMeasure.test.ts"
```

Expected: PASS, 7 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/lib/design/designMeasure.ts brainrouter-desktop/src/lib/design/designMeasure.test.ts
git commit -m "feat(design): measure the selected element's real box and computed styles"
```

---

### Task 5: Wire measurement into the preview surface

**Files:**
- Modify: `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx`
- Modify: `brainrouter-desktop/vite.config.ts`

**Interfaces:**
- Consumes: `buildApplyScript` from `../../lib/design/designProperties.js`; `buildMeasureScript`, `parseMeasurement`, `MeasuredElement` from `../../lib/design/designMeasure.js`.
- Produces: `PreviewHandle` gains `measure: (ref: string) => Promise<MeasuredElement | null>`.

- [ ] **Step 1: Replace the hand-rolled apply snippet with the tested builder**

In `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx`, add to the imports at the top:

```tsx
import { buildApplyScript } from '../../lib/design/designProperties.js';
import { buildMeasureScript, parseMeasurement, type MeasuredElement } from '../../lib/design/designMeasure.js';
```

Then replace the whole `applyDraft` implementation (currently lines 120–129) with:

```tsx
    applyDraft: async (operations, target, boxes) => {
      const wv = target ?? wvRef.current;
      const code = buildApplyScript(operations, boxes);
      if (!code) return;
      if (wv && webviewStateRef.current.ready) { await wv.executeJavaScript(code, true); return; }
      // Browser fallback: the guest is cross-origin, so the injected dev script
      // evaluates the snippet for us.
      const frame = iframeRef.current;
      try { frame?.contentWindow?.postMessage({ __brpEval: code }, '*'); } catch { /* guest not ready */ }
    },
```

- [ ] **Step 2: Widen `applyDraft` and add `measure` to the handle type**

In the same file, replace the `applyDraft` line in the `PreviewHandle` interface (currently line 22):

```tsx
  applyDraft: (operations: readonly DraftOperation[], target?: WebviewEl) => Promise<void>;
```

with:

```tsx
  /** `boxes` supplies measured geometry keyed by element ref — only the
   *  constraint properties need it, and only for refs it contains. */
  applyDraft: (operations: readonly DraftOperation[], target?: WebviewEl, boxes?: Record<string, ConstraintBox>) => Promise<void>;
  /** Reads the element's real box and computed styles out of the preview, so the
   *  inspector shows what IS rather than what a draft claims. Resolves null when
   *  the surface is not ready or the ref no longer matches anything. */
  measure: (ref: string) => Promise<MeasuredElement | null>;
```

and add `ConstraintBox` to the imports:

```tsx
import type { ConstraintBox } from '../../lib/design/designConstraints.js';
```

- [ ] **Step 3: Implement `measure` on both surfaces**

In the same file, add this to the `useImperativeHandle` object, immediately after the `applyDraft` entry:

```tsx
    measure: async (ref) => {
      const code = buildMeasureScript(ref);
      const wv = wvRef.current;
      if (wv && webviewStateRef.current.ready) {
        try { return parseMeasurement(await wv.executeJavaScript(code, false)); } catch { return null; }
      }
      const frame = iframeRef.current;
      if (!frame?.contentWindow) return null;
      // Opaque-origin iframe — postMessage is the only channel, and replies cannot
      // be matched by origin, so the request carries an id the guest echoes back.
      const id = `m${measureIdRef.current++}`;
      return new Promise<MeasuredElement | null>((resolve) => {
        const timer = window.setTimeout(() => { window.removeEventListener('message', onMsg); resolve(null); }, 1200);
        const onMsg = (event: MessageEvent): void => {
          const data = (event.data ?? {}) as { __brpMeasured?: { id?: string; value?: unknown } };
          if (!data.__brpMeasured || data.__brpMeasured.id !== id) return;
          window.clearTimeout(timer);
          window.removeEventListener('message', onMsg);
          resolve(parseMeasurement(data.__brpMeasured.value));
        };
        window.addEventListener('message', onMsg);
        try { frame.contentWindow?.postMessage({ __brpMeasure: { id, code } }, '*'); }
        catch { window.clearTimeout(timer); window.removeEventListener('message', onMsg); resolve(null); }
      });
    },
```

And add the id counter next to the other refs (after `lastSrcRef`, currently line 45):

```tsx
  const measureIdRef = useRef(0);
```

- [ ] **Step 4: Teach the dev picker to measure and to evaluate**

In `brainrouter-desktop/vite.config.ts`, inside the `PICKER` script, replace the single message listener (currently line 38):

```js
window.addEventListener('message',function(e){var d=e.data||{};if(d.__brpPick==='on')enable();else if(d.__brpPick==='off')off();});
```

with:

```js
function run(code){try{return (0,eval)(code);}catch(err){return null;}}
window.addEventListener('message',function(e){var d=e.data||{};if(d.__brpPick==='on')enable();else if(d.__brpPick==='off')off();else if(d.__brpMeasure)parent.postMessage({__brpMeasured:{id:d.__brpMeasure.id,value:run(d.__brpMeasure.code)}},'*');else if(d.__brpEval)run(d.__brpEval);});
```

> This is `apply: 'serve'` only — the plugin never runs in a packaged build, and the evaluated code is always a snippet this app built from a sanitized property model, never guest content.

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Re-run the whole design test folder to prove nothing regressed**

```
npx tsx --test "src/lib/design/*.test.ts"
```

Expected: PASS, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add brainrouter-desktop/src/panels/design/PreviewCanvas.tsx brainrouter-desktop/vite.config.ts
git commit -m "feat(design): read measurements back from the preview surface"
```

---

### Task 6: Shared inspector controls

**Files:**
- Create: `brainrouter-desktop/src/panels/design/inspector/InspectorControls.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- Consumes: `Icon` from `../../../icons.js`.
- Produces (all named exports from `InspectorControls.tsx`):
  - `Section({ title, icon, action, defaultOpen, children })`
  - `Row({ children })` — a 2-up field grid
  - `Field({ label, value, onChange, prefix, suffix, type, options, placeholder, title })`
  - `SegmentedIcons({ label, value, onChange, options })` where `options: { value: string; icon: string; title: string }[]`
  - `ToggleRow({ label, checked, onChange })`
  - `Swatch({ label, value, alpha, onChange, onAlphaChange })`

- [ ] **Step 1: Implement the controls**

Create `brainrouter-desktop/src/panels/design/inspector/InspectorControls.tsx`:

```tsx
// brainrouter-desktop/src/panels/design/inspector/InspectorControls.tsx
// The inspector's vocabulary. Every control is label-first and keyboard
// reachable; the panel is only ~286px wide, so labels sit above their field and
// icon rows carry a title + aria-label instead of visible text.
import React, { useState } from 'react';
import { Icon } from '../../../icons.js';

export function Section({ title, icon, action, defaultOpen = true, children }: { title: string; icon?: string; action?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="ds-inspector-section">
    <div className="ds-inspector-sectionhead">
      <button type="button" className="ds-section-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name={open ? 'chev-down' : 'chev-right'} size={11} />
        {icon ? <Icon name={icon} size={11} /> : null}
        <h3>{title}</h3>
      </button>
      {action}
    </div>
    {open ? <div className="ds-section-body">{children}</div> : null}
  </section>;
}

export function Row({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="ds-inspector-grid">{children}</div>;
}

export function Field({ label, value, onChange, prefix, suffix, type = 'text', options, placeholder, title, disabled }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; type?: 'text' | 'number'; options?: readonly { value: string; label: string }[]; placeholder?: string; title?: string; disabled?: boolean }): React.ReactElement {
  return <label className={`ds-field${disabled ? ' is-disabled' : ''}`} title={title ?? label}>
    <span className="ds-field-label">{label}</span>
    {options
      ? <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <span className="ds-field-input">{prefix ? <i className="ds-field-affix" aria-hidden>{prefix}</i> : null}<input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />{suffix ? <i className="ds-field-affix ds-field-affix--end" aria-hidden>{suffix}</i> : null}</span>}
  </label>;
}

/** `disabled` is used where the underlying CSS provably cannot take effect (an
 *  inline box, an auto-height box) — a latching control that moves nothing is
 *  worse than one that says why it is unavailable. */
export function SegmentedIcons({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: readonly { value: string; icon: string; title: string }[]; disabled?: boolean }): React.ReactElement {
  return <div className={`ds-segrow${disabled ? ' is-disabled' : ''}`} role="group" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" className={`ds-segbtn${value === option.value ? ' is-active' : ''}`} aria-pressed={value === option.value} disabled={disabled} title={option.title} aria-label={option.title} onClick={() => onChange(option.value)}><Icon name={option.icon} size={12} /></button>)}
  </div>;
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }): React.ReactElement {
  return <label className="ds-togglerow"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i className="ds-switch" aria-hidden /></label>;
}

export function Swatch({ label, value, alpha, onChange, onAlphaChange }: { label: string; value: string; alpha: string; onChange: (value: string) => void; onAlphaChange: (value: string) => void }): React.ReactElement {
  return <div className="ds-swatchrow">
    <span className="ds-swatch-chip" style={{ background: value || 'transparent' }} aria-hidden />
    <label className="ds-swatch-hex"><span className="ds-sr-only">{`${label} colour`}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <label className="ds-swatch-alpha"><span className="ds-sr-only">{`${label} opacity`}</span><input type="number" min="0" max="100" value={alpha} onChange={(event) => onAlphaChange(event.target.value)} /></label>
    <i className="ds-field-affix" aria-hidden>%</i>
  </div>;
}
```

- [ ] **Step 2: Add the CSS for the new controls**

Append to `brainrouter-desktop/src/panels/design/designStudio.css`, **before** the two `@media` rules at lines 359–360 (they must stay last so they override):

```css
.design-studio .ds-inspector-sectionhead { display:flex; align-items:center; justify-content:space-between; gap:6px; }
.design-studio .ds-section-toggle { display:flex; align-items:center; gap:5px; flex:1; min-width:0; padding:2px 0; border:0; background:transparent; color:var(--ds-text-2); cursor:pointer; text-align:left; }
.design-studio .ds-section-toggle h3 { margin:0; color:var(--ds-text-2); font-size:11px; font-weight:600; letter-spacing:0.01em; }
.design-studio .ds-section-toggle:focus-visible { outline:2px solid var(--ds-accent); outline-offset:2px; border-radius:var(--ds-radius-chip); }
.design-studio .ds-section-body { display:flex; flex-direction:column; gap:7px; }
.design-studio .ds-field { display:flex; flex-direction:column; gap:4px; min-width:0; color:var(--ds-text-3); font-size:10px; }
.design-studio .ds-field-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.design-studio .ds-field-input { position:relative; display:flex; align-items:center; }
.design-studio .ds-field-input input { width:100%; min-width:0; box-sizing:border-box; padding:7px 22px 7px 22px; border:1px solid var(--ds-border-strong); border-radius:var(--ds-radius-control); color:var(--ds-text); background:var(--ds-bg); font:11px var(--ds-mono); }
.design-studio .ds-field-input input:only-child { padding:7px 9px; }
.design-studio .ds-field select { width:100%; min-width:0; box-sizing:border-box; padding:7px 9px; border:1px solid var(--ds-border-strong); border-radius:var(--ds-radius-control); color:var(--ds-text); background:var(--ds-bg); font:11px var(--ds-font); }
.design-studio .ds-field-affix { position:absolute; left:8px; color:var(--ds-text-3); font:10px var(--ds-mono); font-style:normal; pointer-events:none; }
.design-studio .ds-field-affix--end { left:auto; right:8px; }
.design-studio .ds-field input:focus, .design-studio .ds-field select:focus { outline:2px solid var(--ds-accent); outline-offset:1px; }
.design-studio .ds-segrow { display:flex; gap:2px; padding:2px; border:1px solid var(--ds-border); border-radius:var(--ds-radius-control); background:var(--ds-bg); }
.design-studio .ds-segbtn { display:flex; align-items:center; justify-content:center; flex:1; min-width:0; padding:6px 0; border:0; border-radius:var(--ds-radius-chip); color:var(--ds-text-3); background:transparent; cursor:pointer; }
.design-studio .ds-segbtn:hover { color:var(--ds-text-2); background:var(--ds-overlay); }
.design-studio .ds-segbtn.is-active { color:var(--ds-text); background:var(--ds-overlay); }
.design-studio .ds-segbtn:focus-visible { outline:2px solid var(--ds-accent); outline-offset:-1px; }
.design-studio .ds-togglerow { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--ds-text-2); font-size:11px; }
.design-studio .ds-togglerow input { position:absolute; width:1px; height:1px; opacity:0; }
.design-studio .ds-switch { position:relative; flex:none; width:26px; height:15px; border-radius:999px; background:var(--ds-border-strong); transition:background 120ms ease; }
.design-studio .ds-switch::after { content:''; position:absolute; top:2px; left:2px; width:11px; height:11px; border-radius:50%; background:var(--ds-text); transition:transform 120ms ease; }
.design-studio .ds-togglerow input:checked + .ds-switch { background:var(--ds-accent); }
.design-studio .ds-togglerow input:checked + .ds-switch::after { transform:translateX(11px); }
.design-studio .ds-togglerow input:focus-visible + .ds-switch { outline:2px solid var(--ds-accent); outline-offset:2px; }
.design-studio .ds-swatchrow { display:flex; align-items:center; gap:6px; padding:5px 7px; border:1px solid var(--ds-border-strong); border-radius:var(--ds-radius-control); background:var(--ds-bg); }
.design-studio .ds-swatch-chip { flex:none; width:14px; height:14px; border:1px solid var(--ds-border-strong); border-radius:3px; }
.design-studio .ds-swatchrow input { min-width:0; border:0; background:transparent; color:var(--ds-text); font:11px var(--ds-mono); }
.design-studio .ds-swatch-hex { flex:1; min-width:0; display:flex; }
.design-studio .ds-swatch-hex input { width:100%; }
.design-studio .ds-swatch-alpha { flex:none; width:34px; display:flex; }
.design-studio .ds-swatch-alpha input { width:100%; text-align:right; }
.design-studio .ds-swatchrow .ds-field-affix { position:static; }
.design-studio .ds-swatchrow input:focus { outline:2px solid var(--ds-accent); outline-offset:1px; border-radius:3px; }
.design-studio .ds-sr-only { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.design-studio .ds-field.is-disabled, .design-studio .ds-segrow.is-disabled { opacity:0.45; }
.design-studio .ds-field.is-disabled input, .design-studio .ds-field.is-disabled select, .design-studio .ds-segrow.is-disabled .ds-segbtn { cursor:not-allowed; }
.design-studio .ds-field-hint { margin:0; color:var(--ds-text-3); font-size:10px; line-height:1.45; }
.design-studio .ds-linkbtn { padding:0; border:0; background:transparent; color:var(--ds-accent); font:inherit; text-decoration:underline; cursor:pointer; }
.design-studio .ds-linkbtn:focus-visible { outline:2px solid var(--ds-accent); outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { .design-studio .ds-switch, .design-studio .ds-switch::after { transition:none; } }
```

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```

Expected: no errors. (`InspectorControls.tsx` is not imported yet — the file must still compile on its own.)

- [ ] **Step 4: Commit**

```bash
git add brainrouter-desktop/src/panels/design/inspector/InspectorControls.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(design): add the inspector control vocabulary"
```

---

### Task 7: The Design properties panel

**Files:**
- Create: `brainrouter-desktop/src/panels/design/inspector/DesignPropertiesPanel.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- Consumes: `Section`, `Row`, `Field`, `SegmentedIcons`, `ToggleRow`, `Swatch` from `./InspectorControls.js`; `MeasuredElement` from `../../../lib/design/designMeasure.js`; `HORIZONTAL_CONSTRAINTS`, `VERTICAL_CONSTRAINTS`, `constraintsApply` from `../../../lib/design/designConstraints.js`; `DesignElement`, `DraftProperty` from `../../../lib/design/designElements.js`.
- Produces:
  - `type InspectorEdit = (property: DraftProperty, value: string | number | boolean) => void`
  - `type InspectorRead = (property: DraftProperty) => string`
  - `DesignPropertiesPanel({ element, measured, read, edit, typography })` — `typography` is a slot rendered **between Appearance and Fill**, matching the reference screenshots' order (Position → Layout → Appearance → Typography → Fill → Effects). Task 8 fills it.

- [ ] **Step 1: Implement the panel**

Create `brainrouter-desktop/src/panels/design/inspector/DesignPropertiesPanel.tsx`:

```tsx
// brainrouter-desktop/src/panels/design/inspector/DesignPropertiesPanel.tsx
// Position → Constraints → Layout → Appearance → [Typography] → Fill → Stroke →
// Effects. Every field reads through `read`, which prefers a draft operation and
// falls back to the measured computed style, so the panel always shows a real
// value rather than an invented placeholder.
import React from 'react';
import { Field, Row, SegmentedIcons, Section, Swatch, ToggleRow } from './InspectorControls.js';
import { constraintsApply, HORIZONTAL_CONSTRAINTS, VERTICAL_CONSTRAINTS } from '../../../lib/design/designConstraints.js';
import { transformsApply, type MeasuredElement } from '../../../lib/design/designMeasure.js';
import type { DesignElement, DraftProperty } from '../../../lib/design/designElements.js';

export type InspectorEdit = (property: DraftProperty, value: string | number | boolean) => void;
export type InspectorRead = (property: DraftProperty) => string;

const ALIGN_X = [
  { value: 'start', icon: 'align-left', title: 'Align left' },
  { value: 'center', icon: 'align-center-x', title: 'Align horizontal centers' },
  { value: 'end', icon: 'align-right', title: 'Align right' },
] as const;

const ALIGN_Y = [
  { value: 'start', icon: 'align-top', title: 'Align top' },
  { value: 'center', icon: 'align-center-y', title: 'Align vertical centers' },
  { value: 'end', icon: 'align-bottom', title: 'Align bottom' },
] as const;

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'] as const;

const SIZING_HINT = 'Accepts a number (px), a percentage, auto, fill or hug.';

export function DesignPropertiesPanel({ element, measured, read, edit, typography }: { element: DesignElement; measured: MeasuredElement | null; read: InspectorRead; edit: InspectorEdit; typography?: React.ReactNode }): React.ReactElement {
  const constraintsBind = constraintsApply(measured?.position ?? 'static');
  // translate/scale/rotate are no-ops on a non-replaced inline box, so the
  // offset and flip controls are disabled there instead of latching on nothing.
  const canTransform = transformsApply(measured);
  const box = measured?.box ?? null;
  return <>
    <Section title="Position" icon="cursor" action={box ? <small className="ds-measure-readout" data-mono>{`${box.x}, ${box.y}`}</small> : null}>
      <SegmentedIcons label="Horizontal alignment" value={read('justifySelf')} onChange={(value) => edit('justifySelf', value)} options={ALIGN_X} />
      <SegmentedIcons label="Vertical alignment" value={read('alignSelf')} onChange={(value) => edit('alignSelf', value)} options={ALIGN_Y} />
      <Row>
        <Field label="X" type="number" prefix="X" disabled={!canTransform} value={read('translateX')} onChange={(value) => edit('translateX', Number(value) || 0)} title="Horizontal offset from the layer's laid-out position" />
        <Field label="Y" type="number" prefix="Y" disabled={!canTransform} value={read('translateY')} onChange={(value) => edit('translateY', Number(value) || 0)} title="Vertical offset from the layer's laid-out position" />
      </Row>
      <Row>
        <Field label="Rotation" type="number" suffix="°" disabled={!canTransform} value={read('rotation')} onChange={(value) => edit('rotation', Number(value) || 0)} />
        <div className="ds-field">
          <span className="ds-field-label">Flip</span>
          <SegmentedIcons label="Flip" value="" disabled={!canTransform} onChange={(value) => edit(value === 'h' ? 'flipH' : 'flipV', true)} options={[{ value: 'h', icon: 'flip-h', title: 'Flip horizontally' }, { value: 'v', icon: 'flip-v', title: 'Flip vertically' }]} />
        </div>
      </Row>
      {measured && !canTransform ? <p className="ds-field-hint">This layer is an inline box, so offset, rotation and flip have no effect. Set W or H to give it a box first.</p> : null}
    </Section>

    <Section title="Constraints" icon="constraint">
      {!constraintsBind ? <p className="ds-inspector-note">This layer is in normal flow (<code>position: {measured?.position ?? 'static'}</code>), so constraints are advisory until it is positioned.</p> : null}
      <Row>
        <Field label="Horizontal constraint" value={read('constraintH')} onChange={(value) => edit('constraintH', value)} options={HORIZONTAL_CONSTRAINTS.map((item) => ({ value: item.value, label: item.label }))} />
        <Field label="Vertical constraint" value={read('constraintV')} onChange={(value) => edit('constraintV', value)} options={VERTICAL_CONSTRAINTS.map((item) => ({ value: item.value, label: item.label }))} />
      </Row>
    </Section>

    <Section title="Layout" icon="layout">
      <Row>
        <Field label="W" prefix="W" value={read('width')} onChange={(value) => edit('width', value)} title={SIZING_HINT} />
        <Field label="H" prefix="H" value={read('height')} onChange={(value) => edit('height', value)} title={SIZING_HINT} />
      </Row>
      <Row>
        <Field label="Padding" type="number" value={read('padding')} onChange={(value) => edit('padding', Number(value) || 0)} />
        <Field label="Radius" type="number" value={read('borderRadius')} onChange={(value) => edit('borderRadius', Number(value) || 0)} />
      </Row>
    </Section>

    <Section title="Appearance" icon="eye">
      <Row>
        <Field label="Blend mode" value={read('blendMode')} onChange={(value) => edit('blendMode', value)} options={BLEND_MODES.map((mode) => ({ value: mode, label: mode === 'normal' ? 'Pass through' : mode }))} />
        <Field label="Opacity" type="number" suffix="%" value={read('opacity')} onChange={(value) => edit('opacity', Number(value) || 0)} />
      </Row>
      <ToggleRow label="Visible" checked={read('visibility') !== 'false'} onChange={(checked) => edit('visibility', checked)} />
    </Section>

    {typography}

    <Section title="Fill" icon="palette">
      <Swatch label="Fill" value={read('backgroundColor')} alpha={read('fillOpacity')} onChange={(value) => edit('backgroundColor', value)} onAlphaChange={(value) => edit('fillOpacity', Number(value) || 0)} />
      <Swatch label="Text" value={read('color')} alpha={read('textOpacity')} onChange={(value) => edit('color', value)} onAlphaChange={(value) => edit('textOpacity', Number(value) || 0)} />
    </Section>

    <Section title="Stroke" icon="square">
      <Swatch label="Stroke" value={read('strokeColor')} alpha="100" onChange={(value) => edit('strokeColor', value)} onAlphaChange={() => { /* stroke alpha rides the colour value */ }} />
      <Row>
        <Field label="Align" value={read('strokeAlign')} onChange={(value) => edit('strokeAlign', value)} options={[{ value: 'inside', label: 'Inside' }, { value: 'outside', label: 'Outside' }]} />
        <Field label="W" type="number" prefix="W" value={read('strokeWidth')} onChange={(value) => edit('strokeWidth', Number(value) || 0)} />
      </Row>
    </Section>

    <Section title="Effects" icon="effects" defaultOpen={false}>
      <Row>
        <Field label="Shadow" value={read('shadowKind')} onChange={(value) => edit('shadowKind', value)} options={[{ value: 'drop', label: 'Drop shadow' }, { value: 'inner', label: 'Inner shadow' }]} />
        <Field label="Colour" value={read('shadowColor')} onChange={(value) => edit('shadowColor', value)} />
      </Row>
      <Row>
        <Field label="X" type="number" prefix="X" value={read('shadowX')} onChange={(value) => edit('shadowX', Number(value) || 0)} />
        <Field label="Y" type="number" prefix="Y" value={read('shadowY')} onChange={(value) => edit('shadowY', Number(value) || 0)} />
      </Row>
      <Row>
        <Field label="Blur" type="number" value={read('shadowBlur')} onChange={(value) => edit('shadowBlur', Number(value) || 0)} />
        <Field label="Spread" type="number" value={read('shadowSpread')} onChange={(value) => edit('shadowSpread', Number(value) || 0)} />
      </Row>
      <Row>
        <Field label="Layer blur" type="number" value={read('blur')} onChange={(value) => edit('blur', Number(value) || 0)} />
        <Field label="Backdrop blur" type="number" value={read('backdropBlur')} onChange={(value) => edit('backdropBlur', Number(value) || 0)} />
      </Row>
    </Section>

    <p className="ds-inspector-note" data-mono>{element.testid ? `[data-testid="${element.testid}"]` : element.ref}</p>
  </>;
}
```

- [ ] **Step 2: Add the note, readout and layer-head styles**

Append to `brainrouter-desktop/src/panels/design/designStudio.css`, again **before** the trailing `@media` rules:

```css
.design-studio .ds-inspector-note { margin:0; color:var(--ds-text-3); font-size:10px; line-height:1.5; overflow-wrap:anywhere; }
.design-studio .ds-inspector-note code { color:var(--ds-text-2); font:10px var(--ds-mono); }
.design-studio .ds-measure-readout { flex:none; color:var(--ds-text-3); font-size:10px; }
.design-studio .ds-layer-head { display:flex; align-items:center; gap:6px; padding-bottom:10px; border-bottom:1px solid var(--ds-border); color:var(--ds-text-2); }
.design-studio .ds-layer-head strong { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ds-text); font-size:13px; font-weight:600; }
.design-studio .ds-layer-head small { flex:none; color:var(--ds-text-3); font-size:10px; }
.design-studio .ds-layer-dirty { flex:none; padding:2px 6px; border-radius:var(--ds-radius-chip); color:var(--ds-accent); background:var(--ds-accent-wash); font-size:9px; text-transform:uppercase; letter-spacing:0.04em; }
```

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```

Expected: no errors. `DesignPropertiesPanel.tsx` has no importers yet, so it must compile standalone.

- [ ] **Step 4: Commit**

```bash
git add brainrouter-desktop/src/panels/design/inspector/DesignPropertiesPanel.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(design): add the Position/Constraints/Layout/Appearance/Fill/Stroke/Effects panel"
```

---

### Task 8: The Typography panel and the inspector shell

**Files:**
- Create: `brainrouter-desktop/src/panels/design/inspector/TypographyPanel.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignInspector.tsx`

**Interfaces:**
- Consumes: `InspectorEdit`, `InspectorRead`, `DesignPropertiesPanel` from `./inspector/…`; `isTextLayer`, `layerDisplayName`, `layerIconFor`, `layerKindLabel` from `../../lib/design/designLayerMeta.js`; `measuredValueFor`, `MeasuredElement` from `../../lib/design/designMeasure.js`.
- Produces: `TypographyPanel({ read, edit })`; `DesignInspector` gains a required `measured: MeasuredElement | null` prop (Task 9 supplies it).

- [ ] **Step 1: Rewrite the inspector shell**

> This step imports `TypographyPanel`, which Step 2 creates. The file will not typecheck until Step 2 lands — that is expected; Step 3 is the gate.

Replace the whole contents of `brainrouter-desktop/src/panels/design/DesignInspector.tsx` with:

```tsx
import React from 'react';
import { Icon } from '../../icons.js';
import { DesignPropertiesPanel } from './inspector/DesignPropertiesPanel.js';
import { TypographyPanel } from './inspector/TypographyPanel.js';
import { isTextLayer, layerDisplayName, layerIconFor, layerKindLabel } from '../../lib/design/designLayerMeta.js';
import { measuredValueFor, type MeasuredElement } from '../../lib/design/designMeasure.js';
import type { DesignElement, DraftOperation, DraftProperty } from '../../lib/design/designElements.js';

export type InspectorTab = 'design' | 'code' | 'ai';

export function DesignInspector({ element, measured, tab, onTabChange, operations, onOperationChange, onSave, onRevert, onOpenAi }: { element: DesignElement | null; measured: MeasuredElement | null; tab: InspectorTab; onTabChange: (tab: InspectorTab) => void; operations: DraftOperation[]; onOperationChange: (operation: DraftOperation) => void; onSave: () => void; onRevert: () => void; onOpenAi: () => void }): React.ReactElement {
  return <aside className="ds-design-inspector" aria-label="Design inspector">
    <div className="ds-inspector-tabs" role="tablist" aria-label="Inspector modes">{(['design', 'code', 'ai'] as InspectorTab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => onTabChange(item)}>{item === 'ai' ? <Icon name="spark" size={12} /> : null}{item === 'design' ? 'Design' : item === 'code' ? '<> Code' : 'AI'}</button>)}</div>
    {!element && <div className="ds-inspector-empty"><Icon name="edit" size={18} /><p>Select a layer or use Inspect to edit the prototype.</p></div>}
    {element && tab === 'design' && <DesignTab element={element} measured={measured} operations={operations} onOperationChange={onOperationChange} onSave={onSave} onRevert={onRevert} />}
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
```

- [ ] **Step 2: Implement the Typography panel**

Create `brainrouter-desktop/src/panels/design/inspector/TypographyPanel.tsx`:

```tsx
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
      <Field label="Letter spacing" type="number" prefix="Aa" suffix="%" value={read('letterSpacing')} onChange={(value) => edit('letterSpacing', Number(value) || 0)} />
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
        <button type="button" className={`ds-segbtn${bold ? ' is-active' : ''}`} aria-pressed={bold} title="Bold" aria-label="Bold" onClick={() => edit('fontWeight', bold ? '400' : '700')}><FormatGlyph name="bold" /></button>
        <button type="button" className={`ds-segbtn${read('fontStyle') === 'italic' ? ' is-active' : ''}`} aria-pressed={read('fontStyle') === 'italic'} title="Italic" aria-label="Italic" onClick={() => edit('fontStyle', read('fontStyle') === 'italic' ? 'normal' : 'italic')}><FormatGlyph name="italic" /></button>
        <button type="button" className={`ds-segbtn${decoration.includes('underline') ? ' is-active' : ''}`} aria-pressed={decoration.includes('underline')} title="Underline" aria-label="Underline" onClick={() => toggleDecoration('underline')}><FormatGlyph name="underline" /></button>
        <button type="button" className={`ds-segbtn${decoration.includes('line-through') ? ' is-active' : ''}`} aria-pressed={decoration.includes('line-through')} title="Strikethrough" aria-label="Strikethrough" onClick={() => toggleDecoration('line-through')}><FormatGlyph name="strike" /></button>
      </div>
    </div>
  </Section>;
}

function FormatGlyph({ name }: { name: string }): React.ReactElement { return <Icon name={name} size={12} />; }
```

- [ ] **Step 3: Typecheck**

```
npm run typecheck
```

Expected: one remaining error — `DesignsView.tsx` does not pass the new required `measured` prop to `DesignInspector`. Task 9 fixes it. Do not commit yet.

---

### Task 9: Wire measurements in and make the rail responsive

**Files:**
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- Consumes: `PreviewHandle.measure` (Task 5), `DesignInspector`'s new `measured` prop (Task 7).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Fetch the measurement for the selected element**

In `brainrouter-desktop/src/panels/design/DesignsView.tsx`, add the import:

```tsx
import type { MeasuredElement } from '../../lib/design/designMeasure.js';
```

Add the state next to the other `useState` calls (after `previewReady`/`pickCycle`, currently lines 52–54):

```tsx
  const [measured, setMeasured] = useState<MeasuredElement | null>(null);
```

Add this effect immediately after the `selectedElement` line (currently line 88):

```tsx
  // Re-measure whenever the selection, the surface or the draft changes. Debounced
  // because every keystroke in the inspector rewrites `operations`, and each
  // measure is a round trip into the guest document.
  useEffect(() => {
    const ref = selectedElement?.ref;
    if (!ref) { setMeasured(null); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void previewRef.current?.measure(ref).then((result) => { if (active) setMeasured(result); }).catch(() => { if (active) setMeasured(null); });
    }, 120);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedElement?.ref, previewReady, operations]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Feed the measured box into every draft application**

The constraint properties cannot compute an inset without the element's measured
geometry, so `applyDraft` has to receive it. In the same file, replace
`updateOperation` and `saveDraft` (currently lines 192–208) with:

```tsx
  // Constraints need the measured geometry of the ref they target; only the
  // selected element is measured, which is also the only one being edited.
  const measuredBoxes = (): Record<string, ConstraintBox> => measured ? { [measured.ref]: measured.box } : {};
  const updateOperation = (operation: DraftOperation): void => {
    setOperations((current) => {
      const next = [...current.filter((item) => !(item.elementRef === operation.elementRef && item.property === operation.property)), operation];
      void previewRef.current?.applyDraft(next, undefined, measuredBoxes());
      onDraftContextChange(JSON.stringify(next));
      return next;
    });
  };
  const saveDraft = (): void => {
    if (!protos.selected) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, DraftOperation[]>;
      saved[`${workspaceRoot ?? 'unknown'}:${protos.selected.id}`] = operations;
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(saved));
    } catch { /* Local persistence is optional. */ }
    void previewRef.current?.applyDraft(operations, undefined, measuredBoxes());
  };
```

Add `ConstraintBox` to the imports:

```tsx
import type { ConstraintBox } from '../../lib/design/designConstraints.js';
```

- [ ] **Step 3: Pass the measurement to the inspector**

In the same file, change the `<DesignInspector …>` call (currently line 236) to add the prop:

```tsx
    <DesignInspector element={selectedElement} measured={measured} tab={inspectorTab} onTabChange={setInspectorTab} operations={operations} onOperationChange={updateOperation} onSave={saveDraft} onRevert={revertDraft} onOpenAi={onOpenAi} />
```

- [ ] **Step 4: Make the inspector width a token and keep it reachable when narrow**

In `brainrouter-desktop/src/panels/design/designStudio.css`, replace line 240:

```css
.design-studio .ds-design-editor { display:grid; grid-template-columns:228px minmax(0,1fr) 286px; background:var(--ds-bg); }
```

with:

```css
.design-studio .ds-design-editor { --ds-inspector-w:300px; display:grid; grid-template-columns:228px minmax(0,1fr) var(--ds-inspector-w); background:var(--ds-bg); }
```

Then replace the two trailing `@media` rules (lines 359–360) with:

```css
@media (max-width:1180px) { .design-studio .ds-design-editor { --ds-inspector-w:268px; } }
@media (max-width:1050px) { .design-studio .ds-design-editor { grid-template-columns:190px minmax(0,1fr) var(--ds-inspector-w); --ds-inspector-w:248px; } .design-studio .ds-resource-tab span { display:none; } }
@media (max-width:900px) { .design-studio .ds-inspector-grid { grid-template-columns:1fr; } }
/* Below this the three-column editor cannot hold all three panes, so the
   inspector floats over the stage instead of disappearing — it is the tab's
   primary surface and must stay reachable. */
@media (max-width:760px) {
  .design-studio .ds-design-editor { grid-template-columns:170px minmax(0,1fr); }
  .design-studio .ds-design-inspector { position:absolute; top:0; right:0; bottom:0; z-index:6; width:min(300px,86vw); box-shadow:-12px 0 32px rgb(0 0 0 / 45%); }
  .design-studio .ds-editor-stage { position:relative; }
}
```

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run the full design test folder**

```
npx tsx --test "src/lib/design/*.test.ts"
```

Expected: PASS, 0 failures.

- [ ] **Step 7: Commit Tasks 8–9 together**

```bash
git add brainrouter-desktop/src/panels/design/inspector brainrouter-desktop/src/panels/design/DesignInspector.tsx brainrouter-desktop/src/panels/design/DesignsView.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(design): Figma-grade inspector with measured values, constraints and typography"
```

---

### Task 10: Documentation and full verification

**Files:**
- Modify: `docs/design/Design.md`

- [ ] **Step 1: Replace the Inspector section in `docs/design/Design.md`**

Find the `### Inspector` subsection under `## Design tab components` and replace its single paragraph with:

```markdown
### Inspector

The right rail contains Design, Code, and AI tabs and is 300px wide (268px ≤1180px, 248px ≤1050px, a floating 300px drawer over the stage ≤760px).

The Design tab opens with a layer header — kind glyph, display name, kind label, and an "Edited" chip when the layer has unsaved draft operations — then these sections, each collapsible:

| Section | Fields |
| :--- | :--- |
| Position | Horizontal/vertical self-alignment, X/Y offset, rotation, flip H/V; the measured page position is shown beside the heading |
| Constraints | Horizontal and vertical constraint per Figma's five options; advisory with a note when the layer is still in normal flow |
| Layout | W, H (px, %, `auto`, `fill`, `hug`), padding, radius |
| Appearance | Blend mode, opacity, visibility |
| Fill | Fill and text colour swatches, each with an opacity percentage |
| Stroke | Colour, alignment (inside/outside), width |
| Effects | Drop/inner shadow with colour, X, Y, blur and spread; layer blur; backdrop blur |
| Typography | **Text layers only** — family, weight, size, line height, letter spacing, direction, text alignment, vertical text alignment, text case, truncation, OpenType ligatures/contextual alternates/kerning, and bold/italic/underline/strikethrough |

Typography appears only for a leaf element that carries its own text (`isTextLayer`). On a wrapper element the same edit would style the box rather than the words, so the section is hidden rather than shown as a no-op.

Two controls are gated on what the CSS can actually do, because a control that latches and moves nothing is worse than one that explains itself:

- **Vertical text alignment** needs block-axis free space. `align-content` distributes leftover space, so it does nothing on an auto-height box and nothing at all on an inline box. `verticalAlignApplies()` disables it and offers a one-click "set a fixed height". This mirrors Figma, where vertical alignment is only available on fixed-height text.
- **Offset, rotation and flip** use the individual `translate` / `rotate` / `scale` properties, which have no effect on a non-replaced inline box. `transformsApply()` disables them for inline layers.

Every field is seeded from the element's **measured** computed style, read out of the live preview (`PreviewHandle.measure`) — Electron evaluates the snippet in the `<webview>`, and the dev browser fallback relays it through the injected picker over `postMessage`. A draft operation overrides the measured value; Revert clears the draft and reloads.

Code exposes the semantic tag, stable ref, testid, child count, measured size, computed position, and text summary. AI hands the selected element and draft context to Fix Chat.

### How composite CSS is expressed

`translate`, `scale`, `box-shadow` and colour-with-alpha each take several values, but the inspector treats every field as an independent draft operation. Rather than make the applier stateful, a contributing property writes its own `--br-*` custom property **and** re-states the shared shorthand that reads them:

    translateX  →  --br-tx: 20px  +  translate: var(--br-tx, 0px) var(--br-ty, 0px)

The shorthand is byte-identical whoever emits it, so operations stay order-insensitive and one field never clobbers its neighbour. Every value passes `sanitizeCssValue` before it reaches CSS.

Custom properties **inherit**, so a nested layer that sets only half a group would read its ancestor's other half — edit a card's shadow colour, then a descendant label's blur, and the label would silently inherit the card's colour. `groupResetsFor()` therefore emits `initial` for every member of a touched group that this element does *not* set; `initial` makes a custom property guaranteed-invalid, so the shorthand's `var(--x, fallback)` supplies the neutral default. Members the element does set are left alone, so two fields in the same group still compose.

Two value rules follow from the same mechanism:

- Fill and text **alpha must be a bare number** — it is consumed as `calc(var(--br-fill-a) * 1%)`, and a value carrying its own unit makes the declaration invalid at computed-value time, which resolves to `initial` and *erases* the fill rather than leaving it alone. `alphaValue()` strips the unit and clamps to 0–100.
- `font-feature-settings` uses **single** quotes (`'calt' 1`). The same declaration string is serialized into the `data-br-draft-style="…"` attribute by `applyDraftOperations`, where a double quote would close the attribute.
```

- [ ] **Step 2: Update the supported-properties line**

In the same file, find the `## Design tab components` → `### Resource rail` paragraph's neighbourhood and any other sentence that still says the inspector exposes only "text, color, fill, font size/weight, padding, radius, and visibility". Replace that clause with:

```markdown
the full property set documented in the Inspector section below
```

- [ ] **Step 3: Run the desktop typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run every desktop unit test**

```
npx tsx --test "src/**/*.test.ts"
```

Expected: 0 failures. Record the reported `pass`/`fail` counts.

- [ ] **Step 5: Run the renderer build**

```
npm run build
```

Expected: `vite build` completes and writes `dist/`. If it fails with `Failed to resolve @kinqs/brainrouter-core/dist/*`, run `npm run build:deps` first and retry.

- [ ] **Step 6: Lint from the monorepo root**

```
cd D:\BrainRouter\BrainRouter
npm run lint
```

Expected: no new errors in `brainrouter-desktop/src/panels/design/**` or `brainrouter-desktop/src/lib/design/**`.

- [ ] **Step 7: Check line endings and NUL bytes before finishing**

```
git ls-files --eol brainrouter-desktop/src/lib/design brainrouter-desktop/src/panels/design
```

Expected: every touched file reports `w/lf` or the repo's existing convention — no mixed `mixed` entries.

- [ ] **Step 8: Commit**

```bash
git add docs/design/Design.md
git commit -m "docs(design): document the inspector sections and CSS composition pattern"
```

- [ ] **Step 9: Hand the visual check to the user**

The Electron UI cannot be launched from this harness. Report to the user:
- what passed (typecheck, unit tests, build, lint) with the actual counts;
- that the visual confirmation needs `npm run dev` in `brainrouter-desktop` (after `npm run build:deps`), then Design Studio → Designs → select a flow → click a layer;
- the three things worth eyeballing: the layer header glyph and name, that Typography appears on a text layer and is absent on a wrapper, and that editing a field visibly changes the prototype.
