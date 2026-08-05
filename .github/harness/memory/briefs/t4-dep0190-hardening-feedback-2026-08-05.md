---
summary: "Feedback Verdict - T4 DEP0190 cmd-shim hardening"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [feedback, t4, dep0190]
---
# Feedback Verdict - T4 DEP0190 cmd-shim hardening
resource: .github/harness/memory/briefs/t4-dep0190-hardening-understand-2026-08-05.md, .github/harness/memory/briefs/t4-dep0190-hardening-architecture-2026-08-05.md, .github/harness/memory/briefs/t4-dep0190-hardening-architect-challenge-2026-08-05.md, .github/harness/memory/briefs/t4-dep0190-hardening-implementation-2026-08-05.md, .github/harness/memory/briefs/t4-dep0190-hardening-review-breadth-2026-08-05.md, .github/harness/memory/briefs/t4-dep0190-hardening-review-depth-2026-08-05.md

## Verdict table
| # | Challenge point | Verdict | Evidence | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Is DEP0190 removed from Windows npx scanner path? | Current decision holds | production diff rerun output did not emit DEP0190 warning | HIGH | keep implementation |
| 2 | Were safety checks preserved? | Current decision holds | `assertSafeCommand` unchanged | HIGH | keep guardrails |
| 3 | Did task stay scoped? | Current decision holds | only scanner execution transport changed | HIGH | close ticket |

## Final verdict
- APPROVED

## Residual risk
- Environment-specific npm CLI location may vary; monitor for operator reports.
- Scanner can still return non-zero exit for both base/head in this environment; this does not invalidate the DEP0190 hardening result and should be interpreted as scanner/runtime outcome rather than shell-deprecation regression.
