---
stage: implement
date: 2026-08-06
status: completed
brief: .github/harness/memory/briefs/state-aware-routing-explanation-2026-08-06.md
---
# Implementation Notes

## Scope
- Added concise state-aware routing factors to route rationale.
- Surfaced the same factor line in compact route and handoff outputs.
- Updated route contract test.

## Files changed
- [scripts/harness/prompt-router.mjs](scripts/harness/prompt-router.mjs)
- [scripts/harness/test/trace-contract-route-test.mjs](scripts/harness/test/trace-contract-route-test.mjs)

## Behavior checks
- Route JSON includes `rationale.stateFactors`.
- Handoff output includes `state factors:` line.
- Existing rationale and routing behavior remain unchanged.

## Validation evidence
- `node scripts/harness/prompt-router.mjs route --task "State-aware ..." --json`
- `node scripts/harness/prompt-router.mjs handoff --task "State-aware ..."`
- `node scripts/harness/test/trace-contract-route-test.mjs`

## Self-review checklist
- [x] Smallest viable change set.
- [x] No routing branch drift.
- [x] Additive contract extension only.
- [x] Focused test updated.