# Open Pencil-Inspired Design Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the desktop Design Studio `Designs` tab into an Open Pencil-style flow editor for BrainRouter HTML prototypes.

**Architecture:** Keep one existing `PreviewCanvas` as the live prototype surface. Add pure DOM metadata and draft-operation helpers under `src/lib/design/`, then compose focused left resource rail, layer tree, inspector, and bottom toolbar components around the current `DesignsView`. Drafts are screen-scoped and persisted through the existing design artifact path; Fix Chat remains the source-edit workflow.

**Tech Stack:** React 18, TypeScript, Electron webview/iframe preview, existing BrainRouter design tokens, node:test/tsx.

## Global Constraints

- Prototype HTML remains the rendering source of truth.
- Preserve sandboxing and the current authorized prototype path rules.
- Use the existing Memory Instrument tokens and icon family.
- Keep all interactive controls keyboard reachable with visible focus states.
- Do not introduce `.fig`/`.pen` files or a new MCP server.

### Task 1: Add DOM metadata and draft operation model

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designElements.ts`
- Create: `brainrouter-desktop/src/lib/design/designElements.test.ts`
- Modify: `brainrouter-desktop/src/lib/design/prototypeMeta.ts`

**Interfaces:**
- `extractDesignElements(html: string): DesignElement[]`
- `elementRefFor(element: DesignElement): string`
- `applyDraftOperations(html: string, operations: DraftOperation[]): string`
- `DraftOperation = { elementRef: string; property: DraftProperty; value: string | number | boolean }`

- [ ] Write failing tests for deterministic element extraction, stable refs, safe property filtering, and revert-to-base behavior.
- [ ] Run `npx tsx --test src/lib/design/designElements.test.ts` and confirm the new tests fail because the helpers do not exist.
- [ ] Implement tolerant tag/attribute/text extraction with stable `data-testid` preference and deterministic fallback refs based on tag/index.
- [ ] Implement draft application for text, color, font size, font weight, padding, border radius, and visibility without evaluating prototype scripts.
- [ ] Run the focused test file and confirm it passes.

### Task 2: Add Design resource rail and layer tree

**Files:**
- Create: `brainrouter-desktop/src/panels/design/DesignResourceRail.tsx`
- Create: `brainrouter-desktop/src/panels/design/DesignLayerTree.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- `DesignResourceRail({ activeResource, onResourceChange, entries, selected, onSelect })`
- `DesignLayerTree({ elements, selectedRef, onSelect })`

- [ ] Add component tests or pure render-state tests for Files/Assets/Components/Scales switching and selected-row behavior.
- [ ] Run the focused desktop test command and confirm the new behavior is absent before implementation.
- [ ] Implement Files as the flow list, Assets/Components/Scales as derived read-only inventories, and Design as the selected prototype layer tree.
- [ ] Render nested layer indentation, semantic tags, testids, and selected state with accessible buttons.
- [ ] Add CSS matching the screenshot geometry: compact section headers, selected blue/Signal row, divider rhythm, and scrollable rail.
- [ ] Run focused tests and typecheck.

### Task 3: Add center editor stage and bottom toolbar

**Files:**
- Create: `brainrouter-desktop/src/panels/design/DesignBottomToolbar.tsx`
- Modify: `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- `DesignTool = 'select' | 'hand' | 'frame' | 'shape' | 'text' | 'inspect'`
- `DesignBottomToolbar({ tool, onToolChange, zoom, onZoomChange, onFit })`

- [ ] Add tests for tool selection, zoom clamping, and mode reset when the selected flow changes.
- [ ] Implement a browser-style stage header with flow name, device controls, reload, and inspect status.
- [ ] Add toolbar buttons with icon labels, keyboard shortcuts, pressed states, and zoom/fit actions.
- [ ] Add center-stage selection overlay support without intercepting prototype interaction outside inspect/select mode.
- [ ] Verify device switching, reload, and existing preview bridge behavior remain intact.

### Task 4: Add right inspector tabs and direct draft editing

**Files:**
- Create: `brainrouter-desktop/src/panels/design/DesignInspector.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- `InspectorTab = 'design' | 'code' | 'ai'`
- `DesignInspector({ element, operations, onOperationChange, onSave, onRevert, onOpenAi })`

- [ ] Add tests for inspector tab state, supported property changes, save/revert draft serialization, and AI prompt context.
- [ ] Implement Design inspector sections for position/size summary, layout, typography, fill, radius, and visibility.
- [ ] Implement Code inspector with tag, ref, testid, text summary, and source-safe metadata.
- [ ] Implement AI inspector with a scoped handoff action to the existing `DesignChat` controls.
- [ ] Persist drafts per selected prototype/screen using the existing artifact storage/API fallback, with clear saved/unsaved status.
- [ ] Run focused tests and typecheck.

### Task 5: Wire selection and Fix Chat handoff

**Files:**
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignChat.tsx`
- Modify: `brainrouter-desktop/src/lib/design/prototypeMeta.ts`

- [ ] Add a failing integration-level state test proving selected flow, selected element, and draft context reach Fix Chat together.
- [ ] Implement shared selected-element state at the panel boundary and preserve it across Designs inspector tabs.
- [ ] Pass the element ref and draft summary into `buildUiFixPrompt` without changing the existing file safety rules.
- [ ] Ensure switching to Canvas/Brands clears only transient element selection, not saved draft artifacts.
- [ ] Run desktop tests and confirm existing chat refresh behavior.

### Task 6: Update design documentation and verify

**Files:**
- Modify: `docs/design/Design.md`
- Modify: `task.md`
- Modify: `walkthrough.md`

- [ ] Replace placeholder Design.md content with the BrainRouter Memory Instrument editor tokens, layout, typography, component, accessibility, and motion rules.
- [ ] Document the Design tab workflow and supported direct-edit properties.
- [ ] Run `npm run typecheck` from `brainrouter-desktop`.
- [ ] Run focused design tests and the desktop test suite available without unrelated package failures.
- [ ] Run `npm run build` from `brainrouter-desktop` when dependencies are available.
- [ ] Review the rendered UI at desktop and narrow widths, then record evidence in walkthrough.md.

