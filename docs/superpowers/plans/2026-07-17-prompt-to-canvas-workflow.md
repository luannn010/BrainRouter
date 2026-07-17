# Prompt-to-Canvas UI Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three reusable BrainRouter skills and one orchestration guide for prompt → UI spec → SVG → controllable HTML → Design Studio canvas.

**Architecture:** `prompt-to-ui-spec` owns the framework-neutral JSON contract. `svg-asset-generator` and `html-prototype-generator` consume that contract in sequence and write isolated workspace artifacts. The workflow guide invokes the existing `design:read-prototypes` bridge tool as the single render trigger.

**Tech Stack:** Markdown skill definitions, YAML frontmatter, JSON contract examples, BrainRouter Design Studio prototype loader.

## Global Constraints

- Preserve the user's existing uncommitted changes on `feat/design-studio`.
- Create only additive files under `skills/design/` and `docs/superpowers/`.
- Use lowercase kebab-case IDs and stable `data-screen-id`, `data-component-id`, and `data-testid` attributes.
- Keep SVG and HTML outputs local and self-contained; do not introduce remote dependencies.
- Do not add a new renderer, MCP endpoint, CLI command, or Design Studio UI in this slice.

---

### Task 1: Add the shared extraction skill

**Files:**
- Create: `skills/design/prompt-to-ui-spec/SKILL.md`

**Interfaces:**
- Consumes: one natural-language UI prompt.
- Produces: `ui-flow.json` matching the `UiFlowSpec` contract in `docs/superpowers/specs/2026-07-17-prompt-to-canvas-workflow-design.md`.

- [ ] **Step 1: Write the skill frontmatter and extraction workflow**

Include the exact contract fields, normalization rules, inference limits, and verification checklist. Require validation of screen/component/asset references before writing the JSON file.

- [ ] **Step 2: Validate the skill file**

Run:

```powershell
python C:\Users\luann\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills/design/prompt-to-ui-spec
```

Expected: validation succeeds with no frontmatter or naming errors.

### Task 2: Add the SVG asset generation skill

**Files:**
- Create: `skills/design/svg-asset-generator/SKILL.md`

**Interfaces:**
- Consumes: validated `ui-flow.json` and its `assetRequests`.
- Produces: `proto/assets/<request-id>.svg` files with no scripts or external references.

- [ ] **Step 1: Write the SVG generation rules**

Specify safe SVG structure, accessibility, deterministic naming, local output paths, unsupported asset handling, and per-request verification.

- [ ] **Step 2: Validate the skill file**

Run:

```powershell
python C:\Users\luann\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills/design/svg-asset-generator
```

Expected: validation succeeds with no frontmatter or naming errors.

### Task 3: Add the controllable HTML prototype skill

**Files:**
- Create: `skills/design/html-prototype-generator/SKILL.md`

**Interfaces:**
- Consumes: validated `ui-flow.json` and local SVG files from `proto/assets/`.
- Produces: one self-contained `proto/<screen-id>.html` per screen.

- [ ] **Step 1: Write the HTML generation rules**

Require stable screen/component/test IDs, token-backed CSS variables, local asset references, deterministic interactions, keyboard focus, no remote resources, and prototype-policy-compatible flat paths.

- [ ] **Step 2: Validate the skill file**

Run:

```powershell
python C:\Users\luann\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills/design/html-prototype-generator
```

Expected: validation succeeds with no frontmatter or naming errors.

### Task 4: Add the orchestration workflow guide

**Files:**
- Create: `docs/design/prompt-to-canvas-workflow.md`

**Interfaces:**
- Consumes: user prompt and the outputs of Tasks 1–3.
- Produces: a rendered set of prototypes in Design Studio via exactly one render-tool call, `design:read-prototypes`.

- [ ] **Step 1: Document the ordered stages**

Describe input/output paths, validation gates, retry behavior, and the exact render command/tool payload:

```text
design:read-prototypes({})
```

- [ ] **Step 2: Document the completion checklist**

Require evidence that `ui-flow.json`, all requested SVGs, all screen HTML files, and the returned frames exist before claiming success.

### Task 5: Update repository handover files

**Files:**
- Modify: `task.md`
- Modify: `walkthrough.md`

**Interfaces:**
- Consumes: completed workflow artifacts and validation output.
- Produces: a concise checklist and handover summary without modifying Design Studio source files.

- [ ] **Step 1: Record completed checklist items**

Add the workflow files and validation commands to the existing task checklist.

- [ ] **Step 2: Record the handover summary**

Document the three skill names, render tool, artifact paths, and out-of-scope items.

### Task 6: Run final verification

**Files:**
- Test: `skills/design/prompt-to-ui-spec/SKILL.md`
- Test: `skills/design/svg-asset-generator/SKILL.md`
- Test: `skills/design/html-prototype-generator/SKILL.md`
- Test: `docs/design/prompt-to-canvas-workflow.md`

- [ ] **Step 1: Validate all new skills**

Run the three `quick_validate.py` commands from Tasks 1–3.

- [ ] **Step 2: Check the workflow contract references**

Run:

```powershell
rg -n "prompt-to-ui-spec|svg-asset-generator|html-prototype-generator|design:read-prototypes|ui-flow.json" skills/design docs/design/prompt-to-canvas-workflow.md
```

Expected: every required stage and artifact is referenced, and no stage refers to a different render tool.

- [ ] **Step 3: Confirm unrelated changes remain untouched**

Run:

```powershell
git status --short
git diff --name-only
```

Expected: only the explicitly created/modified workflow documentation files are newly changed by this task; pre-existing `feat/design-studio` changes remain present.
