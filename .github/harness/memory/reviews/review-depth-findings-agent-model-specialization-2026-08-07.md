---
artifact_family: review
immutability: mutable
---

# Review Depth Findings: Agent Model Specialization Guidance

## Gate Ledger

| Artifact / path | Gates run | Status | Evidence |
| --- | --- | --- | --- |
| `harness.config.json` `modelPolicy.domainSpecialists` | Gates 1, 2, 3, 4, 4b, 5 | PASS | Advisory model policy belongs beside existing model policy, reuses Phase 5 tiers and fallback-chain shape, and explicitly says prompt-router does not consume it. |
| `harness.config.schema.json` `modelPolicy.domainSpecialists` shape | Gates 1, 2, 3, 4, 5 | PASS | Schema documents the new config shape without tightening unrelated adopter extensions. |
| `scripts/harness/harness-catalog.mjs` model policy export | Gates 1, 2, 3, 4, 5 | PASS | Generator owns `llms.txt` and catalog JSON, so generated notes now flow from config instead of manual edits. |
| `.github/harness/HARNESS.md` and `README.md` guidance | Gates 1, 2, 3, 4, 4b | PASS | Docs distinguish advisory specialist model choice from executable routing and preserve safety boundaries for database/infrastructure work. |
| Generated catalog outputs | Gates 1, 3, 4 | PASS | Generated artifacts reflect the updated generator/config contract; unrelated drift is visible and non-hand-authored. |

## Structural Findings Ledger

### Blocker

None.

### Major

None.

### Minor

None.

## Brief Conformance

- Artifacts modified match the revised Brief.
- No prompt-router behavior was changed.
- No new specialist skill directories or sidecar allowlist entries were introduced.
- Database and infrastructure guidance keeps high-reasoning review, validation, and approval boundaries explicit.

## Depth Verdict

APPROVED. The change is structurally aligned with the advisory-only model-specialist contract and keeps executable routing ownership unchanged.