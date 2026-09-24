# Follow-up: Eval Taxonomy Reporting and Metric Integrity
resource: scripts/harness/eval/run-eval.mjs, scripts/harness/harness-report.mjs, scripts/harness/otel-export.mjs, scripts/harness/run-experiment.mjs, .github/harness/memory/radar/eval-capability-regression-taxonomy.md
Status: active

## Owner

- Harness Evaluation Owner.

## Triggers

- P1: before the next `harness-evolve` run with a real agent, replace untrusted score extraction and suppress metrics from rejected/nonzero eval runs.
- P2: before `evalKind` influences release policy/separate optimization, or consumers require dashboard/telemetry visibility by kind.

## Remaining Work

- P1: replace brittle first-regex metric extraction in `run-experiment.mjs` with a structured trusted journal/result boundary; do not accept agent stdout or the agent-writable usage metrics file as authoritative score evidence.
- P1: require a rejected eval verdict or nonzero eval exit to yield no optimization metric, even when stdout contains a score-shaped value.
- P2: surface `byEvalKind` in `harness-report` and OTel attributes without changing existing overall fields.
- P2: revisit whether `metric-improve` remains a capability task using observed pass-rate evidence.

## Guardrails

- Required target state: dangerous-diff and deterministic verifier failures are absolute for evolve metric acceptance; current stdout-based extraction does not yet prove this boundary.
- Capability gains must not silently offset a future regression release gate.
- Route through Understand and Architect before changing optimization or release semantics.
