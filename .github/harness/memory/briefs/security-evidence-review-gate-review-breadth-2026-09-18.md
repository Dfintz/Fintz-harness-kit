---
summary: "Review Breadth - Security Evidence and Review Gate Enforcement"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [review-breadth, security, evidence, review-gate]
artifact_family: review
immutability: frozen
immutable_since: 2026-09-18
---
## Review Breadth
resource: .github/harness/memory/briefs/security-evidence-review-gate-2026-09-18.md, scripts/harness/security-review-gate.mjs, scripts/harness/test/security-review-gate-test.mjs, scripts/harness/lurkr-diff.mjs, scripts/harness/plan-review.mjs, .github/workflows/harness-optional-security-gates.example.yml

### Findings
| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| Blocker | Initial gate rejected the normal Lurkr diff shape because `status` is absent. | Real smoke report exposed the mismatch. | Fixed by deriving success from checklist and scan results. |
| Major | Initial gate did not recognize nested `review.finalVerdict`. | Plan-review journal contract inspection. | Fixed and covered by tests. |
| Major | Malformed checklist rows were not rejected. | Challenge fixture with unknown ID/status. | Fixed with required-ID and status validation. |
| Minor | Workflow requires a review JSON artifact produced by a separate stage. | Workflow does not run plan-review itself. | Accepted and documented as an explicit prerequisite. |

### Coverage note
- Covered gate evaluator behavior, actual Lurkr differential report compatibility, plan-review journal shape, path containment, package command surface, workflow wiring, and docs contracts.
- Scanner-specific finding semantics remain intentionally out of scope.

### Verdict
- No unresolved Blocker or Major findings.
