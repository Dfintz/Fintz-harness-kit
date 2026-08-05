---
summary: "Review Depth Gate Ledger - T8 fourth pass (manifest-only evidence sources)"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [review-depth, t8, hardening]
---
# Review Depth Gate Ledger - T8 fourth pass (manifest-only evidence sources)
resource: .github/harness/memory/briefs/t8-hybrid-fusion-fourth-pass-architecture-2026-08-05.md, scripts/harness/t8-benchmark-gap-evaluate.mjs, .github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json

## Gate ledger
| Artifact/path | Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 4b | Gate 5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| scripts/harness/t8-benchmark-gap-evaluate.mjs | PASS | PASS | PASS | PASS | PASS | PASS | Input selection moved from CLI path list to manifest-set IDs with allowlisted prefixes. |
| .github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json | PASS | PASS | PASS | PASS | PASS | PASS | Manifest centralizes source control and reduces ad hoc evaluator inputs. |
| scripts/harness/test/t8-benchmark-gap-evaluate-test.mjs | PASS | PASS | PASS | PASS | PASS | PASS | Tests now target named source sets and preserve deterministic behavior checks. |

## Structural findings
### Major
- Artifact/path: scripts/harness/t8-benchmark-gap-evaluate.mjs
- Gate/depth check failed: Gate 4b operational security assurance (tooling confidence)
- Evidence: static warning persists for dynamic file-read sink.
- Why current structure is weak: runtime policy confidence depends on procedural checks rather than provably literal sink selection.
- Recommended fix: compile a static map of allowed files and route reads through key lookups only.
- Confidence: MEDIUM

### Minor
- None.

## Brief divergence
- No divergence from fourth-pass architecture decisions.
