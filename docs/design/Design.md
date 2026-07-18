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
- Stage uses a 24px grid for spatial orientation and for drag snapping; pan and zoom live on the world layer's transform and never resize surrounding chrome.

## Design tab components

### Resource rail

The left rail exposes Files, Assets, Components, Scales, and Design. Files selects prototype flows. Assets and Scales are read-only inventories derived from the selected HTML.

Design shows **two trees**, because they are two different things — what you drew, and what the prototype is:

- **Canvas** lists the objects drawn on the stage (frames, sections, shapes, text, baked paths). Array order is z-order with the last on top, so the tree reverses it to read topmost-first. A frame or section nests its members underneath it, to any depth. A plain group (Ctrl+G) mints an id matching no annotation, so its members stay flat rather than nesting under a parent that does not exist — and a frame drawn with the F tool adopts nothing, so drawing a frame around shapes does not nest them; only Frame selection (Ctrl+Alt+G) does. Multi-select mirrors the canvas: shift-click accumulates.
- **Layers** is the prototype's semantic DOM tree, with indentation reflecting DOM depth.

The two trees drive different selections, so picking in one clears the other — including the `picked` element, not just `selectedRef`, or the inspector would keep showing an element that is no longer selected.

A hidden layer draws nothing on the stage and is transparent to hit-testing, which makes the rail the only surface where its state is legible and the only place it can be selected to unhide. It is therefore struck through and dimmed rather than removed, and stays clickable.

A layer packed into a component (Create component / Ctrl+Alt+K) shows the component glyph and the component's name in place of its kind. **Packedness is derived, not stored as a fact:** the annotation keeps a `componentId`, and the tree resolves it against the live component list each render. Annotations are per-prototype in localStorage while components live in the per-workspace canvas document, so that pointer can outlive its target — resolving it means a deleted component leaves the layer reading as exactly what it is again, with no cleanup pass and no stale rows. Copy, paste and duplicate strip the link, since a copy is a new object and the clipboard outlives a prototype switch.

Components has two parts: **Saved** components persisted in the canvas document, and below them the read-only component candidates derived from the current HTML. A saved component is draggable — dropping it on the canvas places it at the drop point, snapped to the grid.

A saved component's thumbnail renders inside an iframe with a **fully empty `sandbox`** (no `allow-scripts`). Component markup can come from a model, and this rail lives in the renderer origin that holds the bridge — rejecting `<script>` at generation time is not sufficient on its own, because an inline `onerror=` handler would still run. The sandbox is what actually makes it inert.

### Prototype stage

The center stage is a **world canvas**: a fixed viewport (`overflow:hidden`) containing one world layer that carries `translate(pan) scale(zoom)`. Every prototype is a screen absolutely positioned in world coordinates, read from and written back to the shared `CanvasDocument` at `.brainrouter/design/canvas.json`.

| Gesture | Result |
| :--- | :--- |
| Hand tool drag, Space+drag, middle-drag | Pan |
| Ctrl/Cmd + wheel | Zoom toward the cursor |
| Wheel | Pan; Shift+wheel pans sideways |
| Drag a screen's body | Move it, snapped to the grid — on every screen except the live one |
| Drag a screen's title bar | Move it, on any screen including the live one |
| Drag a resize handle | Resize the selected screen; the opposite edges stay pinned |
| Drag empty canvas (select tool) | Rubber-band selection |
| `0` | Fit the selection, or the whole board |

**Which parts of a screen you can grab** depends on whether it is the live one. A non-live screen is a picture — its snapshot iframe is `pointer-events:none`, so its whole body drags, exactly like the Canvas tab. The live screen's body is the running prototype and has to stay clickable, so that one moves by its title bar. Clicking a screen makes it live, so the first drag of a screen comes from its body and later ones from its title bar.

Screen **chrome is counter-scaled** by the canvas zoom: the title bar holds 22px and the resize handles 10px on screen whether the canvas is at 400% or 10%. Without that, the title bar — the only way to move the live screen — shrank with the zoom and became unhittable at 5px on a zoomed-out board.

Resize handles appear on the selected, unlocked screen: eight of them, clockwise from the top-left. A handle moves only the edges it names, so resizing from the north-west corner moves the origin and leaves the south-east corner exactly where it was — including when the drag is clamped at the 64px minimum, which otherwise makes a squashed screen crawl across the canvas. A drag of zero distance is an exact no-op rather than snapping the box to the grid.

Only the selected screen mounts the live `<webview>`/`<iframe>`; every other screen renders a static, pointer-inert snapshot. A twenty-screen board therefore costs one live guest, not twenty. The live surface is a separate always-mounted layer positioned over the active screen rather than a child of it, so switching screens re-navigates the guest instead of tearing it down and rebuilding it.

Device presets resize the **active screen** rather than scaling the view: on a canvas, "phone" is a property of one screen, not of the camera.

The view auto-frames the active screen until the user pans or zooms, after which it is theirs. Fitting the whole board on open would land at ~24% on a narrow shell, and this is an editing surface.

One honest limitation: wheel events inside the live prototype belong to the prototype, so Ctrl+wheel there scrolls it rather than zooming the canvas. The hand tool masks the guest, which makes zoom work over a live screen too.

### Canvas actions

Right-click acts on whatever was clicked — a screen, an annotation, or empty space — over a selection that spans both kinds of object. Rows whose Figma meaning has no exact analogue on an HTML-prototype canvas are given a definite meaning rather than greyed out:

| Action | What it does here |
| :--- | :--- |
| Copy / Cut / Paste / Duplicate | Session clipboard. A screen duplicates by **copying its prototype file** (`design:duplicate-prototype`), because a `CanvasNode` id derives from its prototype id and two nodes cannot share one. |
| Delete | Annotations are removed. A screen is **removed from the board** (into `hiddenPrototypeIds`, restorable via Show all) — its HTML file is never deleted, and the row reads "Remove from board" to say so. |
| Bring to front / Send to back | Annotation array order; `CanvasNode.zIndex` for screens. |
| Group / Ungroup | An invisible container: members share a `groupId` and travel together. |
| Frame selection | A **visible titled container** at the selection's box plus padding, placed behind its members. This is the real distinction from Group. |
| Add auto layout | Gives a container `autoLayout {direction, gap, padX, padY, align}`; members are placed along the axis and the container hugs them. The container's own origin is preserved, so applying it never makes what you clicked jump. |
| Use as mask | Marks one annotation `mask: true`; its siblings in the same group render clipped to its geometry. Each clipped box gets the mask's outline translated into its own space as `clip-path: path(...)` — no shared `<defs>`, no id collisions. |
| Flatten | Merges the selection into one `path` annotation whose `d` carries each member's outline as a subpath, matching Figma, where flatten yields one vector object of several subpaths. |
| Outline text | **Real glyph contours.** There is no font-outline API in a renderer, so the text is rasterised to an offscreen alpha buffer and `traceMask` walks it with directed boundary edges into closed contours. Tracing "Ag" yields four subpaths — an outer contour and a counter for each letter. The tracer is pure, so it is tested against synthetic masks; only the rasterisation touches the DOM. |
| Outline stroke | Converts a stroked shape into a filled band: an outer ring plus an inner ring wound the other way. Exact for straight-edged kinds and ellipses; for a star or a traced path it bands off the bounding box. |
| Create component | Promotes the selection to a `CanvasComponent` — a self-contained SVG — persisted in the document and listed in the Components rail. |
| Create component with chat | A compact prompt box calling `design:quick-generate`, a **one-shot completion** using the model configured in app settings. Deliberately not the agent loop: it runs no tools, writes no files, and never enters the visible transcript. Markup containing a `<script>` tag is rejected, because generated HTML is stored and re-rendered on the canvas. |
| Show/Hide, Lock/Unlock, Flip H/V | Apply to screens (`CanvasNode` flags) and annotations alike, across the whole selection. |

The canvas document is schema **v2** (components, per-node hidden/locked/flip, group auto layout). A v1 document on disk is upgraded on read rather than rejected, so an existing board survives the change.

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

### Tools and shape properties

The tool shortcuts follow [OpenPencil](https://openpencil.dev/reference/keyboard-shortcuts)'s Figma-compatible map: **V** move/select, **H** hand, **F** frame, **S** section, **R** rectangle, **O** ellipse, **L** line, **T** text. Polygon and Star are flyout-only there, and here too. One deliberate divergence: OpenPencil binds **I** to an eyedropper, which this editor does not have, so **I** stays on Inspect — the element picker, which is this surface's reason to exist.

Two rules make the creation tools behave like every direct-manipulation editor:

- **A creation tool always creates.** The overlay hit-tests for a move only when Select is active. Testing first meant that with Rectangle armed, starting a drag on top of an existing shape moved that shape instead of drawing.
- **One shape per press.** Frame, Shape and Text hand back to Select once something is drawn (`revertsToSelect`), so the next drag moves what you just made rather than drawing another. Hand, Select and Inspect are modes and stay put.

A selected shape takes over the inspector's Design tab, showing the properties OpenPencil's does: position and size, appearance (opacity, corner radius), fill, stroke colour and width, and type size/weight for text. Edits apply to the whole selection. Unset means "the kind's default" rather than a stored value, so frames, sections, lines and text start unfilled while rectangles and ellipses start with the Signal wash.

Colours are **allowlisted, not escaped** — hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, or a bare keyword. They land in an inline `style`, which is a place where "close enough" becomes CSS injection, so anything carrying a semicolon, a `url()`, or an unnamed function is refused and the annotation is left untouched. The guard runs both on write and again on render, so a hand-edited localStorage store cannot smuggle a value through either.

### OpenPencil parity

Checked against [their shortcut reference](https://openpencil.dev/reference/keyboard-shortcuts) and [canvas navigation guide](https://openpencil.dev/user-guide/canvas-navigation), row by row.

**Matched.** Tools V/H/F/S/R/O/L/T with Polygon and Star flyout-only. Canvas interaction: click select, Shift+click add/remove, Alt+drag duplicate-and-move, Shift+drag to constrain a drawn shape to a square or circle, Shift+drag to hold aspect while resizing, middle-drag pan, scroll pan, Ctrl+scroll zoom, double-click to edit text, Escape to deselect. Edit: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, Ctrl+X/C/V/D, Delete, Ctrl+A select all. View: Ctrl+= in, Ctrl+− out, Ctrl+0 to 100%, Ctrl+1 and Shift+1 to fit, Ctrl+2 and Shift+2 to zoom to selection.

Undo covers the annotation layer and is **per gesture, not per frame** — a drag repaints continuously but lands one undo step on release, so one Ctrl+Z returns the shape to where the drag started. History is per prototype, so undo never walks back into another screen. Prototype drafts are excluded: they have their own explicit Save and Revert.

**Not matched, and not reachable by changing this panel.** OpenPencil is a Skia/CanvasKit vector editor with its own `.fig`/`.pen` document model. That buys it gradients and image fills, a pen tool and vector path editing, boolean operations, rotation, components with variants, variables, multi-page documents, WebRTC collaboration, and export to PNG/SVG/JSX. This surface is a redline layer over live HTML prototypes, so fills are solid colours, there is no path editing beyond the baked outlines above, and there is no document format to open or export. Reaching those would mean replacing the renderer and the document model — a different product rather than a change to this one.

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
