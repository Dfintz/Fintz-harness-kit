---
artifact_family: review
immutability: mutable
---

# Review Depth Findings: Model Routing Validator Refresh

## Gate Ledger

| Artifact / path | Gates run | Status | Evidence |
| --- | --- | --- | --- |
| `scripts/harness/phase5/validate-skills.mjs` | Gates 1, 2, 3, 4, 5 | PASS | Validator owns synthetic output, now reads current mappings from `harness.config.json`, and keeps the existing dashboard/result shape. |
| `scripts/harness/test/model-routing-validator-refresh-test.mjs` | Gates 1, 3, 4, 5 | PASS | Regression test checks the exact stale-output failure mode: Sol deep-reasoning, Terra balanced, Luna cheap-fast. |
| `scripts/harness/harness-help.mjs` | Gates 1, 3, 4 | PASS | Adjacent stage help text now matches prompt-router route output for Architect/Feedback. |
| `harness.config.json` tier summary | Gates 1, 3, 4 | PASS | Authoritative config no longer has a stale Luna architect example. |

## Structural Findings Ledger

### Blocker

None.

### Major

None.

### Minor

None.

## Brief Conformance

- Config remains the source of truth for skill model assignments.
- Prompt-router behavior and stage sequencing were not changed.
- Validator fail-closes missing or malformed mapping data.
- Dashboard denominator and shifted rows are derived from config-backed skill data.

## Depth Verdict

APPROVED. The implementation fixes the stale synthetic dashboard at the owning surface without widening runtime routing behavior.