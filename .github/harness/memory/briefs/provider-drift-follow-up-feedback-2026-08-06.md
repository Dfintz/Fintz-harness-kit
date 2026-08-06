---
summary: "Feedback Verdict - provider drift follow-up"
type: feedback
status: active
source: review
created: 2026-08-06
updated: 2026-08-06
tags: [provider-drift, skills, sidecars, review, verdict]
---
## Feedback Verdict Record
resource: .github/harness/memory/briefs/provider-drift-follow-up-2026-08-06.md, scripts/harness/provider-drift-report.mjs, scripts/harness/test/adoption-slices-test.mjs, docs/harness/COMMAND_INDEX.md

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Explicit installed roots must replace defaults | Challenge upheld | CLI fixture uses only the explicit temporary root and exits cleanly | HIGH | Closed |
| 2 | Repeated roots must deduplicate | Challenge upheld | Helper report asserts one normalized installed root | HIGH | Closed |
| 3 | Compared paths must be exact skill/sidecar shapes | Challenge upheld | Nested arbitrary `SKILL.md` fixture is ignored | HIGH | Closed |
| 4 | Missing/extra/content drift needs explicit proof | Challenge upheld | Fixture assertions cover all three drift codes and missing roots | HIGH | Closed |
| 5 | Generic file drift must remain separate from semantic sidecar validation | Current decision holds | Drift report does byte hashing only; existing validators retain YAML/schema policy ownership | HIGH | Closed |
| 6 | Report must remain non-destructive | Current decision holds | No writes or remediation; exit semantics remain 0/1/2 | HIGH | Closed |

### Accepted changes
- Corrected provider-root CLI semantics and deterministic path filtering.
- Added complete temporary-tree CLI and helper coverage with cleanup.
- Documented file-level drift scope and default/explicit root behavior.

### Rejected challenges
- No need to merge generic drift into sidecar semantic validation.
- No need to add installers, copying, remediation, or provider-state mutation.

### Deferred points
- Provider-specific artifact types beyond `SKILL.md` and `agents/openai.yaml`.
- Live install/update integration and remediation policy.

### Brief updates
- Architect challenge `REVISE` resolved.
- Breadth cleanup and drift-category findings resolved.
- Depth gates all passed; no structural divergence remains.

### Response notes
- The provider drift checker first slice is complete as a deterministic, report-only comparison surface.
