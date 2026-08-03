---
summary: "Review Breadth Findings — acceptance-gate zero-warning cleanup and fusion model discrimination"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [acceptance-gate, analyzer, fusion-audit, review-breadth, 2026]
---
# Review Breadth Findings — acceptance-gate zero-warning cleanup and fusion model discrimination

resource: .github/harness/memory/briefs/acceptance-gate-zero-warning-and-fusion-model-discrimination-implementation-2026-08-03.md, scripts/harness/acceptance-gate.mjs, scripts/harness/plan-review.mjs

## Findings ledger

### Blocker

- None.

### Major

- Artifact: `scripts/harness/acceptance-gate.mjs`
- Finding: the dedicated cleanup slice did not achieve zero-warning static analysis; the helper still carries the same trust-boundary warning class as `scripts/harness/plan-review.mjs`.
- Evidence: `get_errors` still reports warnings on `resolve`, repo-input path normalization, and trusted read boundaries after the refactor.
- Impact: if zero-warning analyzer output is a release requirement, this slice is insufficient on its own and needs a broader analyzer-specific solution.
- Confidence: HIGH
- Recommended fix: open a separate analyzer-strategy slice that establishes an accepted repo-wide pattern for repo-contained trusted file reads, instead of continuing local helper churn.

### Minor

- Artifact: fusion local-model audit
- Finding: the alternate model run did not test hosted-provider behavior.
- Evidence: the run used `ollama/devstral:24b` because hosted-provider credentials were not available.
- Impact: model-specific conclusions remain limited to local validators.
- Confidence: HIGH
- Recommended fix: if hosted-provider behavior matters, run the same audit later with the external repo’s intended provider roster.

### Nit

- None.

### FYI

- Artifact: fusion local-model audit
- Finding: validator behavior differs across local models even when the terminal harness failure seam is the same.
- Evidence: `qwen2.5-coder:32b` emitted a `write` tool payload in the earlier run, while `devstral:24b` emitted only natural-language intent with `toolCalls: 0` in this run.
- Impact: model/tool compliance is part of the observed failure, not just the harness contract.
- Confidence: HIGH
- Recommended fix: none in this slice; keep as evidence for future fusion adoption decisions.

## Coverage note

- Covered: local helper refactor, focused regression test, direct analyzer output for `acceptance-gate.mjs`, comparison against `plan-review.mjs`, and one alternate local-model fusion run.
- Not covered: hosted-provider fusion behavior or a repo-wide analyzer suppression/design strategy.

## Missing-context note

- Hosted-provider credentials were unavailable, so the model-discrimination result applies only to local Ollama validators.
