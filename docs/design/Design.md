# BrainRouter Design System

BrainRouter’s desktop Design Studio uses a dark, instrument-like editor surface inspired by professional design tools such as Open Pencil while keeping BrainRouter’s own Memory Instrument identity.

## Visual identity

- Brand essence: calm, technical, observable, and precise.
- Core principle: high-density tooling with generous interaction targets and clear state.
- Editor hierarchy: resource rail → live prototype stage → contextual inspector.

## Colors

| Token | Value | Usage |
| :--- | :--- | :--- |
| Void | `#0B0D0F` | Canvas background and code surfaces |
| Substrate | `#14171A` | Rails, cards, toolbars |
| Lifted | `#1E2227` | Hover, input, and popover surfaces |
| Frost | `#ECEFF2` | Primary text |
| Mist | `#9BA3AC` | Secondary text and controls |
| Ash | `#5E6670` | Metadata and disabled states |
| Signal | `#34C28E` | Active state, focus, save, and live status |
| Danger | `#E5675F` | Destructive or invalid state |
| Warning | `#D9A441` | Stale or advisory state |

## Typography

- UI/body: the application sans font, 14px base, 1.5 line height.
- Labels and metadata: application mono font, 10–12px, uppercase eyebrow style.
- Inspector values: mono font for dimensions, refs, tokens, and source facts.
- Type scale: 12, 14, 16, 20, 28, 44px; weights 400, 500, 600, 700.

## Layout and spacing

- Editor layout: fixed resource rail, flexible prototype stage, fixed contextual inspector.
- Base rhythm: 4px; preferred spacing stops are 8, 12, 16, 24, 32, 48, and 64px.
- Control height: minimum 32px visually and 44px effective interaction target for compact/icon controls.
- Radii: 4px chips, 6px controls, 10px cards, 12px panels.
- Stage uses a 24px grid for spatial orientation; zoom changes use the stage transform and never resize surrounding chrome.

## Design tab components

### Resource rail

The left rail exposes Files, Assets, Components, Scales, and Design. Files selects prototype flows. Assets, Components, and Scales are read-only inventories derived from the selected HTML. Design shows the semantic layer tree, with indentation reflecting DOM depth and Signal/blue selection treatment.

### Prototype stage

The center stage is the existing sandboxed prototype preview. It supports desktop, tablet, and phone presets, reload, select/hand/inspect modes, grid context, zoom, and fit. The stage remains interactive outside inspect mode.

### Inspector

The right rail contains Design, Code, and AI tabs and is 300px wide (268px ≤1180px, 248px ≤1050px, a floating 300px drawer over the stage ≤760px).

The Design tab opens with a layer header — kind glyph, display name, kind label, and an "Edited" chip when the layer has unsaved draft operations — then these sections, each collapsible:

| Section | Fields |
| :--- | :--- |
| Position | Horizontal/vertical self-alignment, X/Y offset, rotation, flip H/V; the measured page position is shown beside the heading |
| Constraints | Horizontal and vertical constraint per Figma's five options; advisory with a note when the layer is still in normal flow |
| Layout | W, H (px, %, `auto`, `fill`, `hug`), padding, radius |
| Appearance | Blend mode, opacity, visibility |
| Typography | **Text layers only** — family, weight, size, line height, letter spacing, direction, text alignment, vertical text alignment, text case, truncation, OpenType ligatures/contextual alternates/kerning, and bold/italic/underline/strikethrough |
| Fill | Fill and text colour swatches, each with an opacity percentage |
| Stroke | Colour, alignment (inside/outside), width |
| Effects | Drop/inner shadow with colour, X, Y, blur and spread; layer blur; backdrop blur |

Typography appears only for a leaf element that carries its own text (`isTextLayer`). On a wrapper element the same edit would style the box rather than the words, so the section is hidden rather than shown as a no-op.

Two controls are gated on what the CSS can actually do, because a control that latches and moves nothing is worse than one that explains itself:

- **Vertical text alignment** needs block-axis free space. `align-content` distributes leftover space, so it does nothing on an auto-height box and nothing at all on an inline box. `verticalAlignApplies()` disables it and offers a one-click "set one" that gives the layer a fixed height. This mirrors Figma, where vertical alignment is only available on fixed-height text.
- **Offset, rotation and flip** use the individual `translate` / `rotate` / `scale` properties, which have no effect on a non-replaced inline box. `transformsApply()` disables them for inline layers.

Every field is seeded from the element's **measured** computed style, read out of the live preview (`PreviewHandle.measure`) — Electron evaluates the snippet in the `<webview>`, and the dev browser fallback relays it through the injected picker over `postMessage`. A draft operation overrides the measured value; Revert clears the draft and reloads.

**The browser channel carries data, never code.** A prototype ships `default-src 'none'; script-src 'unsafe-inline'`, which permits the injected picker's inline `<script>` but *not* `eval` — so posting a snippet for the guest to evaluate fails silently and every read comes back `null`. Measure therefore posts `{__brpMeasure:{id,ref,props}}` and apply posts `{__brpApply:{ops}}` (from `buildApplyPayload`, already resolved to `[property, value]` pairs); the guest's own CSP-approved handler does the work. Electron is exempt because `executeJavaScript` is injected by the embedder rather than by the document, so `buildApplyScript` still serves the `<webview>`. Loosening the prototype CSP to make `eval` work is not an option — it is the sandbox boundary for untrusted generated HTML.

Code exposes the semantic tag, stable ref, testid, child count, measured size, computed position, and text summary. AI hands the selected element and draft context to Fix Chat.

### How composite CSS is expressed

`translate`, `scale`, `box-shadow` and colour-with-alpha each take several values, but the inspector treats every field as an independent draft operation. Rather than make the applier stateful, a contributing property writes its own `--br-*` custom property **and** re-states the shared shorthand that reads them:

    translateX  →  --br-tx: 20px  +  translate: var(--br-tx, 0px) var(--br-ty, 0px)

The shorthand is byte-identical whoever emits it, so operations stay order-insensitive and one field never clobbers its neighbour. Every value passes `sanitizeCssValue` before it reaches CSS.

Custom properties **inherit**, so a nested layer that sets only half a group would read its ancestor's other half — edit a card's shadow colour, then a descendant label's blur, and the label would silently inherit the card's colour. `groupResetsFor()` therefore emits `initial` for every member of a touched group that this element does *not* set; `initial` makes a custom property guaranteed-invalid, so the shorthand's `var(--x, fallback)` supplies the neutral default. Members the element does set are left alone, so two fields in the same group still compose.

Two value rules follow from the same mechanism:

- Fill and text **alpha must be a bare number** — it is consumed as `calc(var(--br-fill-a) * 1%)`, and a value carrying its own unit makes the declaration invalid at computed-value time, which resolves to `initial` and *erases* the fill rather than leaving it alone. `alphaValue()` strips the unit and clamps to 0–100.
- `font-feature-settings` uses **single** quotes (`'calt' 1`). The same declaration string is serialized into the `data-br-draft-style="…"` attribute by `applyDraftOperations`, where a double quote would close the attribute.

### Bottom toolbar

The bottom dock contains Select, Hand, Frame, Shape, Text, Inspect, zoom out/in, zoom percentage, and Fit. Every icon-only control has an accessible label and tooltip/shortcut.

## Interaction and accessibility

- Use visible `:focus-visible` rings with Signal contrast.
- Do not rely on hover; every editor action has a button or keyboard path.
- Keep 8px or more between adjacent controls and 44px effective hit targets.
- Use color plus text/icon state; Signal is never the only indicator.
- Respect `prefers-reduced-motion`; editor transitions are 180–300ms and transform/opacity based.
- Preserve keyboard escape routes: Escape clears selection/inspect mode; Enter activates the selected flow/layer.
- Keep source editing agent-mediated through Fix Chat; direct inspector edits are typed, scoped draft operations with explicit Save and Revert.

## Themes

The editor consumes the application theme variables and maps them into scoped `--ds-*` tokens. Theme references remain available under [docs/design/themes](./themes/).
