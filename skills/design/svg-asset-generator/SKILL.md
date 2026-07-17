---
name: svg-asset-generator
description: Generates safe, local, accessible SVG assets from the assetRequests in a validated ui-flow.json. Use after prompt-to-ui-spec and before HTML prototype generation when a design needs icons, illustrations, logos, or decorative vectors.
---

# SVG Asset Generator

## Overview

Convert the validated `assetRequests` list from `ui-flow.json` into local SVG files that the HTML prototype can load without network access. This stage owns vector asset production only; it must not alter screens, component IDs, or HTML.

## Workflow

### 1. Validate input

Read `ui-flow.json` and confirm it is the `version: 1` contract. For every request, confirm:

- `id` is lowercase kebab-case and unique.
- `kind` is one of `icon`, `illustration`, `logo`, or `decoration`.
- `description` is non-empty.
- every `targetComponents` ID exists in `components`.

Stop with `stage=svg` and the request ID if validation fails.

### 2. Generate local vectors

Write one file per request to `proto/assets/<request-id>.svg`. Use a stable `viewBox`, explicit dimensions, and semantic groups. Prefer simple paths, shapes, and fills over filter-heavy effects. A typical accessible root is:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title-desc">
  <title id="title-desc">Descriptive asset name</title>
  <path d="..." fill="currentColor" />
</svg>
```

For decorative assets, use `aria-hidden="true"` and do not add misleading labels. Use token colors through `currentColor` or explicit values from the spec; do not invent external CSS dependencies.

### 3. Apply safety rules

Reject or remove:

- `<script>` and event-handler attributes such as `onclick`;
- external `<image>`, `<use>`, stylesheet, font, or URL references;
- embedded raster data unless explicitly required by the request;
- malformed XML, missing `viewBox`, or unbounded dimensions.

### 4. Verify output

For each request, confirm the expected file exists and that its text contains `<svg`, `viewBox`, and no forbidden external or executable references. Keep an asset manifest in the stage report, not as an extra runtime dependency.

## Output Contract

```text
proto/assets/<asset-request-id>.svg
```

The HTML stage references assets using `assets/<asset-request-id>.svg`. Do not rename an asset after the HTML stage starts; the request ID is the cross-stage identity.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "A remote icon URL is quicker." | The Design Studio prototype must render in a sandbox and remain reproducible offline. |
| "Accessibility can be added after the page is generated." | The SVG is already an independently consumed artifact; its root semantics must be correct at creation time. |
| "One sprite file is simpler." | Per-request files preserve stable asset identity and let later stages retry one failed asset. |

## Verification

- [ ] Every asset request has exactly one local SVG file.
- [ ] Every SVG has a `viewBox` and intentional accessible/decorative metadata.
- [ ] No SVG contains scripts, event handlers, or external references.
- [ ] Filenames remain lowercase kebab-case request IDs.
- [ ] Output is ready for `html-prototype-generator`.
