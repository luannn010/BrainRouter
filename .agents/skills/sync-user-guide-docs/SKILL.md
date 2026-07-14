---
name: sync-user-guide-docs
description: Use when a code change may have left brainrouter-docs/user-guide/ stale — after adding or changing a CLI slash command, dashboard route, MCP tool, REST route, env var, or desktop panel/mode/setting, or after pulling or merging main. Also when asked to update/sync the user guide, or told the user stories or use cases are out of date.
---

# Sync User-Guide Docs

## Overview

The task-oriented docs at `brainrouter-docs/user-guide/` mirror BrainRouter's user-facing
surfaces (CLI, Desktop, Dashboard, MCP integrations, Self-hosting). They drift the moment a
surface changes. This skill keeps them in sync: figure out **what changed**, map it to
**which surface doc**, and update the **user stories** + **Try-It → Verify use cases**.

**Core principle: the user guide documents user-facing behavior verified against the code,
never from memory.** Every use case must stay runnable and end in a `✅ Verify` result —
that's the contract that makes it a manual test.

## When to use

- You just implemented something user-facing: a slash command, dashboard page, MCP tool,
  REST route, env var, or desktop panel/mode/setting.
- You pulled or merged `main` and the user guide might be behind the code.
- Someone asks to "update / sync the user guide", or says the stories/use cases are stale.

**When NOT to use:** pure internal refactors with no user-facing change; edits to the deep
reference docs (`brainrouter-docs/cli.md`, `configuration.md`, …) — those are the source of
truth this guide points *into*, not part of it.

## Surface → docs map (the heart of this skill)

Each surface has a directory with `README.md` (user stories) + `use-cases.md` (recipes).
Find which surface(s) your change touches, then update that pair.

| Surface | Doc pair under `user-guide/` | Source of truth to check |
|---|---|---|
| **CLI** | `cli/README.md` · `cli/use-cases.md` | `brainrouter-cli/src/cli/commands/*` (slash commands), wizard, orchestration; `brainrouter-docs/cli.md` |
| **Desktop** | `desktop/README.md` · `desktop/use-cases.md` | `brainrouter-desktop/{electron,src}/*`, `brainrouter-desktop/package.json` (run scripts); roadmap + changelog for **status** |
| **Dashboard** | `dashboard/README.md` · `dashboard/use-cases.md` | `brainrouter-dashboard/app/**/page.tsx` (routes) + components |
| **MCP & integrations** | `mcp-integrations/README.md` · `mcp-integrations/use-cases.md` | `brainrouter/src/tools/*` (MCP tools), `brainrouter/src/api/routes/*` + `brainrouter/src/index.ts` (REST mounts), `brainrouter-docs/mcp-install.md`, `BRAINROUTER.md` |
| **Self-hosting** | `self-hosting/README.md` · `self-hosting/use-cases.md` | `brainrouter/.env.example`, `brainrouter-docs/configuration.md`, `brain-agents.md`, `federation.md` |

**Cross-cutting — update only when a *whole new surface* appears or one is renamed:**
- `user-guide/README.md` — the platform-at-a-glance table, the directory tree, personas,
  "start here by role", and the **version note** at the bottom.
- `brainrouter-docs/README.md` — the "task-oriented docs" callout list.

## Procedure

1. **Find what changed.**
   - *New implementation this session* → you already know; list the user-facing additions.
   - *After pull/merge main* → diff, then read the changelog:
     ```bash
     git log --oneline <since>..HEAD
     git diff --stat <since>..HEAD -- brainrouter-cli/src brainrouter/src \
        brainrouter-dashboard/app brainrouter-desktop brainrouter/.env.example
     ```
     Then read the newest `brainrouter-changelog/<version>.md` — it lists user-facing
     changes grouped by surface and is the best signal for which docs need touching.
2. **Map** each change to a surface row above. One change can hit several (e.g. a new env
   var → self-hosting; a new slash command that uses it → CLI). When a single feature spans
   surfaces, give each surface its own slice — document the action where the user performs
   it — and cross-link the related slice with a relative path instead of duplicating it.
3. **Update the doc pair** for each affected surface:
   - `README.md`: add/edit the scannable **user story** (table row,
     `As a … I want … so that …`, with a stable ID).
   - `use-cases.md`: add/edit the **Try-It → Verify** recipe (format below).
4. **Verify against source — never from memory.** Confirm every command/route/field before
   you write it:
   - CLI commands → grep `brainrouter-cli/src/cli/commands/`.
   - Dashboard routes → list `brainrouter-dashboard/app/**/page.tsx`.
   - MCP tools → grep `brainrouter/src/tools/`; REST routes → `brainrouter/src/index.ts`.
   - Env vars → `brainrouter/.env.example` / `configuration.md`.
   - Desktop run scripts → `brainrouter-desktop/package.json`.
5. **Cross-cutting:** if you added a whole new surface, update the two cross-cutting files.
   Bump the **version note** at the bottom of `user-guide/README.md` whenever you sync
   against a newer release — even with no new surface — so it states the version you
   actually verified against.
6. **State status honestly.** If a surface is alpha/preview/coming-soon, say so (check the
   roadmap + changelog) — don't imply it's shipped or installable when it isn't.

## Format contract (match the existing docs)

```
### UC-N · <goal in plain words>
Who / When : <role + trigger>
Steps      : <copy-pasteable commands / clicks>
✅ Verify   : <observable result — how you know it worked>
If it fails : <most common fix>
```

User stories stay one line, scannable in tables, each with a stable ID prefix per surface:
`CLI-S#`, `DESK-S#`, `DB-S#`, `MCP-S#`, `OPS-S#`. For the next ID, scan that surface's
`README.md` for the highest existing number and add one — never renumber existing stories
(recipes and other docs reference them by ID).

## Common mistakes

- **Writing from memory.** Command/route/env names drift between releases — a wrong one
  breaks the "testable" promise. Always source-verify (step 4).
- **Updating only half the pair.** Stories with no matching recipe (or vice-versa) leave the
  surface half-documented.
- **Forgetting the cross-cutting files.** A new surface that isn't in the platform map/tree
  is undiscoverable.
- **Over-claiming status.** Alpha ≠ shipped. Check before writing "production-ready".
- **Breaking the format.** Keep the `✅ Verify` line — it's what makes each use case a test.

## Quick reference

| Step | Do |
|---|---|
| What changed? | `git diff --stat <since>..HEAD` + read newest `brainrouter-changelog/*.md` |
| Which docs? | Map the change to a surface row → its `README.md` + `use-cases.md` |
| Get it right | Grep the source (commands / routes / tools / env) before writing |
| New surface? | Update `user-guide/README.md` (map · tree · personas · version note) + `brainrouter-docs/README.md` |
