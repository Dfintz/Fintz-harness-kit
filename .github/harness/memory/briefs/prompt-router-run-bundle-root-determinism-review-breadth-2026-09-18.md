---
summary: "Review Breadth - Prompt Router Run-Bundle Root Determinism"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [review-breadth, prompt-router, tests]
artifact_family: review
immutability: frozen
immutable_since: 2026-09-18
---
## Review Breadth
resource: .github/harness/memory/briefs/prompt-router-run-bundle-root-determinism-2026-09-18.md, scripts/harness/test/prompt-router-run-bundle-test.mjs, scripts/harness/prompt-router.mjs

### Findings
| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| Blocker | None after fix. | Prompt-router run-bundle suite passes with external `HARNESS_PROJECT_ROOT`. | None. |
| Major | None. | Product router unchanged; explicit alternate project-root assertions remain. | None. |
| Minor | Ambient project-root environment can redirect other ad hoc subprocess tests. | Reproduced original failure with `HARNESS_PROJECT_ROOT` pointing at another repository. | This test is now isolated; broader test-helper policy can be a follow-up. |

### Verdict
- APPROVED.
