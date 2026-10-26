---
summary: Evaluate contrastive composition of general and domain-specific harness edits using observed behavior, with independent deterministic acceptance.
status: adopted
source: https://github.com/google-research/harness2/tree/1cfe254e8d25b15f37048c3730134686abe60335
author_project: google-research/harness2
captured: 2026-10-24
tags: [evaluation, harness-evolve, contrastive, evidence, anti-gaming]
---

# Harness2 Contrastive Composition

## Technique Summary

Harness2 proposes general and domain-specific harness variants separately, executes them on the
same task, and asks a composer to connect edit differences to observed behavioral differences.
The composition is executed too. Proposal and composition use task evidence without ground-truth
grading; this is a search strategy, not proof that the composed harness improves correctness.

## Evidence

- Revision-pinned [recursion.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/recursion.py)
  implements both parallel and sequential variants with invalid-proposal retry/fallback.
- [context.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/context.py)
  packages candidate diffs, trajectories, artifacts, and decisions, and asks each edit to cite
  specific trajectory evidence. It filters declared answer-key paths and trips on grader markers.
  Those filters are not a complete contamination defense.
- [ledger.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/ledger.py)
  asserts `4*k` rollout slots and `3*k` improvement-stage slots per mode. These are not total API
  calls: retries, selection, reflection, and grading require separate accounting.
- Upstream README reports benchmark gains, but this radar pass neither reproduced them nor
  established transfer to coding-stage workflows. No local quality or cost improvement is claimed.

## Repository Relevance

`scripts/harness/skill-adapter-eval.mjs` already compares baseline/adapter arms with alternating
order, repeated cases, hashes, and invalid-call reporting. Its prompt explicitly simulates tool
actions; it is not an execution-trace evaluator. `scripts/harness/harness-evolve.mjs` already owns
eval-gated proposals. The novel delta is an evidence-linked composition candidate, not another
optimizer, judge, or parallel-agent framework. Existing ablation and matched-baseline work remain
prerequisites, not new discoveries.

## Adoption Notes

- **Target files/domains:** `scripts/harness/harness-evolve.mjs`, `scripts/harness/eval/`, and
  `.github/harness/evolve/` proposal artifacts; use `scripts/harness/skill-adapter-eval.mjs` only
  for its existing diagnostic role.
- **Risks/constraints:** follow the [self-improving brief](../briefs/self-improving-harness.md).
  Freeze verifiers, security policy, and guardrails. Restrict edits to one approved target and
  keep generated proposals untrusted. Never let a composer or blind selector decide release
  acceptance. Keep task sources, held-out answers, grading artifacts, and tool-session state
  isolated; use an allowlisted evidence interface and network isolation for protected tasks.
- **Next step:** Understand -> Architect an opt-in offline pilot: one baseline, one general edit,
  one domain edit, and one composed edit, initially depth one. Require a mapping from each retained
  edit to its trace/artifact evidence and observed regression as well as benefit. Do not install
  Harness2 or import its prompt/skill pack.
- **Discriminating check:** freeze a representative development set and separate held-out tasks,
  model revision, task identities, and total time/token budgets before running. Compare composition
  with the current single-proposal approach and equal-budget independent proposals. Accept a
  follow-up only if held-out deterministic success improves without safety regressions within
  the predeclared cost ceiling; otherwise park it. Missing evaluations stay inconclusive.
- **Security scan scope:** idea-level adaptation only, not skill-file adoption. SkillSpector is
  not applicable; any future imported skill requires its own gate.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-24 | candidate | Captured the implemented propose/probe/compose mechanism and its evidence/budget boundaries. | copilot-radar |
| 2026-10-24 | adopted | Priority 2: approve a bounded eval/design follow-up, not a performance claim or default runtime feature. Local two-arm diagnostics do not test evidence-linked composition. | copilot-radar |
| 2026-10-24 | adopted | Adapted as opt-in `scripts/harness/eval/contrastive-pilot.mjs`, with three-call independent control, disjoint held-out tasks, bounded subprocesses, and report-only outcomes. Offline tests pass; model-backed quality and token/USD cost remain unmeasured. See [implementation brief](../briefs/harness2-bounded-adaptations.md). | copilot-implement |
