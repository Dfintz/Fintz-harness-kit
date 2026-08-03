---
summary: "Feedback Verdict Record — external harness learning pass"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [research, external-harness, feedback, 2026]
---
# Feedback Verdict Record — external harness learning pass

resource: .github/harness/memory/briefs/external-harness-learnings-2026-08-03.md, .github/harness/memory/briefs/external-harness-learnings-implementation-2026-08-03.md, .github/harness/memory/briefs/external-harness-learnings-review-breadth-2026-08-03.md, .github/harness/memory/briefs/external-harness-learnings-review-depth-2026-08-03.md

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | The brief prioritized unified run bundles ahead of gate-first acceptance and left key safety constraints implicit. | Challenge upheld | Architect-challenge review, revised Architecture Brief, depth review divergence note | HIGH | Reordered priorities to gate-first acceptance -> run bundle -> comparative review; added explicit do-not rules and risk mitigations. |
| 2 | A workstation-specific `graph.pluginRoot` should not remain in committed config. | Challenge upheld and resolved | Repo standards in `.github/copilot-instructions.md`, depth review gate ledger, final diff in `scripts/harness/graph-provider.mjs` and `harness.config.json` | HIGH | Moved the local specificity to runtime env resolution via `UNDERSTAND_PLUGIN_ROOT` fallback and restored machine-agnostic config defaults. |

## Accepted changes

- Gate-first acceptance is the first recommended adoption slice from the external comparison.
- Unified feature-run bundles remain recommended, but only as explicit greenfield infrastructure shaped by real downstream needs.
- Comparative multi-model review should be recorded as machine-readable consensus/divergence artifacts rather than Pi-specific UI.
- Graph readiness now honors either `graph.pluginRoot` or `UNDERSTAND_PLUGIN_ROOT`, matching the documented operator model.

## Rejected challenges

- None.

## Deferred points

- Deeper source-level validation of the two external repositories remains deferred; this run intentionally used public README evidence only.
- Whether Slice A, B, or C should be implemented next remains a product-priority decision rather than a resolved implementation commitment.

## Brief updates

- Decisions changed: follow-up slice priority reordered to gate-first acceptance -> unified run bundle -> comparative review artifact.
- Constraints updated: no direct SSSF workflow copying, no fusion role-memory persistence, no mandatory typed envelope adoption, no silent gate weakening, no assumed manifest atomicity.
- Do NOT rules updated: same as above, now explicit in the Architecture Brief.
- Assumptions retired or added: retired the earlier implicit notion that a hidden run-bundle behavior might already exist; retained README-grounded external evidence and gate-safety feasibility as `[UNVERIFIED]` assumptions.

## Response notes

- The strongest actionable learning from these repos is not their UI or their runtime stack; it is their insistence on explicit acceptance and durable artifacts.
- This repo already shares much of SSSF's and fusion-harness's control-plane philosophy, so the remaining work is selective packaging improvement, not a rewrite.
- The incidental bootstrap bug exposed during this run has been corrected at the owning runtime boundary rather than papered over in committed config.
