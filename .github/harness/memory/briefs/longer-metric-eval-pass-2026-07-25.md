## Architecture Brief
resource: scripts/harness/prompt-router.mjs, scripts/harness/measure-phase5c-real.mjs, scripts/harness/eval/run-eval.mjs, .github/harness/phase5/validation-results/

### Objective
- Run a longer-than-quick harness metric and eval pass, then summarize measurable deltas against recent baselines.

### Scope and boundaries
- In scope:
  - Execute the router-directed stage sequence for this task.
  - Run multiple real Phase 5c local metric measurements.
  - Run deterministic eval self-test.
  - Compare latest multi-run results to recent local and copilot baselines.
- Out of scope:
  - Changing routing policy, model maps, scoring rubric, or threshold constants.
  - Refactoring measurement/eval scripts.
  - Altering guardrails, safety boundaries, or approval flows.

### Artifacts to create
- .github/harness/memory/briefs/longer-metric-eval-pass-2026-07-25.md - Decision record for this execution and comparison run.

### Artifacts to modify
- None.

### Key decisions
- Decision: Use local provider for a longer pass because the current run environment confirms local provider health and supports repeatable, deterministic script execution without additional cloud credential dependencies.
- Decision: Define "longer pass" as three full measure-phase5c-real local executions plus eval self-test, then aggregate by mean for stability.
- Decision: Use evidence JSON files in .github/harness/phase5/validation-results as source of truth and compute deltas via deterministic PowerShell parsing.
- Decision: Keep evaluation-only workflow (no code edits), because the user requested execution + summary deltas rather than implementation changes.

### Constraints
- Preserve existing repository safety posture and do not weaken guardrails.
- Use existing shipped scripts and outputs as proof surfaces.
- Report reduced confidence where graph freshness is degraded.

### Validation plan
- Run:
  - node scripts/harness/measure-phase5c-real.mjs --provider local (x3)
  - node scripts/harness/eval/run-eval.mjs --self-test --json
- Verify all three measurement runs pass baseline gate.
- Verify eval self-test returns ok=true and all checks pass.
- Compute numeric deltas from saved JSON evidence files.

### Do NOT
- Do not adjust threshold constants or score calculation logic to improve outcomes.
- Do not claim graph-derived dependency confidence where graph freshness is degraded.
- Do not infer deltas from console output when artifact JSON exists.

### Assumptions and risks
- [UNVERIFIED] Local model behavior may drift between runs due to inference nondeterminism; mitigated by multi-run aggregation.
- [UNVERIFIED] Graph snapshot is stale against HEAD; dependency traversal confidence is reduced for impacted-node mapping.
- Risk: If long-running commands are interrupted, partial runs may bias comparisons; mitigated by using completed artifact files only.
