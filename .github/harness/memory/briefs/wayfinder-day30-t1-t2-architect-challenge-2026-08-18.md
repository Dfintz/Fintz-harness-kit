## Architect Challenge
resource: .github/harness/memory/briefs/wayfinder-day30-t1-t2-implementation-2026-08-18.md

### Challenge 1: Is "stay-warn" for T1 just deferring a decision rather than making one?
- Pressure: the milestone plan's M30-1 gate demands "an explicit adopt-strict or stay-warn decision" — is picking the status quo actually satisfying that gate, or dodging it?
- Response: stay-warn is a real decision with a real, cited reason (one data point isn't enough to prove the protected-path list won't false-positive on a legitimate change) and a real re-evaluation date (Day-60). It is recorded in the radar entry's Decision Log, not left implicit. That satisfies the gate's intent: an explicit, evidenced choice, not silence.
- Verdict: accept as-is.

### Challenge 2: Is character-count really a defensible substitute for the token-count design the milestone brief originally assumed?
- Pressure: swapping the metric mid-implementation could look like quietly weakening the ticket's intent.
- Response: Understand-stage inspection is decisive here — `run-experiment.mjs` and `plan-review.mjs` invoke an arbitrary CLI agent via `spawnSync`, so no token-usage signal exists to read at all, regardless of design preference. Character count is not a downgrade of a real option; it is the only zero-dependency, agent-agnostic option available without changing the CLI-agnostic contract of `invokeAgent`/`makeCliReview`. The Brief documents this precisely so it isn't mistaken for scope-cutting.
- Verdict: accept as-is; the correction is evidence-driven, not convenience-driven.

### Challenge 3: Could a warn-only tripwire silently do nothing useful if no one reads stderr?
- Pressure: a warning nobody sees is not really observability.
- Response: the Brief requires `promptChars` to be persisted into the run-experiment journal (and the plan-review round record) on every iteration/round, not just printed to stderr — so the evidence survives after the terminal output scrolls away, and the Day-60 checkpoint review (from the milestone plan) has a durable artifact to inspect.
- Verdict: accept as-is; persistence requirement already covers this.

### VERDICT: APPROVED

No blocking concerns. Proceed to Implement with the Brief's design as written: T1 stays warn (decision recorded), T2 measures composed-prompt character length as a warn-only, persisted-evidence tripwire in both `run-experiment.mjs` and `plan-review.mjs`.
