# Inline Component Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Create component with chat" opens a small inline prompt box at the point you clicked, and the component it generates is placed on the canvas at that point and visible in the Design tree.

**Architecture:** A new `component` annotation kind carries generated markup and renders it inside a fully-sandboxed iframe, so model output is visible on the canvas without ever executing in the renderer origin. The chat popup stops being a centred modal and becomes a small box anchored at the click, in the style of VS Code's inline chat. The resource rail drops to Files and Design.

**Tech Stack:** React 18 + TypeScript (strict), `node:test` + `tsx`, plain CSS.

## Global Constraints

- Pure logic lives in `brainrouter-desktop/src/lib/design/*.ts` and is tested with `node:test` + `tsx`. There is **no** React component test infrastructure (no jsdom/RTL), so `.tsx` is gated on `tsc` + live verification.
- Relative imports carry a `.js` extension. TS strict, but **no** `noUncheckedIndexedAccess` and **no** `exactOptionalPropertyTypes`.
- **Generated markup never runs in the renderer origin.** It renders only inside an iframe with a fully empty `sandbox` attribute (no `allow-scripts`). `design:quick-generate` already rejects `<script>`; that is defence in depth, not the boundary. The sandbox is the boundary.
- Any new annotation field must round-trip through `parseAnnotation`, or it is silently dropped on reload.
- Run tests: `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"`. Typecheck: `npx tsc -p tsconfig.json --noEmit`. Do **not** run `npm test` (its `dist-electron` half has pre-existing Windows failures).
- Commit after each task, Conventional Commits, ending `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File structure

**Modify:**
- `src/lib/design/designAnnotations.ts` + `.test.ts` — the `component` kind and its `html` (Task 1)
- `src/lib/design/annotationStyle.ts` — a component paints its own markup, so no box fill (Task 1)
- `src/panels/design/StageOverlay.tsx` — render the sandboxed component, open the chat at the click (Tasks 2, 4)
- `src/panels/design/QuickComponentChat.tsx` — anchored inline box (Task 3)
- `src/panels/design/DesignResourceRail.tsx` — Files + Design only (Task 5)
- `src/panels/design/DesignsView.tsx` — place the generated component at the click point (Task 4)
- `src/panels/design/designStudio.css` — component + inline chat styling (Tasks 2, 3)
- `docs/design/Design.md` (Task 6)

---

### Task 1: The component annotation

**Files:** `src/lib/design/designAnnotations.ts`, `.test.ts`, `annotationStyle.ts`

**Produces:** `AnnotationKind` gains `'component'`; `DesignAnnotation` gains `html?: string`; `componentAnnotation(name, html, rect)` helper.

- [ ] **Step 1: Write the failing tests** in `designAnnotations.test.ts`:
  - a `component` annotation round-trips through `parseAnnotationStore` with its `html` intact
  - a `component` with missing or blank `html` is dropped by the parser, exactly as a `path` with no `d` is — a component IS its markup
  - `componentAnnotation('Primary button', '<button>Go</button>', rect)` returns kind `component`, the label, and the html
  - a component's default style has no box fill or border (it paints itself)

- [ ] **Step 2: Run to verify they fail.** `npx tsx --test "src/lib/design/designAnnotations.test.ts"` → FAIL, `componentAnnotation` is not exported.

- [ ] **Step 3: Implement.** Add `'component'` to `AnnotationKind` and to the `KINDS` allowlist in the parser. Add `html?: string` to `DesignAnnotation`, carried through `parseAnnotation` next to `path`, with the same "kind requires it" guard:

```ts
if (kind === 'component' && (typeof a.html !== 'string' || !a.html.trim())) return null;
```

Add the helper beside `createAnnotation`:

```ts
/** A component is its markup: generated once, then placed and moved like any
 *  other layer. The markup renders sandboxed — see StageOverlay. */
export function componentAnnotation(name: string, html: string, rect: StageRect): DesignAnnotation {
  return { ...createAnnotation('component', rect, { label: name }), html };
}
```

In `annotationStyle.ts`, add `'component'` to `UNFILLED` and return early from `cssForAnnotation` for it (opacity only), so the frame does not paint a box over its own markup.

- [ ] **Step 4: Run the tests.** Expected PASS.
- [ ] **Step 5: Commit** — `feat(design): a component annotation that carries its markup`.

---

### Task 2: Render it, sandboxed

**Files:** `src/panels/design/StageOverlay.tsx`, `designStudio.css`

- [ ] **Step 1:** In the annotation render, when `a.kind === 'component' && a.html`, render:

```tsx
<iframe className="ds-anno-component" aria-hidden="true" tabIndex={-1} title={a.label || 'Component'}
  sandbox="" srcDoc={a.html} />
```

with a comment stating that the empty `sandbox` — not the `<script>` rejection at generation time — is what makes model output safe here, because this layer lives in the renderer origin that holds the bridge.

- [ ] **Step 2:** CSS: `.ds-anno-component { position:absolute; inset:0; width:100%; height:100%; border:0; background:transparent; pointer-events:none; }`. Pointer-events off so the annotation layer keeps hit-testing, selection and dragging — the component is a picture on the canvas, not a live control.

- [ ] **Step 3:** Give a selected component the same selection ring the other kinds get (it already gets `.is-selected`; confirm the ring is visible over the iframe by giving `.ds-anno--component.is-selected` an `outline`).

- [ ] **Step 4:** Typecheck, commit — `feat(design): render component annotations in a sandbox`.

---

### Task 3: The inline chat box

**Files:** `src/panels/design/QuickComponentChat.tsx`, `designStudio.css`

The current popup is a centred modal over a scrim. It becomes a small box at a point, like VS Code's inline chat: one line of input, a submit affordance, a close affordance, and the model name.

- [ ] **Step 1:** Change the props to `{ at: { x: number; y: number }; onGenerated: (html: string, name: string) => void; onClose: () => void }`. Keep the portal (the canvas is transform-scaled, so a positioned child would inherit the scale).

- [ ] **Step 2:** Position it at `at`, clamped into the viewport the way `DesignContextMenu` clamps — `Math.max(8, Math.min(at.x, window.innerWidth - WIDTH - 8))`, same for y. Width ~360px.

- [ ] **Step 3:** Replace the scrim with a click-outside listener (`pointerdown` capture, ignore clicks inside the box), matching `DesignContextMenu`'s dismissal. Keep Escape-to-close.

- [ ] **Step 4:** Layout: a single-line `<input>` (not a textarea) with placeholder `Describe a component — a primary button, a price card…`, Enter to submit, a `↑` submit button, a `×` close button, and the model name in small mono. Busy state disables the input and shows `Generating…`. Errors render inline under the input.

- [ ] **Step 5:** CSS `.ds-inline-chat` — `position:fixed`, panel background, 1px border, radius, shadow, `z-index:70`. Row layout with the input flexing.

- [ ] **Step 6:** Typecheck, commit — `feat(design): anchor the component chat at the click, VS Code style`.

---

### Task 4: Place the result where it was asked for

**Files:** `src/panels/design/StageOverlay.tsx`, `src/panels/design/DesignsView.tsx`

- [ ] **Step 1:** `onQuickChat` gains the stage point and the client point: `onQuickChat: (at: { x: number; y: number }, stage: StagePoint) => void`. In `applyMenuAction`, the `create-component-chat` branch passes the menu's own coordinates (`m.x`, `m.y` client, `m.point` stage) — the menu already records exactly where the right-click landed.

- [ ] **Step 2:** In `DesignsView`, replace `quickChatOpen: boolean` with `quickChat: { at: { x: number; y: number }; stage: StagePoint } | null`.

- [ ] **Step 3:** On generate, create the component **at the recorded stage point** and select it, instead of only storing it in the document:

```ts
onGenerated={(html, name) => {
  const rect = { x: quickChat.stage.x, y: quickChat.stage.y, w: COMPONENT_W, h: COMPONENT_H };
  const created = componentAnnotation(uniqueComponentName(canvas.document.components, name || 'Component'), html, rect);
  saveComponents(componentFromHtml(created.label, html, { w: rect.w, h: rect.h }));
  changeAnnotations([...annotations, created]);
  setAnnoIds([created.id]);
  setQuickChat(null);
}}
```

with `COMPONENT_W = 320`, `COMPONENT_H = 180` as module constants. Storing the `CanvasComponent` too keeps the document's component library — the layer resolves its name from it and it survives as the reusable record.

- [ ] **Step 4:** The context menu's `create-component-chat` row must be reachable on empty canvas as well as on a shape. It already is (`enabled: true` unconditionally) — verify, do not change.

- [ ] **Step 5:** Typecheck, commit — `feat(design): place a generated component where it was asked for`.

---

### Task 5: Files and Design only

**Files:** `src/panels/design/DesignResourceRail.tsx`, `DesignsView.tsx`

- [ ] **Step 1:** Narrow `DesignResource` to `'files' | 'design'`. Delete the `assets`, `components` and `scales` entries from `RESOURCES`, and delete the `ResourceList`, `ComponentList` and `SavedComponentList` components and the `componentElements` import if it becomes unused.

- [ ] **Step 2:** Keep the `components` and `onDeleteComponent` props **only if** the layer tree still needs them — `canvasLayerRows(annotations, components)` resolves a packed layer's component name, so `components` stays; `onDeleteComponent` becomes unused and goes, along with `COMPONENT_DRAG_TYPE` and the drag/drop handlers in `DesignsView` if nothing else references them. Let `tsc` decide: remove, typecheck, remove what it flags as unused.

- [ ] **Step 3:** In `DesignsView`, every `setResource('components')` must go — those switched to a tab that no longer exists. Replace with nothing (the pack now shows in place, via the layer's own row).

- [ ] **Step 4:** Typecheck, run the suite, commit — `feat(design): cut the resource rail to Files and Design`.

---

### Task 6: Docs and verification

**Files:** `docs/design/Design.md`

- [ ] **Step 1:** Update the resource-rail section: two tabs, and components are canvas objects rather than a library tab.
- [ ] **Step 2:** Document the component annotation and state plainly that the empty `sandbox` is the security boundary for generated markup.
- [ ] **Step 3:** Document the inline chat: anchored at the click, places its result there.
- [ ] **Step 4:** Gates — `npx tsc -p tsconfig.json --noEmit` exit 0; `npx tsx --test "src/**/*.test.ts"` fail 0; `npx vite build` succeeds; `git ls-files --eol` shows `i/lf` for touched files and a NUL scan is clean.
- [ ] **Step 5:** Live verification in the browser preview: the rail shows exactly Files and Design; right-click → "Create component with chat…" opens a box at the pointer, not centred; the box closes on Escape and on an outside click. The dev bridge refuses generation ("needs the desktop app"), so **place a component annotation directly to prove rendering and selection**, and state that end-to-end generation is Electron-only and unverified here.
- [ ] **Step 6:** Commit — `docs(design): inline component chat and the two-tab rail`.

---

## Self-review

**Spec coverage.** Inline popup at the click point → Tasks 3 and 4. Component created and shown on the design → Tasks 1, 2 and 4. A button/text/SVG component → Task 1 carries arbitrary markup; Task 2 renders it. Remove Components/Scales/Assets, keep Files and Design → Task 5.

**Type consistency.** `componentAnnotation` (Task 1) is what Task 4 calls. `StagePoint` is the existing exported type. `DesignResource` narrows in Task 5 and `DesignsView`'s `setResource` calls are fixed in the same task, so the tree never sits broken across a commit.

**Known limitation to state, not hide.** Generated markup is static: the sandbox has no `allow-scripts`, so a generated component is a picture, not a working control. That is the correct trade for markup a model wrote, and it is what makes it safe to render at all.
