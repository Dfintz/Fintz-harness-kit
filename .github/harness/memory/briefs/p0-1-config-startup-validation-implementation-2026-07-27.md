---
summary: "P0-1 Config Startup Validation Implementation - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [config, startup]
---
# P0-1 Config Startup Validation Implementation - 2026-07-27
resource: .github/harness/memory/briefs/p0-1-config-startup-validation-brief-2026-07-27.md, scripts/harness/config.mjs, scripts/harness/config-self-test.mjs, package.json

## Implementation Summary

### Delivered
- Added schema-aware startup validation to `scripts/harness/config.mjs` with:
  - actionable diagnostics for missing config path,
  - actionable diagnostics for schema-invalid config with per-path issue lines,
  - exported `validateConfigObject` contract for reusable validation,
  - optional strict-mode toggle via `HARNESS_CONFIG_STRICT` for fail-fast behavior.
- Added deterministic proof runner `scripts/harness/config-self-test.mjs`.
- Added proof command `harness:config:self-test` to `package.json`.

### Contract adherence
- Architecture Brief followed.
- Ownership stayed centralized in config loader.
- No router/loop protocol/guardrail semantics changed.

### Proof summary
- Pre-change tests/proofs-first baseline:
  - Ran `node scripts/harness/config-self-test.mjs` before config loader edits.
  - Observed failure on required assertions:
    - schema-invalid config should degrade to `{}`,
    - schema-invalid config should emit schema validation diagnostics,
    - missing config should emit actionable not-found diagnostics.
- Post-change validation:
  - `npm run harness:config:self-test` => PASS.
  - `npm run harness:docs:check` => OK.
  - `npm run harness:catalog -- json` smoke run succeeded.

### Change summary
CHANGES MADE:
- scripts/harness/config.mjs: added startup config validation, issue formatting, and strict-mode behavior while preserving fallback compatibility.
- scripts/harness/config-self-test.mjs: added deterministic scenario tests for valid, schema-invalid, and missing config handling.
- package.json: added `harness:config:self-test` npm script.

THINGS I DIDN'T TOUCH (intentionally):
- scripts/harness/prompt-router.mjs: out of scope for P0-1 config validation.
- scripts/harness/run-loop.mjs: no loop behavior changes were needed for config startup validation.
- harness.config.schema.json: schema shape left unchanged; this pass validates existing schema.

POTENTIAL CONCERNS:
- Validator supports current schema constructs used by this repo; if future schema adds advanced JSON Schema features, validator expansion may be needed.

### Assumptions or deviations
- [UNVERIFIED] Some scripts may now emit additional warnings in local runs where invalid config was previously silent; behavior remains non-fatal by default.
- No deviations from Brief boundaries.
