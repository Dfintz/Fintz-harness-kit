---
summary: "P1-2 Prompt-Router Path Hardening Feedback - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [prompt, router]
---
# P1-2 Prompt-Router Path Hardening Feedback - 2026-07-27
resource: .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-brief-2026-07-27.md, .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-implementation-2026-07-27.md, .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-review-breadth-2026-07-27.md, .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-review-depth-2026-07-27.md

## Feedback Verdict Record

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Path-hardening must reject traversal in `--pack` selector. | Challenge upheld | Negative selector commands for `..` and `../../escape` fail non-zero with explicit invalid slug errors. | HIGH | Accepted and complete. |
| 2 | Manifest path fields must be contained under pack root with deterministic fail behavior. | Challenge upheld | Tampered manifest tests for `outputFile`, `promptFile`, and `nextSteps` all fail non-zero; helper validation enforces safe segments + containment checks. | HIGH | Accepted and complete. |
| 3 | Static file-inclusion warnings must be rechecked post-patch. | Challenge upheld | `get_errors` on prompt-router reports no errors after helper reshaping and guarded path usage. | HIGH | Accepted and complete. |
| 4 | Additional Snyk scan evidence should be present if possible. | Insufficient evidence | Snyk auth is valid, but scan failed due untrusted folder requirement and trust was not granted in this pass. | HIGH | Deferred; requires explicit trust instruction. |

### Accepted changes
- Runtime path hardening for next-actions support flow was accepted as implemented.
- Manifest path-field contract enforcement was accepted as implemented.
- Static-analysis warning clearance was accepted as complete for prompt-router.

### Rejected challenges
- None.

### Deferred points
- Snyk code scan execution remains deferred pending explicit permission to run `snyk_trust` on the project folder.

### Brief updates
- Decisions changed: none after implementation.
- Constraints updated: none.
- Do NOT rules updated: none.
- Assumptions retired or added:
  - Retired: implicit assumption that manifest file fields are safe; now enforced by runtime validation.

### Response notes
- The hardening objective is complete for the scoped next-actions file IO path, with deterministic adversarial rejection and clean diagnostics.
- Additional Snyk evidence can be added in a follow-up run once trust approval is explicitly provided.
