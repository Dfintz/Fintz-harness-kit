---
summary: "Review Breadth Findings - Harness Surface Optimization - 2026-07-26"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [harness, surface, optimization, review]
---
# Review Breadth Findings - Harness Surface Optimization - 2026-07-26
resource: .github/harness/memory/briefs/harness-surface-optimization-review-brief-2026-07-26.md, .github/harness/memory/briefs/harness-surface-optimization-report-2026-07-26.md

## Findings ledger

### Blocker

- Artifact: `scripts/harness/run-loop.mjs`
- Finding: Potential command-injection path is flagged for agent command execution surface.
- Evidence: `get_errors` reports command injection concern at agent spawn surface.
- Impact: Medium-High security risk if untrusted command strings are accepted from operator/env in unsafe contexts.
- Confidence: HIGH
- Recommended fix: move to explicit executable + args parsing with safe token policy, and document trusted-command boundary.

### Major

- Artifact: `scripts/harness/prompt-router.mjs`
- Finding: High cognitive complexity plus repeated path-risk diagnostics in next-actions and pack selection flow.
- Evidence: `get_errors` reports complexity + multiple potential file-inclusion attack diagnostics.
- Impact: Elevated maintenance cost and harder safe-evolution of routing features.
- Confidence: HIGH
- Recommended fix: decompose selection pipeline into pure helper steps and centralized path-validation helpers.

- Artifact: `scripts/harness/validate-doc-contracts.mjs`
- Finding: Validator has accumulated complexity and multiple path-risk warnings.
- Evidence: `get_errors` complexity and path diagnostics across major validator functions.
- Impact: Fragile future extension; higher chance of inconsistent checks or false positives.
- Confidence: HIGH
- Recommended fix: modularize validator passes and introduce shared safe-path + command wrappers.

### Minor

- Artifact: graph parity tooling
- Finding: Local parity self-test fails because it expects JSON from provider/genui status commands.
- Evidence: `npm run harness:graph:parity -- --local-only` output (`output is not JSON`).
- Impact: Reduces trust in parity health signal and creates noisy operational baseline.
- Confidence: HIGH
- Recommended fix: standardize JSON mode contract for graph status commands and update parity harness accordingly.

- Artifact: adoption workflow surface
- Finding: No single health-check command for adoption readiness.
- Evidence: setup requires multiple separate commands (`route`, `docs`, `graph`, reports, etc.).
- Impact: Slower onboarding and higher support burden.
- Confidence: MEDIUM-HIGH
- Recommended fix: add `harness:health` aggregator with `--fast` and `--json` options.

### Nit

- Artifact: command UX docs
- Finding: Several high-value commands are distributed across docs with little “first 5 minutes” path.
- Evidence: command inventory breadth in `package.json` and setup docs.
- Impact: discoverability friction for new operators.
- Confidence: MEDIUM
- Recommended fix: add compact triage runbook table in setup docs.

### FYI

- Artifact: run health telemetry
- Finding: Report baseline currently shows low run evidence (`incomplete=1`) and weak convergence signal.
- Evidence: `node scripts/harness/harness-report.mjs --no-html` output.
- Impact: difficult to evaluate loop efficacy trends until more run journaling is captured.
- Confidence: HIGH
- Recommended fix: encourage periodic loop run capture and add min-data warning in report output.

## Coverage note

- Covered: routing, loops, docs validator, config/registry contracts, graph parity/reporting, adoption ergonomics.
- Not covered: runtime performance profiling under heavy load or cross-repo adoption telemetry.

## Missing-context note

- Graph freshness degraded; no fresh graph rebuild was possible in this environment.
