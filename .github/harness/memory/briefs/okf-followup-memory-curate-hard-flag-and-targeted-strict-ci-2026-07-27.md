---
summary: "Brief: OKF follow-up hard-flag remediation and targeted strict CI — active"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [okf, followup, memory, curate]
---
# Brief: OKF follow-up hard-flag remediation and targeted strict CI — active

resource: scripts/harness/memory-curate.mjs,scripts/harness/okf-phase0.mjs,.github/workflows/harness-optional-security-gates.example.yml,.github/harness/memory/briefs/harness-review-consistency-2026-07-25.md

## Objective

Resolve the single hard-flagged memory entry reported by memory-curate and add a targeted strict OKF CI check that scopes enforcement to selected/changed memory paths without changing repository-wide defaults.

## Scope

- In scope: Correct malformed brief status in the flagged brief file.
- In scope: Add targeted-path filtering support to OKF phase-0 audit strict mode.
- In scope: Add optional CI example step to run strict OKF only for changed memory files.
- Out of scope: Enforcing strict OKF across all memory files.
- Out of scope: Bulk migration of existing memory corpus frontmatter.

## Understand evidence and impact map

- Hard-flagged file from memory-curate: harness-review-consistency-2026-07-25.md (malformed-status).
- Primary implementation file: scripts/harness/okf-phase0.mjs.
- CI surface: .github/workflows/harness-optional-security-gates.example.yml.
- Blast radius: low (read-only scanning and optional workflow example only).

## Gate results

- Gate 1 Domain alignment: PASS.
- Gate 2 Generality: PASS (targeting mechanism is generic path scoping).
- Gate 3 Ownership: PASS (status fix in brief owner; strict-scope logic in okf-phase0 owner).
- Gate 4 Boundary integrity: PASS (no routing/loop contract change).
- Gate 4b Isolation/safety: PASS (no permission widening; optional CI gate behind env toggle).
- Gate 5 Reuse: PASS.

## Key decisions

1. Fix malformed brief status using canonical first-line status format.
2. Add repeatable target path argument to okf-phase0 so strict checks can scope to changed files.
3. Keep strict checks opt-in in CI using a dedicated env toggle.

## Constraints

- Preserve current default readiness semantics.
- Keep okf-phase0 read-only.
- Keep workflow change optional and non-breaking by default.

## Validation plan

- node scripts/harness/memory-curate.mjs --strict
- npm run harness:okf:phase0 -- --self-test
- npm run harness:okf:phase0 -- --json --strict-okf --target .github/harness/memory/briefs/harness-review-consistency-2026-07-25.md

## Do NOT

- Do NOT require strict OKF globally.
- Do NOT auto-modify memory files during scans.
- Do NOT alter graph/routing behavior in this follow-up.

## Assumptions and risks

- [UNVERIFIED] CI runners invoking optional strict check have a meaningful diff base.
- Risk: strict targeted check will fail for changed files lacking frontmatter/type, which is intended when toggle is enabled.

## Architect challenge

- VERDICT: APPROVED.
- Challenge result: status-header remediation plus target-scoped strict checks preserve default behavior while enabling opt-in enforcement.
- Blocking concerns: none.

## Feedback verdict

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Resolve current hard-flagged memory entry | Challenge upheld | memory-curate strict output now reports hard-flagged total 0 after status header fix | HIGH | Keep updated brief header format in place |
| 2 | Add strict OKF CI without repo-wide disruption | Decision holds | okf-phase0 target scoping plus workflow toggle preserves default-off behavior | HIGH | Keep optional targeted strict gate behind env toggle |
