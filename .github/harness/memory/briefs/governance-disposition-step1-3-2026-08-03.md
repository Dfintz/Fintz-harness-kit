---
summary: "Architecture Brief — governance disposition step 1 through step 3"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [governance, analyzer, architecture, 2026]
---

# Architecture Brief — governance disposition step 1 through step 3

resource: scripts/harness/acceptance-gate.mjs, scripts/harness/plan-review.mjs, .github/harness/memory/briefs/repo-wide-analyzer-pattern-trusted-reads-implementation-2026-08-03.md, .github/harness/memory/briefs/repo-wide-analyzer-pattern-trusted-reads-review-breadth-2026-08-03.md, .github/harness/memory/briefs/repo-wide-analyzer-pattern-trusted-reads-review-depth-2026-08-03.md, .github/harness/memory/briefs/repo-wide-analyzer-pattern-trusted-reads-feedback-2026-08-03.md

## Objective

Complete operational step 1 through step 3 for the accepted-hotspot governance move:

1. stage governance artifacts,
2. record decision to keep the current structural workaround,
3. create a governance-focused commit.

## Graph-first understand packet

- Graph freshness: fresh at HEAD (`npm run harness:graph -- status`)
- Changed components: `scripts/harness/acceptance-gate.mjs`, `scripts/harness/plan-review.mjs`, governance brief artifacts under `.github/harness/memory/briefs/`
- Affected components (graph dependents): none for `acceptance-gate.mjs` and `plan-review.mjs`
- Layers: `Core`, `Utility Layer`, `Test Layer`; touched runtime files are in Core, briefs are documentation-memory artifacts
- Risk: low to medium (governance-only plus already-tested runtime changes)

## Gate ledger

### Gate 1 — Domain alignment

PASS. Task is a governance closeout for analyzer residuals and aligns with harness memory/review workflow.

### Gate 2 — Generality and reuse

PASS. The disposition format is reusable (scope, rationale, controls, reopen triggers).

### Gate 3 — Data ownership and contracts

PASS. Runtime ownership remains in `acceptance-gate.mjs` and `plan-review.mjs`; governance ownership remains in brief artifacts.

### Gate 4 — Safety and operational risk

PASS with bounded residual risk. No destructive operations required; only git staging/commit and documentation updates.

### Gate 4b — Security/permissions/destructive actions

PASS. No permission widening, no secret handling, no destructive git commands.

### Gate 5 — Test/verification strategy

PASS. Verification includes:

- `npm run test:harness:acceptance`
- `npm run harness:plan-review:self-test`
- `get_errors` on governance brief artifacts (markdown lint clean)
- `git status --short` for exact staging scope

## Architecture decisions

1. Keep the current structural workaround (manifest-selected reads + strict path validation) as the runtime baseline.
2. Treat remaining file-inclusion diagnostics as accepted trust-boundary hotspots under governance disposition.
3. Commit governance and runtime files together in one atomic change-set to preserve traceability between implementation and disposition.

## Constraints

- Do not weaken path-validation or command-validation behavior.
- Do not use destructive git operations.
- Keep commit scope limited to files changed by this slice.

## Do-NOT rules

- Do not reopen further local code churn to chase the same analyzer warning class in this run.
- Do not add policy claims not backed by the current evidence set.
- Do not include unrelated modified files in this commit.

## Assumptions

- "Step 1 through step 3" refers to the previously proposed operational sequence (stage artifacts, keep workaround, commit).
- User intends execution, not advisory-only output.

## Implementation plan

1. Validate current runtime tests and brief lint state.
2. Stage exactly the two runtime files and four governance brief artifacts.
3. Create a single commit with governance-focused message/body including accepted hotspot rationale and reopen triggers.
