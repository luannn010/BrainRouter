# Prompt-to-Canvas UI Workflow Design

## Goal

Define a reusable BrainRouter workflow that turns one natural-language UI prompt into an inspectable set of screens and components, generates local SVG assets, composes controllable HTML prototypes, and loads those prototypes into the Design Studio canvas.

## Scope

This slice creates three focused skills and one workflow guide:

1. `prompt-to-ui-spec` extracts a stable, framework-neutral `ui-flow.json` contract.
2. `svg-asset-generator` converts the contract's asset requests into local, safe SVG files.
3. `html-prototype-generator` converts the contract and SVG files into self-contained HTML files under `proto/`.
4. `prompt-to-canvas-workflow.md` orchestrates those skills and invokes the existing `design:read-prototypes` bridge tool, which is the Design Studio's batch prototype loader and render trigger.

No new renderer, model provider, MCP tool, or Design Studio UI is added in this slice. Existing uncommitted Design Studio changes remain out of scope.

## Architecture

```text
prompt
  -> prompt-to-ui-spec
  -> ui-flow.json
  -> svg-asset-generator
  -> proto/assets/*.svg
  -> html-prototype-generator
  -> proto/*.html
  -> design:read-prototypes
  -> Design Studio canvas
```

The JSON contract is the boundary between stages. Each stage validates its input, writes only its own output, and reports a stage-scoped error. Screens, components, and assets have stable IDs so the HTML preview, element picker, inspector, and fix-chat can address the same object across iterations.

## Contract

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

The extractor must produce at least one screen, every screen must reference existing component IDs, every asset request must reference existing component IDs, and all IDs must be lowercase kebab-case and unique within their namespace.

## Stage Rules

### Extract

Preserve the user's intent and explicit content. Infer only the minimum missing structure. Separate screens from reusable components, distinguish component states from interactions, and emit an asset request instead of embedding invented binary data.

### SVG

Generate local SVG only. Keep the root accessible (`role="img"`, useful `aria-label` or a documented decorative mode), use `viewBox`, avoid scripts and external references, and write files using the request ID as the filename. Do not silently replace a requested asset with a remote image URL.

### HTML

Generate one self-contained HTML document per screen in `proto/`. Use CSS variables from the token set, local asset paths such as `assets/<id>.svg`, and stable attributes:

```html
<main data-screen-id="dashboard">
  <section data-component-id="stats-card" data-testid="stats-card">
    ...
  </section>
</main>
```

Interactive elements must have a `data-testid`, keyboard-visible focus, and deterministic local behavior. HTML must not fetch remote scripts, stylesheets, fonts, or images.

### Render

After validating that `proto/*.html` exists and each document is authorized by the existing prototype policy, invoke `design:read-prototypes` once. The Design Studio's `useCanvasFrames`/`PreviewCanvas` path consumes the returned frames and renders them. If positions are supplied, the caller may persist them through the existing canvas state path; persistence is not part of the single render-tool contract.

## Error Handling

Stop at the first invalid stage input or output. Return:

```text
stage=<extract|svg|html|render>
file=<workspace-relative path, when applicable>
message=<actionable error>
```

Never render partial output as if the workflow succeeded. Keep valid earlier artifacts available for inspection and retry only the failed stage.

## Verification

- The three skill directories contain valid frontmatter and actionable workflows.
- The workflow guide names exactly three stage skills and one render tool.
- The contract appears once as the shared source of truth and is referenced by all three skills.
- The HTML rules preserve stable screen/component/test IDs and local SVG references.
- The render step uses the existing `design:read-prototypes` tool and its 24-frame/512 KiB-per-frame safety limits.
- Skill validation passes for every new skill.

## Out of Scope

- Calling external image-generation or vector APIs.
- Building a new HTML framework, component runtime, or canvas renderer.
- Modifying the existing Design Studio panel or uncommitted work on `feat/design-studio`.
- Adding a new MCP endpoint or CLI command.
