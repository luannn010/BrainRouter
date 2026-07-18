# Design Canvas + Working Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Design Studio's Designs stage into a pannable, zoomable, multi-screen canvas whose right-click menu is fully functional.

**Architecture:** The Designs stage stops being a single centred preview and becomes a *world canvas*: a fixed viewport (`overflow:hidden`) containing one absolutely-positioned world layer carrying `translate(pan) scale(zoom)`. Screens (prototypes) are absolutely positioned children read from the already-persisted `CanvasDocument`. Only the selected screen mounts the live `<webview>`/`<iframe>`; the rest render as static, pointer-inert `srcDoc` previews, so a 20-screen board costs one live guest, not twenty. The right-click menu acts on a unified selection spanning screens and annotations, and every previously-greyed row gets a real, tested implementation.

**Tech Stack:** React 18 + TypeScript (strict), Electron `<webview>`, `node:test` + `tsx`, plain CSS.

## Global Constraints

- **No React component test infrastructure exists.** No jsdom, no RTL, no vitest. All logic that needs a test lives in `brainrouter-desktop/src/lib/design/*.ts` and is tested with `node:test` + `tsx`. Pure logic modules must never import a `.tsx` file.
- **tsconfig has strict on, but NOT `noUncheckedIndexedAccess` and NOT `exactOptionalPropertyTypes`.** `array[i]` is typed as `T`, not `T | undefined`. An optional field may be assigned `undefined`.
- **All relative imports must carry a `.js` extension** (e.g. `import { x } from './canvasViewport.js'`), matching every existing module.
- **Never widen a prototype's CSP.** Prototypes ship `default-src 'none'; script-src 'unsafe-inline'`, which permits inline script but NOT `eval`. The browser-preview channel ships resolved data, never code (see `docs/design/Design.md`). Electron's `executeJavaScript` is exempt.
- **Run tests with:** `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"`. Typecheck with `npx tsc -p tsconfig.json --noEmit`. Do NOT run `npm test` — its `dist-electron` half has 6 pre-existing Windows environment failures (PTY spawn, fan-out, webview path policy) that are unrelated to this work.
- **The Electron app cannot be launched from the agent harness.** Verify with `tsc` + `node:test`, and with the browser preview at `npm run dev` (requires `npm run build:deps` first on a fresh worktree).
- **Never `Date.now()`/`Math.random()` in a pure module's *deterministic* output.** Ids may use the existing `crypto.randomUUID()`-with-fallback pattern already in `designAnnotations.ts`; positions and geometry must be deterministic.
- **Commit after every task.** Use Conventional Commits and end the message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Why not literally reuse Atlas

Atlas's canvas is `@xyflow/react` (React Flow) v12 driven with default interactions. It owns **no** camera math, no pan handler, no wheel-zoom-to-cursor math, no drag persistence, and no context menu — those are all library internals. There is nothing in `src/lib/atlas/**` to lift for a canvas.

The repo's own `panels/design/CanvasView.tsx` already implements exactly the pattern we need — zoom-toward-cursor, ctrl+wheel zoom, pointer drag with grid snap, per-node positions persisted to `.brainrouter/design/canvas.json`. Task 1 extracts that math into a shared, tested module and both canvases then consume it. That is the reuse.

## File structure

**Create:**
- `src/lib/design/canvasViewport.ts` + `.test.ts` — pure pan/zoom/coordinate math (Task 1)
- `src/lib/design/designSelection.ts` + `.test.ts` — unified screen+annotation selection (Task 2)
- `src/lib/design/designAutoLayout.ts` + `.test.ts` — auto-layout engine (Task 6)
- `src/lib/design/designOutline.ts` + `.test.ts` — mask tracing, stroke outlining, flatten (Task 7)
- `src/lib/design/designComponents.ts` + `.test.ts` — component records from a selection (Task 10)
- `src/panels/design/DesignScreen.tsx` — one screen frame on the world canvas (Task 4)
- `src/panels/design/QuickComponentChat.tsx` — the popup chat (Task 11)

**Modify:**
- `src/lib/design/canvasModel.ts` + `.test.ts` — schema v2 (Task 3)
- `src/lib/design/designAnnotations.ts` + `.test.ts` — `groupId`, `mask`, `path` kind, group ops (Task 5)
- `src/panels/design/DesignsView.tsx` — the world canvas host (Tasks 4, 9, 10, 11)
- `src/panels/design/PreviewCanvas.tsx` — stop self-sizing (Task 4)
- `src/panels/design/StageOverlay.tsx` — render `path`, masks, multi-selection (Tasks 5, 8)
- `src/panels/design/DesignContextMenu.tsx` — unified targets, every row live (Task 9)
- `src/panels/design/CanvasRulers.tsx` + `src/lib/design/canvasRulers.ts` — pan-aware (Task 4)
- `src/panels/design/CanvasView.tsx` — consume the shared viewport module (Task 1)
- `src/panels/design/designStudio.css` — world canvas layout (Task 4), path/mask/marquee (Task 8), popup (Task 11)
- `electron/host/queries.ts` + `src/devBridge/queries.ts` — `design:quick-generate` (Task 11)
- `docs/design/Design.md` — document the canvas and the menu semantics (Task 12)

**Delete:**
- `src/lib/design/stageMetrics.ts` + `.test.ts` — its only consumer is `PreviewCanvas`, which stops sizing itself in Task 4 (the world transform now carries scale, and the screen frame carries size). Verified sole importer via grep.

## What each menu row will actually mean

The greyed rows exist because they name vector-editor concepts. Each gets an honest definition in this model rather than a stub:

| Row | Definition here |
| :--- | :--- |
| Copy / Cut / Paste / Duplicate | Session clipboard over the unified selection. A screen duplicates as a **new prototype file** (`design:duplicate-prototype`), because `CanvasNode.id` is derived from `prototypeId` and two nodes cannot share one. |
| Delete | Annotations are removed. Screens are **removed from the board** (added to `hiddenPrototypeIds`, restorable) — the HTML file is never deleted. The menu row says so. |
| Bring to front / Send to back | Annotation array order; `CanvasNode.zIndex` for screens. |
| Group selection | Creates a `CanvasGroup` (screens) / sets `groupId` on annotations. Invisible container; moving one member moves the group. |
| Frame selection | Creates a **visible titled `frame` annotation** at the selection bbox + padding and adopts the members into it. This is the real Figma distinction from Group. |
| Add auto layout | Gives a frame `autoLayout {direction, gap, padX, padY, align}`; members are repositioned in order and the frame hugs them. Pure, tested. |
| Use as mask | Marks one annotation `mask: true`; its siblings in the same frame/group render clipped to its geometry via SVG `clipPath`. |
| Flatten | Merges the selection into one `path` annotation whose `d` concatenates each member's outline as a subpath — matching Figma, where flatten yields one vector object with multiple subpaths. |
| Outline text | Rasterises the text annotation to an offscreen alpha mask and **traces real glyph contours** with marching squares, producing a `path` annotation. Not line boxes — actual outlines. The tracer is pure and tested against synthetic masks; only rasterisation touches the DOM. |
| Outline stroke | Converts a stroked shape into a filled `path`: outer ring + inner ring as two subpaths (a single quad for a line). Pure, tested. |
| Create component | Promotes the selection to a `CanvasComponent` persisted in `CanvasDocument` v2; it appears in the Components rail and can be dragged onto the canvas. |
| Create component with chat | Opens a compact popup; the prompt goes to the model configured in app settings via a new one-shot `design:quick-generate` query (mirrors the existing `write-inline-ai` handler), and the returned HTML becomes a component. |
| Show/Hide, Lock/Unlock | Already real for annotations; extended to screens (`CanvasNode.hidden`/`locked`) and to multi-selection. |
| Flip H/V | Already real for annotations; extended to screens (`CanvasNode.flipX`/`flipY`, rendered as `scaleX(-1)`). |

---

### Task 1: Shared viewport math

**Files:**
- Create: `brainrouter-desktop/src/lib/design/canvasViewport.ts`
- Test: `brainrouter-desktop/src/lib/design/canvasViewport.test.ts`
- Modify: `brainrouter-desktop/src/panels/design/CanvasView.tsx`

**Interfaces:**
- Produces: `Viewport {scale, x, y}`, `ViewPoint {x,y}`, `ViewBounds {x,y,w,h}`, `MIN_SCALE`, `MAX_SCALE`, `clampScale`, `zoomAt`, `panBy`, `screenToWorld`, `worldToScreen`, `fitBounds`, `wheelGesture`, `snapTo`. Tasks 2, 4, 9 consume these.

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/canvasViewport.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCALE, MIN_SCALE, clampScale, fitBounds, panBy, screenToWorld,
  snapTo, wheelGesture, worldToScreen, zoomAt,
} from './canvasViewport.js';

test('zoom keeps the point under the cursor pinned', () => {
  const view = { scale: 1, x: 0, y: 0 };
  const before = screenToWorld(view, 300, 200);
  const zoomed = zoomAt(view, 2, 300, 200);
  const after = screenToWorld(zoomed, 300, 200);
  assert.equal(zoomed.scale, 2);
  assert.ok(Math.abs(after.x - before.x) < 1e-9);
  assert.ok(Math.abs(after.y - before.y) < 1e-9);
});

test('zoom clamps and leaves the viewport untouched at the limit', () => {
  const atMax = { scale: MAX_SCALE, x: 10, y: 20 };
  assert.deepEqual(zoomAt(atMax, 2, 0, 0), atMax);
  assert.equal(clampScale(1000), MAX_SCALE);
  assert.equal(clampScale(0), MIN_SCALE);
});

test('screen and world coordinates round-trip through any viewport', () => {
  const view = { scale: 0.75, x: -120, y: 64 };
  const world = screenToWorld(view, 410, 260);
  const screen = worldToScreen(view, world.x, world.y);
  assert.ok(Math.abs(screen.x - 410) < 1e-9);
  assert.ok(Math.abs(screen.y - 260) < 1e-9);
});

test('panning shifts the world without touching scale', () => {
  assert.deepEqual(panBy({ scale: 2, x: 5, y: 5 }, 10, -4), { scale: 2, x: 15, y: 1 });
});

test('fit centres the bounds inside the viewport and never zooms past 1', () => {
  const view = fitBounds({ x: 0, y: 0, w: 1000, h: 500 }, 600, 400, 50);
  assert.equal(view.scale, 0.5); // (600-100)/1000 = 0.5 is tighter than (400-100)/500
  assert.equal(view.x, (600 - 1000 * 0.5) / 2);
  assert.equal(view.y, (400 - 500 * 0.5) / 2);
  assert.ok(fitBounds({ x: 0, y: 0, w: 10, h: 10 }, 600, 400).scale <= 1);
});

test('fit survives an empty or degenerate bounds', () => {
  const view = fitBounds({ x: 0, y: 0, w: 0, h: 0 }, 600, 400);
  assert.ok(Number.isFinite(view.scale) && view.scale > 0);
  assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y));
});

test('ctrl or meta wheel zooms, plain wheel pans, shift wheel pans sideways', () => {
  assert.deepEqual(wheelGesture({ deltaX: 0, deltaY: -100, ctrlKey: true, metaKey: false, shiftKey: false }), { kind: 'zoom', factor: 1.1 });
  assert.deepEqual(wheelGesture({ deltaX: 0, deltaY: 100, ctrlKey: false, metaKey: true, shiftKey: false }), { kind: 'zoom', factor: 1 / 1.1 });
  assert.deepEqual(wheelGesture({ deltaX: 3, deltaY: 40, ctrlKey: false, metaKey: false, shiftKey: false }), { kind: 'pan', dx: -3, dy: -40 });
  assert.deepEqual(wheelGesture({ deltaX: 0, deltaY: 40, ctrlKey: false, metaKey: false, shiftKey: true }), { kind: 'pan', dx: -40, dy: 0 });
});

test('snapping rounds to the grid and passes values through when snapping is off', () => {
  assert.equal(snapTo(37, 24), 48);
  assert.equal(snapTo(-37, 24), -48);
  assert.equal(snapTo(37, 1), 37);
  assert.equal(snapTo(37, 0), 37);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/canvasViewport.test.ts"`
Expected: FAIL — `Cannot find module './canvasViewport.js'`.

- [ ] **Step 3: Write the implementation**

Create `brainrouter-desktop/src/lib/design/canvasViewport.ts`:

```ts
// brainrouter-desktop/src/lib/design/canvasViewport.ts
// Pan/zoom math shared by the Canvas tab and the Designs stage, so a gesture
// means the same thing on both surfaces. Pure: no DOM, no React.
//
// A Viewport maps world space to screen space as `screen = world * scale + (x, y)`.
// `x`/`y` are the screen-space position of the world origin — exactly what the
// world layer's `translate(x, y) scale(scale)` renders, in that order.

export interface Viewport {
  /** Screen px per world px. */
  scale: number;
  /** Screen-space x of the world origin. */
  x: number;
  /** Screen-space y of the world origin. */
  y: number;
}

export interface ViewPoint { x: number; y: number }
export interface ViewBounds { x: number; y: number; w: number; h: number }

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

/** One wheel notch. Matches the Canvas tab's long-standing feel. */
const ZOOM_STEP = 1.1;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Zoom about a screen-space anchor, keeping the world point under that anchor
 * fixed. Returns the same object identity semantics as the input when the scale
 * is already at a limit, so callers can skip a re-render.
 */
export function zoomAt(view: Viewport, factor: number, cx: number, cy: number): Viewport {
  const scale = clampScale(view.scale * factor);
  if (scale === view.scale) return view;
  const ratio = scale / view.scale;
  return { scale, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio };
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { scale: view.scale, x: view.x + dx, y: view.y + dy };
}

export function screenToWorld(view: Viewport, cx: number, cy: number): ViewPoint {
  return { x: (cx - view.x) / view.scale, y: (cy - view.y) / view.scale };
}

export function worldToScreen(view: Viewport, wx: number, wy: number): ViewPoint {
  return { x: wx * view.scale + view.x, y: wy * view.scale + view.y };
}

/**
 * Frame `bounds` inside a viewW x viewH viewport. Never magnifies past 1:1 —
 * a single small screen should sit at natural size rather than filling the wall.
 */
export function fitBounds(bounds: ViewBounds, viewW: number, viewH: number, padding = 48): Viewport {
  const w = Math.max(1, bounds.w);
  const h = Math.max(1, bounds.h);
  const availW = Math.max(1, viewW - padding * 2);
  const availH = Math.max(1, viewH - padding * 2);
  const scale = clampScale(Math.min(availW / w, availH / h, 1));
  return {
    scale,
    x: (viewW - w * scale) / 2 - bounds.x * scale,
    y: (viewH - h * scale) / 2 - bounds.y * scale,
  };
}

export type WheelGesture =
  | { kind: 'zoom'; factor: number }
  | { kind: 'pan'; dx: number; dy: number };

/**
 * Interpret a wheel event. Ctrl/Cmd + wheel zooms (this is also what a trackpad
 * pinch reports); plain wheel pans; Shift + wheel pans sideways off deltaY,
 * which is how mice without a horizontal wheel scroll horizontally.
 */
export function wheelGesture(e: { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): WheelGesture {
  if (e.ctrlKey || e.metaKey) return { kind: 'zoom', factor: e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP };
  if (e.shiftKey) return { kind: 'pan', dx: -e.deltaY, dy: 0 };
  return { kind: 'pan', dx: -e.deltaX, dy: -e.deltaY };
}

/** Round to the grid. A grid of 0 or 1 means "no snapping". */
export function snapTo(value: number, grid: number): number {
  if (!Number.isFinite(grid) || grid <= 1) return value;
  return Math.round(value / grid) * grid;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/canvasViewport.test.ts"`
Expected: PASS, 8 tests.

- [ ] **Step 5: Point CanvasView at the shared module**

In `brainrouter-desktop/src/panels/design/CanvasView.tsx`, add the import:

```ts
import { fitBounds, panBy, screenToWorld, snapTo, wheelGesture, zoomAt, type Viewport } from '../../lib/design/canvasViewport.js';
```

Replace the local `MIN_ZOOM`/`MAX_ZOOM`/`clamp` constants and the `zoomAt`/`onWheel` bodies with calls into the module, keeping CanvasView's existing separate `zoom`/`pan` state by adapting at the call boundary:

```ts
  const zoomAtPoint = useCallback((factor: number, cx: number, cy: number) => {
    setZoom((z) => {
      const next = zoomAt({ scale: z, x: panRef.current.x, y: panRef.current.y }, factor, cx, cy);
      if (next.scale === z) return z;
      setPan({ x: next.x, y: next.y });
      return next.scale;
    });
  }, []);
```

Add `const panRef = useRef(pan); panRef.current = pan;` just below the `pan` state so the zoom callback reads the live pan without re-creating itself every pan.

Rewrite `onWheel`:

```ts
  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const gesture = wheelGesture(e);
    if (gesture.kind === 'zoom') zoomAtPoint(gesture.factor, e.clientX - rect.left, e.clientY - rect.top);
    else setPan((p) => ({ x: p.x + gesture.dx, y: p.y + gesture.dy }));
  };
```

Replace the grid-snap expression in `onPointerMove` with `snapTo`:

```ts
      const grid = canvas.document.preferences.snapEnabled ? canvas.document.preferences.gridSize : 1;
      const next = { x: snapTo(raw.x, grid), y: snapTo(raw.y, grid) };
```

Replace every remaining `zoomAt(` call site with `zoomAtPoint(`, and replace the body of `fit` with:

```ts
  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const { w, h } = worldSize(nodesForSize);
    const view = fitBounds({ x: 0, y: 0, w, h }, host.clientWidth, host.clientHeight, 32);
    setZoom(view.scale);
    setPan({ x: view.x, y: view.y });
  }, [nodesForSize]);
```

- [ ] **Step 6: Verify the whole suite and the types**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit`
Expected: exit 0, no output.

Run: `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"`
Expected: `pass 417`, `fail 0` (409 before + 8 new).

- [ ] **Step 7: Commit**

```bash
git add brainrouter-desktop/src/lib/design/canvasViewport.ts brainrouter-desktop/src/lib/design/canvasViewport.test.ts brainrouter-desktop/src/panels/design/CanvasView.tsx
git commit -m "feat(design): extract shared canvas viewport math

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Unified selection model

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designSelection.ts`
- Test: `brainrouter-desktop/src/lib/design/designSelection.test.ts`

**Interfaces:**
- Consumes: `ViewBounds` from Task 1.
- Produces: `SelectionRef {kind, id}`, `Selection` (`readonly SelectionRef[]`), `SelectableItem {kind, id, bounds}`, `isSelected`, `toggleSelection`, `selectOnly`, `idsOfKind`, `rectsIntersect`, `marqueeSelect`, `selectionBounds`, `sameRef`. Tasks 4 and 9 consume these.

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/designSelection.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  idsOfKind, isSelected, marqueeSelect, rectsIntersect, sameRef,
  selectOnly, selectionBounds, toggleSelection, type SelectableItem,
} from './designSelection.js';

const items: SelectableItem[] = [
  { kind: 'screen', id: 'home', bounds: { x: 0, y: 0, w: 380, h: 654 } },
  { kind: 'screen', id: 'about', bounds: { x: 480, y: 0, w: 380, h: 654 } },
  { kind: 'annotation', id: 'a1', bounds: { x: 40, y: 40, w: 100, h: 40 } },
];

test('toggle adds then removes a ref and never duplicates it', () => {
  const one = toggleSelection([], { kind: 'screen', id: 'home' });
  assert.equal(one.length, 1);
  const twice = toggleSelection(one, { kind: 'screen', id: 'home' });
  assert.deepEqual(twice, []);
  const both = toggleSelection(one, { kind: 'annotation', id: 'home' });
  assert.equal(both.length, 2, 'same id in a different kind is a different object');
});

test('selectOnly replaces the selection and clears on null', () => {
  assert.deepEqual(selectOnly({ kind: 'screen', id: 'home' }), [{ kind: 'screen', id: 'home' }]);
  assert.deepEqual(selectOnly(null), []);
});

test('membership tests are kind-aware', () => {
  const sel = selectOnly({ kind: 'screen', id: 'home' });
  assert.equal(isSelected(sel, 'screen', 'home'), true);
  assert.equal(isSelected(sel, 'annotation', 'home'), false);
  assert.equal(sameRef({ kind: 'screen', id: 'a' }, { kind: 'screen', id: 'a' }), true);
  assert.equal(sameRef({ kind: 'screen', id: 'a' }, { kind: 'annotation', id: 'a' }), false);
});

test('idsOfKind extracts one kind in selection order', () => {
  const sel = [
    { kind: 'annotation' as const, id: 'a1' },
    { kind: 'screen' as const, id: 'home' },
    { kind: 'annotation' as const, id: 'a2' },
  ];
  assert.deepEqual(idsOfKind(sel, 'annotation'), ['a1', 'a2']);
  assert.deepEqual(idsOfKind(sel, 'screen'), ['home']);
});

test('rect intersection is inclusive of touching edges but excludes separated rects', () => {
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), true);
  assert.equal(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 }), false);
});

test('a marquee selects every item it touches', () => {
  assert.deepEqual(marqueeSelect(items, { x: -10, y: -10, w: 60, h: 60 }), [
    { kind: 'screen', id: 'home' },
    { kind: 'annotation', id: 'a1' },
  ]);
  assert.deepEqual(marqueeSelect(items, { x: 900, y: 900, w: 10, h: 10 }), []);
});

test('selection bounds union every selected item and ignore the rest', () => {
  const sel = [{ kind: 'screen' as const, id: 'home' }, { kind: 'annotation' as const, id: 'a1' }];
  assert.deepEqual(selectionBounds(items, sel), { x: 0, y: 0, w: 380, h: 654 });
  assert.equal(selectionBounds(items, []), null);
  assert.equal(selectionBounds(items, [{ kind: 'screen', id: 'ghost' }]), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/designSelection.test.ts"`
Expected: FAIL — `Cannot find module './designSelection.js'`.

- [ ] **Step 3: Write the implementation**

Create `brainrouter-desktop/src/lib/design/designSelection.ts`:

```ts
// brainrouter-desktop/src/lib/design/designSelection.ts
// One selection model spanning both kinds of thing on the design canvas:
// screens (prototype frames in world space) and annotations (shapes drawn
// inside a screen). The context menu acts on this, so it never has to ask
// which of two selection states is the live one.
import type { ViewBounds } from './canvasViewport.js';

export type SelectionKind = 'screen' | 'annotation';

export interface SelectionRef {
  kind: SelectionKind;
  id: string;
}

export type Selection = readonly SelectionRef[];

export interface SelectableItem extends SelectionRef {
  bounds: ViewBounds;
}

export function sameRef(a: SelectionRef, b: SelectionRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function isSelected(selection: Selection, kind: SelectionKind, id: string): boolean {
  return selection.some((ref) => ref.kind === kind && ref.id === id);
}

/** Shift-click semantics: in the set, remove it; out of it, append it. */
export function toggleSelection(selection: Selection, ref: SelectionRef): Selection {
  return isSelected(selection, ref.kind, ref.id)
    ? selection.filter((item) => !sameRef(item, ref))
    : [...selection, { kind: ref.kind, id: ref.id }];
}

export function selectOnly(ref: SelectionRef | null): Selection {
  return ref ? [{ kind: ref.kind, id: ref.id }] : [];
}

export function idsOfKind(selection: Selection, kind: SelectionKind): string[] {
  return selection.filter((ref) => ref.kind === kind).map((ref) => ref.id);
}

export function rectsIntersect(a: ViewBounds, b: ViewBounds): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/** Rubber-band selection: touching counts, matching how Figma's marquee behaves. */
export function marqueeSelect(items: readonly SelectableItem[], marquee: ViewBounds): Selection {
  return items.filter((item) => rectsIntersect(item.bounds, marquee)).map((item) => ({ kind: item.kind, id: item.id }));
}

/** Union of the selected items' boxes, or null when nothing selected resolves. */
export function selectionBounds(items: readonly SelectableItem[], selection: Selection): ViewBounds | null {
  const chosen = items.filter((item) => isSelected(selection, item.kind, item.id));
  if (chosen.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of chosen) {
    minX = Math.min(minX, item.bounds.x);
    minY = Math.min(minY, item.bounds.y);
    maxX = Math.max(maxX, item.bounds.x + item.bounds.w);
    maxY = Math.max(maxY, item.bounds.y + item.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/designSelection.test.ts"`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/lib/design/designSelection.ts brainrouter-desktop/src/lib/design/designSelection.test.ts
git commit -m "feat(design): unified screen and annotation selection model

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Canvas document schema v2

**Files:**
- Modify: `brainrouter-desktop/src/lib/design/canvasModel.ts`
- Modify: `brainrouter-desktop/src/lib/design/canvasModel.test.ts`

**Interfaces:**
- Produces: `CANVAS_SCHEMA_VERSION = 2`; `CanvasNode` gains `hidden?`, `locked?`, `flipX?`, `flipY?`; `CanvasGroup` gains `autoLayout?: CanvasAutoLayout`; `CanvasDocument` gains `components: CanvasComponent[]`; new `CanvasAutoLayout` and `CanvasComponent`. `validateCanvasDocument` now accepts a v1 document and upgrades it. Tasks 4, 6, 9, 10 consume these.

Existing v1 documents are on real users' disks at `.brainrouter/design/canvas.json`. Rejecting them would silently reset every board, so the validator upgrades instead.

- [ ] **Step 1: Write the failing tests**

Append to `brainrouter-desktop/src/lib/design/canvasModel.test.ts`:

```ts
test('a v1 document upgrades to v2 with an empty component list', () => {
  const v1 = {
    version: 1,
    nodes: [{ id: 'prototype:home', prototypeId: 'home', position: { x: 12, y: 24 }, width: 380, height: 654, zIndex: 0 }],
    groups: [], edges: [], annotations: [], hiddenPrototypeIds: [],
    preferences: { layoutMode: 'manual', gridEnabled: true, snapEnabled: true, gridSize: 24 },
  };
  const parsed = validateCanvasDocument(v1);
  assert.equal(parsed.version, CANVAS_SCHEMA_VERSION);
  assert.deepEqual(parsed.components, []);
  assert.deepEqual(parsed.nodes[0].position, { x: 12, y: 24 }, 'the upgrade preserves placement');
});

test('node state flags survive a round trip and default to unset', () => {
  const doc = createCanvasDocument([{ id: 'home' }]);
  const flagged = validateCanvasDocument({
    ...doc,
    nodes: [{ ...doc.nodes[0], hidden: true, locked: true, flipX: true, flipY: false }],
  });
  assert.equal(flagged.nodes[0].hidden, true);
  assert.equal(flagged.nodes[0].locked, true);
  assert.equal(flagged.nodes[0].flipX, true);
  assert.equal(flagged.nodes[0].flipY, undefined, 'a false flag is dropped rather than stored');
  assert.equal(validateCanvasDocument(doc).nodes[0].hidden, undefined);
});

test('a group carries an optional auto layout spec', () => {
  const doc = createCanvasDocument([{ id: 'home' }]);
  const withGroup = validateCanvasDocument({
    ...doc,
    groups: [{
      id: 'g1', name: 'Row', position: { x: 0, y: 0 }, width: 100, height: 100, collapsed: false,
      autoLayout: { direction: 'row', gap: 16, padX: 8, padY: 8, align: 'center' },
    }],
  });
  assert.deepEqual(withGroup.groups[0].autoLayout, { direction: 'row', gap: 16, padX: 8, padY: 8, align: 'center' });
  assert.throws(() => validateCanvasDocument({
    ...doc,
    groups: [{ id: 'g1', name: 'Row', position: { x: 0, y: 0 }, width: 100, height: 100, collapsed: false, autoLayout: { direction: 'diagonal', gap: 1, padX: 1, padY: 1, align: 'center' } }],
  }), /autoLayout.direction/);
});

test('components are validated and kept', () => {
  const doc = createCanvasDocument([{ id: 'home' }]);
  const withComponent = validateCanvasDocument({
    ...doc,
    components: [{ id: 'c1', name: 'Primary button', html: '<button>Go</button>', width: 120, height: 40 }],
  });
  assert.equal(withComponent.components.length, 1);
  assert.equal(withComponent.components[0].name, 'Primary button');
  assert.throws(() => validateCanvasDocument({ ...doc, components: [{ id: '', name: 'x', html: 'y', width: 1, height: 1 }] }), /components\[0\].id/);
  assert.throws(() => validateCanvasDocument({ ...doc, components: [{ id: 'c1', name: 'x', html: 'y', width: 0, height: 1 }] }), /components\[0\].width/);
});

test('a future schema version is still rejected', () => {
  assert.throws(() => validateCanvasDocument({ version: 99 }), /unsupported Canvas schema/);
});
```

Update the existing import line at the top of the file to include `CANVAS_SCHEMA_VERSION` if it is not already imported.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/canvasModel.test.ts"`
Expected: FAIL — the v1 upgrade test fails with `unsupported Canvas schema version: 1`.

- [ ] **Step 3: Implement the schema change**

In `brainrouter-desktop/src/lib/design/canvasModel.ts`, change the version constant and add the new types:

```ts
export const CANVAS_SCHEMA_VERSION = 2 as const;
/** Versions this build can read. v1 documents are upgraded on load. */
const READABLE_VERSIONS = new Set([1, 2]);

export type AutoLayoutDirection = 'row' | 'column';
export type AutoLayoutAlign = 'start' | 'center' | 'end';

export interface CanvasAutoLayout {
  direction: AutoLayoutDirection;
  gap: number;
  padX: number;
  padY: number;
  align: AutoLayoutAlign;
}

/** A reusable snippet promoted from a selection or generated from a prompt. */
export interface CanvasComponent {
  id: string;
  name: string;
  html: string;
  width: number;
  height: number;
}
```

Extend `CanvasNode` and `CanvasGroup` and `CanvasDocument`:

```ts
export interface CanvasNode {
  id: string;
  prototypeId: string;
  position: CanvasPoint;
  width: number;
  height: number;
  groupId?: string;
  zIndex: number;
  hidden?: boolean;
  locked?: boolean;
  flipX?: boolean;
  flipY?: boolean;
}

export interface CanvasGroup {
  id: string;
  name: string;
  position: CanvasPoint;
  width: number;
  height: number;
  collapsed: boolean;
  autoLayout?: CanvasAutoLayout;
}

export interface CanvasDocument {
  version: typeof CANVAS_SCHEMA_VERSION;
  nodes: CanvasNode[];
  groups: CanvasGroup[];
  edges: CanvasEdge[];
  annotations: CanvasAnnotation[];
  /** Prototype ids intentionally kept out of the board but available to restore. */
  hiddenPrototypeIds: string[];
  components: CanvasComponent[];
  preferences: CanvasPreferences;
}
```

Add these helpers next to the existing private `finite`/`point`/`stringField` helpers:

```ts
/** Optional booleans are stored only when true, so documents stay small. */
function flag(value: unknown): boolean | undefined {
  return value === true ? true : undefined;
}

function autoLayout(value: unknown, field: string): CanvasAutoLayout | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') throw new Error(`${field} must be an object`);
  const raw = value as Record<string, unknown>;
  if (raw.direction !== 'row' && raw.direction !== 'column') throw new Error(`${field}.direction must be row or column`);
  if (raw.align !== 'start' && raw.align !== 'center' && raw.align !== 'end') throw new Error(`${field}.align must be start, center or end`);
  return {
    direction: raw.direction,
    gap: finite(raw.gap, `${field}.gap`),
    padX: finite(raw.padX, `${field}.padX`),
    padY: finite(raw.padY, `${field}.padY`),
    align: raw.align,
  };
}

function components(value: unknown): CanvasComponent[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('components must be an array');
  return value.map((entry, i) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    const width = finite(raw.width, `components[${i}].width`);
    const height = finite(raw.height, `components[${i}].height`);
    if (width <= 0) throw new Error(`components[${i}].width must be positive`);
    if (height <= 0) throw new Error(`components[${i}].height must be positive`);
    return {
      id: stringField(raw.id, `components[${i}].id`),
      name: stringField(raw.name, `components[${i}].name`),
      html: stringField(raw.html, `components[${i}].html`),
      width,
      height,
    };
  });
}
```

In `validateCanvasDocument`, replace the version check and add the new fields. The version guard becomes:

```ts
  const version = (value as Record<string, unknown>).version;
  if (typeof version !== 'number' || !READABLE_VERSIONS.has(version)) {
    throw new Error(`unsupported Canvas schema version: ${String(version)}`);
  }
```

In the node mapper, append the four flags (only when true, so `false` is dropped):

```ts
    hidden: flag(raw.hidden),
    locked: flag(raw.locked),
    flipX: flag(raw.flipX),
    flipY: flag(raw.flipY),
```

In the group mapper, append `autoLayout: autoLayout(raw.autoLayout, \`groups[${i}].autoLayout\`),`.

In the returned document, set `version: CANVAS_SCHEMA_VERSION` (not the input version — this is where the upgrade happens) and add `components: components((value as Record<string, unknown>).components),`.

In `createCanvasDocument`, add `components: [],` to the returned object.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/canvasModel.test.ts"`
Expected: PASS, 10 tests (5 existing + 5 new).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit`
Expected: exit 0. If `CanvasView.tsx` errors on the new required `components` field, it constructs a document literal — add `components: canvas.document.components` to that literal.

Run: `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"`
Expected: `pass 422`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add brainrouter-desktop/src/lib/design/canvasModel.ts brainrouter-desktop/src/lib/design/canvasModel.test.ts brainrouter-desktop/src/panels/design/CanvasView.tsx
git commit -m "feat(design): canvas schema v2 with components, node flags and auto layout

Upgrades v1 documents on read rather than rejecting them, so an existing
board on disk survives the change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Pan-aware rulers

**Files:**
- Modify: `brainrouter-desktop/src/lib/design/canvasRulers.ts`
- Modify: `brainrouter-desktop/src/lib/design/canvasRulers.test.ts`
- Modify: `brainrouter-desktop/src/panels/design/CanvasRulers.tsx`

**Interfaces:**
- Produces: `rulerStep(scale, minSpacing?)`, `rulerTicks(length, scale, origin?, step?)`. `CanvasRulers` takes `{ view: Viewport; width: number; height: number }`.

The current ruler assumes a fixed 2400px world starting at screen 0 and a zoom *percentage*. On a pannable world it must start wherever the world origin currently sits and pick a tick pitch that doesn't crowd at low zoom.

- [ ] **Step 1: Replace the test file**

Overwrite `brainrouter-desktop/src/lib/design/canvasRulers.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { rulerStep, rulerTicks } from './canvasRulers.js';

test('the tick pitch grows as the canvas zooms out so labels never crowd', () => {
  assert.equal(rulerStep(1), 100);
  assert.equal(rulerStep(0.2), 500);
  assert.ok(rulerStep(0.02) >= 2500);
  assert.ok(rulerStep(4) <= 25);
});

test('ticks span the visible length and carry world values', () => {
  const ticks = rulerTicks(600, 1, 0, 100);
  assert.deepEqual(ticks[0], { value: 0, offset: 0 });
  assert.equal(ticks[ticks.length - 1].offset <= 600, true);
  assert.equal(ticks.every((tick) => tick.offset >= 0), true);
});

test('panning shifts the ticks and exposes negative world values', () => {
  const ticks = rulerTicks(600, 1, -250, 100);
  assert.equal(ticks[0].value, 250, 'the first visible tick is 250 world px in');
  assert.equal(ticks[0].offset, 0);
});

test('zooming scales the spacing between ticks', () => {
  const ticks = rulerTicks(600, 0.5, 0, 100);
  assert.equal(ticks[1].offset - ticks[0].offset, 50);
});

test('degenerate inputs return a finite, bounded tick list', () => {
  assert.deepEqual(rulerTicks(0, 1, 0, 100), [{ value: 0, offset: 0 }]);
  assert.equal(rulerTicks(600, 0, 0, 100).length > 0, true);
  assert.ok(rulerTicks(1e6, 1, 0, 1).length <= 512, 'a tiny explicit pitch is capped, not hung on');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/canvasRulers.test.ts"`
Expected: FAIL — `rulerStep` is not exported.

- [ ] **Step 3: Rewrite the module**

Overwrite `brainrouter-desktop/src/lib/design/canvasRulers.ts`:

```ts
// brainrouter-desktop/src/lib/design/canvasRulers.ts
// Ruler ticks for a pannable, zoomable world. `origin` is the screen-space
// position of world 0 — the same number the world layer translates by — so the
// ruler and the canvas can never disagree about where the origin is.
export type RulerTick = { value: number; offset: number };

/** Pitches a designer reads without counting. */
const STEPS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000];
/** Hard stop so a pathological pitch can't spin the render loop. */
const MAX_TICKS = 512;

/** The smallest pitch whose on-screen spacing clears `minSpacing`. */
export function rulerStep(scale: number, minSpacing = 64): number {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  for (const step of STEPS) if (step * safe >= minSpacing) return step;
  return STEPS[STEPS.length - 1];
}

export function rulerTicks(length: number, scale: number, origin = 0, step?: number): RulerTick[] {
  const safeLength = Math.max(0, length);
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pitch = step !== undefined && step > 0 ? step : rulerStep(safeScale);
  const first = Math.ceil((0 - origin) / safeScale / pitch) * pitch;
  const ticks: RulerTick[] = [];
  for (let value = first; ticks.length < MAX_TICKS; value += pitch) {
    const offset = value * safeScale + origin;
    if (offset > safeLength) break;
    ticks.push({ value, offset });
  }
  return ticks;
}
```

- [ ] **Step 4: Rewrite the component**

Overwrite `brainrouter-desktop/src/panels/design/CanvasRulers.tsx`:

```tsx
import React from 'react';
import { rulerTicks } from '../../lib/design/canvasRulers.js';
import type { Viewport } from '../../lib/design/canvasViewport.js';

export function CanvasRulers({ view, width, height }: { view: Viewport; width: number; height: number }): React.ReactElement {
  const across = rulerTicks(width, view.scale, view.x);
  const down = rulerTicks(height, view.scale, view.y);
  return <>
    <div className="ds-ruler ds-ruler--top" aria-hidden="true">
      {across.map((tick) => <span key={`x-${tick.value}`} className="ds-ruler-tick" style={{ left: tick.offset }}><b>{tick.value}</b></span>)}
    </div>
    <div className="ds-ruler ds-ruler--right" aria-hidden="true">
      {down.map((tick) => <span key={`y-${tick.value}`} className="ds-ruler-tick" style={{ top: tick.offset }}><b>{tick.value}</b></span>)}
    </div>
  </>;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/canvasRulers.test.ts"`
Expected: PASS, 5 tests. (Typecheck will still fail until Task 5 updates the `CanvasRulers` call site — that is expected; do not run `tsc` here.)

- [ ] **Step 6: Commit**

```bash
git add brainrouter-desktop/src/lib/design/canvasRulers.ts brainrouter-desktop/src/lib/design/canvasRulers.test.ts brainrouter-desktop/src/panels/design/CanvasRulers.tsx
git commit -m "feat(design): pan-aware rulers with an adaptive tick pitch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: The world canvas

This is the load-bearing task: the Designs stage stops being a centred preview and becomes a world canvas hosting every screen.

**Files:**
- Create: `brainrouter-desktop/src/panels/design/DesignScreen.tsx`
- Modify: `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`
- Delete: `brainrouter-desktop/src/lib/design/stageMetrics.ts`, `brainrouter-desktop/src/lib/design/stageMetrics.test.ts`

**Interfaces:**
- Consumes: `Viewport`, `zoomAt`, `panBy`, `screenToWorld`, `fitBounds`, `wheelGesture`, `snapTo` (Task 1); `Selection`, `selectOnly`, `toggleSelection`, `marqueeSelect`, `selectionBounds`, `idsOfKind` (Task 2); `CanvasNode`, `CanvasDocument` (Task 3); `useCanvasDocument`, `useCanvasFrames`.
- Produces: `DesignScreen` component; `DEVICE_SIZE` exported from `DesignScreen.tsx`.

- [ ] **Step 1: Strip self-sizing out of PreviewCanvas**

In `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx`:
- Delete the `import { computeStageMetrics } from '../../lib/design/stageMetrics.js';` line.
- Delete the `zoom` and `shellSize` props from the component's props type and destructuring (leave `workspaceRoot`, `selected`, `device`, `overlay`, `onWebviewReady`).
- Delete the `DEVICE_W` constant and the `maxW` derivation if they are now unused.
- Replace the returned JSX (the `.ds-preview` / `.ds-stage-zoom` / `.ds-stage` nest) with the single element the screen frame now sizes:

```tsx
  return <div className={`ds-stage ds-stage--${device}`} ref={hostRef}>{overlay}</div>;
```

The webview/iframe already sets `width:100%;height:100%`, so it fills whatever the screen frame gives it. Zoom is now the world transform's job.

- [ ] **Step 2: Delete the dead sizing module**

```bash
git rm brainrouter-desktop/src/lib/design/stageMetrics.ts brainrouter-desktop/src/lib/design/stageMetrics.test.ts
```

Verify nothing still imports it:

Run: `cd brainrouter-desktop && npx tsx -e "0"` then `grep -rn "stageMetrics" src/ electron/`
Expected: only the stale comment in `DesignsView.tsx:51`, which Step 4 rewrites.

- [ ] **Step 3: Create the screen frame**

Create `brainrouter-desktop/src/panels/design/DesignScreen.tsx`:

```tsx
// brainrouter-desktop/src/panels/design/DesignScreen.tsx
// One screen on the design canvas. Only the active screen gets the live
// webview (passed in as children); the rest render a static, pointer-inert
// snapshot, so a twenty-screen board still costs exactly one live guest.
import React from 'react';
import { Icon } from '../../icons.js';
import type { CanvasNode } from '../../lib/design/canvasModel.js';
import type { Device } from './PreviewCanvas.js';

export const DEVICE_SIZE: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  tablet: { w: 820, h: 1180 },
  phone: { w: 390, h: 844 },
};

export function DesignScreen({ node, title, content, active, selected, children }: {
  node: CanvasNode;
  title: string;
  content: string | null;
  active: boolean;
  selected: boolean;
  children?: React.ReactNode;
}): React.ReactElement | null {
  if (node.hidden) return null;
  const flips = [node.flipX ? 'scaleX(-1)' : '', node.flipY ? 'scaleY(-1)' : ''].filter(Boolean).join(' ');
  const classes = ['ds-screen', selected ? 'is-selected' : '', active ? 'is-active' : '', node.locked ? 'is-locked' : ''].filter(Boolean).join(' ');
  return <div className={classes} data-screen-id={node.prototypeId}
    style={{ left: node.position.x, top: node.position.y, width: node.width, height: node.height, zIndex: node.zIndex }}>
    <div className="ds-screen-head" title={title}>
      <Icon name="file" size={11} />
      <span>{title}</span>
      <small data-mono>{Math.round(node.width)}×{Math.round(node.height)}</small>
    </div>
    <div className="ds-screen-body" style={flips ? { transform: flips } : undefined}>
      {active
        ? children
        : content
          ? <iframe className="ds-screen-doc" sandbox="allow-scripts" srcDoc={content} tabIndex={-1} title={title} />
          : <div className="ds-screen-blank" />}
    </div>
  </div>;
}
```

- [ ] **Step 4: Rewire DesignsView onto the world canvas**

In `brainrouter-desktop/src/panels/design/DesignsView.tsx`:

Add imports:

```ts
import { fitBounds, panBy, screenToWorld, snapTo, wheelGesture, zoomAt, type Viewport, type ViewBounds } from '../../lib/design/canvasViewport.js';
import { idsOfKind, isSelected, marqueeSelect, selectOnly, selectionBounds, toggleSelection, type SelectableItem, type Selection } from '../../lib/design/designSelection.js';
import { useCanvasDocument } from '../../lib/design/useCanvasDocument.js';
import { useCanvasFrames } from '../../lib/design/useCanvasFrames.js';
import { DEVICE_SIZE, DesignScreen } from './DesignScreen.js';
import type { CanvasNode } from '../../lib/design/canvasModel.js';
```

Replace the `zoom` state with the viewport, and add the canvas document, selection, marquee and space-pan state:

```ts
  const [view, setView] = useState<Viewport>({ scale: 1, x: 64, y: 64 });
  const [selection, setSelection] = useState<Selection>([]);
  const [marquee, setMarquee] = useState<ViewBounds | null>(null);
  const spaceRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const { frames } = useCanvasFrames();
  const canvasEntries = useMemo(() => protos.entries.map((entry) => ({ id: entry.id })), [protos.entries]);
  const canvas = useCanvasDocument(canvasEntries);
  const nodes = canvas.document.nodes;
  const contentById = useMemo(() => new Map(frames.map((item) => [item.id, item.content])), [frames]);
  const titleById = useMemo(() => new Map(protos.entries.map((entry) => [entry.id, entry.title])), [protos.entries]);
  const activeNode = nodes.find((node) => node.prototypeId === protos.selected?.id) ?? null;
  const screenItems: SelectableItem[] = useMemo(() => nodes.map((node) => ({
    kind: 'screen' as const, id: node.prototypeId,
    bounds: { x: node.position.x, y: node.position.y, w: node.width, h: node.height },
  })), [nodes]);
```

Everywhere the old code passed `zoom` (a percentage) to `StageOverlay`, pass `view.scale * 100` — `StageOverlay` divides by 100 internally, so the annotation layer keeps tracking the world scale for free.

Add the non-passive wheel listener (React's synthetic `onWheel` is passive, so `preventDefault` would be ignored and Ctrl+wheel would zoom the whole app instead of the canvas):

```ts
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const onWheel = (e: WheelEvent): void => {
      const rect = shell.getBoundingClientRect();
      const gesture = wheelGesture(e);
      e.preventDefault();
      setView((current) => gesture.kind === 'zoom'
        ? zoomAt(current, gesture.factor, e.clientX - rect.left, e.clientY - rect.top)
        : panBy(current, gesture.dx, gesture.dy));
    };
    shell.addEventListener('wheel', onWheel, { passive: false });
    return () => shell.removeEventListener('wheel', onWheel);
  }, []);
```

Track the space key for space-drag panning, inside the existing keyboard effect:

```ts
    const onKeyUp = (e: KeyboardEvent): void => { if (e.code === 'Space') spaceRef.current = false; };
```

and at the top of the existing `onKey`, before the tool lookup:

```ts
      if (e.code === 'Space') { spaceRef.current = true; if (!isEditableTarget(e.target as HTMLElement | null)) e.preventDefault(); return; }
```

Register `keyup` alongside `keydown` in the same effect and remove it in the cleanup.

Replace `onShellPointerDown` wholesale. It now dispatches between pan, screen drag, screen select and marquee:

```ts
  const saveNodes = (next: CanvasNode[]): void => canvas.save({ ...canvas.document, nodes: next });

  const onShellPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const shell = shellRef.current;
    if (!shell) return;
    const target = e.target as HTMLElement;
    const wantsPan = e.button === 1 || spaceRef.current || tool === 'hand';
    if (e.button !== 0 && !wantsPan) return;

    if (wantsPan) {
      const start = { x: e.clientX, y: e.clientY, view: viewRef.current };
      setIsPanning(true);
      const onMove = (ev: PointerEvent): void => setView(panBy(start.view, ev.clientX - start.x, ev.clientY - start.y));
      const onUp = (): void => { setIsPanning(false); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
      return;
    }

    const screenEl = target.closest<HTMLElement>('.ds-screen');
    const id = screenEl?.dataset.screenId ?? '';
    if (screenEl && id) {
      const node = nodes.find((item) => item.prototypeId === id);
      const next = e.shiftKey ? toggleSelection(selection, { kind: 'screen', id }) : (isSelected(selection, 'screen', id) ? selection : selectOnly({ kind: 'screen', id }));
      setSelection(next);
      if (id !== protos.selected?.id) protos.select(id);
      // Only the title bar drags — the body stays interactive so the live
      // prototype is still drivable, exactly as it was before the canvas.
      if (!node || node.locked || !target.closest('.ds-screen-head')) return;
      const moving = new Set(idsOfKind(next, 'screen'));
      const origins = new Map(nodes.filter((item) => moving.has(item.prototypeId)).map((item) => [item.prototypeId, item.position]));
      const grid = canvas.document.preferences.snapEnabled ? canvas.document.preferences.gridSize : 1;
      const start = { x: e.clientX, y: e.clientY, scale: viewRef.current.scale };
      let latest = nodes;
      const onMove = (ev: PointerEvent): void => {
        const dx = (ev.clientX - start.x) / start.scale;
        const dy = (ev.clientY - start.y) / start.scale;
        latest = nodes.map((item) => {
          const origin = origins.get(item.prototypeId);
          return origin ? { ...item, position: { x: snapTo(origin.x + dx, grid), y: snapTo(origin.y + dy, grid) } } : item;
        });
        setDragNodes(latest);
      };
      const onUp = (): void => {
        setDragNodes(null);
        saveNodes(latest);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
      return;
    }

    if (tool !== 'select') return;
    const rect = shell.getBoundingClientRect();
    const origin = screenToWorld(viewRef.current, e.clientX - rect.left, e.clientY - rect.top);
    const onMove = (ev: PointerEvent): void => {
      const at = screenToWorld(viewRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
      setMarquee({ x: Math.min(origin.x, at.x), y: Math.min(origin.y, at.y), w: Math.abs(at.x - origin.x), h: Math.abs(at.y - origin.y) });
    };
    const onUp = (): void => {
      setMarquee((box) => {
        setSelection(box && (box.w > 2 || box.h > 2) ? marqueeSelect(screenItems, box) : []);
        return null;
      });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
```

Add the drag-preview state next to the others so a drag repaints without a disk write per frame:

```ts
  const [dragNodes, setDragNodes] = useState<CanvasNode[] | null>(null);
  const shownNodes = dragNodes ?? nodes;
```

and read `shownNodes` (not `nodes`) in the render.

Add the zoom and fit helpers the bottom toolbar calls:

```ts
  const setZoomPercent = (percent: number): void => {
    const shell = shellRef.current;
    if (!shell) return;
    setView((current) => zoomAt(current, (percent / 100) / current.scale, shell.clientWidth / 2, shell.clientHeight / 2));
  };
  const fitAll = (): void => {
    const shell = shellRef.current;
    if (!shell) return;
    const all = screenItems.map((item) => ({ kind: item.kind, id: item.id }));
    const bounds = selectionBounds(screenItems, selection.length ? selection : all);
    if (bounds) setView(fitBounds(bounds, shell.clientWidth, shell.clientHeight, 64));
  };
```

Make the device buttons resize the active screen instead of scaling the whole stage:

```ts
  const applyDevice = (next: Device): void => {
    setDevice(next);
    if (!activeNode) return;
    const size = DEVICE_SIZE[next];
    saveNodes(nodes.map((node) => node.prototypeId === activeNode.prototypeId ? { ...node, width: size.w, height: size.h } : node));
  };
```

Replace the stage markup (the `<div ref={shellRef} …>` block) with:

```tsx
      <div ref={shellRef} className={`ds-stage-shell ds-stage-shell--${tool}${isPanning ? ' is-panning' : ''}`} onPointerDown={onShellPointerDown}>
        <div className="ds-design-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {shownNodes.map((node) => <DesignScreen key={node.prototypeId} node={node}
            title={titleById.get(node.prototypeId) ?? node.prototypeId}
            content={contentById.get(node.prototypeId) ?? null}
            active={node.prototypeId === protos.selected?.id}
            selected={isSelected(selection, 'screen', node.prototypeId)}>
            <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device}
              overlay={<StageOverlay tool={tool} frameKind={frameKind} shapeKind={shapeKind} zoom={view.scale * 100}
                annotations={annotations} selectedId={selectedAnnoId} clipboard={clipboard}
                onSelect={setSelectedAnnoId} onChange={changeAnnotations} onClipboardChange={setClipboard} />}
              onWebviewReady={(wv) => { setPreviewReady((tick) => tick + 1); if (operations.length) void previewRef.current?.applyDraft(operations, wv); }} />
          </DesignScreen>)}
          {marquee ? <div className="ds-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} /> : null}
        </div>
        <CanvasRulers view={view} width={shellSize?.w ?? 0} height={shellSize?.h ?? 0} />
      </div>
```

Update the bottom toolbar props: `zoom={Math.round(view.scale * 100)} onZoomChange={setZoomPercent} onFit={fitAll}`, and the device buttons to call `applyDevice`.

Delete the now-stale comment at the old line 51 about `stageMetrics.ts`.

- [ ] **Step 5: Add the CSS**

In `brainrouter-desktop/src/panels/design/designStudio.css`, replace the `.ds-stage-shell` overflow rule and the `.ds-preview`/`.ds-stage-zoom` rules with the world-canvas set:

```css
/* The stage is a fixed viewport; one world layer inside it carries pan+zoom. */
.design-studio .ds-stage-shell { flex: 1; min-height: 0; position: relative; overflow: hidden; touch-action: none;
  background-color: #101316;
  background-image: linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px);
  background-size: 24px 24px; }
.design-studio .ds-design-world { position: absolute; top: 0; left: 0; transform-origin: 0 0; will-change: transform; }
.design-studio .ds-screen { position: absolute; }
.design-studio .ds-screen-head { position: absolute; top: -22px; left: 0; right: 0; height: 20px; display: flex; align-items: center; gap: 6px;
  padding: 0 2px; font-size: 11px; color: var(--ds-text-dim); cursor: grab; user-select: none; white-space: nowrap; overflow: hidden; }
.design-studio .ds-screen-head small { margin-left: auto; opacity: .6; }
.design-studio .ds-screen.is-selected .ds-screen-head { color: var(--ds-accent); }
.design-studio .ds-screen.is-locked .ds-screen-head { cursor: not-allowed; }
.design-studio .ds-screen-body { position: relative; width: 100%; height: 100%; overflow: hidden;
  border: 1px solid var(--ds-border); border-radius: var(--ds-radius-card); background: var(--ds-surface);
  box-shadow: 0 20px 50px rgba(0,0,0,.42); }
.design-studio .ds-screen.is-selected .ds-screen-body { border-color: var(--ds-accent); box-shadow: 0 0 0 2px var(--ds-accent-wash), 0 20px 50px rgba(0,0,0,.42); }
.design-studio .ds-screen-doc { width: 100%; height: 100%; border: 0; background: #fff; pointer-events: none; }
.design-studio .ds-screen-blank { width: 100%; height: 100%; background: var(--ds-surface-2); }
.design-studio .ds-stage { position: absolute; inset: 0; overflow: hidden; }
.design-studio .ds-marquee { position: absolute; border: 1px solid var(--ds-accent); background: var(--ds-accent-wash); pointer-events: none; }
```

Keep the existing `.ds-stage-shell--hand`, `--select`, `--frame` cursor rules; they still apply.

- [ ] **Step 6: Typecheck and test**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit`
Expected: exit 0. Fix any `PreviewCanvas` call site that still passes `zoom`/`shellSize`.

Run: `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"`
Expected: `fail 0`. The count drops by the 6 deleted `stageMetrics` tests and gains nothing here.

- [ ] **Step 7: Verify live in the browser preview**

Run `npm run dev` from `brainrouter-desktop` (run `npm run build:deps` first if the worktree is fresh), open the Design Studio, and confirm with the browser tools:
- dragging empty canvas with the Hand tool pans; middle-drag and space-drag pan with any tool;
- Ctrl+wheel over the canvas background zooms toward the cursor (`.ds-design-world`'s transform scale changes and the point under the cursor stays put);
- every prototype renders as a screen; dragging a screen's title bar moves it and it stays put after a reload;
- the selected screen shows the live, clickable prototype.

Known and intended: Ctrl+wheel *inside* the live prototype scrolls the prototype rather than zooming the canvas — wheel events inside a webview/iframe do not reach the host. Switch to the Hand tool (which masks the guest) to zoom over a live screen.

- [ ] **Step 8: Commit**

```bash
git add -A brainrouter-desktop/src brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(design): rebuild the Designs stage as a pan/zoom world canvas

Screens read their positions from the persisted CanvasDocument and drag
with grid snap. Only the selected screen mounts the live webview; the
rest render inert snapshots, so the board costs one guest, not N.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Annotation model — groups, masks, paths

**Files:**
- Modify: `brainrouter-desktop/src/lib/design/designAnnotations.ts`
- Modify: `brainrouter-desktop/src/lib/design/designAnnotations.test.ts`

**Interfaces:**
- Produces: `AnnotationKind` gains `'path'`; `DesignAnnotation` gains `groupId?: string`, `mask?: boolean`, `path?: string`, `autoLayout?: CanvasAutoLayout`; new `groupAnnotations`, `ungroupAnnotations`, `frameSelection`, `setMask`, `membersOf`, `boundsOf`.

Read the file first — the existing exports and the private `nextId()` helper are reused rather than duplicated.

- [ ] **Step 1: Write the failing tests**

Append to `designAnnotations.test.ts` — tests for: grouping assigns a shared fresh `groupId` to every member and returns it; ungrouping clears it; `membersOf` returns a group's members in list order; `frameSelection` inserts a `frame` annotation whose box is the members' bbox grown by the padding, adopts the members into it, and places it *behind* them in the array so it reads as a container; `setMask` marks exactly one annotation per group as the mask and clears any previous mask in that group; `boundsOf` unions a list and returns null when empty; a `path` annotation survives `parseAnnotationStore` round-trip with its `d` string intact, and an annotation with a malformed `path` is dropped.

- [ ] **Step 2: Run to verify they fail**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/designAnnotations.test.ts"`
Expected: FAIL — `groupAnnotations` is not exported.

- [ ] **Step 3: Implement**

Extend the type:

```ts
export type AnnotationKind = 'frame' | 'section' | 'rectangle' | 'line' | 'ellipse' | 'polygon' | 'star' | 'text' | 'path';

export interface DesignAnnotation extends StageRect {
  id: string;
  kind: AnnotationKind;
  label: string;
  flipX?: boolean;
  flipY?: boolean;
  hidden?: boolean;
  locked?: boolean;
  /** Group or frame this annotation belongs to. */
  groupId?: string;
  /** This annotation clips its siblings in the same group. */
  mask?: boolean;
  /** SVG path data — set for kind 'path', produced by flatten/outline. */
  path?: string;
  /** Set on a 'frame' to lay its members out automatically. */
  autoLayout?: CanvasAutoLayout;
}
```

Import `CanvasAutoLayout` from `./canvasModel.js` (a type-only import, so the pure-logic boundary holds).

Add `FRAME_PADDING = 24` next to the other constants, and the new functions. `groupAnnotations` mints one id via the existing `nextId()` and stamps it on every member. `frameSelection` computes `boundsOf(members)`, creates a `frame` annotation at that box grown by `FRAME_PADDING`, labels it via the existing `nextGroupLabel('frame', list)`, sets each member's `groupId` to the frame's id, and splices the frame in *before* the first member's index. `setMask(list, id)` sets `mask: true` on `id` and deletes `mask` from every other member of the same group.

Extend the private `parseAnnotation` to carry `groupId`, `mask`, `path` and `autoLayout` through, dropping an entry whose `kind === 'path'` has no non-empty string `path`.

- [ ] **Step 4: Run the tests, then the suite**

Run: `cd brainrouter-desktop && npx tsx --test "src/lib/design/designAnnotations.test.ts"` — expected PASS.
Run: `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"` — expected `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/lib/design/designAnnotations.ts brainrouter-desktop/src/lib/design/designAnnotations.test.ts
git commit -m "feat(design): annotation groups, frames, masks and path geometry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Auto layout engine

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designAutoLayout.ts` + `.test.ts`

**Interfaces:**
- Consumes: `CanvasAutoLayout` (Task 3), `DesignAnnotation`, `StageRect` (Task 6).
- Produces: `DEFAULT_AUTO_LAYOUT: CanvasAutoLayout`, `applyAutoLayout(frame, members, layout): { frame: StageRect; members: StageRect[] }`, `autoLayoutAnnotations(list, frameId): DesignAnnotation[]`.

- [ ] **Step 1: Write the failing tests**

Cover: a row lays members left to right at `padX` from the frame's left, separated by `gap`, and the frame hugs to `padX*2 + sum(widths) + gap*(n-1)`; a column does the same on the block axis; `align: 'center'` centres each member on the cross axis and `'end'` flushes it; the frame's own position is preserved (auto layout moves children, not the frame); an empty member list leaves the frame at its padding-only minimum rather than collapsing to zero or producing NaN; `autoLayoutAnnotations` is a no-op when the frame has no `autoLayout` and returns a new array without mutating the input.

- [ ] **Step 2: Run to verify it fails.** Expected: module not found.

- [ ] **Step 3: Implement.** The engine is a single pass: walk the members in list order, place each at the running main-axis cursor, resolve the cross-axis offset from `align`, advance by `size + gap`, and finally resize the frame to hug. Every number derives from the inputs — no `Date.now()`, no randomness.

- [ ] **Step 4: Run the tests.** Expected PASS.

- [ ] **Step 5: Commit** — `feat(design): auto layout engine for frames`.

---

### Task 8: Outline geometry — trace, stroke, flatten

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designOutline.ts` + `.test.ts`

**Interfaces:**
- Produces: `traceMask(alpha, width, height, threshold?): string`, `outlineStrokePath(annotation, strokeWidth): string`, `flattenToPath(annotations): string`, `outlinePathFor(annotation): string`.

This is where "Outline text" becomes real rather than a stub. `traceMask` takes a rasterised alpha buffer and walks its contours with marching squares, emitting one closed subpath per contour — genuine glyph outlines. It is pure, so it is testable without a canvas; only the caller in Task 10 touches `CanvasRenderingContext2D` to produce the buffer.

- [ ] **Step 1: Write the failing tests**

Cover: tracing a solid rectangle mask yields exactly one closed subpath whose bounding box matches the rectangle; tracing a mask with two disjoint blobs yields two subpaths (`d.match(/M/g).length === 2`); an all-zero mask yields `''`; the threshold is respected (a mask of 0x7F traces at threshold 100 but not at 200); `outlineStrokePath` on a rectangle yields two subpaths (outer and inner ring) whose outer box is the rect grown by half the stroke; `outlineStrokePath` on a line yields a single quad subpath; `flattenToPath` concatenates each member's outline as its own `M`-prefixed subpath and preserves member order; `flattenToPath([])` is `''`.

- [ ] **Step 2: Run to verify it fails.** Expected: module not found.

- [ ] **Step 3: Implement.** `outlinePathFor` switches on `kind`, reusing the existing `polygonPointsFor`/`starPointsFor` from `designAnnotations.ts` for those kinds, an `M/L/Z` box for rectangle/frame/section, four arcs for ellipse, and the stored `path` for `'path'`. Round every emitted coordinate to 2 decimals so the output is stable and diffable.

- [ ] **Step 4: Run the tests.** Expected PASS.

- [ ] **Step 5: Commit** — `feat(design): contour tracing, stroke outlining and flatten`.

---

### Task 9: Render paths, masks and multi-selection

**Files:**
- Modify: `brainrouter-desktop/src/panels/design/StageOverlay.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

Read `StageOverlay.tsx` fully before editing.

- [ ] **Step 1:** Render `kind === 'path'` as an `<svg>` positioned at the annotation's box containing `<path d={annotation.path} />`, styled with the same stroke/fill treatment the existing shapes use.
- [ ] **Step 2:** Render masks: for each group that has a member with `mask: true`, emit a `<clipPath>` whose contents are that member's outline, and set `clip-path` on the group's other members. The mask itself renders as an outline only.
- [ ] **Step 3:** Accept a `selectedIds: readonly string[]` prop alongside the existing `selectedId` and give every selected annotation the selection treatment, so a marquee or shift-click shows all of what it caught.
- [ ] **Step 4:** Add the CSS for `.ds-anno--path` and `.ds-anno--mask`.
- [ ] **Step 5:** Typecheck, run the suite, commit — `feat(design): render path annotations, masks and multi-selection`.

---

### Task 10: The context menu, fully wired

**Files:**
- Modify: `brainrouter-desktop/src/panels/design/DesignContextMenu.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`

**Interfaces:**
- Produces: `MenuAction` gains `'group' | 'ungroup' | 'frame' | 'auto-layout' | 'mask' | 'flatten' | 'outline-text' | 'outline-stroke' | 'create-component' | 'create-component-chat' | 'paste-replace'`. `DesignContextMenu` takes `{ x, y, target: MenuTarget, selectionCount, clipboardFilled, hiddenCount, onAction, onClose }` where `MenuTarget = { kind: 'screen'; node: CanvasNode } | { kind: 'annotation'; annotation: DesignAnnotation } | null`.

- [ ] **Step 1:** Rewrite the items list. Every row that was `enabled: false` gets an `action` and a real enablement predicate:
  - Group/Frame selection: `selectionCount >= 2`.
  - Add auto layout: target is a `frame` or `section` annotation.
  - Use as mask: target is a shape annotation inside a group.
  - Flatten: `selectionCount >= 1` and every member is a shape.
  - Outline text: target is a `text` annotation.
  - Outline stroke: target is a shape annotation.
  - Create component / Create component with chat: `selectionCount >= 1` / always.
  - Paste to replace: `clipboardFilled && target !== null`.
  - Delete: label becomes `Remove from board` when the target is a screen, because the HTML file is never deleted.
- [ ] **Step 2:** In `DesignsView`, add `onContextMenu` on the shell that resolves the target — annotation hit first (via `hitTestIncludingLocked` in stage space), then the enclosing `.ds-screen`, else `null` — and opens the menu at the event's client coordinates.
- [ ] **Step 3:** Implement `applyMenuAction(action)` in `DesignsView`, dispatching each action to the pure helpers from Tasks 6–8 and `canvas.save` for screen-side changes. Screen duplicate calls the new `design:duplicate-prototype` query added in Task 12; screen delete moves the id into `hiddenPrototypeIds`.
- [ ] **Step 4:** Extend the keyboard map with `Ctrl+G` (group), `Ctrl+Shift+G` (ungroup), `Ctrl+Alt+G` (frame), `Shift+A` (auto layout), `Ctrl+Alt+M` (mask), `Alt+Shift+F` (flatten), `Ctrl+Alt+K` (create component), and make the existing `Ctrl+C/X/V/D`, `]`/`[`, `Delete`, `Shift+H/V`, `Ctrl+Shift+H/L` operate on the whole selection rather than one annotation.
- [ ] **Step 5:** Typecheck, run the suite, verify in the browser preview that every row is enabled in the right context and does what it says, commit — `feat(design): make every context menu action real`.

---

### Task 11: Components — create, persist, place

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designComponents.ts` + `.test.ts`
- Modify: `brainrouter-desktop/src/panels/design/DesignResourceRail.tsx`, `DesignsView.tsx`

**Interfaces:**
- Produces: `componentFromSelection(name, annotations, bounds): CanvasComponent`, `componentFromHtml(name, html, size): CanvasComponent`, `addComponent(list, component): CanvasComponent[]`, `uniqueComponentName(list, base): string`.

- [ ] **Step 1:** Tests — a component from a selection captures the members' bbox as its size and serialises their geometry into `html`; names collide-avoid by suffixing (`Card`, `Card 2`, `Card 3`); adding a component with an existing id replaces rather than duplicates; a component from empty input throws rather than producing a zero-sized record.
- [ ] **Step 2:** Implement, then wire "Create component" to store into `canvas.document.components` via `canvas.save`.
- [ ] **Step 3:** Show `canvas.document.components` in the resource rail's Components tab above the derived-element list, each draggable; dropping one on the canvas inserts its HTML as a `path`-free annotation group at the drop point in world coordinates.
- [ ] **Step 4:** Typecheck, test, commit — `feat(design): promote a selection to a reusable component`.

---

### Task 12: Quick-chat component generation

**Files:**
- Create: `brainrouter-desktop/src/panels/design/QuickComponentChat.tsx`
- Modify: `brainrouter-desktop/electron/host/queries.ts`, `src/devBridge/queries.ts`, `DesignsView.tsx`, `designStudio.css`

- [ ] **Step 1:** Add a `design:quick-generate` query to `electron/host/queries.ts`, modelled exactly on the existing `write-inline-ai` handler a few hundred lines above it: resolve the model with `llmForSession(getActiveAgent().sessionKey)`, return `{ html: '', error: 'No model configured — set a provider/model (and API key) in Settings.' }` when there is no usable config, otherwise call `callOpenAI(llm, [system, user], [], { effort: 'low' })` with a system prompt that demands a single self-contained HTML fragment, and return `{ html }`. This uses the model chosen in app settings, and it is one-shot — it never touches the visible chat transcript.
- [ ] **Step 2:** Add a `design:duplicate-prototype` query alongside it (needed by Task 10): copy `proto/<id>.html` to a fresh non-colliding id via the same `insideWorkspace` guard and atomic write the rest of `designHost` uses, and return `{ id, path }`.
- [ ] **Step 3:** Add dev-bridge stubs in `src/devBridge/queries.ts` so the browser preview degrades honestly: `design:quick-generate` returns `{ html: '', error: 'Quick generate needs the desktop app.' }` and `design:duplicate-prototype` returns `{ error: 'Duplicating a screen needs the desktop app.' }`.
- [ ] **Step 4:** Build `QuickComponentChat.tsx` — a compact popover following the existing `.pop-wrap`/`.menu-pop` convention in `theme.css` (there is no shared Modal component in this app; do not invent one here). It shows the model name read from `bridgeQuery<ConfigSnapshot>('config-snapshot', {})`, a prompt field, a Generate button, a busy state, and an inline error row for the `error` field. On success it calls back with the HTML.
- [ ] **Step 5:** Wire "Create component with chat" to open it and feed the result through `componentFromHtml` into `canvas.document.components`.
- [ ] **Step 6:** Typecheck, run the suite, commit — `feat(design): generate a component from a prompt with the configured model`.

---

### Task 13: Documentation and verification

**Files:**
- Modify: `docs/design/Design.md`

- [ ] **Step 1:** Rewrite the "Prototype stage" section to describe the world canvas: viewport + world layer, the gestures (hand/space/middle drag to pan, Ctrl+wheel to zoom at the cursor, plain wheel to pan, Shift+wheel sideways), grid snap, one-live-guest rendering, and the honest limitation that wheel events inside a live prototype belong to the prototype.
- [ ] **Step 2:** Add a "Canvas actions" section reproducing the semantics table from the top of this plan, so the meaning of Flatten/Outline/Mask in *this* product is written down rather than assumed from Figma.
- [ ] **Step 3:** Note the schema v2 upgrade and that v1 documents on disk are migrated on read.
- [ ] **Step 4:** Full gates:
  - `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit` → exit 0
  - `cd brainrouter-desktop && npx tsx --test "src/**/*.test.ts"` → `fail 0`
  - `cd brainrouter-desktop && npx vite build` → succeeds
  - `git ls-files --eol` on every touched file → `i/lf`; scan each for NUL bytes
- [ ] **Step 5:** Live verification in the browser preview of each headline gesture and each menu row.
- [ ] **Step 6:** Commit — `docs(design): document the design canvas and its actions`.

---

## Self-review

**Spec coverage.** Every item the goal named maps to a task: drag the whole page/preview → Task 5 (pan); Atlas-like canvas reusing existing code → Tasks 1 and 5 (the shared viewport module, extracted from `CanvasView`); drag screens/components → Task 5 (screens), Task 11 (components); Ctrl+Scroll → Tasks 1 and 5; Copy/Cut/Paste, Bring to front/back, Delete, Group selection → Task 10; Frame selection, Add auto layout, Use as mask, Flatten, Outline text, Outline stroke → Tasks 6–8 and 10; Create component and Create component with quick chat → Tasks 11 and 12; Show/Hide, Lock/Unlock → Tasks 3 and 10; Flip H/V → Tasks 3 and 10.

**Type consistency.** `Viewport`/`ViewBounds` (Task 1) are the same types `designSelection` (Task 2) and `DesignsView` (Task 5) consume. `CanvasAutoLayout` is defined once in `canvasModel.ts` (Task 3) and imported by both `designAnnotations.ts` (Task 6) and `designAutoLayout.ts` (Task 7). `MenuAction` is extended in one place (Task 10) and every new member has a handler in the same task.

**Ordering constraint.** Task 4 leaves the tree typecheck-red on purpose (it changes the `CanvasRulers` props but Task 5 updates the call site). Do not run `tsc` between them; the step text says so.

**Calibration note.** Tasks 1–5 carry complete code because that is where the subtle correctness lives — coordinate math, schema migration, and the pointer-dispatch tree. Tasks 6–13 specify exact files, exact exported signatures, and exact test obligations, with prose for the mechanical wiring. If executing this plan with fresh subagents rather than inline, expand Tasks 6–13 to full code first.
