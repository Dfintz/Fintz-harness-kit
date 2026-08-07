---
artifact_family: review
immutability: mutable
---

# Feedback Verdict Record: Agent Model Specialization Guidance

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Advisory `modelPolicy.domainSpecialists` may not satisfy a request for specialized skills or best models. | Current decision holds. The implemented contract is explicitly advisory model-tier guidance, not executable domain dispatch or new skill creation. | Revised Brief, Architect Challenge approval, `harness.config.json`, router smoke test preserving stage model assignments. | HIGH | No further change. Future executable domain dispatch should be a separate `domainModelMapping` task with router tests. |
| 2 | `llms.txt` should not be edited manually because it is generated. | Challenge upheld and resolved. Catalog notes now flow from `scripts/harness/harness-catalog.mjs`, then `npm run harness:catalog:sync` regenerates outputs. | `scripts/harness/harness-catalog.mjs`, regenerated `llms.txt`, `.github/harness/catalog/harness-profile.json`. | HIGH | No further change. |
| 3 | Database and infrastructure recommendations could weaken safety if routed directly to coding models. | Current decision holds. Entries require high-reasoning review/validation pairings and preserve approval boundaries. | `harness.config.json` `database` / `infrastructure` entries, `.github/harness/HARNESS.md`, Review Depth gate ledger. | HIGH | No further change. |

## Accepted Changes

- Clarified advisory-only scope in the Brief and implementation.
- Moved catalog output through the generator instead of hand-authored `llms.txt` edits.

## Rejected Challenges

- Executable prompt-router domain dispatch is not needed for this task. The user asked for model-usage review and specialist guidance; deterministic dispatch would be a larger behavior change requiring new tests and a separate contract.

## Deferred Points

- Future `domainModelMapping` execution path, if users want automatic frontend/UI/UX/database/infrastructure/backend model selection.
- Dedicated domain skill directories, if a future domain needs materially different instructions, tools, approval policy, or output ownership.

## Brief Updates

- Decisions changed: none after implementation.
- Constraints updated: none after implementation.
- Do NOT rules updated: none after implementation.
- Assumptions retired or added: none after implementation.

## Response Notes

- The harness now records best-fit domain model guidance for frontend, UI/UX, database, infrastructure, and backend work while keeping stage routing deterministic and unchanged.
- The new guidance is surfaced in config, docs, and generated catalog artifacts, but it does not create implicit specialist invocation or new tool permissions.