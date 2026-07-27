# Brief: Harness Consistency Review (Registry Gap, Package Version, llms.txt) — implemented

resource: .github/harness/registry.json, package.json, llms.txt, harness.config.json

**Status:** Settled  
**Date:** 2026-07-25  
**Stage:** Architect  
**Task:** review the harness

---

## Decision

Fix four specific gaps found during the Understand stage scan. All fixes are additive or
cosmetic — no behavioral regressions expected.

## Gaps and Fixes

| # | Gap | Fix | File |
| --- | --- | --- | --- |
| 1 | `prototype` skill missing from registry (19/20) | Add entry matching `.github/skills/prototype/SKILL.md` | `.github/harness/registry.json` |
| 2 | `technique-triage.json` loop missing from registry (10/12) | Add entry | `.github/harness/registry.json` |
| 3 | `package.json` version `1.0.0` (repo is at v2.0.0) | Bump to `2.0.0` | `package.json` |
| 4 | `llms.txt` has no Phase 5 / model-routing section | Add Phase 5 summary block | `llms.txt` |

## Out of Scope (accepted)

- Pilot INTEGRATION-PLAN.md dead script references — internal/aspirational docs, low priority
- Optimized-skills docs-check warnings — generated files referencing project-specific scripts

## Constraints

- Do not alter registry skills that already exist — append only
- Do not change any harness behavior or script logic
- `package.json` version must match the v2.0.0 git tag
- `llms.txt` additions must be accurate and concise (LLM-readable format)

## Alternatives Considered

- Ignoring registry gap: rejected — prototype skill is live, missing entry breaks catalog/routing
- Deleting pilot INTEGRATION-PLAN.md: out of scope for this pass

## Review Gate

Valid reason to challenge: if `prototype` is intentionally excluded from the registry for a
routing reason not captured in this review.
