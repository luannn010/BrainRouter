# Plan: Upgrade the BrainRouter Design Canvas with Open Pencil-Inspired Features

## Status

Draft for human review. No implementation is included in this document.

## Goal

Upgrade the BrainRouter Design Studio **Canvas** so it becomes an inspectable,
editable map of prototype flows rather than only a set of preview thumbnails.
The canvas should retain BrainRouter's current strengths—self-contained HTML
prototypes, flow-oriented frames, sandboxed previews, and the Fix Chat—while
borrowing the most useful interaction patterns from Open Pencil:

- structured nodes and hierarchy;
- selection, bounds, and property inspection;
- reusable component/state relationships;
- layout guides and auto-layout-like arrangement;
- design-token and accessibility audits;
- programmable, agent-friendly operations;
- exportable canvas snapshots and reports.

This is an additive Canvas upgrade. It is not a proposal to replace BrainRouter
prototypes with `.fig` files or to reproduce a full vector design editor.

## Research basis

Open Pencil describes its editor as a local, programmable design editor with a
scene graph, selection/manipulation, components and variants, auto layout and
CSS Grid, variables, linting/token analysis, import/export, and AI/MCP
operations. The relevant references are:

- [Open Pencil repository](https://github.com/open-pencil/open-pencil)
- [Open Pencil user guide](https://openpencil.dev/user-guide/)
- [Selection and manipulation overview](https://openpencil.dev/user-guide/selection)
- [Auto Layout guide](https://openpencil.dev/user-guide/auto-layout)
- [Components and variants](https://openpencil.dev/user-guide/components)
- [Figma compatibility and feature matrix](https://openpencil.dev/guide/figma-comparison)
- [Open Pencil roadmap](https://openpencil.dev/development/roadmap)

The plan intentionally treats Open Pencil as a source of interaction and
architecture patterns, not as a requirement to copy its renderer or file format.

## Current BrainRouter baseline

The existing Canvas is implemented in:

- `brainrouter-desktop/src/panels/design/CanvasView.tsx`
- `brainrouter-desktop/src/lib/design/useCanvasFrames.ts`
- `brainrouter-desktop/src/panels/design/designStudio.css`
- `brainrouter-desktop/src/panels/DesignStudioPanel.tsx`
- `brainrouter-desktop/electron/designHost.ts`

Today it loads a capped batch of prototype HTML files, creates fixed-size
frames in a four-column grid, draws simple sequential connectors, supports pan,
zoom, fit, keyboard navigation, selection, refresh, and double-click navigation
to Designs. Frame previews are sandboxed `srcDoc` iframes and are intentionally
non-interactive on the map.

### Design constraints to preserve

- Keep the Canvas a **flow map**, not a freeform illustration editor.
- Keep prototype HTML as the source of truth for rendered UI.
- Preserve sandboxing and the current authorized-prototype path rules.
- Keep the existing Designs tab as the interactive/manual-testing surface.
- Keep the Fix Chat able to target a selected prototype and picked element.
- Keep the existing Memory Instrument visual language and scoped CSS.
- Avoid a new heavyweight renderer until the DOM-backed approach has proven
  insufficient.

## Proposed product model

Introduce a small Canvas document model layered over the existing prototypes:

```text
CanvasDocument
├── flow groups / sections
├── prototype nodes (existing HTML frames)
│   ├── metadata: id, title, path, size, status
│   ├── viewport / position / z-order
│   ├── semantic elements discovered from HTML
│   ├── transitions: source → target, trigger, label
│   └── states / variants: default, error, success, loading, etc.
├── annotations / review notes
└── canvas preferences: zoom, pan, grid, layout mode
```

The model should be persisted separately from prototype HTML, initially under
the existing workspace state area. It must be versioned so future schema changes
can migrate safely. If metadata is missing, the Canvas should derive a useful
default from the prototype files and continue working.

## Recommended feature scope

### MVP: inspectable flow canvas

1. **Real canvas node model**
   - Replace index-derived frame positions with stable node ids and persisted
     positions.
   - Add flow groups/sections so related screens can be visually organized.
   - Keep a deterministic auto-layout fallback for new or unpositioned nodes.

2. **Selection and inspection**
   - Single-select, multi-select, marquee select, and clear selection.
   - Show a Canvas inspector for selected prototype nodes: title, path, viewport,
     file size, modified time, detected interactive elements, and transition
     count.
   - Preserve double-click to open Designs.

3. **Navigation ergonomics**
   - Add a hand/select mode, spacebar pan, zoom-to-selection, fit-all, and a
     minimap or compact navigator for large flows.
   - Add visible grid/guides and snap-to-grid, with a toggle and persisted
     preference.

4. **Explicit flow relationships**
   - Infer transitions from existing `data-go`, `data-show`, and compatible
     navigation markers where possible.
   - Render labeled edges and distinguish inferred edges from user-confirmed
     edges.
   - Do not execute prototype JavaScript inside the Canvas iframe.

### Phase 2: design-system and review intelligence

5. **Element-level inspect mode**
   - Add an opt-in inspect action that opens the selected prototype in Designs,
     activates the existing picker, and returns the selected element context to
     the Canvas/Inspector.
   - Display stable `data-testid`, semantic tag, text summary, bounding box,
     computed color/type hints, and a link to Fix Chat.

6. **Token and accessibility audit**
   - Analyze self-contained HTML/CSS for repeated colors, spacing values,
     font sizes, radii, contrast pairs, missing labels, and missing testids.
   - Compare findings with BrainRouter's Memory Instrument tokens.
   - Surface warnings on nodes and provide a flow-level audit summary.
   - Keep analysis read-only at first; fixes should go through Fix Chat.

7. **Reusable patterns and states**
   - Detect repeated structural patterns across prototypes, such as cards,
     buttons, form fields, banners, and navigation shells.
   - Represent them as reviewable “pattern candidates” rather than silently
     rewriting HTML.
   - Add lightweight state labels and variant badges based on flow metadata and
     detected screens; allow manual correction.

### Phase 3: controlled editing and automation

8. **Canvas operations for agents**
   - Define typed operations for create group, move node, rename node, connect
     nodes, add annotation, run audit, and focus selection.
   - Expose them through the existing desktop bridge/query conventions, not a
     new MCP server.
   - Require an explicit preview/confirmation boundary for operations that write
     metadata or prototype files.

9. **Layout modes**
   - Add manual, flow, and grid layout modes.
   - Borrow Open Pencil's auto-layout principles—direction, gap, padding,
     alignment, wrapping—but apply them to prototype frames and flow groups,
     not arbitrary vector nodes.
   - Preserve manual positions when the user switches back from an automatic
     layout.

10. **Export and handoff**
    - Export the current Canvas viewport as PNG/SVG or a deterministic HTML
      report, depending on existing desktop export capabilities.
    - Include flow graph, node titles, audit status, and selected annotations.
    - Add “copy inspector summary” for agent prompts and issue reports.

## Dependency graph

```text
Canvas metadata schema + persistence
        │
        ├── stable node positions / groups
        │       ├── selection + marquee + inspector
        │       │       └── element inspect bridge
        │       └── layout modes + minimap
        │
        ├── transition extraction
        │       └── labeled flow edges + state badges
        │
        └── HTML/CSS analysis
                ├── token/accessibility audit
                └── pattern candidates

Typed Canvas operations
        └── Fix Chat / agent handoff / export reports
```

## Implementation tasks

### Task 1 — Define and test the Canvas metadata schema (M)

**Description:** Add a versioned pure TypeScript model for Canvas documents,
nodes, groups, positions, edges, states, annotations, and layout preferences.
Include migration/defaulting helpers so existing prototype directories open with
no metadata file.

**Acceptance criteria:**

- [ ] Existing prototypes produce deterministic node ids and default positions.
- [ ] Schema validation rejects malformed ids, invalid coordinates, and unknown
      layout modes with actionable errors.
- [ ] Version migration is covered for at least the initial persisted format.

**Verification:** Unit tests for parsing, migration, defaults, and stable ids;
run the desktop package typecheck/build.

**Dependencies:** None.

**Likely files:**

- `brainrouter-desktop/src/lib/design/canvasModel.ts`
- `brainrouter-desktop/src/lib/design/canvasModel.test.ts`
- `brainrouter-desktop/electron/designHost.ts`
- `brainrouter-desktop/electron/host/queries.ts`

**Estimated scope:** Medium.

### Task 2 — Persist positions, groups, and Canvas preferences (M)

**Description:** Add host-backed read/write operations for Canvas metadata under
the workspace state directory, with atomic writes and safe workspace scoping.

**Acceptance criteria:**

- [ ] Moving a node, changing a group, or changing a Canvas preference survives
      reload and app restart.
- [ ] A corrupt or unavailable metadata file falls back to derived defaults and
      shows a recoverable warning.
- [ ] Writes cannot escape the configured workspace root.

**Verification:** Host unit tests for atomic persistence, fallback behavior, and
path safety; manual restart/reload verification.

**Dependencies:** Task 1.

**Likely files:** `electron/designHost.ts`, `electron/designHost.test.ts`,
`src/lib/design/useCanvasDocument.ts`, bridge query types.

**Estimated scope:** Medium.

### Task 3 — Replace fixed grid placement with a node-backed Canvas (M)

**Description:** Update `CanvasView` to render persisted positions and groups,
while retaining deterministic flow layout for new nodes. Add drag-to-move with
selection-safe pointer handling.

**Acceptance criteria:**

- [ ] Existing Canvas interactions—pan, zoom, fit, refresh, keyboard movement,
      frame selection, and open-in-Designs—continue to work.
- [ ] Dragging a frame updates local state and persists on drop.
- [ ] New prototypes receive predictable non-overlapping positions.

**Verification:** Existing tests plus focused pure geometry tests; manual Canvas
interaction at 1, 4, 24, and zero frames.

**Dependencies:** Tasks 1–2.

**Likely files:** `CanvasView.tsx`, `designStudio.css`, canvas geometry/model
helpers, tests.

**Estimated scope:** Medium.

### Checkpoint: Canvas foundation

- [ ] Desktop build and all relevant unit tests pass.
- [ ] Existing prototype flows render unchanged.
- [ ] Positions persist without changing prototype HTML.
- [ ] Human review before adding inspection intelligence.

### Task 4 — Add selection model, marquee selection, and Canvas inspector (M)

**Description:** Introduce keyboard-accessible single/multi-selection and a
right-side inspector focused on prototype-level facts and actions.

**Acceptance criteria:**

- [ ] Shift-click and marquee selection work without starting a pan.
- [ ] Escape clears selection; Enter/open action navigates to Designs.
- [ ] Inspector shows selected node metadata and offers open, focus, audit, and
      Fix Chat actions.

**Verification:** Pure selection reducer tests plus manual keyboard/pointer QA.

**Dependencies:** Task 3.

**Likely files:** `CanvasView.tsx`, new `CanvasInspector.tsx`, selection helpers,
scoped CSS, tests.

**Estimated scope:** Medium.

### Task 5 — Infer and render flow edges (M)

**Description:** Parse supported navigation markers from prototype HTML and
store/display inferred edges, with manual confirmation and labels.

**Acceptance criteria:**

- [ ] Supported `data-go` relationships are extracted deterministically.
- [ ] Missing targets and unsupported markers are shown as warnings, not fatal
      errors.
- [ ] Edges remain readable at fit-to-screen zoom and do not intercept frame
      selection.

**Verification:** Parser tests using the existing seed flows; manual visual QA
with multiple rows and groups.

**Dependencies:** Task 1.

**Likely files:** `src/lib/design/flowExtraction.ts`, test fixtures,
`CanvasView.tsx`, `designStudio.css`.

**Estimated scope:** Medium.

### Task 6 — Add grid, guides, minimap, and layout modes (M)

**Description:** Add the navigation and layout affordances that are most useful
from Open Pencil without introducing a vector editor: select/hand mode, grid,
snap, minimap, manual layout, flow layout, and grid layout.

**Acceptance criteria:**

- [ ] User can toggle grid/snap and change layout mode from the Canvas toolbar.
- [ ] Automatic layouts are deterministic and preserve group boundaries.
- [ ] Returning to manual layout restores the last manual positions.

**Verification:** Geometry/layout unit tests and manual large-flow testing.

**Dependencies:** Tasks 2–5.

**Likely files:** canvas geometry/layout helpers, `CanvasView.tsx`, toolbar/CSS,
metadata persistence.

**Estimated scope:** Medium.

### Checkpoint: Flow-map usability

- [ ] A user can find, arrange, inspect, and open any flow without excessive
      panning.
- [ ] Edges, groups, grid, and minimap remain usable with 24 frames.
- [ ] No regression in Designs preview or Fix Chat refresh behavior.

### Task 7 — Add element inspection handoff to Designs (S)

**Description:** Connect Canvas selection to the existing Designs picker so an
agent or user can inspect a real HTML element without duplicating the preview
engine.

**Acceptance criteria:**

- [ ] Canvas action opens the correct prototype in Designs and activates inspect
      mode.
- [ ] Selected element context includes testid/tag/text/bounds and is visible in
      the Canvas/Designs inspector.
- [ ] Fix Chat receives the same picked-element context as the current manual
      picker flow.

**Verification:** Manual end-to-end test on seeded sign-in and register flows.

**Dependencies:** Task 4.

**Likely files:** `DesignStudioPanel.tsx`, `DesignsView.tsx`, `PreviewCanvas.tsx`,
`InspectorRail.tsx`, bridge event/query types.

**Estimated scope:** Small.

### Task 8 — Add read-only token and accessibility audits (M)

**Description:** Analyze prototype HTML/CSS and compare results with the
BrainRouter design tokens. Keep the first version advisory and route proposed
changes through Fix Chat.

**Acceptance criteria:**

- [ ] Audit reports repeated colors, spacing, typography, radii, contrast, label
      issues, and missing testids with source locations where available.
- [ ] Canvas nodes show an audit status and the inspector shows actionable
      findings.
- [ ] Audit failures never prevent preview rendering.

**Verification:** Pure parser/analyzer tests against seed documents and malformed
HTML; manual review of findings.

**Dependencies:** Tasks 1 and 4.

**Likely files:** `src/lib/design/canvasAudit.ts`, tests, `useCanvasFrames.ts`,
inspector components, CSS.

**Estimated scope:** Medium.

### Task 9 — Represent repeated patterns and states as metadata (M)

**Description:** Detect likely repeated UI structures and flow states, then make
them reviewable as badges/pattern candidates. Do not auto-edit source files.

**Acceptance criteria:**

- [ ] Repeated patterns include evidence and confidence, not only a label.
- [ ] Users can accept, dismiss, or rename a candidate in metadata.
- [ ] State/variant labels are visible on nodes and usable in Fix Chat context.

**Verification:** Fixture-based detector tests and manual review with the seed
flows.

**Dependencies:** Tasks 5 and 8.

**Likely files:** `canvasPatterns.ts`, tests, metadata model/migrations,
`CanvasView.tsx`, inspector.

**Estimated scope:** Medium.

### Task 10 — Add typed agent operations and exportable handoff (M)

**Description:** Expose safe Canvas operations through existing desktop bridge
conventions and provide a deterministic summary/export path for agents and
human review.

**Acceptance criteria:**

- [ ] Read operations can inspect nodes, edges, audits, and selection context.
- [ ] Write operations are typed, workspace-scoped, logged, and reversible via
      undo or metadata history.
- [ ] User can copy or export a deterministic Canvas summary containing layout,
      flows, findings, and annotations.

**Verification:** Host/query tests, schema tests, export snapshot tests, and a
manual Fix Chat/agent handoff.

**Dependencies:** Tasks 1–9.

**Likely files:** bridge contracts, `electron/designHost.ts`, query handlers,
export helper, tests, Canvas UI.

**Estimated scope:** Medium.

## Explicitly out of scope for this upgrade

- Native `.fig`/`.pen` file import or export.
- A general-purpose vector scene graph or arbitrary shape drawing tools.
- Replacing HTML prototypes with a CanvasKit/WebGPU renderer.
- Real-time multiplayer collaboration.
- Automatic source edits from audits without user confirmation.
- Full component library publishing and cross-project synchronization.
- A new MCP server; use the existing BrainRouter bridge and agent workflows.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Canvas metadata diverges from prototype files | High | Keep HTML as rendering source of truth; derive defaults and show stale-state warnings. |
| Large iframe thumbnails become slow | High | Keep the current frame cap, lazy-load offscreen previews, and measure before changing renderer. |
| Selection conflicts with pan and iframe behavior | High | Maintain explicit select/hand modes and keep iframe pointer events disabled on the map. |
| HTML parsing is unreliable | Medium | Use tolerant extraction with confidence/warnings; never block rendering. |
| Layout changes surprise users | Medium | Preserve manual positions and make automatic layouts explicit and reversible. |
| Bridge writes create unsafe file access | High | Reuse authorization/path checks, validate ids, atomic-write metadata only inside workspace state. |
| Scope expands toward a Figma clone | High | Enforce the MVP boundary: flow nodes, inspection, metadata, and agent handoff first. |

## Open questions for review

1. Should Canvas metadata be committed alongside the project, or remain in the
   local BrainRouter state directory by default?
2. Should groups represent product flows only, or also support freeform review
   sections such as “Needs QA” and “Ready for handoff”?
3. Should audit findings be visible by default, or only after the user enables an
   Audit mode?
4. Is PNG/SVG export required for the first release, or is a deterministic text/
   HTML handoff enough?
5. Should user-confirmed edges be persisted separately from inferred edges so
   re-analysis cannot overwrite them?

## Review checkpoint

Please review this plan before implementation begins. The recommended first
approval boundary is Tasks 1–6 (the inspectable flow canvas). Tasks 7–10 can then
be approved as a second milestone after the interaction model has been validated.

