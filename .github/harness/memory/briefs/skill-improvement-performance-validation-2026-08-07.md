---
summary: "Architecture Brief: live skill-improvement performance validation"
type: brief
status: active
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [skills, optimization, evaluation, performance]
---
# Architecture Brief: Live Skill-Improvement Performance Validation

resource: scripts/harness/optimize-all-skills.mjs, scripts/harness/dspy-bridge.mjs, .github/harness/eval-sets/, scripts/harness/phase5/validate-skills.mjs, scripts/harness/phase5c-live-monitor.mjs, harness.config.json

## Objective

- Run the maintained live skill optimizer against every skill with an available eval set and record trustworthy coverage, outcome, and provider evidence for the current harness state.

## Scope and boundaries

- In scope:
  - Refresh and query the knowledge graph for the evaluation surfaces.
  - Validate the current skill-to-model mapping and run the optimizer's deterministic inventory.
  - Run the existing DSPy/Ollama optimizer against current skill instructions without applying generated candidates.
  - Record the resulting evidence and limitations in this Brief.
- Out of scope:
  - Editing skill instructions, model-routing configuration, or evaluation rubrics.
  - Treating synthetic Phase 5 quality, latency, cost, or success values as live performance.
  - Creating a new evaluation framework during this validation run.

## Artifacts to create

- `.github/harness/memory/briefs/skill-improvement-performance-validation-2026-08-07.md` - decision record, proof summary, and review artifacts for this run.
- `.github/harness/optimization-reports/optimization-report--2026-08-07.{md,json}` - optimizer-generated per-skill outcomes.

## Artifacts to modify

- `.github/harness/memory/briefs/skill-improvement-performance-validation-2026-08-07.md` - append implementation, review, and feedback outcomes after validation.

## Key decisions

- Gate 1 - Domain alignment: PASS. Skill performance evidence belongs to the existing optimizer and eval-set workflow.
- Gate 2 - Generality: PASS. Use the repository-wide discovery path rather than a bespoke list of skills.
- Gate 3 - Ownership: PASS. `optimize-all-skills.mjs` owns live candidate generation; `harness.config.json` owns routing mappings; the Brief owns run conclusions.
- Gate 4 - Boundary integrity: PASS. The validation consumes current skills and eval sets without changing routing or product behavior.
- Gate 4b - Isolation/safety: PASS. The run uses a local provider, writes only generated reports/candidates, and does not apply outputs to source skills.
- Gate 5 - Reuse: PASS. Reuse existing optimizer, eval sets, model-routing validator, and report formats; do not create a parallel runner.
- Decision: classify `scripts/harness/phase5/validate-skills.mjs` and `scripts/harness/phase5c-live-monitor.mjs` as synthetic configuration observability only because their metrics are computed from static profiles or randomness.
- Decision: use local Ollama `qwen2.5:latest`, confirmed reachable, for live optimizer execution.
- Decision: remove the duplicate optimizer entry point before execution so one requested run produces one report and one candidate-generation pass.
- Topology: Producer-Reviewer. The optimizer produces candidates/reports; harness checks and independent review assess whether the evidence supports a performance claim.

## Constraints

- Preserve every current source skill and `harness.config.json` mapping.
- Run the same current eval sets for all discovered skills; record missing eval sets as coverage gaps.
- Report live keyword-rubric outcomes separately from real-user task quality.
- Do not apply optimized output automatically.

## Validation plan

- `npm run harness:model-routing:validate` checks the mapping shape and synthetic cascade contract; it is not live performance evidence.
- `node scripts/harness/optimize-all-skills.mjs --model ollama --dry-run` proves skill/eval-set discovery coverage.
- `node scripts/harness/optimize-all-skills.mjs --model ollama` produces live per-skill optimizer outcomes.
- `npm run harness:docs:check` validates the persisted Brief and harness documentation contracts.

## Do NOT

- Do NOT use `phase5c-live-monitor.mjs` output as live performance evidence.
- Do NOT claim model quality, cost, or latency from `validate-skills.mjs` as measured results.
- Do NOT copy optimizer candidates over the current SKILL.md files.
- Do NOT add or modify evaluation cases during this run.

## Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[UNVERIFIED]` Eval sets represent each skill's intended behavior adequately. | Meaningfulness of optimizer scores. | A passing keyword score could fail real task quality. |
| `[UNVERIFIED]` Local `qwen2.5:latest` is suitable for DSPy optimization. | Completion and candidate quality. | The run may error or generate weak candidates. |
| `[UNVERIFIED]` Existing output files are non-source generated artifacts. | Source immutability. | A generated file might be mistaken for an applied skill change. |

## Implementation Summary

### Delivered

- Removed the duplicate `main()` call from `scripts/harness/optimize-all-skills.mjs` so one invocation runs one optimization pass.
- Refreshed the Understand graph and confirmed the active snapshot matches `HEAD`.
- Confirmed local Ollama is reachable and exposes `qwen2.5:latest`.
- Ran the optimizer inventory: 23 skills discovered, 21 with eval sets, and 2 skipped for missing eval sets (`to-questionnaire`, `wait-what`).
- Started the live optimization pass. `ai-techniques-radar` completed and wrote a separate candidate; the pass was stopped during `architect` because the sequential ten-trial workflow cannot complete all 21 skills within a bounded session.

### Proof summary

- `npm run harness:graph -- status --json` -> PASS; graph is fresh at `0239c87d3c473b3c3efd4dbe014df0feef5abc9e`.
- `node scripts/harness/optimize-all-skills.mjs --model ollama --dry-run` -> PASS; 21 covered skills and 2 explicit coverage gaps.
- `npm run harness:model-routing:validate` -> PASS for mapping and synthetic cascade contract only; its quality, latency, and cost figures are not live measurements.
- `node scripts/harness/dspy-bridge.mjs --self-test` -> FAIL, 6/7; `scripts/harness/requirements-dspy.txt` is missing.
- `npm run harness:docs:check` -> PASS.

### Self-review summary

- Source `SKILL.md` files and `harness.config.json` were not modified.
- The generated candidate is isolated at `.github/harness/optimized-skills/ai-techniques-radar--ollama--2026-08-07.md`.
- Resume command: `node scripts/harness/optimize-all-skills.mjs --model ollama`; it restarts from the first skill because the current runner has no checkpointing or per-skill selection.

## Review Breadth Findings

### Major

- `scripts/harness/dspy-bridge.mjs`: its self-test requires `scripts/harness/requirements-dspy.txt`, but that file is absent. This makes the bridge's advertised dependency contract fail before a full run can be accepted as validated. Add the requirements file or retire the stale assertion.
- `scripts/harness/optimize-all-skills.mjs`: a full 21-skill run is sequential, allows ten minutes per skill, and has no resume or per-skill selection. The requested all-skill live performance result is therefore incomplete in a bounded session. Add checkpointing and a selection/resume contract before treating this as an operational all-skill evaluator.

### Minor

- `.github/harness/eval-sets/`: `to-questionnaire` and `wait-what` have no eval set, leaving 2 of 23 discovered skills outside coverage.

## Review Depth Gate Ledger

- `scripts/harness/optimize-all-skills.mjs`: Gates 1, 3, 4, 4b, and 5 PASS after the duplicate entry point removal; candidate files remain separate from source skills. Gate 2 is BLOCKED for operational-scale runs because checkpointing/resume belongs in the shared orchestrator rather than task notes.
- `.github/harness/memory/briefs/skill-improvement-performance-validation-2026-08-07.md`: Gates 1-5 PASS. The Brief owns the distinction between live evidence, synthetic observability, and incomplete coverage.

## Feedback Verdict Record

### Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- |
| 1 | Duplicate optimizer entry point | Challenge upheld | Architect Challenge and repaired dry-run | High | Removed duplicate call. |
| 2 | Phase 5 metrics prove live skill quality | Challenge upheld | Static profiles and `Math.random()` in Phase 5 scripts | High | Keep synthetic metrics out of performance claims. |
| 3 | Full all-skill live performance validation completed | Insufficient evidence | One candidate completed; remaining run was intentionally stopped | High | Add resumable execution, then rerun all 21 covered skills. |

### Accepted changes

- Retain the single optimizer entry point.
- Treat the missing requirements contract, missing eval sets, and no-resume behavior as follow-up work.

### Deferred points

- Live quality across all skills remains unmeasured until the resumable full run completes.

### Brief updates

- Added the bounded-run result and explicit resume limitation.
- Retained the prohibition on using synthetic metrics as live evidence.
