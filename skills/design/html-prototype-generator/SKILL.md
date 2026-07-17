---
name: html-prototype-generator
description: Generates self-contained, controllable HTML screen prototypes from a validated ui-flow.json and local SVG assets. Use after prompt-to-ui-spec and svg-asset-generator when the result must load in BrainRouter Design Studio and expose stable component controls.
---

# HTML Prototype Generator

## Overview

Compose the screens and reusable components in a validated `ui-flow.json` into standalone HTML files that Design Studio can preview, inspect, and modify. The HTML is an editable prototype surface, not production application code.

## Workflow

### 1. Validate inputs

Require a valid `version: 1` spec and the complete `proto/assets/` output from `svg-asset-generator`. Confirm every screen ID and every requested SVG is available before writing HTML. Do not render or claim success with missing assets.

### 2. Create one document per screen

Write exactly one flat file at `proto/<screen-id>.html`. Each document must include:

- `<!doctype html>`, language, charset, viewport, and a meaningful `<title>`;
- inline `<style>` containing token-backed CSS variables and all prototype styles;
- no external scripts, stylesheets, fonts, images, or network requests;
- a semantic `<main data-screen-id="<screen-id>">` root;
- the screen's component tree in the same order as the spec.

Use local SVGs with paths such as `assets/brand-mark.svg`. Never use `file://` paths or remote URLs.

### 3. Expose stable controls

Every rendered component must carry its spec identity:

```html
<section data-component-id="stats-card" data-testid="stats-card">
  <h2 data-testid="stats-card-title">Revenue</h2>
  <button type="button" data-testid="stats-card-action">Open details</button>
</section>
```

Rules:

- `data-screen-id` appears exactly once per document.
- `data-component-id` is copied verbatim from the component spec and is unique in that screen.
- Every interactive control has a meaningful unique `data-testid`.
- State variants use classes or `data-state`, not regenerated IDs.
- Buttons, links, inputs, and custom controls have visible focus and keyboard behavior.

### 4. Implement deterministic behavior

Implement only interactions declared in the spec. Use small inline scripts when needed, scoped to the document and free of network access. Avoid timers, randomness, analytics, and browser storage unless explicitly requested. For an interaction that cannot be implemented safely, show the declared state and report the limitation.

### 5. Verify the prototype

For each screen, confirm:

```text
proto/<screen-id>.html exists
title, viewport, and data-screen-id exist
all referenced assets exist below proto/assets/
all component IDs resolve to one DOM node
all interactive nodes have data-testid and keyboard focus
the document contains no http(s)://, file://, <script src=, or external stylesheet/font references
```

Keep the output within DesignHost's current preview guard: at most 24 frames, with each HTML frame no larger than 512 KiB.

## Output Contract

```text
proto/<screen-id>.html
```

These flat HTML files are the only files consumed by the existing `design:read-prototypes` render tool. Do not create nested HTML paths that the authorized prototype policy will reject.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The browser can infer which element is which." | Inspector and fix-chat need stable attributes to address the same component across renders. |
| "A CDN stylesheet keeps the prototype small." | Network dependencies make sandboxed Design Studio renders non-deterministic and unsafe. |
| "Production React components are better here." | Design Studio consumes authorized self-contained HTML files; framework source is outside this stage's contract. |

## Verification

- [ ] One self-contained flat HTML file exists per screen.
- [ ] Stable screen, component, and test IDs are present and unique where required.
- [ ] All SVG references resolve to local files.
- [ ] Interactive elements are deterministic and keyboard accessible.
- [ ] No external resources or unsafe script loading is present.
- [ ] Frame count and size fit DesignHost limits.
