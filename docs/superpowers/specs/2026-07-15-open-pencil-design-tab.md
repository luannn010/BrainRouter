# Open Pencil-Inspired Design Tab

## Goal

Make the desktop BrainRouter Design Studio `Designs` tab feel like the Open Pencil editor shown in the reference screenshots: choose a flow, browse files/assets/components/scales, inspect a layer tree, edit a live prototype in the center, and use a right inspector plus a bottom tool dock.

## Scope

This is a desktop Design Studio feature. The existing `Canvas` and `Brands` tabs remain intact. The existing prototype HTML files remain the rendering source of truth and the existing sandboxed webview/iframe remains the only preview surface.

The feature includes:

- A left resource rail with `Files`, `Assets`, `Components`, and `Scales` tabs.
- A `Design` layer-tree subpanel for the selected prototype, built from semantic HTML elements and stable element references.
- A center stage with browser chrome, device presets, zoom/fit, inspect mode, and live element selection.
- A right inspector with `Design`, `Code`, and `AI` tabs.
- A bottom toolbar with select, hand, frame, shape, text, inspect, and zoom actions.
- Direct preview edits for safe presentation properties (text, color, font size/weight, spacing, radius, and visibility), with explicit save/revert state.
- AI handoff to the existing Fix Chat using the selected flow, element reference, and current edit context.

## Interaction model

The default mode is Select. Clicking an element in the preview selects it and highlights the matching layer-tree row. Inspect mode enables the existing picker bridge for prototypes that need event-backed selection. Clicking a flow in Files changes the selected prototype without replacing the surrounding editor chrome. Escape clears element selection; keyboard navigation moves through visible layer rows; Enter opens the selected flow in the existing interactive preview.

Preview edits are stored as typed, screen-scoped draft operations. They apply immediately to the preview via a deterministic CSS/HTML overlay and are saved through the existing design-artifact persistence path. Revert removes the draft for the current flow/screen. Fix Chat receives the selected element and draft summary but remains the only agent-driven source edit path.

## Visual system

Use the Memory Instrument tokens already defined in `designTokens.ts` and `designStudio.css`: Void background, Substrate panels, Lifted active surfaces, Frost primary text, Mist secondary text, and Signal accent. Use the existing icon family, 4/8px spacing rhythm, 44px minimum interactive targets, visible focus rings, semantic labels, and reduced-motion media rules. The right inspector and bottom toolbar must remain usable at narrow desktop widths by allowing the stage to shrink before collapsing secondary labels.

## Non-goals

- No `.fig`/`.pen` file format.
- No replacement vector renderer.
- No automatic destructive writes to prototype HTML from direct inspector edits.
- No new MCP server.
- No change to the dashboard Brand Design workspace in this slice.

## Acceptance criteria

1. The Designs tab exposes the Open Pencil-style left rail, center stage, right inspector, and bottom toolbar.
2. Selecting a flow updates the stage and layer tree while preserving the editor shell.
3. Selecting an element updates both the layer tree and inspector with semantic/code details.
4. Supported direct edits visibly update the stage and can be saved or reverted.
5. AI handoff includes the selected element context and draft properties.
6. Existing device switching, reload, manual flow testing, Fix Chat, Canvas navigation, and prototype sandboxing continue to work.
7. Unit tests cover element extraction, stable references, draft application/revert, and inspector state; desktop typecheck/build pass.

