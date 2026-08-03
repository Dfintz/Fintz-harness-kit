---
summary: "Harness Surface Optimization Report - 2026-07-26"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [harness, surface, optimization, report]
---
# Harness Surface Optimization Report - 2026-07-26
resource: .github/harness/HARNESS.md, .github/harness/LOOPS.md, .github/harness/registry.json, harness.config.json, scripts/harness/prompt-router.mjs, scripts/harness/validate-doc-contracts.mjs, scripts/harness/run-loop.mjs, scripts/harness/harness-report.mjs

## Executive summary

This review found high-value optimization opportunities across routing, validation, loop execution observability, and adoption ergonomics. The largest immediate gains are in deterministic configuration validation, health-check consolidation, and hardening + simplification of high-complexity runtime surfaces. Guardrail integrity should remain unchanged.

## Baseline evidence used

- `npm run harness:docs:check` => OK
- `npm run harness:loops` => 11 loops listed, mix of convergence/workflow/experiment
- `node scripts/harness/harness-report.mjs --no-html` => sparse run health (`incomplete=1`, low convergence evidence)
- `npm run harness:graph:parity -- --local-only` => failed local parity checks (non-JSON output expectations)
- `get_errors` on core scripts => recurring high-volume diagnostics in:
  - `scripts/harness/prompt-router.mjs`
  - `scripts/harness/validate-doc-contracts.mjs`
  - `scripts/harness/run-loop.mjs`

## Top optimization backlog (prioritized)

| Priority | Opportunity | Surface(s) | Benefit | Effort | Risk | Type |
|---|---|---|---|---|---|---|
| P0 | Startup config schema validation + actionable errors | `scripts/harness/config.mjs`, `harness.config.json` | Faster adoption recovery, fewer mid-loop failures | S | Low | Code |
| P0 | Unified `harness:health` command (`--fast`/`--json`) | `scripts/harness/*`, `package.json` | Single operator preflight for readiness | M | Low | Code |
| P0 | Router complexity and selector-path hardening pass | `scripts/harness/prompt-router.mjs` | Lower maintenance cost and safer path handling | M | Low-Med | Code |
| P1 | Docs-contracts validator modularization + path safety wrappers | `scripts/harness/validate-doc-contracts.mjs` | Better maintainability, fewer false positives, easier extension | M | Low | Code |
| P1 | Loop-runner security/agent-invocation hardening profile | `scripts/harness/run-loop.mjs` | Reduced command injection and path-risk profile | M | Med | Code |
| P1 | Loop observability: per-check latency and bottleneck reporting | `scripts/harness/run-loop.mjs`, report surfaces | Better timeout tuning and loop ROI | M | Low | Code |
| P1 | Graph parity self-test contract alignment (JSON mode standardization) | `scripts/harness/graph-parity-self-test.mjs`, graph commands | Reliable parity CI signals | S-M | Low | Code |
| P2 | Memory integrity checker (orphan/superseded/cycle checks) | `scripts/harness/memory-curate.mjs`, memory docs | Cleaner long-lived memory store | S-M | Low | Code |
| P2 | Cross-doc reference integrity extension | `scripts/harness/validate-doc-contracts.mjs` | Earlier catch of stale skill/instruction links | S-M | Low | Code |
| P2 | Adoption docs optimization runbook (no-code package) | `SETUP.md`, `HARNESS.md`, `LOOPS.md` | Faster onboarding and fewer support pings | S | Low | Docs |

## Key findings by surface

### 1) Routing (`prompt-router`)

- Strength: robust stage/model routing and prompt-pack generation.
- Gap: rising cognitive complexity and repeated path-related diagnostics.
- Optimization: split next-actions selection into isolated helpers and a validated selector contract module; normalize fail paths and reduce nested control flow.

### 2) Docs contracts validator

- Strength: catches broad consistency issues and currently reports green baseline.
- Gap: concentrated complexity and path-risk diagnostics; growing scope increases maintenance cost.
- Optimization: break into composable validators (`workflow`, `registry`, `skills`, `citations`, `changed-surface`) with shared safe-path helper.

### 3) Loop runtime

- Strength: bounded loops and explicit terminal states.
- Gap: diagnostics indicate command/path-risk exposures and limited runtime perf instrumentation.
- Optimization: explicit trusted-command policy for agent execution and lightweight per-check timing summary in journals/reports.

### 4) Ops/telemetry surfaces

- Strength: report + graph tooling exists and is scriptable.
- Gap: `harness-report` shows sparse usable run state; graph parity local checks currently fail due to output-contract mismatch.
- Optimization: standardize machine-readable mode for graph commands and integrate into health-check.

### 5) Adoption UX

- Strength: rich docs and templates.
- Gap: first-run requires many manual checks and interpretation.
- Optimization: one guided preflight (`harness:health`) and docs section mapping red/amber/green outcomes to fixes.

## Suggested execution waves

### Wave 1 (quick wins, low risk)

1. Implement config schema validation + actionable error hints.
2. Implement `harness:health --fast --json` (compose existing checks, no behavior change).
3. Add graph command `--json` compatibility contract and parity self-test alignment.

### Wave 2 (maintainability + hardening)

1. Refactor `prompt-router` next-actions selection internals into smaller pure helpers.
2. Refactor docs validator into modules with shared safe path functions.
3. Add loop per-check latency summaries and simple bottleneck annotation.

### Wave 3 (quality-of-life and memory hygiene)

1. Add memory integrity checks and fix suggestions.
2. Extend cross-doc link integrity checks.
3. Publish adoption optimization runbook updates.

## Guardrail constraints

- Do not relax loop bounds, safety guardrails, or approval gates.
- Do not weaken check semantics for convenience.
- Keep optimization work additive and backward compatible unless explicitly approved.

## Confidence and caveats

- Confidence: Medium-High for code-surface recommendations (file + diagnostics-backed).
- Caveat: graph freshness degraded; cross-component dependency claims were constrained to direct file evidence.
