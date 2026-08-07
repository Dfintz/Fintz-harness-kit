---
summary: "Review depth - Sandcastle structured output slice"
type: brief
status: implemented
source: review
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, structured-output, review-depth]
artifact_family: review
immutability: mutable
---

# Review Depth Gate Ledger - Sandcastle structured output slice

resource: .github/harness/memory/briefs/sandcastle-structured-output-slice-2026-08-07.md, scripts/harness/structured-output.mjs, scripts/harness/test/structured-output-test.mjs, package.json

| Artifact or path | Gate | Verdict | Evidence |
| --- | --- | --- | --- |
| `scripts/harness/structured-output.mjs` | 1 Domain alignment | PASS | Structured artifact parsing is a core harness utility, not a Sandcastle runtime concern. |
| `scripts/harness/structured-output.mjs` | 2 Generality | PASS | The helper supports string and JSON extraction and can serve prompt-pack, plan-review, council-review, or review-ledger callers. |
| `scripts/harness/structured-output.mjs` | 3 Ownership | PASS | Parsing and validation are owned by a standalone helper; callers keep ownership of run completion and retry behavior. |
| `scripts/harness/structured-output.mjs` | 4 Boundary integrity | PASS | The helper has no network, git, model, sandbox, or GitHub API side effects. |
| `scripts/harness/structured-output.mjs` | 4b Isolation and safety | PASS | It parses local text only and reports explicit errors without executing model-provided content. |
| `scripts/harness/test/structured-output-test.mjs` | 5 Reuse | PASS | The test covers the reusable primitive directly, and `test:harness:core` now includes it. |

## Structural findings

### Blocker

- None.

### Major

- None.

### Minor

- None.

## Brief divergence

- The implementation added the new test to `test:harness:core`, which is an additive strengthening of the Brief's validation plan rather than a divergence.