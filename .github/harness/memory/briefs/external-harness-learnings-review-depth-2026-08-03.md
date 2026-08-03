---
summary: "Review Depth — external harness learning pass"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [research, external-harness, review-depth, 2026]
---
# Review Depth — external harness learning pass

resource: .github/harness/memory/briefs/external-harness-learnings-2026-08-03.md, .github/harness/memory/briefs/external-harness-learnings-implementation-2026-08-03.md, .github/harness/memory/briefs/external-harness-learnings-review-breadth-2026-08-03.md, scripts/harness/graph-provider.mjs, harness.config.json

## Gate ledger

| Artifact or path | Gates run | Status | Evidence |
| --- | --- | --- | --- |
| Research brief and adoption slices | 1, 2, 3, 4, 4b, 5 | PASS | Recommendations stay in harness-owned docs/runtime surfaces, preserve project-agnostic boundaries, and explicitly reject runtime-specific carryovers from Pi-only workflows. |
| `scripts/harness/graph-provider.mjs` env fallback | 1, 3, 4, 4b | PASS | The fix aligns runtime behavior with the existing config note instead of introducing a workstation-specific config owner or a new routing path. |
| `harness.config.json` graph block | 1, 3, 4b | PASS | Repo config returns to the intended machine-agnostic empty default while env resolution carries local specificity outside committed config. |

## Structural findings ledger

### Blocker

- None.

### Major

- None.

### Minor

- None.

## Brief divergence

- One bounded divergence occurred during execution and was resolved in-run: an initial local config edit hardcoded a workstation-specific `graph.pluginRoot` to clear routing preflight, but the final implementation moved the behavior to the correct runtime owner in `scripts/harness/graph-provider.mjs` and restored `harness.config.json` to its machine-agnostic default.
