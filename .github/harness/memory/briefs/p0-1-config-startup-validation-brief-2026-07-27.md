# P0-1 Config Startup Validation Brief - 2026-07-27
resource: scripts/harness/config.mjs, harness.config.schema.json, harness.config.json, package.json, scripts/harness/harness-catalog.mjs, scripts/harness/run-loop.mjs, scripts/harness/validate-doc-contracts.mjs

## Architecture Brief

### Objective
- Add deterministic startup validation for harness config loading with actionable diagnostics while preserving current project-agnostic behavior and existing public API usage.
- Provide a first-class proof surface (self-test command) that verifies valid, missing, and invalid config scenarios.

### Scope and boundaries
- In scope:
  - `scripts/harness/config.mjs` validation logic and diagnostics.
  - New self-test script for config validation behavior.
  - `package.json` script entry for deterministic proof.
- Out of scope:
  - Broad refactors across all config consumers.
  - Tightening schema beyond existing `harness.config.schema.json` semantics.
  - Any change to routing stages, loop semantics, or guardrail policies.

### Artifacts to create
- `scripts/harness/config-self-test.mjs` - deterministic validation proof for success/failure/missing-file behavior.

### Artifacts to modify
- `scripts/harness/config.mjs` - add schema-aware startup validation with actionable warnings/errors and stable fallback behavior.
- `package.json` - add `harness:config:self-test` script.

### Key decisions
- Decision: keep `loadConfig()` return contract backward-compatible (`{}` fallback for missing/invalid config) while adding strict diagnostics.
  - Reasoning: this avoids breaking ten direct dependents and keeps loops/scripts runnable with clear operator feedback.
- Decision: use in-repo schema (`harness.config.schema.json`) via lightweight validator logic instead of introducing new external dependencies.
  - Reasoning: smallest safe change, zero install overhead, deterministic behavior in current environment.
- Decision: expose `validateConfigObject` from config module and test via dedicated self-test runner.
  - Reasoning: explicit contract surface plus repeatable proof command for review stages.
- Decision: fail-closed only for schema parse/validator-internal errors in strict mode via env toggle; default remains warn-and-degrade.
  - Reasoning: preserves operator UX while enabling stricter CI posture later.

### Constraints
- Preserve existing exports and current token-resolution behavior.
- Keep unresolved token behavior unchanged.
- Diagnostics must include what failed and how to fix (`path`, `expected`, `actual`, and key hints).
- Validation implementation must remain dependency-free (Node built-ins only).

### Validation plan
- Tests/proofs-first sequencing:
  - First create and run `scripts/harness/config-self-test.mjs` before editing `scripts/harness/config.mjs`.
  - Capture failing-then-passing proof for invalid and missing config cases.
- Run `npm run harness:config:self-test` to verify:
  - valid config passes,
  - invalid config emits actionable diagnostics,
  - missing config returns `{}` without crash.
- Run `npm run harness:docs:check` to ensure harness docs/contracts remain intact.
- Run a smoke command that loads config transitively (`npm run harness:catalog -- json`) to verify no runtime regression.

### Acceptance criteria
- A pre-change self-test run demonstrates baseline failure for at least invalid and missing config assertions.
- A post-change self-test run demonstrates those assertions pass.
- `harness:docs:check` and catalog smoke command both pass after implementation.

### Do NOT
- Do NOT change router behavior, stage mappings, or loop protocol.
- Do NOT throw by default for ordinary schema violations in local operator flows.
- Do NOT add speculative schema requirements not present in `harness.config.schema.json`.

### Assumptions and risks
- `[UNVERIFIED]` Assumption: no downstream script depends on currently silent acceptance of schema-invalid config.
  - Risk if wrong: scripts may now surface warnings that existing operators interpret as failures.
- `[UNVERIFIED]` Assumption: lightweight validator coverage over required schema branches is sufficient for P0-1.
  - Risk if wrong: some malformed configs may still pass and require a follow-up hardening pass.

## Gate check notes
- Gate 1 (domain/module alignment): PASS - ownership belongs in `scripts/harness/config.mjs`.
- Gate 2 (generality): PASS - validation logic is reusable across all config consumers.
- Gate 3 (ownership): PASS - state/rule ownership remains centralized in config loader.
- Gate 4 (boundary integrity): PASS - consumers remain thin; no policy drift into unrelated scripts.
- Gate 4b (safety boundary): PASS - no permission/secret boundary changes; additive diagnostics only.
- Gate 5 (reuse): PASS - single validator surface avoids duplicated per-script checks.
