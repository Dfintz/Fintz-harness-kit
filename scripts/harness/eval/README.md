# Harness Eval Tasks

Each task lives under `scripts/harness/eval/tasks/<id>/task.json` with a deterministic verifier,
unsolved workdir, and solved self-test overlay.

`kind` names the task family/verifier shape. `evalKind` separately records why the task exists.

## Eval Kind

Set `evalKind` to one of:

- `regression` - protects behavior expected to remain reliable
- `capability` - probes an improvement frontier or current limit

Omitting `evalKind` defaults conservatively to `regression`. Explicit `null`, empty, non-string, or
unknown values fail task loading with the task id. Classification records eval intent, not verifier
shape.

The runner preserves the overall score across all tasks and adds `aggregate.byEvalKind` for present
kinds only. Capability scores therefore still influence the overall optimization metric; no release
or optimization policy is isolated by kind yet. Self-test `evalKinds` counts all known kinds,
including zero counts, while score summaries omit kinds absent from a run.

Dangerous-diff and deterministic verifier failures apply regardless of kind. Do not use a capability
gain to waive a security finding or a future regression release gate.
