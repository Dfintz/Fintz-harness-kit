---
summary: "Understand Stage - T4 Differential Security Scan Workflow"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [understand, t4, security, differential, lurkr]
---
# Understand Stage - T4 Differential Security Scan Workflow
resource: .github/harness/memory/briefs/wayfinder-decision-map-2026-08-05.md, .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, scripts/harness/lurkr-check.mjs, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md

## Graph freshness gate
- Provider status: ready (`understand-anything` provider available, query yes, refresh yes).
- Graph status: STALE by 1 commit / 25 files behind HEAD.
- Refresh readiness: ready.
- Decision: proceed with T4 scope discovery using current graph + live file evidence; mark stale-state residual risk for follow-up refresh.

## Scope statement
- Scope type: mixed (workflow + script + docs).
- Ticket objective: implement a repeatable before/after security findings path for optional Lurkr checks with optional CI usage.

## Impacted surfaces
- Runtime script surface:
  - `scripts/harness/lurkr-check.mjs` (existing single-snapshot wrapper).
  - New shared command-parsing/execution helper (`scripts/harness/lurkr-core.mjs`).
  - New differential report command (`scripts/harness/lurkr-diff.mjs`).
- Command entrypoints:
  - `package.json` scripts (`harness:security:lurkr`, new `harness:security:lurkr:diff`).
- Operator documentation:
  - `SETUP.md` optional security section.
  - `.github/instructions/05-REVIEW-BREADTH.md` security lane guidance.

## Dependency and boundary map
- `lurkr-check` and `lurkr-diff` share parsing/safe-token policy through `lurkr-core`.
- Differential flow depends on git worktree operations (`git worktree add/remove`) and configured scanner command (`HARNESS_LURKR_COMMAND` or `--command`).
- Output boundary is file artifact only (JSON report under `.github/harness/runs/`), no policy enforcement by default.

## Missing context and limitations
- Missing: scanner-specific structured output contract (Lurkr JSON schema not required by current harness integration).
- Limitation: differential report must be line-based across scanner stdout/stderr to remain scanner-agnostic.
- Risk: output drift noise if scanner emits unstable banners/timestamps.

## Understand verdict
- Proceed to Architect with additive, backward-compatible T4 slice:
  - add deterministic before/after report command,
  - keep existing warning-mode semantics,
  - document optional CI integration path.
