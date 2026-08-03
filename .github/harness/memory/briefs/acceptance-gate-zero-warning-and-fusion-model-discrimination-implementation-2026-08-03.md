---
summary: "Implementation Summary — acceptance-gate zero-warning cleanup and fusion model discrimination"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [acceptance-gate, analyzer, fusion-audit, implementation, 2026]
---
# Implementation Summary — acceptance-gate zero-warning cleanup and fusion model discrimination

resource: .github/harness/memory/briefs/acceptance-gate-zero-warning-and-fusion-model-discrimination-2026-08-03.md, scripts/harness/acceptance-gate.mjs, scripts/harness/plan-review.mjs, scripts/harness/test/acceptance-gate-test.mjs

## Implementation Summary

### Delivered

- Refactored `scripts/harness/acceptance-gate.mjs` to use the same repo-contained trust-boundary shape as `scripts/harness/plan-review.mjs`: `assertPathInsideRepo(candidatePath, label)` plus `resolveRepoInputPath(inputPath, label)`.
- Routed the default scaffold output path through the same final containment check.
- Re-ran the focused helper test and diagnostics.
- Ran one more fusion audit with `ollama/devstral:24b` as validator/architect and `ollama/qwen2.5-coder:14b` as builder.

### Proof summary

- `npm run test:harness:acceptance` => PASS after the refactor.
- `get_errors scripts/harness/acceptance-gate.mjs` => residual warnings remain at helper-boundary trust-modeling lines.
- `get_errors scripts/harness/plan-review.mjs` => the same three boundary warnings already exist there, confirming the local refactor has converged on the repo’s current best pattern rather than a helper-specific mistake.
- Alternate fusion audit result => same gate-file acceptance seam, different model behavior:
  - `qwen2.5-coder:32b` previously reached a `write` tool call payload but still failed gate-file acceptance.
  - `devstral:24b` did not call any tool and instead returned a natural-language promise to write the gate file.

### Result

- Zero-warning static analysis was not achieved by a local helper-only cleanup.
- The dedicated cleanup slice still resolved the main uncertainty: additional local rewrites are unlikely to eliminate the remaining warnings without a broader analyzer-specific strategy.
- The fusion gate failure is partly model-specific in expression, but not harness-specific in seam: both local validators failed before a usable `gate.py` was accepted.

### Things intentionally not changed

- No change to `command-validation.mjs`.
- No fusion-harness source changes.
- No hosted-provider audit, because this environment does not provide hosted-provider credentials.
