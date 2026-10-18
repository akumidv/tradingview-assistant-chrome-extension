# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Gemini, Copilot) working in this
repository. Vendor pointer files import this document — it is the single source of truth.

## Dev layer — akmon (developing the project)

This project uses the akmon dev layer — one standard for how an assistant helps develop it.
Model & notation: [`MODEL.md`](https://github.com/akumidv/ai_akmon/blob/main/MODEL.md); attach/realign guide:
[`BOOTSTRAP.md`](https://github.com/akumidv/ai_akmon/blob/main/BOOTSTRAP.md); overview: [`README.md`](https://github.com/akumidv/ai_akmon/blob/main/README.md).

- **Archetype / language:** `frontend` / `javascript` — classified per
  [`ARCHETYPES.md`](https://github.com/akumidv/ai_akmon/blob/main/ARCHETYPES.md) (a Chrome
  extension: content scripts + popup running in the browser); mirrored by `attached_archetype`
  in `_aitna/.akmon.toml`.
- **Layers:** SHARED = installed `akmon` npm package (hooks run from `node_modules/akmon/js/hooks`; only the imported guardrails are materialized, at `_aitna/.akmon/guardrails/`; `npx akmon path` locates the rest) · LOCAL = `_aitna/{agents,skills,tools,memory}` +
  [`_aitna/TASKS.md`](_aitna/TASKS.md) · USAGE = root `skills/` (absent until this project
  exposes one).
- **Agents (roles):** [review](_aitna/agents/review/README.md),
  [architect](_aitna/agents/architect/README.md), [engineer](_aitna/agents/engineer/README.md)
  → roles: [`akmon/roles/`](https://github.com/akumidv/ai_akmon/blob/main/roles/README.md) — run `akmon path` to read them locally.
  **Declare the active agent** before doing work and restate it on switch
  (`🧭 agent: <name> — <focus>`).
- **Delegation (always-on, direct):** **delegation is the default.** For every non-trivial
  task, before the first repository sweep, edit, or test run, decompose the work and delegate
  every independent mechanical sub-step to available subagents without waiting for an owner
  prompt. The orchestrator retains decomposition, routing, synthesis, and owner dialogue. Skip
  only when the task is atomic or the harness exposes no subagents; state the reason. This
  clause is direct because Codex does not expand nested `@` imports in `AGENTS.md`.
- **Owner authority (always-on — it overrides any task instruction):** the owner verifies
  consequential architecture, data-shape and math decisions recorded in ADRs; an assistant
  *drafts*, the owner *decides*. **D5** — the owner owns commits, tags, pushes, publishing and pin bumps; never
  `git add`/`commit`/`push` on the owner's behalf.
- **Guardrails and profiles (always-on):** the common guardrail and the project's language
  profile are **imported** (not just linked) so their rules load at session start; akmon is the
  single owner — do not restate them here. Import this project's language profile on its own
  line (e.g. `@_aitna/.akmon/profiles/python.md`), and an environment profile where some of its code
  runs in one, per the ARCHETYPES map. akmon ships no `js` language profile yet, so only the
  common guardrail is imported; import the `js` profile here once akmon adds it (backlog `A2`).

@_aitna/.akmon/guardrails/_common.md

- **Domain profiles (opt-in by need):** none attached yet — link only those the project actually needs.
- **Pipelines:** [pre-commit](https://github.com/akumidv/ai_akmon/blob/main/pipelines/pre-commit.md) (tests mandatory),
  [review-flow](https://github.com/akumidv/ai_akmon/blob/main/pipelines/review-flow.md),
  [design-flow](https://github.com/akumidv/ai_akmon/blob/main/pipelines/design-flow.md),
  [code-flow](https://github.com/akumidv/ai_akmon/blob/main/pipelines/code-flow.md),
  [tasks](https://github.com/akumidv/ai_akmon/blob/main/pipelines/tasks.md) (backlog format), and the learn loop
  ([memory-distill](https://github.com/akumidv/ai_akmon/blob/main/pipelines/memory-distill.md) +
  [learning](https://github.com/akumidv/ai_akmon/blob/main/pipelines/learning.md)).
- **Memory:** read `_aitna/memory/` at session start — distilled project facts, indexed by
  [`_aitna/memory/README.md`](_aitna/memory/README.md).
- **Changelog:** [`extension/CHANGELOG.md`](extension/CHANGELOG.md) (not the repository root) —
  written only through the [changelog skill](_aitna/skills/changelog/SKILL.md), which also decides
  what is substantive enough for an entry.
- **Backlog:** [`_aitna/TASKS.md`](_aitna/TASKS.md) — one line per task, detail by reference;
  finished entries move to `TASKS_ARCHIVE.md`.
- **Decisions:** [`_aitna/decisions/`](_aitna/decisions/README.md) — accepted thematic ADRs,
  numbered; an assistant drafts a block, the owner accepts it.
- **Secrets:** from `.env` (gitignored). Never in code, docs, tests, or commits.
