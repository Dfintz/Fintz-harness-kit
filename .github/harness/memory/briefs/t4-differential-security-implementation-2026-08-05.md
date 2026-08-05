---
summary: "Implementation Summary - T4 Differential Security Scan Workflow"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [implement, t4, security, differential]
---
# Implementation Summary - T4 Differential Security Scan Workflow
resource: .github/harness/memory/briefs/t4-differential-security-architecture-2026-08-05.md, scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-check.mjs, scripts/harness/lurkr-diff.mjs, package.json, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md, .github/harness/runs/t4-lurkr-diff-smoke.json, .github/harness/runs/t4-lurkr-diff-nodev.json

## Delivered changes
1. Shared command execution core
- Added `scripts/harness/lurkr-core.mjs` with reusable:
  - argument parsing (`--required`, `--command`),
  - command resolution (`HARNESS_LURKR_COMMAND` fallback),
  - token safety checks,
  - scanner process execution helper.

2. Existing wrapper refactor
- Updated `scripts/harness/lurkr-check.mjs` to consume shared core without changing its operator-facing behavior.

3. Differential report command
- Added `scripts/harness/lurkr-diff.mjs`:
  - resolves base ref (`--base`, default `HEAD~1`),
  - scans base snapshot in temp detached worktree and current HEAD,
  - computes deterministic line-based added/removed findings drift,
  - writes JSON report (`--output`, default `.github/harness/runs/lurkr-diff-report.json`),
  - supports warning mode and `--required` fail mode,
  - writes explicit skipped report when scanner command is unconfigured.

4. Command and docs wiring
- Added npm script in `package.json`:
  - `harness:security:lurkr:diff`.
- Updated `SETUP.md` optional security section with before/after usage examples.
- Updated `.github/instructions/05-REVIEW-BREADTH.md` security lane guidance to include differential evidence command path.

## Deterministic evidence
- Skipped-mode artifact path proof:
  - `.github/harness/runs/t4-lurkr-diff-smoke.json` created with `status: skipped` when no scanner command is configured.
- Active diff-flow proof:
  - `.github/harness/runs/t4-lurkr-diff-nodev.json` generated via deterministic command `node -v` on both refs with zero drift.

## Validation run log
- `node --check scripts/harness/lurkr-core.mjs` -> pass.
- `node --check scripts/harness/lurkr-check.mjs` -> pass.
- `node --check scripts/harness/lurkr-diff.mjs` -> pass.
- `npm run harness:security:lurkr:diff -- --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-smoke.json` -> pass (skip report generated).
- `node scripts/harness/lurkr-diff.mjs --command "node -v" --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-nodev.json` -> pass (drift report generated).

## Self-review checklist
- Additive and backward-compatible: yes.
- Default optional policy preserved: yes.
- Shared logic deduplicated: yes.
- Deterministic report path exists even on skipped runs: yes.
