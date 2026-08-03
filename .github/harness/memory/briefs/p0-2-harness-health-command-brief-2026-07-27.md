---
summary: "P0-2 Unified Harness Health Command Brief - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [harness, health]
---
# P0-2 Unified Harness Health Command Brief - 2026-07-27
resource: package.json, scripts/harness/config-self-test.mjs, scripts/harness/graph.mjs, scripts/harness/validate-doc-contracts.mjs, .github/harness/memory/briefs/p0-1-config-startup-validation-feedback-2026-07-27.md

## Architecture Brief

### Objective
- Implement a single health-check command that provides operator-friendly readiness output and machine-readable JSON output.
- Support `--fast` for minimal checks and default mode for broader readiness signals.

### Scope and boundaries
- In scope:
  - New CLI script to aggregate existing checks.
  - New npm script wiring in `package.json`.
  - Usage notes in `SETUP.md` for operator discovery.
- Out of scope:
  - Changing existing check semantics (docs/config/graph commands remain source-of-truth).
  - Modifying graph provider internals, router behavior, or loop protocol.

### Artifacts to create
- `scripts/harness/health.mjs` - unified health command with `--fast` and `--json` flags.

### Artifacts to modify
- `package.json` - add `harness:health` script.
- `SETUP.md` - document health command usage and interpretation.

### Key decisions
- Decision: reuse subprocess invocation of existing commands rather than reimplementing their internals.
  - Reasoning: keeps ownership boundaries clean and reduces drift risk.
- Decision: `--fast` runs low-cost checks only (`docs`, `config-self-test`) and omits graph status probing.
  - Reasoning: deterministic quick preflight for local and CI loops.
- Decision: default mode runs `docs`, `config-self-test`, and graph status probe.
  - Reasoning: aligns with accepted backlog intent to consolidate core readiness checks.
- Decision: graph stale/degraded is warning-level in health summary by default, not hard failure.
  - Reasoning: current environment may intentionally run without full graph refresh capability.

### Constraints
- No new external dependencies.
- Preserve portability on Windows/macOS/Linux (Node child process only).
- Machine-readable JSON output must include per-check status and overall exit reason.
- Exit code must be non-zero only when required checks fail.

### Validation plan
- Run `npm run harness:health -- --fast` and `npm run harness:health -- --fast --json`.
- Run `npm run harness:health` and `npm run harness:health -- --json`.
- Confirm `npm run harness:docs:check` and `npm run harness:config:self-test` still pass independently.

### Command contract table

| Mode | Subprocess | Classification | Pass/fail mapping |
|---|---|---|---|
| `--fast` | `npm run harness:docs:check` | required | exit code `0` => pass, non-zero => fail |
| `--fast` | `npm run harness:config:self-test` | required | exit code `0` => pass, non-zero => fail |
| default | `npm run harness:docs:check` | required | exit code `0` => pass, non-zero => fail |
| default | `npm run harness:config:self-test` | required | exit code `0` => pass, non-zero => fail |
| default | `npm run harness:graph status` | warning | always recorded; stale/degraded/non-zero is warning, not hard failure |

Overall exit rule:
- Exit non-zero only when one or more required checks fail.
- Warning checks never flip overall status to failing in this P0-2 pass.

### Do NOT
- Do NOT duplicate existing validation logic from docs/config/graph scripts.
- Do NOT make graph refresh readiness a blocking failure in default mode.
- Do NOT alter routing or stage orchestration behavior.

### Assumptions and risks
- [UNVERIFIED] Assumption: operators prefer warning-level graph freshness in aggregated health output.
  - Risk if wrong: CI users may want strict graph enforcement, requiring a follow-up strict flag.
- [UNVERIFIED] Assumption: subprocess output volume remains manageable in JSON mode.
  - Risk if wrong: large output could reduce readability and require truncation strategy.
