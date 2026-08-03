## Implementation Summary

### Delivered
- Removed deprecated breaking-window aliases from `package.json`:
  - `test:mpc:dispatch`
  - `test:mpc:dispatch:command`
  - `test:mpc:dispatch:rate-limit`
  - `test:mpc:dispatch:auth`
  - `test:mpc:dispatch:template`
  - `test:mpc:dispatch:integration`
- Added command-surface policy check command:
  - `harness:commands:check` -> `scripts/harness/check-script-alias-policy.mjs`
- Added policy enforcement in validator-owned path:
  - `scripts/harness/validate-doc-contracts.mjs` now errors on exact duplicate script command bodies.
- Added CI example enforcement step:
  - `.github/workflows/harness-optional-security-gates.example.yml` runs `npm run harness:commands:check` unconditionally.
- Added release-note and migration guidance:
  - `RELEASE_NOTES_v3.1.1.md`
  - discoverability link in `README.md`.

### Contract adherence
- Followed revised brief with explicit breaking-window cutover and policy-check coverage.
- Kept canonical `test:mcp:*` commands unchanged.

### Proof summary
- `npm run harness:commands:check` -> PASS (`[script-alias-policy] OK`)
- `npm run harness:docs:check` -> PASS (`[docs-contracts] OK`)
- `node scripts/harness/validate-doc-contracts.mjs` -> PASS (direct invocation)
- `npm run test:mcp:dispatch:command` -> PASS
- `npm run test:mcp:dispatch` -> PASS (full canonical aggregate)
- `npm run test:mpc:dispatch` -> FAIL (expected by design after removal)

### CHANGES MADE
- `package.json`: removed deprecated `test:mpc:*` aliases; added `harness:commands:check`.
- `scripts/harness/check-script-alias-policy.mjs`: new deterministic duplicate-body policy checker.
- `scripts/harness/validate-doc-contracts.mjs`: integrated duplicate-body policy as an error.
- `.github/workflows/harness-optional-security-gates.example.yml`: added required command-surface policy step.
- `RELEASE_NOTES_v3.1.1.md`: breaking-window migration and rollback notes.
- `README.md`: added link to latest release notes.

### THINGS I DIDN'T TOUCH (intentionally)
- Canonical `test:mcp:*` test scripts and implementation files under `scripts/harness/test/*`.
- Harness stage routing/model policy in `harness.config.json`.

### POTENTIAL CONCERNS
- Consumers still using removed `test:mpc:*` aliases will break immediately and must migrate.

### Assumptions or deviations
- `[UNVERIFIED]` Downstream users saw enough migration notice; release notes now include full mapping and expected-failure semantics.
