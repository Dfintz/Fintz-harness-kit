---
summary: "Feedback Verdict - trace-contract follow-up"
type: feedback
status: active
source: review
created: 2026-08-06
updated: 2026-08-06
tags: [trace-contract, route, prompt-pack, review, verdict]
---
## Feedback Verdict Record
resource: .github/harness/memory/briefs/trace-contract-follow-up-2026-08-06.md, scripts/harness/trace-contract.mjs, scripts/harness/test/trace-contract-prompt-pack-test.mjs, package.json

### Point-by-point verdicts
| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Route-only trace coverage was incomplete | Challenge upheld | Existing route test fabricated an in-memory stage trace and did not inspect generated prompt-pack artifacts | HIGH | Added prompt-pack integration test |
| 2 | Prompt-pack test should assert exact stage sequence and artifact handoffs | Current decision holds | `assertExactStageSequence` and `assertArtifactHandoffs` pass against generated manifest | HIGH | Closed |
| 3 | Manifest-derived prompt paths need containment checks | Challenge upheld | Breadth review identified direct reads from manifest fields | HIGH | Added separator-aware `containedPath` checks |
| 4 | Prompt-pack tests must restore run-side effects | Challenge upheld | Breadth review identified missing preflight override log restoration | HIGH | Snapshot/restore added for feature index, feature dirs, and override log |
| 5 | Test should claim canonical skill execution | Third option | Generated pack reflects registry metadata; canonical skill execution remains out of scope until generator carries it | HIGH | Brief narrowed and deferred canonical-skill coverage |
| 6 | Pure trace helper should own filesystem behavior | Current decision holds | Helper has no imports or I/O; test owns CLI/filesystem observation | HIGH | Closed |

### Accepted changes
- Add exact generated prompt-pack trace coverage alongside the existing route test.
- Preserve path containment and deterministic cleanup as explicit test contracts.
- Keep the test independent of models, network, graph runtime, and provider installers.

### Rejected challenges
- No need to alter routing, registry metadata, prompt generation, or canonical skill content for this slice.
- No need to add full prose snapshots; stable markers and structured manifest fields are sufficient.

### Deferred points
- Canonical skill execution behavior remains untested until prompt generation explicitly carries canonical skill contracts.
- Full context-sufficiency wording remains deferred; current test checks stable graph/skill markers and required input/output blocks.

### Brief updates
- Scope narrowed from generic skill execution to registry-to-prompt-pack behavior.
- Cleanup and path-safety constraints made explicit and implemented.
- No Do-NOT rules changed.
- Architect challenge verdict `REVISE` resolved; Review Breadth and Review Depth are clear.

### Response notes
- The remaining trace-contract gap is closed for the currently shipped prompt-pack contract without changing routing authority or stage behavior.
