---
name: prompt-to-ui-spec
description: Extracts screens, reusable components, states, interactions, design tokens, and local asset requests from a natural-language UI prompt into a validated ui-flow.json. Use when a prompt must become an inspectable multi-screen design workflow before SVG or HTML generation.
---

# Prompt to UI Spec

## Overview

Turn one UI prompt into a framework-neutral, deterministic `ui-flow.json`. This is the first stage of the prompt-to-canvas workflow and the only stage allowed to infer screens, reusable components, interaction states, and asset requests.

## Workflow

### 1. Capture intent

Read the complete prompt. Preserve named routes, copy, roles, actions, visual direction, responsive requirements, and explicit component behavior. Do not invent product claims, data, or remote assets.

### 2. Extract screens

Create one screen for each route, page, modal flow, or distinct viewport state that the prompt requires. Each screen needs:

- `id`: lowercase kebab-case, stable across retries.
- `name`: human-readable label.
- `route`: route or state identifier; use `/` for the primary screen when no route is given.
- `description`: its purpose and primary user action.
- `components`: IDs of components present on the screen.
- `position`: optional canvas coordinates; use a simple left-to-right layout when the prompt describes a flow.

### 3. Extract components

Create reusable component records instead of duplicating UI fragments. Include `type`, concrete `props`, supported `states`, and user-visible `interactions`. Use stable IDs such as `top-nav`, `checkout-form`, or `empty-state`; never use array indexes.

### 4. Extract tokens

Record only tokens supported by the prompt or a coherent minimal inference:

```json
{
  "colors": { "canvas": "#0B0D0F", "surface": "#14171A", "text": "#ECEFF2", "accent": "#34C28E" },
  "spacing": { "unit": "4px", "page": "32px", "section": "48px" },
  "typography": { "body": "ui-sans-serif, system-ui, sans-serif", "headingWeight": "700" }
}
```

Keep token names semantic. Do not introduce a second accent palette without an explicit requirement.

### 5. Extract asset requests

Represent every icon, illustration, logo, or decorative vector needed by a component as an `assetRequests` record. Describe the visual, `kind`, and exact target component IDs. The next stage will generate the SVG; do not embed SVG markup or remote URLs here.

### 6. Validate and write

Write `ui-flow.json` at the workflow's agreed workspace location. Before finishing, verify:

```text
version === 1
title and sourcePrompt are non-empty
screens.length >= 1
all IDs match ^[a-z0-9]+(?:-[a-z0-9]+)*$
all IDs are unique within screens, components, and assetRequests
every screen component exists
every asset target component exists
```

If a requirement is ambiguous, encode the smallest reversible assumption in `description` or `props`; do not create speculative screens.

## Output Contract

Produce exactly one JSON object matching this shape:

```ts
type UiFlowSpec = {
  version: 1;
  title: string;
  sourcePrompt: string;
  screens: Array<{
    id: string;
    name: string;
    route: string;
    description: string;
    components: string[];
    position?: { x: number; y: number };
  }>;
  components: Array<{
    id: string;
    type: string;
    props: Record<string, unknown>;
    states: string[];
    interactions: string[];
  }>;
  tokens: {
    colors: Record<string, string>;
    spacing: Record<string, string>;
    typography: Record<string, string>;
  };
  assetRequests: Array<{
    id: string;
    kind: "icon" | "illustration" | "logo" | "decoration";
    description: string;
    targetComponents: string[];
  }>;
};
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The HTML generator can infer the screens later." | Without a stable spec, screens and component IDs drift between retries and cannot be controlled in Design Studio. |
| "Use placeholder IDs for now." | Index-based or placeholder IDs break element picking and fix-chat references. |
| "Add every possible screen." | Speculative screens make the canvas noisy and misrepresent user intent. |

## Verification

- [ ] `ui-flow.json` is valid JSON and matches `version: 1`.
- [ ] At least one screen exists and every reference resolves.
- [ ] IDs are stable lowercase kebab-case values.
- [ ] Asset needs are requests, not remote URLs or unvalidated inline markup.
- [ ] The output is ready for `svg-asset-generator`.
