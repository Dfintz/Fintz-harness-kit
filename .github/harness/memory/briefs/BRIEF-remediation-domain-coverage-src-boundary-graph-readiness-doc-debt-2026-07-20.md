<!-- markdownlint-disable-next-line MD022 -->
# Architecture Brief: Remediation for Coverage, Source Boundary, Graph Readiness, and Documentation Debt
resource: frontend/, apps/mobile/, backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts, scripts/harness/graph.mjs, README.md, .github/harness/memory/briefs/BRIEF-comprehensive-review-2026-07-20.md, .github/harness/reviews/comprehensive-review-2026-07-20-implementation-notes.md, .github/harness/reviews/comprehensive-review-2026-07-20-review-breadth-findings.md

## Objective

Address remediable findings from the prior comprehensive review in this repository snapshot, while clearly preserving unresolved blockers that require missing source material.

## Scope and boundaries

- In scope:
  - Historical markdown lint debt cleanup in prior comprehensive brief/review artifacts.
  - Re-validation of README markdown debt claim status.
  - Confirmation and documentation of unresolved coverage and source-boundary blockers.
- Out of scope:
  - Creating or reconstructing missing frontend/mobile source code.
  - Refactoring backend dist/source architecture without canonical source files present.
  - Changing graph provider plugin installation state outside repository-managed files.

## Artifacts to create

- .github/harness/reviews/remediation-domain-coverage-src-boundary-graph-readiness-doc-debt-2026-07-20-implementation-notes.md
- .github/harness/reviews/remediation-domain-coverage-src-boundary-graph-readiness-doc-debt-2026-07-20-review-breadth-findings.md
- .github/harness/reviews/remediation-domain-coverage-src-boundary-graph-readiness-doc-debt-2026-07-20-review-depth-findings.md
- .github/harness/reviews/remediation-domain-coverage-src-boundary-graph-readiness-doc-debt-2026-07-20-feedback-verdict.md

## Artifacts to modify

- .github/harness/memory/briefs/BRIEF-comprehensive-review-2026-07-20.md
- .github/harness/reviews/comprehensive-review-2026-07-20-implementation-notes.md
- .github/harness/reviews/comprehensive-review-2026-07-20-review-breadth-findings.md

## Key decisions

- Keep provenance-line requirement intact for all new briefs.
- Remediate what is directly actionable (documentation debt) and explicitly classify non-actionable findings as blocked by missing context/assets.
- Treat graph freshness as valid but graph refresh-readiness degradation as an operational setup risk.

## Constraints

- No speculative code generation for missing frontend/mobile domains.
- No runtime behavior changes beyond this remediation scope.

## Validation plan

- get_errors on remediated historical artifact files.
- npm run harness:docs:check for contract integrity.
- file/directory checks for frontend/mobile and backend/src visibility.
- graph status/provider-status checks for readiness.

## Do NOT

- Do NOT claim full-app domain validation completion while frontend/mobile source remains absent.
- Do NOT claim backend source-boundary risk is resolved without canonical runtime source restoration.

## Assumptions and risks

- [UNVERIFIED] frontend/mobile source may exist in another branch or separate repository.
- [UNVERIFIED] backend runtime TypeScript source may exist outside this workspace snapshot.
- Residual risk: graph refresh still depends on pluginRoot configuration.

## Inline skeptical pass (architect-challenge fallback)

- Challenge: Could markdown debt cleanup hide substantive technical risk?
  - Resolution: No; cleanup only improves artifact quality and does not alter earlier substantive findings.
- Challenge: Could missing frontend/mobile source be treated as low severity because directories exist?
  - Resolution: No; absent first-party source keeps this as a blocker for whole-app validation.

VERDICT: APPROVED
