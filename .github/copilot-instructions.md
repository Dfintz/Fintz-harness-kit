---
applyTo: '**'
---

# GitHub Copilot Instructions for the Harness Kit

This repository is the **harness kit itself**. When working here, optimize for reusable,
agent-agnostic harness behavior rather than one-off fixes for a single editor, provider, or project.

## Start here

Before changing code or docs, load these in order:

1. `AGENTS.md` for the repository entry point
2. `.github/harness/HARNESS.md` for the operating contract
3. `.github/harness/LOOPS.md` when touching loop behavior
4. Relevant files under `.github/instructions/` for workflow-stage behavior
5. Relevant files under `.github/skills/` when the task touches a published Copilot skill
6. `.github/harness/memory/README.md` and any relevant lessons / briefs before rediscovering context

## Authority chain

When guidance conflicts, higher entries win:

1. This file for Copilot-specific repository standards
2. `.github/instructions/0*.md` for stage-specific workflow requirements
3. Skill files under `.github/skills/`
4. `.github/harness/HARNESS.md` and `.github/harness/LOOPS.md` for orchestration and loop protocol

The harness does not replace repository standards; it tells the agent when to apply them.

## How Copilot should use this repository

- Treat `.github/copilot-instructions.md` as the GitHub Copilot App entrypoint for this repo.
- For non-trivial work, follow the harness stage machine: Understand -> Architect -> Implement ->
  Review Breadth -> Review Depth -> Feedback.
- Load the matching skill before editing in that area.
- Use `harness.config.json` as the source of truth for project commands and model-routing defaults.
- Prefer the existing harness scripts and config tokens over hardcoded workflow logic.

## Repository-specific standards

- Keep the kit **project-agnostic**. Do not bake in assumptions that only fit one product, stack, or
  team unless the file is explicitly an example/template.
- Keep Copilot, Claude, and generic-agent surfaces aligned when behavior changes:
  - `AGENTS.md`
  - `.github/copilot-instructions.md`
  - `.github/harness/HARNESS.md`
  - `.github/instructions/`
  - `.github/skills/`
  - `skills/harness/SKILL.md`
  - `README.md` / `SETUP.md` when operator-facing behavior changes
- Prefer configuration-driven changes in `harness.config.json`, loop JSON, skill metadata, and docs
  over special cases embedded in scripts.
- Preserve safety properties: bounded loops, deterministic validation, explicit terminal states, human
  review gates, and no silent weakening of guardrails.
- Do not silently remove or dilute diagnostics, risk reporting, or review stages just to make a path
  feel simpler.

## Editing guidance

- Make precise changes that solve the root problem and keep related documentation in sync.
- Reuse existing patterns and naming from nearby harness files.
- Keep examples clearly labeled as examples when they are not universal policy.
- Prefer additive, well-scoped documentation updates over broad rewrites.

## Validation guidance

- Run the narrowest existing command that covers the changed behavior.
- For harness runtime changes, prefer the relevant self-test or loop/report command already exposed in
  `package.json`.
- For docs-only changes, verify the edited instructions stay internally consistent and reference real
  files in the repository.

## Useful commands

```bash
npm run harness:route -- --task "<prompt>"
npm run harness:feature -- --task "<feature task>"
npm run harness:handoff:review -- --task "<review task>"
npm run harness:loops
npm run harness:report
```

## Copilot-specific note

When another file says "read `.github/copilot-instructions.md` first," this is the file it means.
Keep it present, concise, and aligned with the rest of the harness so the GitHub Copilot App can load
the same operating contract the other agent surfaces use.
