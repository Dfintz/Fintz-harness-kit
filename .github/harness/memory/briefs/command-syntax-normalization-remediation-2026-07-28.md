---
status: active
date: 2026-07-28
stage: Architect
brief_type: Documentation-Consistency
ownership: harness-team
---

# Architecture Brief: Command Syntax Normalization In Remediation Artifacts
resource: .github/harness/memory/briefs/open-findings-remediation-2026-07-28.md,.github/harness/memory/reviews/review-breadth-2026-07-28-open-findings-remediation.md,.github/harness/memory/reviews/review-depth-2026-07-28-open-findings-remediation.md,.github/harness/memory/reviews/feedback-verdict-2026-07-28-open-findings-remediation.md,scripts/harness/graph.mjs

active

## Context Sufficiency Check

### Inventory

- Minor finding states mixed command syntax appears across remediation artifacts.
- Scope-relevant files are current remediation brief/reviews only, not historical archives.
- Current runnable command form is `npm run harness:graph status`.

### Scope

- Scope: documentation consistency update.
- Primary boundary: current remediation artifacts in `.github/harness/memory/briefs` and `.github/harness/memory/reviews`.

### Missing Context

- No blocker context missing.

## Gate Decisions

### Gate 1: Domain / Module Alignment

- Keep changes in memory artifacts that currently report/open this minor finding.

### Gate 2: Generality

- Normalize all examples to one command form: `npm run harness:graph status`.

### Gate 3: Ownership

- Brief and review ledgers own wording and command example consistency.

### Gate 4: Boundary Integrity

- No runtime code behavior changes required.
- Only textual consistency edits and finding status closure.

### Gate 4b: Isolation / Safety

- No safety, auth, tenancy, or guardrail changes.

### Gate 5: Reuse

- Reuse existing command proven in terminal output (`harness:graph status`); avoid introducing alternate aliases in docs.

## Planned Change Set

### Modify

- `.github/harness/memory/briefs/open-findings-remediation-2026-07-28.md`
- `.github/harness/memory/reviews/review-breadth-2026-07-28-open-findings-remediation.md`
- `.github/harness/memory/reviews/review-depth-2026-07-28-open-findings-remediation.md`
- `.github/harness/memory/reviews/feedback-verdict-2026-07-28-open-findings-remediation.md`

### Explicitly Not Doing

- No edits to older historical briefs/reviews outside this remediation set.
- No script/code changes.

## Constraints

- Keep edits minimal and auditable.
- Preserve factual history while updating current status and closure.

## Do-NOTs

- Do NOT rewrite unrelated findings.
- Do NOT alter behavior claims unsupported by command output.

## Assumptions

- [UNVERIFIED] No process depends on preserving the old mixed-syntax wording in these specific files.

## Validation Plan

- `npm run harness:docs:check` passes.
- `grep` for mixed mention in the four targeted files returns no remaining conflicting command form.
