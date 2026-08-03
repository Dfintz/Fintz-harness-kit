---
summary: "P1-1 Router Complexity Refactor + Parity Docker Hardening Implementation - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [router, complexity]
---
# P1-1 Router Complexity Refactor + Parity Docker Hardening Implementation - 2026-07-27
resource: .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-brief-2026-07-27.md, scripts/harness/prompt-router.mjs, scripts/harness/graph-parity-self-test.mjs

## Implementation Summary

### Delivered
- Hardened parity Docker executable resolution first (security follow-up):
  - `HARNESS_DOCKER_EXECUTABLE` override now requires an absolute path.
  - Relative overrides are treated as invalid and do not trigger PATH fallback.
  - Standard absolute candidate paths are still attempted when override is absent.
- Completed P1-1 complexity refactor in prompt-router next-actions flow:
  - extracted helper functions for selector labeling, manifest match logic, manifest selection, pending stage detection, action builders, and fallback actions.
  - removed nested selector ternary and reduced complexity concentration in `inferNextActions`.

### Contract adherence
- Security-first ordering was respected: parity hardening completed before router refactor.
- CLI behavior preserved for `route`, `handoff`, and `next-actions` outputs.
- No routing policy/stage semantics changed.

### Proof summary
- `npm run harness:graph:parity -- --local-only` => PASS.
- `$env:HARNESS_DOCKER_EXECUTABLE='relative/docker.exe'; npm run harness:graph:parity` => PASS with docker unavailable context (non-required mode).
- `$env:HARNESS_DOCKER_EXECUTABLE='relative/docker.exe'; npm run harness:graph:parity -- --require-docker` => expected FAIL (non-zero).
- `node scripts/harness/prompt-router.mjs next-actions --task "ship auth audit" --json` => valid output.
- `node scripts/harness/prompt-router.mjs route --task "fix auth middleware race" --json` => valid route output.

### Change summary
CHANGES MADE:
- scripts/harness/graph-parity-self-test.mjs: absolute-only docker override policy and fixed-path resolution helpers.
- scripts/harness/prompt-router.mjs: next-actions helper extraction and complexity reduction in `inferNextActions`.

THINGS I DIDN'T TOUCH (intentionally):
- prompt-router broad path-hardening warnings outside the P1-1 next-actions complexity scope.
- graph provider semantics and refresh behavior.
- package script surface.

POTENTIAL CONCERNS:
- prompt-router still has path-related static-analysis warnings in neighboring file IO functions; those are out of scope for this pass and should be handled in a dedicated hardening backlog item.

### Assumptions or deviations
- [UNVERIFIED] Existing non-standard docker install paths may require explicit absolute HARNESS_DOCKER_EXECUTABLE override.
- No deviations from brief scope.
