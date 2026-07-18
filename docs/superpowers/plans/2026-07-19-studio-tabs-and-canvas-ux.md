# Design Studio: contained errors, two tabs, and canvas interaction UX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a throw in one Design Studio view from taking down the whole app, cut the studio to Design + Brands, and fix the canvas interactions (drag, selection) and the right-hand inspector where they measurably hurt the user.

**Architecture:** Three independent slices. (1) A resettable error boundary wraps each studio view, so a failure is contained to one tab and retried by switching away and back. (2) The Canvas tab and its two exclusive files are deleted; `DesignsView` already owns the world canvas. (3) Canvas gestures gain a drag threshold, shift axis-lock and alignment guides — all as pure modules under `src/lib/design/` so they are unit-testable — and the inspector stops rendering a blank panel and stops lying about multi-selections.

**Tech Stack:** React 18, TypeScript (strict, but **no** `noUncheckedIndexedAccess` and **no** `exactOptionalPropertyTypes`), `node:test` + `tsx`. Vite dev server for live verification.

## Global Constraints

- Relative imports MUST carry the `.js` extension (`./designTools.js`), even from `.ts`.
- There is **no** jsdom, RTL or vitest in `brainrouter-desktop`. `.tsx` cannot be unit-tested. **Every piece of logic worth a test MUST live in a `.ts` module under `src/lib/design/`**; `.tsx` files are gated on `tsc` plus live browser verification.
- Test files are `src/lib/design/<name>.test.ts`, using `import test from 'node:test'` and `import assert from 'node:assert/strict'`.
- Run the full gate with `npm --prefix brainrouter-desktop test` from the repo root. It runs `build:deps`, `typecheck`, `build:electron`, then the node and tsx test suites.
- The current suite is **543 tests passing**. It must stay green; new tests add to that count.
- Do NOT commit `dist-electron` changes as part of a feature commit — it is tracked build output that `npm test` regenerates. Check `git status` before committing and leave `dist-electron/` out unless the task is explicitly a rebuild.
- Comments explain WHY, not what. Match the density and voice of the surrounding file.
- Windows: verify no CRLF/NUL damage before committing (`git diff --stat` should be proportional to the edit).

---

### Task 1: Contain a failing studio view

**The defect, measured.** `src/main.tsx` mounts the app's *only* `ErrorBoundary`. I reproduced a real throw inside `DesignsView` (`ReferenceError: emptyHistory is not defined`, triggered by a partial Vite HMR reload) and the console showed the boundary that caught it was the root one:

```
The above error occurred in the <DesignsView> component:
    at DesignsView ... at DesignStudioPanel ... at App
    at ErrorBoundary (src/components/primitives/ErrorBoundary.tsx:5:8)
```

So one bad view replaces the **entire application** with the fallback card, and the card's "Dismiss" re-renders the same broken view, which throws again immediately. That inescapable loop is exactly the reported symptom: errors every time you switch between the Design and Brands tabs.

The fix is containment, not a hunt for every possible throw: a boundary per view that resets when the tab changes.

**Files:**
- Create: `brainrouter-desktop/src/lib/design/boundaryReset.ts`
- Create: `brainrouter-desktop/src/lib/design/boundaryReset.test.ts`
- Create: `brainrouter-desktop/src/components/primitives/ResettableBoundary.tsx`
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx` (move one declaration)

**Interfaces:**
- Produces: `shouldResetBoundary(previousKey: string, nextKey: string, hasError: boolean): boolean`
- Produces: `ResettableBoundary` — props `{ resetKey: string; label: string; children: React.ReactNode }`
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/boundaryReset.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResetBoundary } from './boundaryReset.js';

test('a boundary holding an error clears when the key changes', () => {
  assert.equal(shouldResetBoundary('designs', 'brands', true), true);
});

test('a boundary with no error never needs resetting', () => {
  // Resetting a healthy boundary would throw away the children's state for
  // nothing — switching tabs must not remount a view that is working.
  assert.equal(shouldResetBoundary('designs', 'brands', false), false);
});

test('the same key does not clear a live error', () => {
  // Re-rendering the same broken view must keep showing the fallback, or the
  // view remounts, throws again, and the panel flickers in a loop.
  assert.equal(shouldResetBoundary('designs', 'designs', true), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/boundaryReset.test.ts"
```

Expected: FAIL — `Cannot find module './boundaryReset.js'`.

- [ ] **Step 3: Write the module**

Create `brainrouter-desktop/src/lib/design/boundaryReset.ts`:

```ts
// When a studio view throws, its boundary latches the error. Switching to
// another tab has to clear that latch, or the panel is wedged until a full
// reload — which is what a single app-wide boundary did.

/**
 * True when a latched error should be dropped because the boundary is now
 * showing different content. A healthy boundary is never reset: remounting a
 * working view on every tab change would discard its state for nothing.
 */
export function shouldResetBoundary(previousKey: string, nextKey: string, hasError: boolean): boolean {
  return hasError && previousKey !== nextKey;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/boundaryReset.test.ts"
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Write the boundary component**

Create `brainrouter-desktop/src/components/primitives/ResettableBoundary.tsx`:

```tsx
import React from 'react';
import { shouldResetBoundary } from '../../lib/design/boundaryReset.js';

interface Props { resetKey: string; label: string; children: React.ReactNode }
interface State { error: Error | null; key: string }

/**
 * A boundary scoped to one view. The app-wide boundary in main.tsx is the last
 * resort — it replaces the whole window, so a throw in one Design Studio tab
 * took the nav down with it and left no way back except a reload. This one
 * keeps the failure inside the panel that caused it and clears itself when the
 * user switches to a different view.
 */
export class ResettableBoundary extends React.Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (shouldResetBoundary(state.key, props.resetKey, state.error !== null)) return { error: null, key: props.resetKey };
    return state.key === props.resetKey ? null : { key: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[BrainRouter] ${this.props.label} failed to render:`, error, info?.componentStack);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="ds-viewerror" role="alert">
        <p className="ds-eyebrow">{this.props.label} could not be shown</p>
        <p className="ds-viewerror-msg">{error.message || String(error)}</p>
        <p className="ds-viewerror-hint">The rest of the studio still works — switch tabs and back to retry.</p>
        <button type="button" className="ds-iconbtn" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
```

- [ ] **Step 6: Wrap each view and fix the declaration-order hazard**

In `src/panels/DesignStudioPanel.tsx`, import the boundary and wrap the tab body. Replace the `<div className="ds-view" role="tabpanel">…</div>` block's children so each view is inside one boundary keyed by the active tab:

```tsx
<div className="ds-view" role="tabpanel">
  <ResettableBoundary resetKey={tab} label={TABS.find((t) => t.id === tab)?.label ?? 'This view'}>
    {tab === 'brands' && <BrandsView branch={branch} commit={null} iso={new Date().toISOString()} />}
    {tab === 'designs' && (
      <DesignsView … unchanged props … />
    )}
  </ResettableBoundary>
</div>
```

(The `canvas` line is deleted in Task 2; if Task 2 has not run yet, keep it inside the boundary too.)

In `src/panels/design/DesignsView.tsx`, move the `historyRef` declaration **above** the effect that assigns it. Today `const historyRef = useRef(...)` sits at ~line 301 while the prototype-load effect writes `historyRef.current` at ~line 208. It works only because effects run after the render pass; any refactor that moves that code into render turns it into a temporal-dead-zone `ReferenceError`. Cut this line:

```tsx
  const historyRef = useRef(emptyHistory<DesignAnnotation[]>([]));
```

and paste it immediately above the `useEffect` that loads the prototype (the one containing `historyRef.current = emptyHistory(loaded);`), keeping its two-line comment with it.

- [ ] **Step 7: Add the fallback styles**

Append to `src/panels/design/designStudio.css`:

```css
.design-studio .ds-viewerror { margin:auto; max-width:420px; padding:20px; display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.design-studio .ds-viewerror-msg { font:12px var(--ds-mono); color:var(--ds-text-1); word-break:break-word; }
.design-studio .ds-viewerror-hint { font-size:12px; color:var(--ds-text-3); }
```

- [ ] **Step 8: Gate and commit**

```bash
npm --prefix brainrouter-desktop run typecheck
cd brainrouter-desktop && npx tsx --test "src/lib/design/boundaryReset.test.ts"
```

Expected: typecheck clean, 3 tests pass.

```bash
git add brainrouter-desktop/src/lib/design/boundaryReset.ts brainrouter-desktop/src/lib/design/boundaryReset.test.ts brainrouter-desktop/src/components/primitives/ResettableBoundary.tsx brainrouter-desktop/src/panels/DesignStudioPanel.tsx brainrouter-desktop/src/panels/design/DesignsView.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "fix(design): contain a failing studio view instead of taking down the app"
```

---

### Task 2: Cut the studio to Design and Brands

The Canvas tab is a read-only board of prototype thumbnails. `DesignsView` now renders the same screens on a real world canvas that you can drag, resize, annotate and pack into components — so Canvas is a strictly weaker duplicate of the tab next to it. `CanvasView` and `CanvasInspector` are imported by nothing else (verified by grep), so they delete cleanly. `useCanvasFrames` stays: `DesignsView` uses it too.

**Files:**
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx`
- Delete: `brainrouter-desktop/src/panels/design/CanvasView.tsx`
- Delete: `brainrouter-desktop/src/panels/design/CanvasInspector.tsx`
- Modify: `docs/design/Design.md`

**Interfaces:**
- Consumes: the boundary from Task 1.
- Produces: `StudioTab = 'designs' | 'brands'` (narrowed from three members).

- [ ] **Step 1: Narrow the tab union and drop the Canvas wiring**

In `src/panels/DesignStudioPanel.tsx`:

```tsx
export type StudioTab = 'designs' | 'brands';

const TABS: Array<{ id: StudioTab; label: string; hint: string }> = [
  { id: 'designs', label: 'Design', hint: 'Preview, drive and inspect a prototype' },
  { id: 'brands', label: 'Brands', hint: 'The brand system: colour, type, shape, motion, voice' },
];
```

Then:
- change `useState<StudioTab>('canvas')` to `useState<StudioTab>('designs')`
- delete `import { CanvasView } from './design/CanvasView.js';`
- delete the `const [canvasKey, setCanvasKey] = useState(0);` line and its comment
- delete the `openInDesigns` callback (its only caller was `CanvasView`) and the now-unused `useCallback` import if nothing else uses it
- delete the `{tab === 'canvas' && <CanvasView … />}` line
- in the `onApplied` handler, drop `setCanvasKey((k) => k + 1);` so it reads:

```tsx
onApplied={() => {
  // Surface the edit on the shared preview: reload if Designs is mounted,
  // otherwise switch to it (mounting loads the just-edited file fresh).
  if (tab === 'designs') previewRef.current?.reload(); else setTab('designs');
  setTimeout(() => { protos.refresh(); }, 400);
}}
```

- [ ] **Step 2: Delete the two exclusive files**

```bash
git rm brainrouter-desktop/src/panels/design/CanvasView.tsx brainrouter-desktop/src/panels/design/CanvasInspector.tsx
```

- [ ] **Step 3: Prove nothing else referenced them**

```bash
cd brainrouter-desktop && grep -rn "CanvasView\|CanvasInspector" src/ ; echo "exit=$?"
```

Expected: no matches (`exit=1`). If anything matches, fix that importer before continuing.

- [ ] **Step 4: Typecheck**

```bash
npm --prefix brainrouter-desktop run typecheck
```

Expected: clean. TypeScript will flag any remaining `'canvas'` comparison as a non-overlapping union member — fix each one it names.

- [ ] **Step 5: Update the docs**

In `docs/design/Design.md`, find the section describing the three studio tabs and rewrite it for two. State plainly that the Canvas tab was removed because the Designs canvas superseded it — a doc that silently drops a feature reads as an oversight.

- [ ] **Step 6: Commit**

```bash
git add -A brainrouter-desktop/src/panels docs/design/Design.md
git commit -m "feat(design): cut the studio to Design and Brands"
```

---

### Task 3: A drag threshold and shift axis-lock

**The defect.** `onShellPointerDown` in `DesignsView.tsx` installs its `pointermove` handler and starts moving the screen on the *first* move event. There is no threshold, so a click that drifts one pixel — which is most clicks on a trackpad — nudges the screen and writes a new position to disk. And `onMove` never reads modifier keys, so there is no way to constrain a drag to one axis. Both are table stakes in a design tool.

**Files:**
- Create: `brainrouter-desktop/src/lib/design/dragGesture.ts`
- Create: `brainrouter-desktop/src/lib/design/dragGesture.test.ts`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`

**Interfaces:**
- Produces: `DRAG_THRESHOLD: number`, `passedThreshold(dx: number, dy: number): boolean`, `constrainDelta(dx: number, dy: number, lock: boolean): { dx: number; dy: number }`
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/dragGesture.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAG_THRESHOLD, constrainDelta, passedThreshold } from './dragGesture.js';

test('a hand that drifts inside the threshold is still a click', () => {
  assert.equal(passedThreshold(0, 0), false);
  assert.equal(passedThreshold(2, 2), false);
});

test('a real drag crosses the threshold on either axis or diagonally', () => {
  assert.equal(passedThreshold(DRAG_THRESHOLD + 1, 0), true);
  assert.equal(passedThreshold(0, -(DRAG_THRESHOLD + 1)), true);
  assert.equal(passedThreshold(-5, 5), true);
});

test('the threshold is measured as distance, not per-axis', () => {
  // 3,3 is 4.24 away — beyond a 4px radius even though neither axis is.
  assert.equal(passedThreshold(3, 3), true);
});

test('axis lock keeps the larger movement and zeroes the other', () => {
  assert.deepEqual(constrainDelta(40, 6, true), { dx: 40, dy: 0 });
  assert.deepEqual(constrainDelta(6, -40, true), { dx: 0, dy: -40 });
});

test('an exactly diagonal locked drag picks one axis rather than moving both', () => {
  // A tie must not fall through to free movement — the point of the lock is
  // that the result is always axis-aligned.
  const locked = constrainDelta(20, -20, true);
  assert.ok(locked.dx === 0 || locked.dy === 0, 'one axis is zero');
});

test('without the lock the delta passes through untouched', () => {
  assert.deepEqual(constrainDelta(40, 6, false), { dx: 40, dy: 6 });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/dragGesture.test.ts"
```

Expected: FAIL — `Cannot find module './dragGesture.js'`.

- [ ] **Step 3: Write the module**

Create `brainrouter-desktop/src/lib/design/dragGesture.ts`:

```ts
// Pointer deltas, in SCREEN pixels, before the view scale divides them into
// world units. Threshold and axis-lock both belong here rather than in the
// pointer handler so they can be tested without a DOM.

/**
 * How far the pointer must travel before a press becomes a drag. Below this a
 * press is a click: without it, the drift in an ordinary trackpad click nudges
 * the screen and persists a new position.
 */
export const DRAG_THRESHOLD = 4;

/** Radial, not per-axis — a diagonal drift of 3,3 is further than 4px. */
export function passedThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > DRAG_THRESHOLD;
}

/**
 * Shift constrains a drag to one axis, as it does in every design tool. The
 * dominant axis wins; a tie resolves to horizontal so the result is always
 * axis-aligned rather than silently falling back to free movement.
 */
export function constrainDelta(dx: number, dy: number, lock: boolean): { dx: number; dy: number } {
  if (!lock) return { dx, dy };
  return Math.abs(dy) > Math.abs(dx) ? { dx: 0, dy } : { dx, dy: 0 };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/dragGesture.test.ts"
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Apply both to the screen-drag gesture**

In `src/panels/design/DesignsView.tsx`, add to the imports:

```tsx
import { constrainDelta, passedThreshold } from '../../lib/design/dragGesture.js';
```

In `onShellPointerDown`, in the screen-**drag** branch (the one that builds `origins` and `moving`), replace the `onMove`/`onUp` pair with a threshold-gated version. The screen only moves once the pointer has genuinely travelled, and `setDragNodes` is never called for a click:

```tsx
      const start = { x: e.clientX, y: e.clientY, scale: viewRef.current.scale };
      let latest = nodes;
      let dragging = false;
      const onMove = (ev: PointerEvent): void => {
        const rawX = ev.clientX - start.x;
        const rawY = ev.clientY - start.y;
        // Below the threshold this is still a click — moving now would nudge
        // the screen and persist the nudge on release.
        if (!dragging && !passedThreshold(rawX, rawY)) return;
        dragging = true;
        const { dx: lockedX, dy: lockedY } = constrainDelta(rawX, rawY, ev.shiftKey);
        const dx = lockedX / start.scale;
        const dy = lockedY / start.scale;
        latest = nodes.map((item) => {
          const origin = origins.get(item.prototypeId);
          return origin ? { ...item, position: { x: snapTo(origin.x + dx, grid), y: snapTo(origin.y + dy, grid) } } : item;
        });
        setDragNodes(latest);
      };
      const onUp = (): void => {
        setDragNodes(null);
        // A click that never crossed the threshold has nothing to save; writing
        // here would rewrite the board on every selection.
        if (dragging) saveNodes(latest);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
```

- [ ] **Step 6: Gate and commit**

```bash
npm --prefix brainrouter-desktop run typecheck && cd brainrouter-desktop && npx tsx --test "src/lib/design/dragGesture.test.ts"
```

Expected: typecheck clean, 6 tests pass.

```bash
git add brainrouter-desktop/src/lib/design/dragGesture.ts brainrouter-desktop/src/lib/design/dragGesture.test.ts brainrouter-desktop/src/panels/design/DesignsView.tsx
git commit -m "fix(design): a click no longer nudges a screen, and shift locks a drag to one axis"
```

---

### Task 4: Alignment guides while dragging

**The defect.** Dragging a screen snaps to a numeric grid and nothing else. Lining two screens up by eye is guesswork. Every design tool snaps to the *other objects'* edges and centres and draws a guide showing why it snapped.

**Files:**
- Create: `brainrouter-desktop/src/lib/design/alignmentGuides.ts`
- Create: `brainrouter-desktop/src/lib/design/alignmentGuides.test.ts`
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  ```ts
  export interface GuideBox { x: number; y: number; w: number; h: number }
  export interface Guide { axis: 'x' | 'y'; at: number; from: number; to: number }
  export interface SnapResult { x: number; y: number; guides: Guide[] }
  export const SNAP_TOLERANCE: number;
  export function snapToNeighbours(moving: GuideBox, others: readonly GuideBox[], tolerance?: number): SnapResult;
  ```

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/alignmentGuides.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { SNAP_TOLERANCE, snapToNeighbours, type GuideBox } from './alignmentGuides.js';

const neighbour: GuideBox = { x: 100, y: 100, w: 200, h: 200 };

test('a near-miss on a left edge snaps flush and reports a guide', () => {
  const result = snapToNeighbours({ x: 104, y: 400, w: 200, h: 200 }, [neighbour]);
  assert.equal(result.x, 100, 'the left edges line up');
  assert.equal(result.y, 400, 'the untouched axis is left alone');
  assert.ok(result.guides.some((g) => g.axis === 'x' && g.at === 100), 'a vertical guide marks the shared edge');
});

test('centres snap to centres, not only edges', () => {
  // Moving box centre 203 vs neighbour centre 200 — within tolerance.
  const result = snapToNeighbours({ x: 153, y: 400, w: 100, h: 100 }, [neighbour]);
  assert.equal(result.x + 50, 200, 'the centres align');
});

test('a box further away than the tolerance is left exactly where it is', () => {
  const far = { x: 100 + SNAP_TOLERANCE + 5, y: 400, w: 200, h: 200 };
  const result = snapToNeighbours(far, [neighbour]);
  assert.equal(result.x, far.x);
  assert.deepEqual(result.guides, []);
});

test('the closest candidate wins when two neighbours both qualify', () => {
  const near: GuideBox = { x: 103, y: 600, w: 50, h: 50 };
  const result = snapToNeighbours({ x: 104, y: 900, w: 50, h: 50 }, [neighbour, near]);
  assert.equal(result.x, 103, 'snaps to the nearer edge at 103, not the one at 100');
});

test('with no neighbours nothing moves', () => {
  const alone = { x: 7, y: 9, w: 10, h: 10 };
  const result = snapToNeighbours(alone, []);
  assert.equal(result.x, 7);
  assert.equal(result.y, 9);
  assert.deepEqual(result.guides, []);
});

test('a guide spans both boxes so it visibly connects them', () => {
  const result = snapToNeighbours({ x: 104, y: 400, w: 200, h: 200 }, [neighbour]);
  const guide = result.guides.find((g) => g.axis === 'x');
  assert.ok(guide, 'there is a vertical guide');
  assert.ok(guide.from <= 100, 'it reaches the neighbour above');
  assert.ok(guide.to >= 600, 'it reaches the bottom of the dragged box');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/alignmentGuides.test.ts"
```

Expected: FAIL — `Cannot find module './alignmentGuides.js'`.

- [ ] **Step 3: Write the module**

Create `brainrouter-desktop/src/lib/design/alignmentGuides.ts`:

```ts
// Snapping a dragged screen to the other screens' edges and centres, plus the
// guides that show why it snapped. Pure geometry in world units — the caller
// converts pointer deltas before asking.

export interface GuideBox { x: number; y: number; w: number; h: number }

/** A line to draw: `at` is the world coordinate on `axis`, `from`/`to` its extent. */
export interface Guide { axis: 'x' | 'y'; at: number; from: number; to: number }

export interface SnapResult { x: number; y: number; guides: Guide[] }

/** How close, in world units, an edge must be before it grabs. */
export const SNAP_TOLERANCE = 6;

/** The three lines a box offers on one axis: near edge, centre, far edge. */
function stops(start: number, size: number): number[] {
  return [start, start + size / 2, start + size];
}

interface Candidate { delta: number; at: number; other: GuideBox }

function bestOn(movingStart: number, movingSize: number, others: readonly GuideBox[], axis: 'x' | 'y', tolerance: number): Candidate | null {
  let best: Candidate | null = null;
  for (const other of others) {
    const otherStart = axis === 'x' ? other.x : other.y;
    const otherSize = axis === 'x' ? other.w : other.h;
    for (const mine of stops(movingStart, movingSize)) {
      for (const theirs of stops(otherStart, otherSize)) {
        const delta = theirs - mine;
        if (Math.abs(delta) > tolerance) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, at: theirs, other };
      }
    }
  }
  return best;
}

/**
 * Nudges `moving` onto the nearest neighbour line within `tolerance` on each
 * axis independently, and returns the guides for whatever grabbed. The axes are
 * independent so a box can snap horizontally without being dragged vertically.
 */
export function snapToNeighbours(moving: GuideBox, others: readonly GuideBox[], tolerance: number = SNAP_TOLERANCE): SnapResult {
  const guides: Guide[] = [];
  const horizontal = bestOn(moving.x, moving.w, others, 'x', tolerance);
  const vertical = bestOn(moving.y, moving.h, others, 'y', tolerance);
  const x = moving.x + (horizontal?.delta ?? 0);
  const y = moving.y + (vertical?.delta ?? 0);
  if (horizontal) {
    guides.push({
      axis: 'x',
      at: horizontal.at,
      from: Math.min(y, horizontal.other.y),
      to: Math.max(y + moving.h, horizontal.other.y + horizontal.other.h),
    });
  }
  if (vertical) {
    guides.push({
      axis: 'y',
      at: vertical.at,
      from: Math.min(x, horizontal?.other.x ?? vertical.other.x),
      to: Math.max(x + moving.w, vertical.other.x + vertical.other.w),
    });
  }
  return { x, y, guides };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/alignmentGuides.test.ts"
```

Expected: PASS, 6 tests. If the "closest candidate wins" test fails, check that `bestOn` compares `Math.abs(delta)` and not raw delta.

- [ ] **Step 5: Wire the guides into the drag**

In `src/panels/design/DesignsView.tsx`:

Add the import:

```tsx
import { snapToNeighbours, type Guide } from '../../lib/design/alignmentGuides.js';
```

Add state next to the other drag state (near `const [marquee, setMarquee] = useState…`):

```tsx
const [guides, setGuides] = useState<Guide[]>([]);
```

In the drag `onMove` from Task 3, after computing `dx`/`dy` and before building `latest`, snap the *primary* dragged screen against every screen that is not moving, and shift the whole group by the correction so a multi-selection keeps its shape:

```tsx
        const anchor = origins.get(id);
        const still = nodes.filter((item) => !moving.has(item.prototypeId)).map((item) => ({ x: item.position.x, y: item.position.y, w: item.width, h: item.height }));
        const node = nodes.find((item) => item.prototypeId === id);
        let adjustX = 0;
        let adjustY = 0;
        if (anchor && node) {
          const snapped = snapToNeighbours({ x: anchor.x + dx, y: anchor.y + dy, w: node.width, h: node.height }, still);
          adjustX = snapped.x - (anchor.x + dx);
          adjustY = snapped.y - (anchor.y + dy);
          setGuides(snapped.guides);
        }
        latest = nodes.map((item) => {
          const origin = origins.get(item.prototypeId);
          return origin ? { ...item, position: { x: snapTo(origin.x + dx + adjustX, grid), y: snapTo(origin.y + dy + adjustY, grid) } } : item;
        });
        setDragNodes(latest);
```

In that branch's `onUp`, clear them — a guide left on screen after release reads as a broken render:

```tsx
        setGuides([]);
```

Render them inside `.ds-design-world`, immediately after the `{marquee ? … : null}` line so they sit above the screens:

```tsx
          {guides.map((guide, i) => <div key={i} className={`ds-guide ds-guide--${guide.axis}`}
            style={guide.axis === 'x'
              ? { left: guide.at, top: guide.from, height: guide.to - guide.from }
              : { top: guide.at, left: guide.from, width: guide.to - guide.from }} />)}
```

- [ ] **Step 6: Style the guides**

Append to `src/panels/design/designStudio.css`:

```css
/* Counter-scaling is deliberately skipped: a 1px world line reads as a hairline
   at every zoom the studio allows, and scaling it made it vanish when zoomed out. */
.design-studio .ds-guide { position:absolute; pointer-events:none; z-index:1200; background:var(--ds-accent); }
.design-studio .ds-guide--x { width:1px; }
.design-studio .ds-guide--y { height:1px; }
```

- [ ] **Step 7: Gate and commit**

```bash
npm --prefix brainrouter-desktop run typecheck && cd brainrouter-desktop && npx tsx --test "src/lib/design/alignmentGuides.test.ts"
```

Expected: typecheck clean, 6 tests pass.

```bash
git add brainrouter-desktop/src/lib/design/alignmentGuides.ts brainrouter-desktop/src/lib/design/alignmentGuides.test.ts brainrouter-desktop/src/panels/design/DesignsView.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(design): snap a dragged screen to its neighbours and show why"
```

---

### Task 5: Clicking empty canvas clears everything

**The defect.** The marquee's `onUp` calls `setSelection(…)` but never touches `annoIds`. Click a shape, then click empty canvas: the shape stays selected and the inspector keeps editing it, while nothing on screen looks selected. The two selection models drift apart.

**Files:**
- Modify: `brainrouter-desktop/src/panels/design/DesignsView.tsx`

**Interfaces:**
- Consumes: nothing. No new exports.

- [ ] **Step 1: Clear both selections on an empty-canvas click**

In `onShellPointerDown`, in the marquee branch's `onUp`, the current body is:

```tsx
    const onUp = (): void => {
      setMarquee((box) => {
        setSelection(box && (box.w > 2 || box.h > 2) ? marqueeSelect(screenItems, box) : []);
        return null;
      });
```

Replace the `setSelection` line with a version that also clears the annotation selection on a bare click:

```tsx
      setMarquee((box) => {
        const dragged = Boolean(box && (box.w > 2 || box.h > 2));
        setSelection(dragged ? marqueeSelect(screenItems, box!) : []);
        // A click on empty canvas deselects EVERYTHING. Clearing only the screen
        // selection left a shape selected with no visible highlight, and the
        // inspector kept editing it.
        if (!dragged) setAnnoIds([]);
        return null;
      });
```

- [ ] **Step 2: Typecheck**

```bash
npm --prefix brainrouter-desktop run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add brainrouter-desktop/src/panels/design/DesignsView.tsx
git commit -m "fix(design): clicking empty canvas clears the shape selection too"
```

---

### Task 6: The inspector stops going blank and stops lying

**Two defects in `DesignInspector.tsx`.**

1. Lines 26–27 gate the Code and AI panels on `element` (a prototype DOM element). The empty state on line 24 is gated on `!shapeMode`. So with a *shape* selected, clicking "Code" or "AI" renders **nothing at all** — the whole aside goes blank with no way to tell what happened.
2. `ShapeInspector` reads every field off `selected[0]`. Select three shapes with different fills and the panel shows the first one's fill as though it were the selection's. Editing then silently overwrites all three. Design tools show `Mixed` for exactly this reason.

**Files:**
- Create: `brainrouter-desktop/src/lib/design/mixedValues.ts`
- Create: `brainrouter-desktop/src/lib/design/mixedValues.test.ts`
- Modify: `brainrouter-desktop/src/panels/design/inspector/ShapeInspector.tsx`
- Modify: `brainrouter-desktop/src/panels/design/DesignInspector.tsx`

**Interfaces:**
- Produces: `MIXED: string`, `sharedValue(values: readonly string[]): string`
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Create `brainrouter-desktop/src/lib/design/mixedValues.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIXED, sharedValue } from './mixedValues.js';

test('one value reads as itself', () => {
  assert.equal(sharedValue(['#ff0000']), '#ff0000');
});

test('agreeing values read as the agreed value', () => {
  assert.equal(sharedValue(['12', '12', '12']), '12');
});

test('disagreeing values read as Mixed', () => {
  assert.equal(sharedValue(['12', '14']), MIXED);
});

test('an empty selection reads as empty, not Mixed', () => {
  // Nothing selected is not a disagreement — showing "Mixed" there would be a
  // lie in the other direction.
  assert.equal(sharedValue([]), '');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/mixedValues.test.ts"
```

Expected: FAIL — `Cannot find module './mixedValues.js'`.

- [ ] **Step 3: Write the module**

Create `brainrouter-desktop/src/lib/design/mixedValues.ts`:

```ts
// A multi-selection whose members disagree has no single value to show. Naming
// that explicitly beats showing the first member's value as if it spoke for the
// rest — the user edits what they see, and would overwrite the others blind.

export const MIXED = 'Mixed';

/** The value every member shares, `MIXED` when they disagree, `''` when empty. */
export function sharedValue(values: readonly string[]): string {
  if (values.length === 0) return '';
  const first = values[0];
  return values.every((value) => value === first) ? first : MIXED;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd brainrouter-desktop && npx tsx --test "src/lib/design/mixedValues.test.ts"
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Read every field across the whole selection**

In `src/panels/design/inspector/ShapeInspector.tsx`, add the import:

```tsx
import { MIXED, sharedValue } from '../../../lib/design/mixedValues.js';
```

Replace the `style` and geometry readers. The old `style` read `head` alone; these read the selection:

```tsx
  /** Every field speaks for the whole selection, so a disagreement shows as Mixed. */
  const style = (field: StyleField): string => sharedValue(selected.map((shape) => String(styleValue(shape, field))));
  const geometry = (field: 'x' | 'y' | 'w' | 'h'): string => sharedValue(selected.map((shape) => String(Math.round(shape[field]))));
  // "Mixed" is a label, not a number — committing it would write NaN.
  const number = (field: StyleField) => (value: string): void => { if (value.trim() && value !== MIXED) onStyle(field, Number(value)); };
  const geo = (field: 'x' | 'y' | 'w' | 'h') => (value: string): void => { if (value.trim() && value !== MIXED) onGeometry(field, Number(value)); };
```

Then swap the four Position fields to use them:

```tsx
      <Row>
        <Field label="X" value={geometry('x')} onChange={geo('x')} />
        <Field label="Y" value={geometry('y')} onChange={geo('y')} />
      </Row>
      <Row>
        <Field label="W" value={geometry('w')} onChange={geo('w')} />
        <Field label="H" value={geometry('h')} onChange={geo('h')} />
      </Row>
```

Note the dropped `type="number"`: a number input cannot display the string `Mixed`. Leave the remaining `style(...)`-fed fields as they are — they now return `Mixed` automatically, so drop `type="number"` from the Opacity, Radius, Width, Size and Weight `Field`s too, for the same reason.

- [ ] **Step 6: Give the Code and AI tabs something to say about a shape**

In `src/panels/design/DesignInspector.tsx`, replace lines 24–27 (the four conditional branches) with a version where every combination renders something:

```tsx
    {shapeMode && tab !== 'design' && <div className="ds-inspector-panel">
      <span className="ds-eyebrow">{tab === 'code' ? 'Canvas shape' : 'AI edit target'}</span>
      <p className="ds-inspector-copy">
        {shapes.length > 1 ? `${shapes.length} canvas layers are selected.` : `A canvas ${shapes[0].kind} is selected.`}
        {' '}Canvas shapes live on the annotation layer, not in the prototype&rsquo;s HTML — there is no markup to show or to hand to the chat. Use Inspect to pick a real element first.
      </p>
    </div>}
    {!shapeMode && !element && <div className="ds-inspector-empty"><Icon name="edit" size={18} /><p>Select a layer or use Inspect to edit the prototype.</p></div>}
    {!shapeMode && element && tab === 'design' && <DesignTab element={element} measured={measured} operations={operations} onOperationChange={onOperationChange} onSave={onSave} onRevert={onRevert} />}
    {!shapeMode && element && tab === 'code' && <CodeProperties element={element} measured={measured} />}
    {!shapeMode && element && tab === 'ai' && <div className="ds-inspector-panel">…unchanged AI panel body…</div>}
```

Keep the existing AI panel body verbatim; only its guard changes from `element &&` to `!shapeMode && element &&`.

- [ ] **Step 7: Gate and commit**

```bash
npm --prefix brainrouter-desktop run typecheck && cd brainrouter-desktop && npx tsx --test "src/lib/design/mixedValues.test.ts"
```

Expected: typecheck clean, 4 tests pass.

```bash
git add brainrouter-desktop/src/lib/design/mixedValues.ts brainrouter-desktop/src/lib/design/mixedValues.test.ts brainrouter-desktop/src/panels/design/inspector/ShapeInspector.tsx brainrouter-desktop/src/panels/design/DesignInspector.tsx
git commit -m "fix(design): the inspector never goes blank and says Mixed when it means it"
```

---

### Task 7: Full gate, live verification, docs

- [ ] **Step 1: Run the whole suite**

```bash
npm --prefix brainrouter-desktop test
```

Expected: `build:deps` and `typecheck` clean, then **562 tests passing** (543 existing + 3 + 6 + 6 + 4). If the count is lower, a new test file was not picked up — check it is named `*.test.ts` under `src/lib/design/`.

- [ ] **Step 2: Confirm the build**

```bash
npm --prefix brainrouter-desktop run build
```

Expected: `vite build` succeeds.

- [ ] **Step 3: Verify live in the browser preview**

Start the dev server with `preview_start {name: "desktop-dev"}`. **Restart it if it was already running** — a long-lived server accumulates failed HMR reloads, and a stale module graph is what produced the `emptyHistory is not defined` crash during diagnosis. Then open `http://localhost:5173/#design` and reload once so `main.tsx` reads the hash.

Check each, with evidence, not assumption:
1. The studio nav shows exactly `["Design", "Brands"]` — read `.ds-seg` text content.
2. Switching Design ↔ Brands ten times leaves `read_console_messages {onlyErrors: true}` empty.
3. Press on a screen header and release without moving: its `position` is unchanged (read the persisted canvas document from localStorage before and after).
4. Drag a screen near another's left edge: a `.ds-guide` element exists mid-drag and is gone after release.
5. Drag with shift held: one of `dx`/`dy` stays zero.
6. Select a shape, click empty canvas: the inspector returns to its empty state.
7. Select a shape, click the Code tab: the aside shows the explanation, not nothing.

- [ ] **Step 4: Update the docs**

In `docs/design/Design.md`, document the new interaction rules under the canvas section: the 4px drag threshold, shift axis-lock, neighbour snapping at 6 world units with guides, and empty-click deselect. Add a line to the inspector section about `Mixed`.

- [ ] **Step 5: Check the working tree before committing**

```bash
git status --short
```

`dist-electron/` will be dirty because `npm test` rebuilt it. Leave it out of the commit unless it was already staged intentionally.

```bash
git add docs/design/Design.md
git commit -m "docs(design): record the canvas interaction rules"
```

---

## Self-Review

**Spec coverage.** Four asks, all covered: tab-switch errors → Task 1; remove Canvas → Task 2; right-hand toolbar UX → Task 6; canvas drag-and-drop and object selection → Tasks 3, 4, 5.

**Open question carried into execution.** The open-pencil reference research was still running when this plan was written. Tasks 3–6 are grounded in defects I reproduced in *this* codebase, not in guesses about open-pencil, so they stand on their own. Where the research names a different constant (drag threshold, snap tolerance) or a different section order, adjust `DRAG_THRESHOLD` / `SNAP_TOLERANCE` and the inspector layout to match — and say so in the commit rather than silently keeping these values.

**Type consistency.** `GuideBox`/`Guide`/`SnapResult` are used in Task 4 only. `sharedValue`/`MIXED` in Task 6 only. `passedThreshold`/`constrainDelta` in Task 3, and Task 4's snapping code sits inside the `onMove` that Task 3 rewrites — so **Task 4 depends on Task 3 having landed first**. `StudioTab` narrows in Task 2; Task 1's boundary uses `tab` as its `resetKey`, which stays a string either way.
