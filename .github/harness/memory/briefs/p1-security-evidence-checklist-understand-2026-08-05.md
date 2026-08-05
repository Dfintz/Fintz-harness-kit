---
summary: "Understand Stage - P1 Security Evidence Checklist"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [understand, p1, security, checklist, lurkr]
---
# Understand Stage - P1 Security Evidence Checklist
resource: .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-05.md, .github/harness/memory/radar/hermes-security-evidence-checklist.md, scripts/harness/lurkr-diff.mjs, .github/instructions/05-REVIEW-BREADTH.md, .github/workflows/harness-optional-security-gates.example.yml, SETUP.md

## Context sufficiency check
- Available artifacts:
  - Wayfinder P1 row for security evidence checklist adoption.
  - Existing T4 differential security workflow artifacts and scripts.
  - Current review-breadth and setup guidance.
- Scope: workflow plus documentation plus security evidence metadata in differential reports.
- Missing critical context: none.

## Graph freshness gate
- Command: `npm run harness:graph -- provider-status`
  - Result: provider ready (`understand-anything`), graph path present.
- Command: `npm run harness:graph -- status`
  - Result: graph fresh and matched HEAD.

## Impact map
- Changed components (planned):
  - `scripts/harness/lurkr-diff.mjs`
  - `.github/instructions/05-REVIEW-BREADTH.md`
  - `SETUP.md`
  - `.github/workflows/harness-optional-security-gates.example.yml`
- Affected components:
  - `package.json` security command surface (referenced, unchanged).
  - Existing T4 security workflow brief family under `.github/harness/memory/briefs/`.
- Affected layers:
  - Optional security workflow runtime script layer.
  - Review instructions layer.
  - Operator setup and CI example layer.

## Residual risk
- Low: change is additive and evidence-only, with no scanner enforcement or approval-boundary changes.
