## Implementation Summary
resource: .github/harness/memory/briefs/wait-what-pilot-sidecar-selftest-architecture-2026-08-05.md, .github/skills/wait-what/SKILL.md, scripts/harness/test/sidecar-validator-edge-cases-test.mjs

### Delivered
- Added wait-what pilot skill as optional user-invoked guidance only.
- Added matching sidecar metadata with policy.allow_implicit_invocation set to false.
- Added sidecar validator edge-case self-test covering invalid YAML shape, missing policy key, and wrong scalar types.
- Added npm script to run the new focused test.
- Registered wait-what in registry skill inventory and listed it in HARNESS shipped skills table.

### Contract adherence
- No auto-invocation behavior introduced.
- No prompt-router stage/routing changes.
- Sidecar contract remains strict and deterministic.

### Proof summary
- npm run test:harness:sidecar:validator -> PASS
- npm run harness:skills:sidecars:check -> PASS
- npm run harness:docs:check -> PASS
- git diff --check -> PASS (only unrelated existing line-ending warnings)

### Assumptions or deviations
- [UNVERIFIED] Pilot surface discoverability is sufficient without adding it to default stage machine triggers.
