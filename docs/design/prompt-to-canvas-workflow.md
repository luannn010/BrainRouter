# Prompt-to-Canvas Workflow

Use this workflow when a user wants a natural-language prompt turned into screens and controllable UI components on the BrainRouter Design Studio canvas.

## Pipeline

```text
Prompt
  -> prompt-to-ui-spec
  -> ui-flow.json
  -> svg-asset-generator
  -> proto/assets/*.svg
  -> html-prototype-generator
  -> proto/*.html
  -> design:read-prototypes({})
  -> Design Studio canvas
```

The workflow deliberately uses exactly three skills and one render tool:

- Extract skill: `prompt-to-ui-spec`
- SVG skill: `svg-asset-generator`
- HTML skill: `html-prototype-generator`
- Render tool: `design:read-prototypes`

## Runbook

1. Pass the user's complete UI prompt to `prompt-to-ui-spec`. Save its validated output as `ui-flow.json` in the workspace.
2. Pass that JSON to `svg-asset-generator`. Write one local file per request below `proto/assets/`.
3. Pass the JSON plus the generated assets to `html-prototype-generator`. Write one flat `proto/<screen-id>.html` per screen.
4. Validate all expected files and the DesignHost limits: no more than 24 frames and no more than 512 KiB per HTML frame.
5. Invoke the one render tool:

   ```text
   design:read-prototypes({})
   ```

6. Verify that the returned frames appear in the Design Studio canvas. The existing `PreviewCanvas`/`useCanvasFrames` path performs the actual frame rendering. Preserve canvas positions through the existing canvas document persistence only when the user asks to arrange or save the flow.

## Control Contract

The HTML generator must preserve these attributes so Design Studio can inspect and control components:

```html
<main data-screen-id="dashboard">
  <section data-component-id="stats-card" data-testid="stats-card">
    <button type="button" data-testid="stats-card-action">Open details</button>
  </section>
</main>
```

The shared `UiFlowSpec` contract is documented in `docs/superpowers/specs/2026-07-17-prompt-to-canvas-workflow-design.md` and must remain the single source of truth between stages.

## Failure and Retry

Stop at the first failed gate and report `stage`, `file`, and an actionable `message`. Keep valid earlier artifacts so the failed stage can be retried without regenerating unrelated outputs. Never invoke `design:read-prototypes` when a required HTML file or local asset is missing.

## Completion Evidence

Claim completion only when all of the following are true:

- `ui-flow.json` validates and contains at least one screen.
- Every requested `proto/assets/<id>.svg` exists and is safe/local.
- Every `proto/<screen-id>.html` exists, is self-contained, and contains stable IDs.
- `design:read-prototypes({})` returns the expected frames without truncation caused by workflow output.
- The frames are visible in Design Studio's canvas.
