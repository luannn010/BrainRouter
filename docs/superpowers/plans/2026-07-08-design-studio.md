# BrainRouter Design Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new, additive **Design Studio** side-panel to the BrainRouter desktop app that clones the claude.ai/design loop — a living **design system**, a **brand signature**, a **prototype preview canvas**, a **manual-test canvas**, and a **UI-fix chat** — skinned entirely in BrainRouter's "Memory Instrument" theme, reusing the existing prototype/webview/IPC infrastructure without touching any current UI.

**Architecture:** One lazy-loaded `DesignStudioPanel` (PanelId `design-studio`) hosts a segmented workbench. Pure logic (token model, brand signature, prototype metadata, fix-prompt) lives in `src/lib/design/` and is unit-tested with `node:test`/`tsx`. A thin host service `DesignHost` (`electron/designHost.ts`) lists/reads/seeds prototype HTML under the workspace `proto/` dir and is reached from the panel via the existing `bridgeQuery` promise helper. The **preview** and **test** canvases embed the same hardened `<webview>` the Browser panel uses (authorized `file://proto/…` src) and drive it with the existing `webviewBridge`. The **UI-fix chat** is a slim, decoupled composer that sends `start-turn` and reloads the preview when the agent finishes editing the prototype file. Everything the studio styles lives under a scoped `.design-studio` root that defines the Memory Instrument tokens, so the surrounding app chrome is never affected.

**Tech Stack:** React 18 + TypeScript (renderer), Electron 33 `<webview>`, Node's `node:test` runner via `tsx`, `@kinqs/brainrouter-core/prototype` helpers, plain CSS custom properties.

## Global Constraints

- **Additive only.** Do NOT modify any existing panel body, the sidebar, chat, or theme.css. The only edits to existing files are: registering the new PanelId (`Panel.tsx`), the lazy render case (`renderPanelBody.tsx`), the barrel export (`panels/index.ts`), one icon (`icons.tsx`), the host context field (`context.ts`), the host service construction (`host.ts`), and the `design:*` query handlers (`queries.ts`). Nothing else in existing files changes.
- **No "Claude" in visible content.** All copy is BrainRouter's. This is a BrainRouter tool.
- **Memory Instrument theme, scoped.** All studio surfaces use tokens defined under a `.design-studio` root: canvas Void `#0B0D0F`, panel Substrate `#14171A`, overlay Lifted `#1E2227`; text Frost `#ECEFF2` / Mist `#9BA3AC` / Ash `#5E6670`; the ONE accent **Signal `#34C28E`** (`--ds-accent`); Recall-Heat ramp Ember `#E0A063` → Coal `#C98F6E` → Slate `#6B7480` → Cinder `#3C434B` (graph/timeline data only, with a legend); semantic Rose `#E5675F` danger, Amber `#D9A441` warn. Fonts: `'Geist', ui-sans-serif, system-ui, sans-serif` (sans) and `'Geist Mono', ui-monospace, 'SF Mono', monospace` (mono, for ALL data). Radii chip 4 / control 6 / card 10 / panel 12. No serif, no Inter, no AI-purple, no neon/outer-glow, no emoji. Icons: reuse `icons.tsx` (Phosphor-style, `currentColor`, no color).
- **Testing = `node:test` only.** No vitest, no jest, no `@testing-library/react`, no jsdom. TDD applies to **pure functions** (`import test from 'node:test'; import assert from 'node:assert/strict';`). React panels are verified in the running app, not unit-tested. Dev single-file run: `tsx --test <path/to/file.test.ts>`.
- **Reuse, don't reinvent:** core prototype helpers (`reservePrototypePath`, `isAuthorizedPrototypePath`, `isPrototypeComplete`, `buildPrototypePrompt`, `buildDesignSteering`, `DesignContext`); the webview mount pattern + `webviewBridge`; `bridgeQuery` for IPC; `window.brainrouter.send({kind:'start-turn'})` + `window.brainrouter.onEvent` for the fix chat. Do NOT reuse `Composer` (36 required props).
- **Do NOT push.** All work stays local until the user explicitly asks. Commit locally per task.
- **Fonts:** the app does not self-host Geist today; the token stack degrades gracefully to system fonts. Self-hosting Geist `woff2` is a documented follow-up (see Task 10 Notes), not part of this plan.

---

## File Structure

**New — pure logic (renderer, `tsx`-tested):**
- `brainrouter-desktop/src/lib/design/designTokens.ts` — Memory Instrument token model (display data + canonical constants).
- `brainrouter-desktop/src/lib/design/designTokens.test.ts`
- `brainrouter-desktop/src/lib/design/signature.ts` — brand signature: mark geometry, wordmark, the canonical `BRAINROUTER_SIGNATURE` `DesignContext`, and `buildSignatureStamp`.
- `brainrouter-desktop/src/lib/design/signature.test.ts`
- `brainrouter-desktop/src/lib/design/prototypeMeta.ts` — id/title/sort/url helpers + `buildUiFixPrompt`.
- `brainrouter-desktop/src/lib/design/prototypeMeta.test.ts`

**New — host service (electron, compiled → `dist-electron`, tested there):**
- `brainrouter-desktop/electron/designHost.ts` — `DesignHost` (list/read/ensureSeed under `proto/`).
- `brainrouter-desktop/electron/designHost.test.ts`

**New — React panel + views:**
- `brainrouter-desktop/src/panels/DesignStudioPanel.tsx` — container + segmented nav + scoped theme root.
- `brainrouter-desktop/src/panels/design/designStudio.css` — scoped `.design-studio` tokens + component styles.
- `brainrouter-desktop/src/panels/design/SystemView.tsx` — living style guide.
- `brainrouter-desktop/src/panels/design/BrandSignature.tsx` — signature mark/wordmark/stamp.
- `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx` — webview preview + device sizing.
- `brainrouter-desktop/src/panels/design/TestCanvas.tsx` — webview + bridge controls.
- `brainrouter-desktop/src/panels/design/DesignChat.tsx` — slim UI-fix chat dock.
- `brainrouter-desktop/src/lib/design/usePrototypes.ts` — hook: seed + list + select via `bridgeQuery`.

**Modified — additive registration only:**
- `brainrouter-desktop/src/panels/Panel.tsx` — add `design-studio` to `PanelId` + `PANEL_DEFS`.
- `brainrouter-desktop/src/App/render/renderPanelBody.tsx` — lazy import + `case 'design-studio'`.
- `brainrouter-desktop/src/panels/index.ts` — barrel export.
- `brainrouter-desktop/src/icons.tsx` — one `design-studio` icon path.
- `brainrouter-desktop/electron/host/context.ts` — `design: DesignHost` field.
- `brainrouter-desktop/electron/host.ts` — construct `createDesignHost(workspaceRoot)`.
- `brainrouter-desktop/electron/host/queries.ts` — `design:*` handlers.

---

## Task 1: Memory Instrument token model

**Files:**
- Create: `brainrouter-desktop/src/lib/design/designTokens.ts`
- Test: `brainrouter-desktop/src/lib/design/designTokens.test.ts`

**Interfaces:**
- Produces: `MEMORY_INSTRUMENT` (const object), `type TokenSwatch = { name: string; token: string; value: string; role: string }`, `colorTokens(): TokenSwatch[]`, `heatRamp(): TokenSwatch[]`, `typeScale(): Array<{ role: string; family: 'sans'|'mono'; size: number; weight: number }>`, `radii(): Array<{ token: string; px: number }>`. Consumed by `SystemView` (Task 6) and asserted against `designStudio.css` (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// brainrouter-desktop/src/lib/design/designTokens.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_INSTRUMENT, colorTokens, heatRamp, typeScale, radii } from './designTokens.js';

// hue (0–360) of a #rrggbb color, or null for non-hex (e.g. rgba()) values
function hexHue(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h;
}

test('canonical Memory Instrument values are exact', () => {
  assert.equal(MEMORY_INSTRUMENT.accent, '#34C28E');
  assert.equal(MEMORY_INSTRUMENT.surfaceBase, '#0B0D0F');
  assert.equal(MEMORY_INSTRUMENT.surfaceRaised, '#14171A');
  assert.equal(MEMORY_INSTRUMENT.text, '#ECEFF2');
  assert.equal(MEMORY_INSTRUMENT.heat.hot, '#E0A063');
  assert.equal(MEMORY_INSTRUMENT.heat.cold, '#3C434B');
  assert.equal(MEMORY_INSTRUMENT.danger, '#E5675F');
});

test('colorTokens exposes exactly one accent and no AI-purple/indigo/violet', () => {
  const cols = colorTokens();
  const accents = cols.filter((c) => c.token === '--ds-accent');
  assert.equal(accents.length, 1);
  assert.equal(accents[0].value, '#34C28E');
  // a real guard: no token sits in the indigo/violet band (~255°–300°), the AI-design cliché
  for (const c of cols) {
    const h = hexHue(c.value);
    assert.ok(h === null || h < 255 || h > 300, `${c.name} (${c.value}) is in the AI-purple band`);
  }
});

test('heatRamp is the four-stop Ember→Cinder legend, hot first', () => {
  const ramp = heatRamp();
  assert.deepEqual(ramp.map((r) => r.value), ['#E0A063', '#C98F6E', '#6B7480', '#3C434B']);
});

test('typeScale sets all data rows in mono', () => {
  const scale = typeScale();
  const data = scale.find((r) => r.role === 'Data / Metric');
  assert.equal(data?.family, 'mono');
  assert.ok(scale.some((r) => r.role === 'Body' && r.family === 'sans'));
});

test('radii are the architectural 4/6/10/12 set', () => {
  assert.deepEqual(radii().map((r) => r.px), [4, 6, 10, 12]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test src/lib/design/designTokens.test.ts`
Expected: FAIL — `Cannot find module './designTokens.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// brainrouter-desktop/src/lib/design/designTokens.ts
/**
 * Memory Instrument — the canonical BrainRouter design tokens, as data.
 * The Design Studio's System view renders these; designStudio.css mirrors the
 * same values as scoped CSS custom properties (a test keeps them honest).
 */
export const MEMORY_INSTRUMENT = {
  surfaceBase: '#0B0D0F',
  surfaceRaised: '#14171A',
  surfaceOverlay: '#1E2227',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#ECEFF2',
  textSecondary: '#9BA3AC',
  textMuted: '#5E6670',
  accent: '#34C28E',
  accentPress: '#28A87C',
  accentWash: 'rgba(52,194,142,0.14)',
  heat: { hot: '#E0A063', warm: '#C98F6E', cool: '#6B7480', cold: '#3C434B' },
  danger: '#E5675F',
  warn: '#D9A441',
} as const;

export type TokenSwatch = { name: string; token: string; value: string; role: string };

export function colorTokens(): TokenSwatch[] {
  const M = MEMORY_INSTRUMENT;
  return [
    { name: 'Void', token: '--ds-bg', value: M.surfaceBase, role: 'Page canvas' },
    { name: 'Substrate', token: '--ds-surface', value: M.surfaceRaised, role: 'Panels, cards' },
    { name: 'Lifted', token: '--ds-overlay', value: M.surfaceOverlay, role: 'Popovers, active rows' },
    { name: 'Frost', token: '--ds-text', value: M.text, role: 'Primary text' },
    { name: 'Mist', token: '--ds-text-2', value: M.textSecondary, role: 'Secondary text' },
    { name: 'Ash', token: '--ds-text-3', value: M.textMuted, role: 'Metadata, disabled' },
    { name: 'Signal', token: '--ds-accent', value: M.accent, role: 'THE accent — action, active, live' },
    { name: 'Rose', token: '--ds-danger', value: M.danger, role: 'Contradiction, destructive' },
    { name: 'Amber', token: '--ds-warn', value: M.warn, role: 'Stale-vs-code caution' },
  ];
}

export function heatRamp(): TokenSwatch[] {
  const H = MEMORY_INSTRUMENT.heat;
  return [
    { name: 'Ember', token: '--ds-heat-hot', value: H.hot, role: 'Hot — recalled now' },
    { name: 'Coal', token: '--ds-heat-warm', value: H.warm, role: 'Warm — recently active' },
    { name: 'Slate', token: '--ds-heat-cool', value: H.cool, role: 'Cool — dormant' },
    { name: 'Cinder', token: '--ds-heat-cold', value: H.cold, role: 'Cold — archival' },
  ];
}

export function typeScale(): Array<{ role: string; family: 'sans' | 'mono'; size: number; weight: number }> {
  return [
    { role: 'Display', family: 'sans', size: 44, weight: 600 },
    { role: 'H1', family: 'sans', size: 28, weight: 600 },
    { role: 'H2', family: 'sans', size: 20, weight: 600 },
    { role: 'H3 / Section', family: 'sans', size: 16, weight: 500 },
    { role: 'Body', family: 'sans', size: 14, weight: 400 },
    { role: 'Label / Eyebrow', family: 'mono', size: 12, weight: 500 },
    { role: 'Data / Metric', family: 'mono', size: 13, weight: 500 },
  ];
}

export function radii(): Array<{ token: string; px: number }> {
  return [
    { token: '--ds-radius-chip', px: 4 },
    { token: '--ds-radius-control', px: 6 },
    { token: '--ds-radius-card', px: 10 },
    { token: '--ds-radius-panel', px: 12 },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test src/lib/design/designTokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/lib/design/designTokens.ts brainrouter-desktop/src/lib/design/designTokens.test.ts
git commit -m "feat(desktop): Design Studio — Memory Instrument token model"
```

---

## Task 2: Brand signature model

**Files:**
- Create: `brainrouter-desktop/src/lib/design/signature.ts`
- Test: `brainrouter-desktop/src/lib/design/signature.test.ts`

**Interfaces:**
- Consumes: `DesignContext` from `@kinqs/brainrouter-core/dist/prototype/prototypePrompt.js`.
- Produces: `BRAINROUTER_SIGNATURE: DesignContext`, `SIGNATURE_MARK: { nodes: Array<{ cx:number; cy:number; r:number; core?:boolean }>; edges: Array<[number, number]> }`, `WORDMARK: string`, `TAGLINE: string`, `buildSignatureStamp(input: StampInput): string`, `type StampInput = { branch?: string|null; commit?: string|null; protoId?: string|null; iso: string }`. Consumed by `BrandSignature` (Task 6) and `DesignChat`/prompt seeding (Tasks 3, 9).

- [ ] **Step 1: Write the failing test**

```ts
// brainrouter-desktop/src/lib/design/signature.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAINROUTER_SIGNATURE, SIGNATURE_MARK, WORDMARK, buildSignatureStamp } from './signature.js';

test('the brand signature seeds prototypes with Signal + dark, precise tone', () => {
  assert.equal(WORDMARK, 'BrainRouter');
  assert.equal(BRAINROUTER_SIGNATURE.brandColor, '#34C28E');
  assert.ok(BRAINROUTER_SIGNATURE.tone?.includes('dark'));
  assert.ok(BRAINROUTER_SIGNATURE.tone?.includes('high-contrast'));
  assert.match(BRAINROUTER_SIGNATURE.designType ?? '', /memory/i);
});

test('the mark is a memory node-graph: one core + three satellites, three edges', () => {
  assert.equal(SIGNATURE_MARK.nodes.length, 4);
  assert.equal(SIGNATURE_MARK.nodes.filter((n) => n.core).length, 1);
  assert.equal(SIGNATURE_MARK.edges.length, 3);
});

test('the stamp is a mono provenance readout, commit truncated to 7', () => {
  const stamp = buildSignatureStamp({ branch: 'feat/x', commit: '3a105892abc', protoId: 'welcome', iso: '2026-07-08T10:00:00.000Z' });
  assert.equal(stamp, 'brainrouter · feat/x · 3a10589 · welcome · 2026-07-08');
});

test('the stamp degrades gracefully when git context is missing', () => {
  assert.equal(buildSignatureStamp({ iso: '2026-07-08T10:00:00.000Z' }), 'brainrouter · 2026-07-08');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test src/lib/design/signature.test.ts`
Expected: FAIL — `Cannot find module './signature.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// brainrouter-desktop/src/lib/design/signature.ts
import type { DesignContext } from '@kinqs/brainrouter-core/dist/prototype/prototypePrompt.js';

export const WORDMARK = 'BrainRouter';
export const TAGLINE = 'The Memory Instrument';

/**
 * The canonical brand steer. Feeding this DesignContext to buildPrototypePrompt
 * makes every generated/fixed prototype on-identity: Signal accent, dark, precise.
 */
export const BRAINROUTER_SIGNATURE: DesignContext = {
  designType: 'developer memory instrument — a calm dark data dashboard',
  brandColor: '#34C28E',
  tone: ['dark', 'high-contrast', 'minimal', 'precise'],
};

/** The signature mark: a memory node-graph — one recalled core + three satellites. */
export const SIGNATURE_MARK: { nodes: Array<{ cx: number; cy: number; r: number; core?: boolean }>; edges: Array<[number, number]> } = {
  nodes: [
    { cx: 12, cy: 12, r: 3, core: true },
    { cx: 5, cy: 6, r: 1.6 },
    { cx: 19, cy: 7, r: 1.6 },
    { cx: 18, cy: 18, r: 1.6 },
  ],
  edges: [[0, 1], [0, 2], [0, 3]],
};

export type StampInput = { branch?: string | null; commit?: string | null; protoId?: string | null; iso: string };

/** A mono provenance readout: `brainrouter · <branch> · <commit7> · <protoId> · <date>`. */
export function buildSignatureStamp(input: StampInput): string {
  const parts = ['brainrouter'];
  if (input.branch) parts.push(input.branch);
  if (input.commit) parts.push(input.commit.slice(0, 7));
  if (input.protoId) parts.push(input.protoId);
  parts.push(input.iso.slice(0, 10));
  return parts.join(' · ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test src/lib/design/signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/lib/design/signature.ts brainrouter-desktop/src/lib/design/signature.test.ts
git commit -m "feat(desktop): Design Studio — brand signature model + DesignContext seed"
```

---

## Task 3: Prototype metadata helpers + UI-fix prompt

**Files:**
- Create: `brainrouter-desktop/src/lib/design/prototypeMeta.ts`
- Test: `brainrouter-desktop/src/lib/design/prototypeMeta.test.ts`

**Interfaces:**
- Consumes: `buildPrototypePrompt`, `buildDesignSteering` from core (imported inside `buildUiFixPrompt`); `BRAINROUTER_SIGNATURE` from Task 2.
- Produces: `type PrototypeEntry = { id: string; path: string; title: string; mtimeMs: number }`, `prototypeIdFromPath(relPath: string): string`, `prototypeTitleFrom(html: string, relPath: string): string`, `sortByRecent(entries: PrototypeEntry[]): PrototypeEntry[]`, `fileUrlFor(workspaceRoot: string, relPath: string): string`, `buildUiFixPrompt(input: { relPath: string; instruction: string; pickedRef?: string | null }): string`. `PrototypeEntry` is the shared shape the host returns (Task 4) and the hook/preview consume (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// brainrouter-desktop/src/lib/design/prototypeMeta.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { prototypeIdFromPath, prototypeTitleFrom, sortByRecent, fileUrlFor, buildUiFixPrompt } from './prototypeMeta.js';

test('id is the filename stem under proto/', () => {
  assert.equal(prototypeIdFromPath('proto/prototype-welcome.html'), 'prototype-welcome');
  assert.equal(prototypeIdFromPath('proto/prototype-1736200000000-3a105892.html'), 'prototype-1736200000000-3a105892');
});

test('title prefers <title>, falls back to a humanized filename', () => {
  assert.equal(prototypeTitleFrom('<title>Kanban Board</title>', 'proto/x.html'), 'Kanban Board');
  assert.equal(prototypeTitleFrom('<html></html>', 'proto/prototype-welcome.html'), 'Welcome');
});

test('sortByRecent is newest-first', () => {
  const sorted = sortByRecent([
    { id: 'a', path: 'proto/a.html', title: 'A', mtimeMs: 100 },
    { id: 'b', path: 'proto/b.html', title: 'B', mtimeMs: 300 },
    { id: 'c', path: 'proto/c.html', title: 'C', mtimeMs: 200 },
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ['b', 'c', 'a']);
});

test('fileUrlFor builds a forward-slash file:// url the webview policy accepts', () => {
  const url = fileUrlFor('C:\\ws', 'proto/prototype-welcome.html');
  assert.ok(url.startsWith('file:///'));
  assert.ok(url.endsWith('/proto/prototype-welcome.html'));
  assert.ok(!url.includes('\\'));
});

test('buildUiFixPrompt names the one file, the instruction, and stays on-brand + self-contained', () => {
  const p = buildUiFixPrompt({ relPath: 'proto/prototype-welcome.html', instruction: 'make the primary button use Signal', pickedRef: 'submit-btn' });
  assert.match(p, /proto\/prototype-welcome\.html/);
  assert.match(p, /make the primary button use Signal/);
  assert.match(p, /submit-btn/);
  assert.match(p, /self-contained/i);
  assert.match(p, /#34C28E/); // brand steer injected
});

test('buildUiFixPrompt omits the picked-element line when none is provided', () => {
  const p = buildUiFixPrompt({ relPath: 'proto/x.html', instruction: 'tighten spacing' });
  assert.doesNotMatch(p, /selected element/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test src/lib/design/prototypeMeta.test.ts`
Expected: FAIL — `Cannot find module './prototypeMeta.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// brainrouter-desktop/src/lib/design/prototypeMeta.ts
import { buildDesignSteering } from '@kinqs/brainrouter-core/dist/prototype/prototypePrompt.js';
import { BRAINROUTER_SIGNATURE } from './signature.js';

export type PrototypeEntry = { id: string; path: string; title: string; mtimeMs: number };

export function prototypeIdFromPath(relPath: string): string {
  const base = relPath.split('/').pop() ?? relPath;
  return base.replace(/\.html?$/i, '');
}

export function prototypeTitleFrom(html: string, relPath: string): string {
  const m = /<title>([^<]+)<\/title>/i.exec(html);
  if (m && m[1].trim()) return m[1].trim();
  const stem = prototypeIdFromPath(relPath).replace(/^prototype[-_]?/i, '').replace(/[-_]\d{10,}.*$/, '');
  const words = stem.replace(/[-_]+/g, ' ').trim();
  if (!words) return 'Untitled prototype';
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sortByRecent(entries: PrototypeEntry[]): PrototypeEntry[] {
  return [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function fileUrlFor(workspaceRoot: string, relPath: string): string {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = `${root}/${rel}`;
  return `file:///${full.replace(/^\/+/, '')}`;
}

/**
 * A tightly-scoped prompt: the agent edits ONE self-contained prototype file in
 * place, keeps it self-contained + on the BrainRouter Memory Instrument brand,
 * and — when the user picked an element in the Test canvas — targets it.
 */
export function buildUiFixPrompt(input: { relPath: string; instruction: string; pickedRef?: string | null }): string {
  const steer = buildDesignSteering(BRAINROUTER_SIGNATURE);
  const picked = input.pickedRef ? `\nThe selected element is \`[data-testid="${input.pickedRef}"]\` — scope the change to it unless the instruction says otherwise.` : '';
  return [
    `Edit the existing prototype file \`${input.relPath}\` in place to satisfy this UI change:`,
    ``,
    `> ${input.instruction}`,
    picked,
    ``,
    `Rules:`,
    `- Keep the file a SINGLE self-contained HTML document (inline CSS/JS, no external URLs).`,
    `- Preserve existing \`data-testid\` attributes so manual testing keeps working; add testids to any new interactive elements.`,
    `- Stay on the BrainRouter "Memory Instrument" brand:`,
    steer || `- Primary brand color: #34C28E — the single accent.`,
    `- Do not rename the file or create new files; write the whole updated document back to \`${input.relPath}\`.`,
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test src/lib/design/prototypeMeta.test.ts`
Expected: PASS (6 tests). (Note: this imports the compiled core `dist/`; ensure `npm --prefix ../packages/core run build` has run once, or run `npm run build:deps` from `brainrouter-desktop`.)

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/lib/design/prototypeMeta.ts brainrouter-desktop/src/lib/design/prototypeMeta.test.ts
git commit -m "feat(desktop): Design Studio — prototype metadata + UI-fix prompt builder"
```

---

## Task 4: DesignHost service + IPC wiring

**Files:**
- Create: `brainrouter-desktop/electron/designHost.ts`
- Test: `brainrouter-desktop/electron/designHost.test.ts`
- Modify: `brainrouter-desktop/electron/host/context.ts` (add `design` field)
- Modify: `brainrouter-desktop/electron/host.ts` (construct the service)
- Modify: `brainrouter-desktop/electron/host/queries.ts` (add `design:*` handlers)

**Interfaces:**
- Consumes: `isAuthorizedPrototypePath` from `@kinqs/brainrouter-core/dist/prototype/protoDetect.js`; `PrototypeEntry` shape from Task 3 (re-declared host-side to avoid a renderer import).
- Produces: `interface DesignHost { listPrototypes(): { prototypes: PrototypeEntry[] }; readPrototype(id: string): { path: string; content: string } | { error: string }; ensureSeed(): { path: string; created: boolean } }`, `createDesignHost(workspaceRoot: string): DesignHost`. Reached from the renderer via `bridgeQuery('design:list-prototypes')`, `bridgeQuery('design:read-prototype', { id })`, `bridgeQuery('design:ensure-seed')` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// brainrouter-desktop/electron/designHost.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDesignHost } from './designHost.js';

function ws(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-'));
  mkdirSync(path.join(dir, 'proto'), { recursive: true });
  return dir;
}

test('ensureSeed writes a welcome prototype only when proto/ is empty', () => {
  const dir = ws();
  try {
    const first = createDesignHost(dir).ensureSeed();
    assert.equal(first.created, true);
    assert.match(first.path, /^proto\/.*\.html$/);
    const second = createDesignHost(dir).ensureSeed();
    assert.equal(second.created, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('listPrototypes returns authorized proto html with title + id, newest first', () => {
  const dir = ws();
  try {
    writeFileSync(path.join(dir, 'proto', 'a.html'), '<title>Alpha</title>');
    writeFileSync(path.join(dir, 'proto', 'b.html'), '<title>Beta</title>');
    writeFileSync(path.join(dir, 'proto', 'notes.txt'), 'ignore me');
    const { prototypes } = createDesignHost(dir).listPrototypes();
    assert.equal(prototypes.length, 2);
    assert.ok(prototypes.every((p) => p.path.startsWith('proto/') && p.path.endsWith('.html')));
    assert.ok(prototypes.some((p) => p.title === 'Alpha'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readPrototype returns content for an authorized id and errors on traversal', () => {
  const dir = ws();
  try {
    writeFileSync(path.join(dir, 'proto', 'a.html'), '<title>Alpha</title><body>hi</body>');
    const host = createDesignHost(dir);
    const ok = host.readPrototype('a');
    assert.ok('content' in ok && ok.content.includes('hi'));
    const bad = host.readPrototype('../../etc/passwd');
    assert.ok('error' in bad);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd brainrouter-desktop && npx tsx --test electron/designHost.test.ts`
Expected: FAIL — `Cannot find module './designHost.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// brainrouter-desktop/electron/designHost.ts
/**
 * DesignHost — the host-side backend for the Design Studio's prototype canvases.
 * Lists / reads / seeds self-contained prototype HTML under the workspace `proto/`
 * dir, reusing core's `isAuthorizedPrototypePath` so we only ever touch files the
 * sandboxed <webview> is also allowed to load.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isAuthorizedPrototypePath } from '@kinqs/brainrouter-core/dist/prototype/protoDetect.js';

export type PrototypeEntry = { id: string; path: string; title: string; mtimeMs: number };
export interface DesignHost {
  listPrototypes(): { prototypes: PrototypeEntry[] };
  readPrototype(id: string): { path: string; content: string } | { error: string };
  ensureSeed(): { path: string; created: boolean };
}

function titleFrom(html: string, id: string): string {
  const m = /<title>([^<]+)<\/title>/i.exec(html);
  if (m && m[1].trim()) return m[1].trim();
  const words = id.replace(/^prototype[-_]?/i, '').replace(/[-_]\d{10,}.*$/, '').replace(/[-_]+/g, ' ').trim();
  return words ? words.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Untitled prototype';
}

const SEED_ID = 'prototype-welcome';

export function createDesignHost(workspaceRoot: string): DesignHost {
  const protoDir = path.join(workspaceRoot, 'proto');

  const resolveAuthorized = (id: string): string | null => {
    const rel = `proto/${id}.html`;
    if (!isAuthorizedPrototypePath(rel)) return null;
    const abs = path.resolve(workspaceRoot, rel);
    const inside = path.relative(workspaceRoot, abs);
    if (inside.startsWith('..') || path.isAbsolute(inside)) return null;
    return abs;
  };

  return {
    listPrototypes() {
      let names: string[] = [];
      try { names = fs.readdirSync(protoDir); } catch { return { prototypes: [] }; }
      const prototypes: PrototypeEntry[] = [];
      for (const name of names) {
        const rel = `proto/${name}`;
        if (!isAuthorizedPrototypePath(rel)) continue;
        const abs = path.join(protoDir, name);
        let content = '';
        let mtimeMs = 0;
        try { content = fs.readFileSync(abs, 'utf8'); mtimeMs = fs.statSync(abs).mtimeMs; } catch { continue; }
        const id = name.replace(/\.html?$/i, '');
        prototypes.push({ id, path: rel, title: titleFrom(content, id), mtimeMs });
      }
      prototypes.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return { prototypes };
    },

    readPrototype(id) {
      const abs = resolveAuthorized(id);
      if (!abs) return { error: 'not an authorized prototype path' };
      try { return { path: `proto/${id}.html`, content: fs.readFileSync(abs, 'utf8') }; }
      catch (err) { return { error: err instanceof Error ? err.message : String(err) }; }
    },

    ensureSeed() {
      const rel = `proto/${SEED_ID}.html`;
      const abs = path.join(protoDir, `${SEED_ID}.html`);
      try {
        const existing = fs.existsSync(protoDir) ? fs.readdirSync(protoDir).filter((n) => /\.html?$/i.test(n)) : [];
        if (existing.length > 0) return { path: existing.includes(`${SEED_ID}.html`) ? rel : `proto/${existing[0]}`, created: false };
      } catch { /* fall through to create */ }
      fs.mkdirSync(protoDir, { recursive: true });
      fs.writeFileSync(abs, SEED_HTML, 'utf8');
      return { path: rel, created: true };
    },
  };
}

/** A minimal on-brand starter so the Preview/Test canvases are never empty. */
const SEED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>Welcome</title>
<style>
:root{--bg:#0B0D0F;--surface:#14171A;--text:#ECEFF2;--mut:#9BA3AC;--accent:#34C28E;--border:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);
color:var(--text);font-family:ui-sans-serif,system-ui,sans-serif}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px;max-width:420px;text-align:center}
h1{font-size:28px;margin:0 0 8px}p{color:var(--mut);margin:0 0 24px;line-height:1.5}
button{background:var(--accent);color:#06140E;border:0;border-radius:6px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}
.dot{display:inline-block;width:8px;height:8px;border-radius:9999px;background:var(--accent);margin-right:6px;vertical-align:middle}
</style></head><body>
<main class="card"><h1><span class="dot"></span>BrainRouter prototype</h1>
<p>Edit me from the UI-fix chat, preview me here, and test me hands-on. Memory Instrument, self-contained.</p>
<button data-testid="primary-cta">Recall</button></main></body></html>`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd brainrouter-desktop && npx tsx --test electron/designHost.test.ts`
Expected: PASS (3 tests).

(This dev-loop command runs the `.test.ts` directly via `tsx` and does NOT invoke `build:electron`, so it is unaffected by the pre-existing `build:electron` breakage on this branch — see Task 10 Step 1. Run `npm run build:deps` once first so the core `dist/prototype/*` that the service imports is present.)

- [ ] **Step 5: Wire the service into HostContext (additive field)**

In `brainrouter-desktop/electron/host/context.ts`, add the import near the other host-service imports and one field to the `HostContext` interface, immediately after the `uitest: UiTestHost;` line:

```ts
// add near the top imports:
import type { DesignHost } from '../designHost.js';

// inside interface HostContext, right after `uitest: UiTestHost;`:
  // DESIGN STUDIO — lists/reads/seeds prototypes for the preview + test canvases.
  design: DesignHost;
```

- [ ] **Step 6: Construct the service in host.ts**

In `brainrouter-desktop/electron/host.ts`, the `HostContext` is assembled in `main()` as a single object literal — `const ctx: HostContext = { … }` (≈ line 953, verified). `workspaceRoot` is already in scope there (defined ≈ line 243). Add the import and one field to that literal:

```ts
// add the import at top of host.ts:
import { createDesignHost } from './designHost.js';

// add to the `const ctx: HostContext = { … }` literal (alongside the other services):
  design: createDesignHost(workspaceRoot),
```

(Note: `uitest` is passed into that literal as a **shorthand** property from a local binding, not as a literal `uitest:` key — so search for `const ctx: HostContext = {`, not for `uitest:`. Add `design:` as a normal keyed property.)

- [ ] **Step 7: Add the `design:*` handlers in queries.ts**

In `brainrouter-desktop/electron/host/queries.ts`, add `design` to the `ctx` destructure at the top of `buildQueries` (next to `uitest`):

```ts
  const {
    uitest,
    design,
    // ...existing destructured fields...
  } = ctx;
```

Then add these handlers to the returned handler object (alongside the `uitest:*` handlers):

```ts
      'design:list-prototypes': () => {
        try { return design.listPrototypes(); }
        catch (err) { return { error: err instanceof Error ? err.message : String(err) }; }
      },
      'design:read-prototype': (args) => {
        const id = typeof args.id === 'string' ? args.id : '';
        return id ? design.readPrototype(id) : { error: 'missing id' };
      },
      'design:ensure-seed': () => {
        try { return design.ensureSeed(); }
        catch (err) { return { error: err instanceof Error ? err.message : String(err) }; }
      },
```

- [ ] **Step 8: Typecheck the electron project**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.electron.json --noEmit`
Expected: no errors (confirms the `HostContext` field, the `host.ts` literal, and the handlers all type-align).

- [ ] **Step 9: Commit**

```bash
git add brainrouter-desktop/electron/designHost.ts brainrouter-desktop/electron/designHost.test.ts brainrouter-desktop/electron/host/context.ts brainrouter-desktop/electron/host.ts brainrouter-desktop/electron/host/queries.ts
git commit -m "feat(desktop): Design Studio — DesignHost service + design:* IPC handlers"
```

---

## Task 5: Panel registration + Design Studio shell

**Files:**
- Create: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx`
- Create: `brainrouter-desktop/src/panels/design/designStudio.css`
- Modify: `brainrouter-desktop/src/panels/Panel.tsx`
- Modify: `brainrouter-desktop/src/App/render/renderPanelBody.tsx`
- Modify: `brainrouter-desktop/src/panels/index.ts`
- Modify: `brainrouter-desktop/src/icons.tsx`

**Interfaces:**
- Produces: `DesignStudioPanel` (default-less named export), `type StudioTab = 'system' | 'preview' | 'test'`. Consumes token/CSS scope; view bodies are placeholders here and filled in Tasks 6–9.

- [ ] **Step 1: Register the PanelId (Panel.tsx)**

Change the `PanelId` union's tail in `brainrouter-desktop/src/panels/Panel.tsx`:

```ts
// ...existing ids... | 'memory' | 'prototype' | 'uitest' | 'design-studio';
```

Add a `PANEL_DEFS` entry (place it near `prototype`/`uitest`):

```ts
  { id: 'design-studio', title: 'Design Studio', icon: 'design-studio' },
```

**Do NOT add `design-studio` to `HIDDEN_MANUAL_PANEL_IDS`** (`Panel.tsx:~42`). The Views picker renders `MANUAL_PANEL_DEFS = PANEL_DEFS.filter((d) => !HIDDEN_MANUAL_PANEL_IDS.has(d.id))` (`Panel.tsx:51`, `PanelPicker:83`), so a plain `PANEL_DEFS` entry surfaces the panel automatically as long as it stays out of the hidden set. (Verified.)

- [ ] **Step 2: Add the icon (icons.tsx)**

In `brainrouter-desktop/src/icons.tsx`, add to the `PATHS` record (a memory node-graph mark, matching the 16×16 `currentColor` convention):

```tsx
  'design-studio': <><circle cx="8" cy="8" r="2" /><circle cx="3.5" cy="4" r="1" /><circle cx="12.5" cy="4.5" r="1" /><circle cx="12" cy="12.5" r="1" /><path d="M8 8 3.5 4M8 8l4.5-3.5M8 8l4 4.5" /></>,
```

- [ ] **Step 3: Add the lazy render case (renderPanelBody.tsx)**

Near the other `lazy(...)` panel imports at the top of `brainrouter-desktop/src/App/render/renderPanelBody.tsx`:

```ts
const DesignStudioPanel = lazy(() => import('../../panels/DesignStudioPanel.js').then((m) => ({ default: m.DesignStudioPanel })));
```

Add the case in the `renderPanelBody` switch (next to `case 'prototype'`):

```tsx
      case 'design-studio':
        return <Suspense fallback={<div className="row status"><span className="spinner" /> Loading…</div>}><DesignStudioPanel workspaceRoot={info.workspaceRoot} branch={branches.current} /></Suspense>;
```

(`info` and `branches` are already in the `renderPanelBody` closure — they're used by other cases like `context`/`review`. Confirm by grep before wiring; if `info.workspaceRoot`/`branches.current` are not in scope in this file, pass `undefined` and read them inside the panel via `bridgeQuery('info', {})` instead.)

- [ ] **Step 4: Export from the barrel (index.ts)**

Add to `brainrouter-desktop/src/panels/index.ts`:

```ts
export { DesignStudioPanel } from './DesignStudioPanel.js';
```

- [ ] **Step 5: Create the scoped stylesheet**

```css
/* brainrouter-desktop/src/panels/design/designStudio.css */
/* Memory Instrument — scoped so the surrounding app chrome is untouched. */
.design-studio {
  --ds-bg:#0B0D0F; --ds-surface:#14171A; --ds-overlay:#1E2227;
  --ds-border:rgba(255,255,255,0.08); --ds-border-strong:rgba(255,255,255,0.14);
  --ds-text:#ECEFF2; --ds-text-2:#9BA3AC; --ds-text-3:#5E6670;
  --ds-accent:#34C28E; --ds-accent-press:#28A87C; --ds-accent-wash:rgba(52,194,142,0.14);
  --ds-heat-hot:#E0A063; --ds-heat-warm:#C98F6E; --ds-heat-cool:#6B7480; --ds-heat-cold:#3C434B;
  --ds-danger:#E5675F; --ds-warn:#D9A441;
  --ds-font:"Geist",ui-sans-serif,system-ui,sans-serif;
  --ds-mono:"Geist Mono",ui-monospace,"SF Mono",Consolas,monospace;
  --ds-radius-chip:4px; --ds-radius-control:6px; --ds-radius-card:10px; --ds-radius-panel:12px;
  --ds-elev-inset:inset 0 1px 0 rgba(255,255,255,0.05);
  --ds-shadow-sm:0 1px 2px rgba(0,0,0,0.35),0 1px 1px rgba(0,0,0,0.22);
  display:flex; flex-direction:column; height:100%;
  background:var(--ds-bg); color:var(--ds-text);
  font-family:var(--ds-font); font-size:14px; line-height:1.5;
}
.design-studio *[data-mono], .design-studio .ds-mono { font-family:var(--ds-mono); }
.design-studio .ds-nav { display:flex; gap:2px; padding:8px; border-bottom:1px solid var(--ds-border); background:var(--ds-surface); align-items:center; }
.design-studio .ds-seg { background:transparent; color:var(--ds-text-2); border:0; padding:6px 12px; border-radius:var(--ds-radius-control); font:inherit; cursor:pointer; }
.design-studio .ds-seg[aria-selected="true"] { background:var(--ds-accent-wash); color:var(--ds-text); box-shadow:inset 0 0 0 1px var(--ds-border-strong); }
.design-studio .ds-nav-spacer { flex:1; }
.design-studio .ds-chat-toggle { background:transparent; color:var(--ds-text-2); border:1px solid var(--ds-border-strong); border-radius:var(--ds-radius-control); padding:6px 10px; font:inherit; cursor:pointer; }
.design-studio .ds-chat-toggle[aria-pressed="true"] { color:var(--ds-accent); border-color:var(--ds-accent); }
.design-studio .ds-body { flex:1; min-height:0; display:flex; }
.design-studio .ds-view { flex:1; min-width:0; overflow:auto; }
.design-studio .ds-eyebrow { font-family:var(--ds-mono); font-size:12px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ds-text-2); }
.design-studio .ds-card { background:var(--ds-surface); border:1px solid var(--ds-border); border-radius:var(--ds-radius-card); }
.design-studio .ds-empty { color:var(--ds-text-3); padding:24px; font-family:var(--ds-mono); font-size:13px; }
/* live status dot — the one signature loop */
.design-studio .ds-dot { width:8px; height:8px; border-radius:9999px; background:var(--ds-accent); display:inline-block; }
.design-studio .ds-dot--live { animation:ds-breathe 2.4s ease-in-out infinite; }
@keyframes ds-breathe { 0%,100%{opacity:.5} 50%{opacity:1} }
@media (prefers-reduced-motion: reduce) { .design-studio .ds-dot--live { animation:none; } }
```

- [ ] **Step 6: Create the panel shell**

```tsx
// brainrouter-desktop/src/panels/DesignStudioPanel.tsx
import React, { useState } from 'react';
import './design/designStudio.css';

export type StudioTab = 'system' | 'preview' | 'test';

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'preview', label: 'Preview' },
  { id: 'test', label: 'Test' },
];

export function DesignStudioPanel({ workspaceRoot, branch }: { workspaceRoot?: string; branch?: string | null }): React.ReactElement {
  const [tab, setTab] = useState<StudioTab>('system');
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="design-studio">
      <div className="ds-nav" role="tablist" aria-label="Design Studio">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="ds-seg" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <span className="ds-nav-spacer" />
        <button className="ds-chat-toggle" aria-pressed={chatOpen} onClick={() => setChatOpen((v) => !v)}>Fix chat</button>
      </div>
      <div className="ds-body">
        <div className="ds-view" role="tabpanel">
          {tab === 'system' && <div className="ds-empty">System view — Task 6.</div>}
          {tab === 'preview' && <div className="ds-empty">Preview canvas — Task 7.</div>}
          {tab === 'test' && <div className="ds-empty">Test canvas — Task 8.</div>}
        </div>
        {chatOpen && <div className="ds-empty" style={{ width: 320, borderLeft: '1px solid var(--ds-border)' }}>Fix chat — Task 9.</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + verify the panel opens**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit`
Expected: no errors.

Then verify in the app: `cd brainrouter-desktop && npm run start:fast` (assumes deps already built once via `npm run build:deps`). In the app, open the **Views** picker (the `PanelPicker`), click **Design Studio**. Expected: the panel opens on a Void (`#0B0D0F`) ground with a Signal-tinted **System** segment selected, and the three tabs + **Fix chat** toggle switch their placeholder bodies. The surrounding app chrome is unchanged.

- [ ] **Step 8: Commit**

```bash
git add brainrouter-desktop/src/panels/DesignStudioPanel.tsx brainrouter-desktop/src/panels/design/designStudio.css brainrouter-desktop/src/panels/Panel.tsx brainrouter-desktop/src/App/render/renderPanelBody.tsx brainrouter-desktop/src/panels/index.ts brainrouter-desktop/src/icons.tsx
git commit -m "feat(desktop): Design Studio — panel registration + Memory Instrument shell"
```

---

## Task 6: System view — living design system + brand signature

**Files:**
- Create: `brainrouter-desktop/src/panels/design/SystemView.tsx`
- Create: `brainrouter-desktop/src/panels/design/BrandSignature.tsx`
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx` (render `<SystemView>`)
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css` (append System/signature styles)

**Interfaces:**
- Consumes: `colorTokens`, `heatRamp`, `typeScale`, `radii` (Task 1); `SIGNATURE_MARK`, `WORDMARK`, `TAGLINE`, `BRAINROUTER_SIGNATURE`, `buildSignatureStamp` (Task 2).
- Produces: `SystemView`, `BrandSignature` components.

- [ ] **Step 1: Create BrandSignature**

```tsx
// brainrouter-desktop/src/panels/design/BrandSignature.tsx
import React from 'react';
import { SIGNATURE_MARK, WORDMARK, TAGLINE, BRAINROUTER_SIGNATURE, buildSignatureStamp } from '../../lib/design/signature.js';

export function BrandSignature({ branch, commit, iso }: { branch?: string | null; commit?: string | null; iso: string }): React.ReactElement {
  const stamp = buildSignatureStamp({ branch, commit, iso });
  return (
    <section className="ds-card ds-sig">
      <p className="ds-eyebrow">Brand signature</p>
      <div className="ds-sig-lockup">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {SIGNATURE_MARK.edges.map(([a, b], i) => (
            <line key={i} x1={SIGNATURE_MARK.nodes[a].cx} y1={SIGNATURE_MARK.nodes[a].cy} x2={SIGNATURE_MARK.nodes[b].cx} y2={SIGNATURE_MARK.nodes[b].cy} stroke="#34C28E" strokeWidth="1.2" opacity="0.6" />
          ))}
          {SIGNATURE_MARK.nodes.map((n, i) => (
            <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill={n.core ? '#34C28E' : 'none'} stroke="#34C28E" strokeWidth={n.core ? 0 : 1.4} />
          ))}
        </svg>
        <div>
          <div className="ds-sig-word">{WORDMARK}</div>
          <div className="ds-eyebrow">{TAGLINE}</div>
        </div>
      </div>
      <div className="ds-sig-steer">
        <span className="ds-chip" data-mono>type · {BRAINROUTER_SIGNATURE.designType}</span>
        <span className="ds-chip" data-mono>accent · {BRAINROUTER_SIGNATURE.brandColor}</span>
        {(BRAINROUTER_SIGNATURE.tone ?? []).map((t) => <span key={t} className="ds-chip" data-mono>{t}</span>)}
      </div>
      <p className="ds-sig-stamp" data-mono>{stamp}</p>
    </section>
  );
}
```

- [ ] **Step 2: Create SystemView**

```tsx
// brainrouter-desktop/src/panels/design/SystemView.tsx
import React from 'react';
import { colorTokens, heatRamp, typeScale, radii } from '../../lib/design/designTokens.js';
import { BrandSignature } from './BrandSignature.js';

export function SystemView({ branch, commit, iso }: { branch?: string | null; commit?: string | null; iso: string }): React.ReactElement {
  return (
    <div className="ds-system">
      <BrandSignature branch={branch} commit={commit} iso={iso} />

      <section>
        <p className="ds-eyebrow">Color · one Signal accent</p>
        <div className="ds-swatches">
          {colorTokens().map((c) => (
            <div key={c.token} className="ds-swatch">
              <span className="ds-swatch-chip" style={{ background: c.value }} />
              <div><div className="ds-swatch-name">{c.name}</div><div className="ds-swatch-meta" data-mono>{c.token} · {c.value}</div><div className="ds-swatch-role">{c.role}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="ds-eyebrow">Recall Heat · graph/timeline data only</p>
        <div className="ds-heat">
          {heatRamp().map((h) => (
            <div key={h.token} className="ds-heat-stop"><span className="ds-heat-chip" style={{ background: h.value }} /><span data-mono>{h.name}</span><span className="ds-swatch-meta" data-mono>{h.value}</span></div>
          ))}
        </div>
      </section>

      <section>
        <p className="ds-eyebrow">Type · Geist + Geist Mono</p>
        <div className="ds-type">
          {typeScale().map((t) => (
            <div key={t.role} className="ds-type-row" style={{ fontFamily: t.family === 'mono' ? 'var(--ds-mono)' : 'var(--ds-font)', fontSize: t.size, fontWeight: t.weight }}>
              {t.role} <span className="ds-swatch-meta" data-mono>{t.size}/{t.weight} · {t.family}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="ds-eyebrow">Components</p>
        <div className="ds-specimens">
          <button className="ds-btn ds-btn--accent">Recall</button>
          <button className="ds-btn ds-btn--ghost">Dismiss</button>
          <span className="ds-status"><span className="ds-dot ds-dot--live" /> live · auto-route</span>
          <span className="ds-chip" data-mono>source · ts · conf 0.82</span>
          <span className="ds-node ds-node--fact">fact node</span>
          <span className="ds-node ds-node--inferred">inferred node</span>
        </div>
        <div className="ds-radii">
          {radii().map((r) => <span key={r.token} className="ds-radii-chip" style={{ borderRadius: r.px }} data-mono>{r.px}px</span>)}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Append System/signature styles to designStudio.css**

```css
/* --- System view --- */
.design-studio .ds-system { padding:16px; display:flex; flex-direction:column; gap:24px; }
.design-studio .ds-sig { padding:16px; display:flex; flex-direction:column; gap:12px; }
.design-studio .ds-sig-lockup { display:flex; align-items:center; gap:12px; }
.design-studio .ds-sig-word { font-size:20px; font-weight:600; letter-spacing:-0.01em; }
.design-studio .ds-sig-steer { display:flex; flex-wrap:wrap; gap:6px; }
.design-studio .ds-sig-stamp { color:var(--ds-text-3); font-size:12px; margin:0; }
.design-studio .ds-chip { font-family:var(--ds-mono); font-size:12px; color:var(--ds-text-2); background:var(--ds-overlay); border-radius:var(--ds-radius-chip); padding:2px 8px; }
.design-studio .ds-swatches { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
.design-studio .ds-swatch { display:flex; gap:10px; align-items:center; }
.design-studio .ds-swatch-chip { width:36px; height:36px; border-radius:var(--ds-radius-control); border:1px solid var(--ds-border); flex:none; }
.design-studio .ds-swatch-name { font-weight:500; }
.design-studio .ds-swatch-meta { color:var(--ds-text-3); font-size:12px; }
.design-studio .ds-swatch-role { color:var(--ds-text-2); font-size:12px; }
.design-studio .ds-heat { display:flex; gap:0; border-radius:var(--ds-radius-card); overflow:hidden; border:1px solid var(--ds-border); width:max-content; }
.design-studio .ds-heat-stop { display:flex; flex-direction:column; gap:4px; padding:10px 14px; font-size:12px; align-items:center; }
.design-studio .ds-heat-chip { width:28px; height:16px; border-radius:3px; }
.design-studio .ds-type { display:flex; flex-direction:column; gap:8px; }
.design-studio .ds-type-row { color:var(--ds-text); }
.design-studio .ds-specimens { display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
.design-studio .ds-btn { border:0; border-radius:var(--ds-radius-control); padding:8px 14px; font:inherit; font-weight:500; cursor:pointer; box-shadow:var(--ds-elev-inset); }
.design-studio .ds-btn--accent { background:var(--ds-accent); color:#06140E; }
.design-studio .ds-btn--accent:active { transform:scale(.98); background:var(--ds-accent-press); }
.design-studio .ds-btn--ghost { background:transparent; color:var(--ds-text); box-shadow:inset 0 0 0 1px var(--ds-border-strong); }
.design-studio .ds-status { display:inline-flex; align-items:center; gap:6px; color:var(--ds-text-2); font-family:var(--ds-mono); font-size:12px; }
.design-studio .ds-node { padding:8px 12px; border-radius:var(--ds-radius-card); background:var(--ds-surface); box-shadow:var(--ds-elev-inset); font-size:13px; }
.design-studio .ds-node--fact { border:1px solid var(--ds-border-strong); }
.design-studio .ds-node--inferred { border:1px dashed var(--ds-border-strong); }
.design-studio .ds-radii { display:flex; gap:10px; margin-top:12px; }
.design-studio .ds-radii-chip { border:1px solid var(--ds-border-strong); padding:10px 12px; color:var(--ds-text-2); font-size:12px; }
```

- [ ] **Step 4: Render SystemView in the shell**

In `DesignStudioPanel.tsx`, replace the `tab === 'system'` placeholder:

```tsx
import { SystemView } from './design/SystemView.js';
// ...
{tab === 'system' && <SystemView branch={branch} commit={null} iso={new Date().toISOString()} />}
```

- [ ] **Step 5: Typecheck + verify**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit` → no errors.
Verify in app (`npm run start:fast` → Views → Design Studio → System): the signature lockup (node-graph mark + "BrainRouter" + "The Memory Instrument" + steer chips + mono stamp), the 9 color swatches with exactly one Signal, the four-stop heat legend, the Geist type scale, and the component specimens (accent/ghost buttons, breathing live dot, provenance chip, solid=fact/dashed=inferred nodes, radii chips) all render on Void. No purple, no emoji.

- [ ] **Step 6: Commit**

```bash
git add brainrouter-desktop/src/panels/design/SystemView.tsx brainrouter-desktop/src/panels/design/BrandSignature.tsx brainrouter-desktop/src/panels/DesignStudioPanel.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(desktop): Design Studio — living design system + brand signature view"
```

---

## Task 7: Preview canvas

**Files:**
- Create: `brainrouter-desktop/src/lib/design/usePrototypes.ts`
- Create: `brainrouter-desktop/src/panels/design/PreviewCanvas.tsx`
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx` (share prototype state; render `<PreviewCanvas>`)
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css` (append preview styles)

**Interfaces:**
- Consumes: `bridgeQuery` from `../../lib/bridgeQuery.js`; `PrototypeEntry`, `fileUrlFor`, `sortByRecent` (Task 3); `WebviewEl` from `../../lib/uitest/webviewBridge.js`.
- Produces: `usePrototypes(): PrototypesApi` where `interface PrototypesApi { entries: PrototypeEntry[]; selected: PrototypeEntry | null; select(id: string): void; refresh(): void; loading: boolean; error: string | null }`; `PreviewCanvas` component; `type Device = 'desktop'|'tablet'|'phone'`. The `usePrototypes` state is lifted into `DesignStudioPanel` so Preview, Test, and Chat share one selection. (Signature matches the Step-1 implementation: no-arg hook, `refresh()` not `reload()`.)

- [ ] **Step 1: Create the usePrototypes hook**

```ts
// brainrouter-desktop/src/lib/design/usePrototypes.ts
import { useCallback, useEffect, useState } from 'react';
import { bridgeQuery } from '../bridgeQuery.js';
import { sortByRecent, type PrototypeEntry } from './prototypeMeta.js';

export interface PrototypesApi {
  entries: PrototypeEntry[];
  selected: PrototypeEntry | null;
  select: (id: string) => void;
  refresh: () => void;
  loading: boolean;
  error: string | null;
}

export function usePrototypes(): PrototypesApi {
  const [entries, setEntries] = useState<PrototypeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await bridgeQuery('design:ensure-seed', {});
      const res = await bridgeQuery<{ prototypes?: PrototypeEntry[]; error?: string }>('design:list-prototypes', {});
      if (res?.error) throw new Error(res.error);
      const list = sortByRecent(res?.prototypes ?? []);
      setEntries(list);
      setSelectedId((cur) => cur && list.some((e) => e.id === cur) ? cur : (list[0]?.id ?? null));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return {
    entries,
    selected: entries.find((e) => e.id === selectedId) ?? null,
    select: setSelectedId,
    refresh: () => void load(),
    loading,
    error,
  };
}
```

- [ ] **Step 2: Create PreviewCanvas**

```tsx
// brainrouter-desktop/src/panels/design/PreviewCanvas.tsx
import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import type { WebviewEl } from '../../lib/uitest/webviewBridge.js';
import { fileUrlFor, type PrototypeEntry } from '../../lib/design/prototypeMeta.js';

export type Device = 'desktop' | 'tablet' | 'phone';
const DEVICE_W: Record<Device, number | null> = { desktop: null, tablet: 820, phone: 390 };

export interface PreviewHandle { reload: () => void; getWebview: () => WebviewEl | null; }

export const PreviewCanvas = forwardRef<PreviewHandle, {
  workspaceRoot?: string;
  selected: PrototypeEntry | null;
  device: Device;
  onWebviewReady?: (wv: WebviewEl) => void;
}>(function PreviewCanvas({ workspaceRoot, selected, device, onWebviewReady }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wvRef = useRef<WebviewEl | null>(null);

  // Create the hardened <webview> once (main.ts already gates its src via webviewPolicy).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const wv = document.createElement('webview') as unknown as WebviewEl;
    wv.setAttribute('src', 'data:text/html,<body style="background:%230B0D0F"></body>');
    wv.setAttribute('partition', 'persist:design-studio');
    wv.style.width = '100%'; wv.style.height = '100%'; wv.style.border = '0';
    host.appendChild(wv);
    wvRef.current = wv;
    const onReady = (): void => { if (onWebviewReady) onWebviewReady(wv); };
    wv.addEventListener('dom-ready', onReady);
    return () => { try { host.removeChild(wv); } catch { /* ignore */ } wvRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the selected prototype as an authorized file:// url.
  useEffect(() => {
    const wv = wvRef.current;
    if (!wv || !selected || !workspaceRoot) return;
    const url = fileUrlFor(workspaceRoot, selected.path);
    wv.loadURL(url).catch(() => { /* policy refusal or missing file — surfaced by did-fail-load */ });
  }, [selected?.path, workspaceRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ reload: () => wvRef.current?.reload(), getWebview: () => wvRef.current }), []);

  const maxW = DEVICE_W[device];
  return (
    <div className="ds-preview">
      <div className={`ds-stage ds-stage--${device}`} style={maxW ? { maxWidth: maxW } : undefined} ref={hostRef} />
      {!selected && <div className="ds-empty">No prototypes yet. The seed loads automatically — or generate one from the Fix chat.</div>}
    </div>
  );
});
```

- [ ] **Step 3: Append preview styles**

```css
/* --- Preview / Test canvases --- */
.design-studio .ds-canvas-bar { display:flex; align-items:center; gap:8px; padding:8px; border-bottom:1px solid var(--ds-border); background:var(--ds-surface); }
.design-studio .ds-select { background:var(--ds-bg); color:var(--ds-text); border:1px solid var(--ds-border); border-radius:var(--ds-radius-control); padding:6px 8px; font:inherit; font-family:var(--ds-mono); font-size:12px; }
.design-studio .ds-iconbtn { background:transparent; color:var(--ds-text-2); border:1px solid var(--ds-border-strong); border-radius:var(--ds-radius-control); padding:6px 10px; font:inherit; cursor:pointer; }
.design-studio .ds-iconbtn[aria-pressed="true"] { color:var(--ds-accent); border-color:var(--ds-accent); }
.design-studio .ds-preview, .design-studio .ds-testwrap { flex:1; min-height:0; display:flex; flex-direction:column; }
.design-studio .ds-preview { align-items:center; justify-content:stretch; padding:12px; }
.design-studio .ds-stage { width:100%; height:100%; background:#0B0D0F; border:1px solid var(--ds-border); border-radius:var(--ds-radius-card); overflow:hidden; margin:0 auto; }
```

- [ ] **Step 4: Lift prototype state + device selector into the shell**

In `DesignStudioPanel.tsx`, add the shared hook, a device toggle, a preview ref, and render the Preview tab with a picker bar:

```tsx
import { usePrototypes } from '../lib/design/usePrototypes.js';
import { PreviewCanvas, type PreviewHandle, type Device } from './design/PreviewCanvas.js';
import { useRef } from 'react';
// ...inside the component, above the return:
  const protos = usePrototypes();
  const [device, setDevice] = useState<Device>('desktop');
  const previewRef = useRef<PreviewHandle>(null);
// ...replace the `tab === 'preview'` placeholder with:
  {tab === 'preview' && (
    <div className="ds-testwrap">
      <div className="ds-canvas-bar">
        <select className="ds-select" value={protos.selected?.id ?? ''} onChange={(e) => protos.select(e.target.value)}>
          {protos.entries.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        {(['desktop', 'tablet', 'phone'] as Device[]).map((d) => (
          <button key={d} className="ds-iconbtn" aria-pressed={device === d} onClick={() => setDevice(d)}>{d}</button>
        ))}
        <span className="ds-nav-spacer" />
        <button className="ds-iconbtn" onClick={() => previewRef.current?.reload()}>Reload</button>
      </div>
      <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={protos.selected} device={device} />
    </div>
  )}
```

- [ ] **Step 5: Typecheck + verify**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit` → no errors.
Verify in app (Views → Design Studio → Preview): the seed prototype (`Welcome`) renders live inside the stage on Void; the device buttons resize the stage (tablet 820 / phone 390 / desktop full); Reload re-renders. Confirm the webview actually loaded (not a blank/blocked frame) — the seed's "Recall" button and breathing dot are visible.

- [ ] **Step 6: Commit**

```bash
git add brainrouter-desktop/src/lib/design/usePrototypes.ts brainrouter-desktop/src/panels/design/PreviewCanvas.tsx brainrouter-desktop/src/panels/DesignStudioPanel.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(desktop): Design Studio — prototype preview canvas (hardened webview)"
```

---

## Task 8: Manual-test canvas

**Files:**
- Create: `brainrouter-desktop/src/panels/design/TestCanvas.tsx`
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx` (render `<TestCanvas>`; lift picked-element state)
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css` (append test styles)

**Interfaces:**
- Consumes: `webviewBridge` fns `startPick`, `readPick`, `cancelPick`, `a11ySnapshot`, `tap`, `typeText` and `WebviewEl` (from `../../lib/uitest/webviewBridge.js`); the shared `PreviewCanvas` webview via a ref.
- Produces: `TestCanvas` component; reports the picked `data-testid` up via `onPick(ref: string)` so the Fix chat (Task 9) can target it.

- [ ] **Step 1: Create TestCanvas**

The Test canvas reuses ONE preview webview instance (shared through the parent) so preview and test act on the same rendered page. It renders the same `PreviewCanvas` plus a controls strip driving the existing bridge.

```tsx
// brainrouter-desktop/src/panels/design/TestCanvas.tsx
import React, { useRef, useState } from 'react';
import type { WebviewEl } from '../../lib/uitest/webviewBridge.js';
import { startPick, readPick, cancelPick, a11ySnapshot, tap, typeText } from '../../lib/uitest/webviewBridge.js';
import { PreviewCanvas, type PreviewHandle, type Device } from './PreviewCanvas.js';
import type { PrototypeEntry } from '../../lib/design/prototypeMeta.js';

export function TestCanvas({ workspaceRoot, selected, device, picked, onPick }: {
  workspaceRoot?: string;
  selected: PrototypeEntry | null;
  device: Device;
  picked: string | null;
  onPick: (ref: string | null) => void;
}): React.ReactElement {
  const previewRef = useRef<PreviewHandle>(null);
  const [a11y, setA11y] = useState<Array<{ role: string; name: string; testid?: string }>>([]);
  const [typeVal, setTypeVal] = useState('');
  const [status, setStatus] = useState('');

  const wv = (): WebviewEl | null => previewRef.current?.getWebview() ?? null;

  const doPick = async (): Promise<void> => {
    const el = wv(); if (!el) return;
    setStatus('Click an element in the preview…');
    await startPick(el);
    const poll = setInterval(async () => {
      const r = await readPick(el);
      if (r) {
        clearInterval(poll);
        const ref = r.testid ?? r.suggestion ?? null;
        onPick(ref);
        setStatus(ref ? `Picked [data-testid="${ref}"]` : `Picked <${r.tag}> "${r.text.slice(0, 24)}" (no testid)`);
      }
    }, 300);
    setTimeout(() => { clearInterval(poll); void cancelPick(el); }, 20_000);
  };

  const doA11y = async (): Promise<void> => { const el = wv(); if (el) setA11y(await a11ySnapshot(el)); };
  const doTap = async (): Promise<void> => { const el = wv(); if (el && picked) { const r = await tap(el, picked); setStatus(r.ok ? `Tapped ${picked}` : `Tap failed: ${r.error ?? ''}`); } };
  const doType = async (): Promise<void> => { const el = wv(); if (el && picked) { const r = await typeText(el, picked, typeVal); setStatus(r.ok ? `Typed into ${picked}` : `Type failed: ${r.error ?? ''}`); } };

  return (
    <div className="ds-testwrap">
      <div className="ds-canvas-bar">
        <button className="ds-iconbtn" onClick={() => void doPick()}>Pick</button>
        <button className="ds-iconbtn" onClick={() => void doA11y()}>Inspect a11y</button>
        <button className="ds-iconbtn" disabled={!picked} onClick={() => void doTap()}>Tap</button>
        <input className="ds-select" placeholder="type text…" value={typeVal} onChange={(e) => setTypeVal(e.target.value)} />
        <button className="ds-iconbtn" disabled={!picked} onClick={() => void doType()}>Type</button>
        <span className="ds-nav-spacer" />
        <button className="ds-iconbtn" onClick={() => previewRef.current?.reload()}>Reload</button>
      </div>
      <div className="ds-testsplit">
        <PreviewCanvas ref={previewRef} workspaceRoot={workspaceRoot} selected={selected} device={device} />
        <aside className="ds-testinspect">
          <p className="ds-eyebrow">Selected</p>
          <p className="ds-mono ds-testpicked" data-mono>{picked ? `[data-testid="${picked}"]` : '— pick an element —'}</p>
          <p className="ds-eyebrow">Status</p>
          <p className="ds-mono" data-mono>{status || '—'}</p>
          <p className="ds-eyebrow">Accessibility tree</p>
          <ul className="ds-a11y">
            {a11y.map((n, i) => <li key={i} data-mono>{n.role} · {n.name}{n.testid ? ` · ${n.testid}` : ''}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append test styles**

```css
.design-studio .ds-testsplit { flex:1; min-height:0; display:flex; }
.design-studio .ds-testsplit .ds-preview { flex:1; }
.design-studio .ds-testinspect { width:260px; flex:none; border-left:1px solid var(--ds-border); padding:12px; overflow:auto; display:flex; flex-direction:column; gap:8px; }
.design-studio .ds-testpicked { color:var(--ds-accent); font-size:12px; word-break:break-all; }
.design-studio .ds-a11y { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--ds-text-2); }
.design-studio .ds-a11y li { border-top:1px solid var(--ds-border); padding-top:4px; }
```

- [ ] **Step 3: Lift picked-element state + render the Test tab**

In `DesignStudioPanel.tsx`:

```tsx
import { TestCanvas } from './design/TestCanvas.js';
// ...add state near the others:
  const [picked, setPicked] = useState<string | null>(null);
// ...replace the `tab === 'test'` placeholder:
  {tab === 'test' && <TestCanvas workspaceRoot={workspaceRoot} selected={protos.selected} device={device} picked={picked} onPick={setPicked} />}
```

- [ ] **Step 4: Typecheck + verify**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit` → no errors.
Verify in app (Views → Design Studio → Test): the seed renders in the split preview; **Pick** enters pick mode, clicking the "Recall" button sets `Selected → [data-testid="primary-cta"]`; **Inspect a11y** lists the button's role/name; **Tap** taps it; typing + **Type** targets the picked element. Status line updates for each.

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/panels/design/TestCanvas.tsx brainrouter-desktop/src/panels/DesignStudioPanel.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(desktop): Design Studio — manual-test canvas (pick/tap/type/a11y)"
```

---

## Task 9: UI-fix chat dock

**Files:**
- Create: `brainrouter-desktop/src/panels/design/DesignChat.tsx`
- Modify: `brainrouter-desktop/src/panels/DesignStudioPanel.tsx` (render `<DesignChat>` when `chatOpen`; wire reload-on-fix)
- Modify: `brainrouter-desktop/src/panels/design/designStudio.css` (append chat styles)

**Interfaces:**
- Consumes: `window.brainrouter.send`/`window.brainrouter.onEvent` (typed via `src/bridge.d.ts`); `buildUiFixPrompt` (Task 3); the selected `PrototypeEntry` + `picked` ref (Tasks 7–8).
- Produces: `DesignChat` component; calls `onApplied()` after a turn ends so the parent reloads the preview.

- [ ] **Step 1: Create DesignChat (decoupled from Composer)**

```tsx
// brainrouter-desktop/src/panels/design/DesignChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import { buildUiFixPrompt } from '../../lib/design/prototypeMeta.js';
import type { PrototypeEntry } from '../../lib/design/prototypeMeta.js';

type Line = { role: 'you' | 'brainrouter'; text: string };

export function DesignChat({ selected, picked, onApplied }: {
  selected: PrototypeEntry | null;
  picked: string | null;
  onApplied: () => void;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState('');
  const [running, setRunning] = useState(false);
  const liveRef = useRef('');

  // Subscribe to agent stream in isolation (own liveText; does not touch the main chat state).
  useEffect(() => {
    const off = window.brainrouter.onEvent((msg: unknown) => {
      const e = ((msg as { event?: { kind?: string; text?: string } }).event ?? msg) as { kind?: string; text?: string };
      if (e?.kind === 'assistant-delta') { liveRef.current += e.text ?? ''; setLive(liveRef.current); }
      else if (e?.kind === 'assistant-turn-end') {
        const text = liveRef.current.trim();
        liveRef.current = ''; setLive('');
        setRunning(false);
        if (text) setLines((l) => [...l, { role: 'brainrouter', text }]);
        onApplied(); // reload the preview — the file was just edited
      }
    });
    return off;
  }, [onApplied]);

  const submit = (): void => {
    const instruction = draft.trim();
    if (!instruction || !selected || running) return;
    const prompt = buildUiFixPrompt({ relPath: selected.path, instruction, pickedRef: picked });
    setLines((l) => [...l, { role: 'you', text: instruction }]);
    setDraft(''); setRunning(true); liveRef.current = ''; setLive('');
    // `hidden: true` keeps this design-fix turn OUT of the main chat transcript
    // (the dock renders its own stream via onEvent). AgentCommand supports it:
    // { kind:'start-turn'; prompt; hidden?; images? }. If, at runtime, `hidden`
    // also suppresses the assistant-delta events the dock listens for, drop it
    // and accept a shared transcript for v1 (see Task 10 Notes).
    window.brainrouter.send({ kind: 'start-turn', prompt, hidden: true } as never);
  };

  return (
    <div className="ds-chat">
      <div className="ds-chat-head">
        <span className="ds-eyebrow">Fix UI</span>
        <span className="ds-mono ds-chat-target" data-mono>{selected ? selected.title : 'no prototype'}{picked ? ` · ${picked}` : ''}</span>
      </div>
      <div className="ds-chat-log">
        {lines.map((l, i) => <div key={i} className={`ds-msg ds-msg--${l.role}`}><span className="ds-eyebrow">{l.role}</span><div>{l.text}</div></div>)}
        {running && <div className="ds-msg ds-msg--brainrouter"><span className="ds-eyebrow"><span className="ds-dot ds-dot--live" /> brainrouter</span><div>{live || 'editing the prototype…'}</div></div>}
      </div>
      <form className="ds-chat-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea className="ds-chat-input" rows={2} placeholder={selected ? 'e.g. make the primary button use the Signal color' : 'Select a prototype first'} value={draft}
          disabled={!selected || running}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <button className="ds-btn ds-btn--accent" type="submit" disabled={!selected || running || !draft.trim()}>{running ? 'Fixing…' : 'Fix'}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Append chat styles**

```css
/* --- UI-fix chat --- */
.design-studio .ds-chat { width:340px; flex:none; border-left:1px solid var(--ds-border); background:var(--ds-surface); display:flex; flex-direction:column; }
.design-studio .ds-chat-head { padding:10px 12px; border-bottom:1px solid var(--ds-border); display:flex; flex-direction:column; gap:2px; }
.design-studio .ds-chat-target { color:var(--ds-text-3); font-size:12px; }
.design-studio .ds-chat-log { flex:1; min-height:0; overflow:auto; padding:12px; display:flex; flex-direction:column; gap:12px; }
.design-studio .ds-msg { display:flex; flex-direction:column; gap:4px; font-size:13px; }
.design-studio .ds-msg--you div { color:var(--ds-text); }
.design-studio .ds-msg--brainrouter div { color:var(--ds-text-2); line-height:1.5; }
.design-studio .ds-chat-form { border-top:1px solid var(--ds-border); padding:10px; display:flex; gap:8px; align-items:flex-end; }
.design-studio .ds-chat-input { flex:1; resize:none; background:var(--ds-bg); color:var(--ds-text); border:1px solid var(--ds-border); border-radius:var(--ds-radius-control); padding:8px; font:inherit; }
.design-studio .ds-chat-input:focus { outline:none; border-color:var(--ds-accent); box-shadow:0 0 0 2px var(--ds-accent-wash); }
```

- [ ] **Step 3: Render the dock + wire reload-on-fix**

In `DesignStudioPanel.tsx`, replace the `chatOpen` placeholder and add a reload callback that also refreshes the list (title/mtime may change):

```tsx
import { DesignChat } from './design/DesignChat.js';
// ...replace the chatOpen placeholder:
  {chatOpen && (
    <DesignChat
      selected={protos.selected}
      picked={picked}
      onApplied={() => { previewRef.current?.reload(); setTimeout(() => protos.refresh(), 400); }}
    />
  )}
```

Note: the Preview tab's `previewRef` reloads on fix. When the user is on the Test tab, its own inner `PreviewCanvas` has a separate webview; for v1 the Fix chat reloads the Preview-tab webview and refreshes the list — switching to Preview shows the applied change. (See Task 10 Notes for the shared-webview follow-up.)

- [ ] **Step 4: Typecheck + verify end-to-end**

Run: `cd brainrouter-desktop && npx tsc -p tsconfig.json --noEmit` → no errors.
Verify in app: open Design Studio → **Fix chat** → with the seed selected, type "make the primary button label say Remember and give it more padding" → send. Expected: the dock shows a breathing live status while the agent runs, the agent edits `proto/prototype-welcome.html`, the turn ends, and the Preview tab (Reload fires automatically) shows the updated button. (Requires a model/provider configured in Settings, same as the main chat.)

- [ ] **Step 5: Commit**

```bash
git add brainrouter-desktop/src/panels/design/DesignChat.tsx brainrouter-desktop/src/panels/DesignStudioPanel.tsx brainrouter-desktop/src/panels/design/designStudio.css
git commit -m "feat(desktop): Design Studio — UI-fix chat dock (edit prototype + reload)"
```

---

## Task 10: Full-loop verification + full test/typecheck gate

**Files:** none created; this task green-gates the whole feature.

- [ ] **Step 1: Run the full desktop test + typecheck suite**

Run: `cd brainrouter-desktop && npm run test`
Expected: builds deps, typechecks, compiles electron, runs `node --test dist-electron/**/*.test.js` (includes `designHost.test.js`) and `tsx --test src/**/*.test.ts` (includes `designTokens`, `signature`, `prototypeMeta`) — all green.

**Pre-existing branch caveat (verified at plan time):** `npm run build:electron` on this branch currently fails on unrelated missing core exports (`@kinqs/brainrouter-core/router/gateway`, `triggers`) — a pre-existing issue, NOT a Design Studio regression. If `npm run test` is blocked by that, verify the Design Studio suite directly through the dev lanes instead: `npx tsx --test src/lib/design/*.test.ts` and `npx tsx --test electron/designHost.test.ts` (both green), plus `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.electron.json --noEmit`. Fix (or wait out) the unrelated core build separately to get the full `npm run test` green.

(If the known Windows core-test baseline fails in unrelated packages, scope the check to the desktop package as above; the Design Studio tests specifically must pass.)

- [ ] **Step 2: Manual full-loop smoke (single pass)**

Launch `npm run start:fast`, open **Views → Design Studio**, and confirm the five functions in one pass:
1. **System** — Memory Instrument tokens + brand signature render on Void; one Signal accent; heat legend; Geist type; no purple/emoji/serif.
2. **Preview** — seed renders live; device sizing works; Reload works.
3. **Test** — Pick → Tap/Type/Inspect on the previewed prototype.
4. **Fix chat** — an instruction edits the prototype file and the preview reflects it.
5. **Signature** — the mono provenance stamp shows in System.

Confirm the rest of the app (sidebar, main chat, other panels) is visually and behaviorally unchanged.

- [ ] **Step 3: Confirm additive-only diff**

Run: `git diff --stat main...HEAD -- brainrouter-desktop | cat`
Expected: only the files listed in **File Structure** appear; the "Modified" list is limited to the seven registration/wiring files, each with small additive hunks. No existing panel body, chat component, or `theme.css` is changed.

- [ ] **Step 4: Final commit (docs/walkthrough, optional)**

```bash
git add -A
git commit -m "docs(desktop): Design Studio walkthrough + plan checkboxes"
```

**Notes / documented follow-ups (out of scope for these basic functions):**
- **Shared webview across Preview/Test:** v1 gives the Preview tab and the Test tab each their own `PreviewCanvas` webview. A follow-up lifts a single webview instance into the shell so a fix reloads whichever tab is visible and Pick/Test act on the exact same frame the user previews.
- **Dedicated design sub-session:** the Fix chat sends `start-turn` on the active agent session with `hidden: true` to keep it out of the main transcript. Confirm during execution that `hidden` suppresses transcript rendering but still emits the `assistant-delta`/`assistant-turn-end` events the dock consumes; if it doesn't, a follow-up routes design fixes through a scoped sub-session (or a one-shot headless agent) so the two streams don't share an agent at all.
- **Self-hosted Geist:** the token stack references Geist with a system fallback; a follow-up adds `Geist`/`Geist Mono` `woff2` via `@font-face` scoped to `.design-studio`.
- **Hot-reload via poll:** instead of reload-on-turn-end, a follow-up can poll `design:read-prototype` and use core's `isPrototypeComplete(previous, current)` to reload only once the file is byte-stable (handles incremental agent writes).

---

## Self-Review

**Spec coverage (the 5 requested functions):**
1. *Design system* → Task 1 (token model) + Task 6 (SystemView living style guide). ✔
2. *Brand signature* → Task 2 (model) + Task 6 (BrandSignature) — mark, wordmark, `DesignContext` seed, provenance stamp. ✔
3. *Canvas for prototype preview* → Task 7 (PreviewCanvas, hardened webview, device sizing). ✔
4. *Canvas for prototype manual test* → Task 8 (TestCanvas, pick/tap/type/a11y via `webviewBridge`). ✔
5. *Chat for fixing UI* → Task 9 (DesignChat → `buildUiFixPrompt` → `start-turn` → reload). ✔
Plus enabling infra: Task 4 (host service + IPC), Task 5 (registration + shell), Task 10 (gate).

**Type consistency:** `PrototypeEntry` shape is identical in `prototypeMeta.ts` (renderer) and `designHost.ts` (host) — `{ id, path, title, mtimeMs }`. `Device` and `DEVICE_W` defined once in `PreviewCanvas.tsx`, imported by the shell + TestCanvas. `PreviewHandle` (`reload`, `getWebview`) is the single ref contract used by Preview, Test, and the shell's reload-on-fix. `bridgeQuery` names (`design:list-prototypes`, `design:read-prototype`, `design:ensure-seed`) match the `queries.ts` handlers exactly. `WebviewEl` and the bridge function names (`startPick`, `readPick`, `cancelPick`, `a11ySnapshot`, `tap`, `typeText`) are the verified exports of `webviewBridge.ts`.

**Placeholder scan:** no TBD/TODO; every code step carries full code; every test step has real assertions and exact run commands. The only intentional deferrals are the four labelled follow-ups in Task 10 Notes, explicitly out of scope.

**Known integration checkpoints to verify during execution (not gaps, but confirm-before-wiring):** in Task 5 Step 3, confirm `info`/`branches` are in `renderPanelBody`'s closure (fallback provided); in Task 4 Steps 5–6, match the exact `HostContext` literal assembly in `host.ts` (the plan gives the field to add, adapt to the local variable names).
