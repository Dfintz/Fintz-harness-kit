---
status: active
date: 2026-07-28
stage: Architect
brief_type: Documentation-Consistency
ownership: harness-team
---

# Architecture Brief: Historical Command Syntax Normalization Sweep
resource: .github/harness/memory/briefs/BRIEF-fix-full-review-findings-2026-07-25.md,.github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-20.md,.github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-25.md,.github/harness/memory/briefs/p0-2-harness-health-command-brief-2026-07-27.md,.github/harness/memory/briefs/p1-2-prompt-router-path-hardening-brief-2026-07-27.md,.github/harness/memory/briefs/p1-3-snyk-trust-and-rescan-brief-2026-07-27.md,.github/harness/memory/briefs/radar-gap-review-breadth-2026-07-26.md,.github/harness/memory/briefs/whole-harness-review-brief-2026-07-27.md,.github/harness/memory/reviews/review-breadth-2026-07-28-mcp-convergence.md,scripts/harness/graph.mjs

active

## Context Sufficiency Check

### Inventory

- Historical artifacts still contain legacy syntax examples using `npm run harness:graph -- status`.
- Active remediation files were already normalized and are out of scope for this sweep.
- Current canonical runnable form is `npm run harness:graph status`.

### Scope

- Scope: historical memory artifacts only.
- Boundary: normalize command examples while preserving surrounding historical meaning, findings, and chronology.

### Missing Context

- No blocker context missing.

## Gate Decisions

### Gate 1: Domain / Module Alignment

- Changes stay within memory brief/review artifacts and do not touch runtime scripts.

### Gate 2: Generality

- Apply one canonical command form across all targeted historical references.

### Gate 3: Ownership

- Historical memory artifacts are the correct ownership boundary for this cleanup.

### Gate 4: Boundary Integrity

- No behavior claims are changed; only command tokenization is normalized.
- Preserve history wording and incident context in every artifact.

### Gate 4b: Isolation / Safety

- No auth/security/tenant/approval surfaces touched.

### Gate 5: Reuse

- Reuse the already-validated canonical command form from current runbooks: `npm run harness:graph status`.

## Planned Change Set

### Modify

- `.github/harness/memory/briefs/BRIEF-fix-full-review-findings-2026-07-25.md`
- `.github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-20.md`
- `.github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-25.md`
- `.github/harness/memory/briefs/p0-2-harness-health-command-brief-2026-07-27.md`
- `.github/harness/memory/briefs/p1-2-prompt-router-path-hardening-brief-2026-07-27.md`
- `.github/harness/memory/briefs/p1-3-snyk-trust-and-rescan-brief-2026-07-27.md`
- `.github/harness/memory/briefs/radar-gap-review-breadth-2026-07-26.md`
- `.github/harness/memory/briefs/whole-harness-review-brief-2026-07-27.md`
- `.github/harness/memory/reviews/review-breadth-2026-07-28-mcp-convergence.md`

### Explicitly Not Doing

- No edits to current active remediation artifacts already normalized in this session.
- No edits to runtime code or package scripts.

## Constraints

- Keep changes surgical and text-only.
- Preserve historical context wording except command syntax tokens.
- Preserve chronology, severity labels, verdict language, and incident narrative exactly.

## Do-NOTs

- Do NOT rewrite findings severity, chronology, or evidence conclusions.
- Do NOT change quote intent beyond command syntax normalization.

## Assumptions

- [UNVERIFIED] Historical references are illustrative and should align with current canonical command style.

## Validation Plan

- `npm run harness:docs:check` passes.
- Target-bounded legacy-form check returns zero matches across only this file set:
	- `.github/harness/memory/briefs/BRIEF-fix-full-review-findings-2026-07-25.md`
	- `.github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-20.md`
	- `.github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-25.md`
	- `.github/harness/memory/briefs/p0-2-harness-health-command-brief-2026-07-27.md`
	- `.github/harness/memory/briefs/p1-2-prompt-router-path-hardening-brief-2026-07-27.md`
	- `.github/harness/memory/briefs/p1-3-snyk-trust-and-rescan-brief-2026-07-27.md`
	- `.github/harness/memory/briefs/radar-gap-review-breadth-2026-07-26.md`
	- `.github/harness/memory/briefs/whole-harness-review-brief-2026-07-27.md`
	- `.github/harness/memory/reviews/review-breadth-2026-07-28-mcp-convergence.md`
- Target-bounded canonical-form check confirms replacements exist in those files.
- Before/after match counts are captured in implementation evidence.
