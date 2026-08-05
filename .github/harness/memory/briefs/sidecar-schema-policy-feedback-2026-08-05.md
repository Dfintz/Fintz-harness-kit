## Feedback Verdict Record
resource: .github/harness/memory/briefs/sidecar-schema-policy-architecture-2026-08-05.md, .github/harness/memory/briefs/sidecar-schema-policy-review-breadth-2026-08-05.md, .github/harness/memory/briefs/sidecar-schema-policy-review-depth-2026-08-05.md, .github/harness/memory/briefs/v1-2-0-wait-what-adoption-architecture-2026-08-05.md

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Enforce sidecar schema/policy contract strictly | Current decision holds | New schema file + deterministic checker pass + successful validation outputs | HIGH | Keep strict validation in docs-check |
| 2 | Add a dedicated deterministic command for sidecar checks | Challenge upheld | package.json includes sidecar-only command and it passes | HIGH | Retain harness:skills:sidecars:check |
| 3 | Evaluate one v1.2.0 behavior skill for adoption now | Third option | Focused wait-what architecture brief recommends pilot/deferred adoption | HIGH | Keep decision brief; schedule optional pilot follow-up |

### Accepted changes
- Strict sidecar contract and policy key requirements are now checked deterministically.
- All local sidecars conform to the enforced schema.
- Focused architecture brief completed for wait-what behavior skill.

### Rejected challenges
- Immediate runtime integration of sidecar policy into prompt-router was rejected for this pass.

### Deferred points
- wait-what implementation pilot (optional, separate scoped change).

### Brief updates
- Decisions changed: none after review.
- Constraints updated: none.
- Do NOT updates: none.
- Assumptions retained: external consumer semantics for policy key.

### Response notes
- The schema/policy contract is now explicit, deterministic, and CI-friendly.
- Behavior-skill adoption was evaluated with architecture gates and is ready for a separate pilot if desired.
