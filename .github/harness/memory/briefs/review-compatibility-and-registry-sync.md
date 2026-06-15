# Architecture Brief: Restore review compatibility and sync registry entrypoints

Date: 2026-06-15
Scope: harness-kit command surface + machine-readable registry

## Problem

- `harness:review` was repointed to a prompt-router handoff output, breaking prior behavior where it executed `plan-review`.
- `.github/harness/registry.json` did not index the new prompt-router entrypoints, creating discoverability drift.

## Decisions

1. Preserve backward compatibility:

- Restore `harness:review` to `node scripts/harness/plan-review.mjs`.
- Introduce explicit handoff aliases:
  - `harness:handoff:review`
  - `harness:handoff:feature`
- Keep `harness:feature` as a handoff convenience alias.

2. Treat registry as source-of-truth for operator entrypoints:

- Add prompt-router script and wrapper command entries under `entrypoints` in `.github/harness/registry.json`.

3. Keep docs and runtime shortcuts aligned:

- Update `AGENTS.md`, `README.md`, and `.github/harness/HARNESS.md` to distinguish:
  - handoff commands (`harness:handoff:*` and `harness:feature`)
  - executable workflow command (`harness:review`)
- Update prompt-router reminder text to recommend `harness:handoff:review` for review handoffs.

## Files changed

- `package.json`
- `scripts/harness/prompt-router.mjs`
- `AGENTS.md`
- `README.md`
- `.github/harness/HARNESS.md`
- `.github/harness/registry.json`

## Constraints and Do-NOTs

- Do not remove `harness:plan-review`.
- Do not make `harness:review` a non-executing handoff alias.
- Do not leave registry and docs inconsistent with command behavior.

## Validation

- `harness:review` now runs `plan-review` and requires `--subject` as expected.
- `harness:handoff:review` prints review handoff plan.
- `harness:feature` prints feature handoff plan.
- JSON diagnostics clean for modified docs/config; remaining static warning in router is a known false positive around task normalization.
