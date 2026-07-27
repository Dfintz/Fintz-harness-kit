## Feedback Verdict Record
resource: .github/harness/memory/briefs/route-and-reviewer-preflight-hard-fail-brief-2026-07-27.md,.github/harness/memory/briefs/route-and-reviewer-preflight-review-breadth-2026-07-27.md,.github/harness/memory/briefs/route-and-reviewer-preflight-review-depth-2026-07-27.md,scripts/harness/prompt-router.mjs,scripts/harness/plan-review.mjs

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Non-trivial routes should hard-fail when graph refresh readiness is degraded | Challenge upheld | non-trivial route command now exits with explicit degraded-readiness error; trivial route still passes | HIGH | Keep `prompt-router` preflight guard |
| 2 | Architect-challenge failures should be actionable before execution starts | Challenge upheld | `plan-review` now performs reviewer smoke preflight and fails with exit, verdict status, and output preview | HIGH | Keep reviewer preflight and diagnostics |
| 3 | Existing plan-review static-analysis debt must be fixed in this same patch | Partial / deferred | diagnostics exist but predate this feature and are broader than scoped change | HIGH | Defer to dedicated hardening/refactor task |

### Accepted changes
- `prompt-router`: non-trivial graph-readiness hard-fail preflight.
- `plan-review`: reviewer command preflight with verdict requirement and actionable diagnostics.

### Rejected challenges
- None.

### Deferred points
- Full plan-review complexity/security refactor remains open as a separate workstream.

### Brief updates
- No architectural decision changes required.

### Response notes
- The implemented preflights convert ambiguous runtime failures into deterministic, actionable stops.
- This run intentionally leaves broader static-analysis debt untouched to preserve tight scope and avoid mixed refactor risk.