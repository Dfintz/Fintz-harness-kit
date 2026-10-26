---
summary: Convergence journals now record repair start/completion and reject uncertain resume without replaying effects or undoing edits.
status: adopted
source: https://github.com/disler/pi-durable-news-agent/tree/273b79bb8d3d8907cae9fbd6abd3da163ee2a343
author_project: disler / pi-durable-news-agent and durable-pi
captured: 2026-10-26
tags: [durability, recovery, idempotency, convergence, testing]
---

# Interruption-Aware Convergence Recovery

## Technique Summary

Checkpoint deterministic work and distinguish replay-safe operations from operations with
uncertain effects. On restart, report uncertain effects as interrupted instead of silently
repeating them. Durable request admission is not exactly-once execution of an external effect.

## Evidence

- News agent revision `273b79bb8d3d8907cae9fbd6abd3da163ee2a343`:
  [recovery test](https://github.com/disler/pi-durable-news-agent/blob/273b79bb8d3d8907cae9fbd6abd3da163ee2a343/apps/dna-server-api/tests/recovery.test.ts)
  kills the fixture process during the relevance gate, restarts against the same database,
  and asserts that previously completed judgments are not repeated and four news cards are unique.
  This is fixture coverage, not proof that a provider cannot charge for an unrecorded response.
- Durable Pi revision `37165c619573dbaf425463038bbffecfe576beec`:
  [recovery boundaries](https://github.com/disler/durable-pi/blob/37165c619573dbaf425463038bbffecfe576beec/README.md#where-it-can-still-fail)
  explicitly separate request deduplication from external-effect idempotency.
- Upstream test source was inspected, not executed. No external runtime was installed.

## Repository Relevance

The initial [run-loop.mjs](../../../../scripts/harness/run-loop.mjs) assessment found check
results journaled before `invokeAgent`, without repair start/completion. A subsequent real
subprocess regression reproduced incorrect convergence after a partial edit and runner crash.
The adopted implementation now persists repair phases and rejects uncertain resume before
lease takeover or checks. See the [implementation proof](../briefs/durable-recovery-and-action-approval.md#implementation-and-proof).

Do not duplicate [experiment resume identity](google-harness2-experiment-resume-identity.md):
that shipped slice already rejects in-flight experiment work and configuration/checkpoint drift.
The [continuity brief](../briefs/prime-agent-continuity-contract-2026-08-10.md) remains metadata-only.

## Adoption Notes

- **Target files/domains:** [run-loop.mjs](../../../../scripts/harness/run-loop.mjs), existing
  loop recovery tests, and [LOOPS.md](../../LOOPS.md).
- **Risks/constraints:** arbitrary agent commands can have irreversible effects. Preserve
  lease/CAS checks, run identity, iteration budgets, existing terminal states, and dirty user
  changes. No automatic rollback or automatic replay of an uncertain command. A journal write
  is not a transaction with a remote service, and an owner lease is not effect idempotency.
- **Next step:** Understand -> Architect a convergence-only recovery audit. First extend the
  nearest existing subprocess fixture; add an in-flight phase contract only if the audit shows
  current behavior cannot distinguish an interrupted repair. Do not introduce SQLite or Pi.
- **Discriminating check:** use a fake agent that records a temporary external-effect marker,
  then terminates before its caller records completion. Resume against the same journal after
  legitimate lease expiry. Require no silent duplicate effect, no false convergence, preserved
  file edits, and an explicit interrupted/blocked outcome where safety cannot be established.
  Also test interruption before the marker and after durable completion. If existing behavior
  already satisfies these checks, close the gap without a second recovery mechanism.
- **Security scan scope:** research Markdown only; no code, dependency, or external skill import.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-26 | candidate | Captured revision-pinned crash-test evidence and compared the convergence checkpoint with existing experiment identity. | GitHub Copilot |
| 2026-10-26 | adopted | Priority 1: pursue the bounded recovery audit and architecture task, not runtime replacement or a claim of a reproduced replay bug. Implementation remains separately gated. | Manual technique-triage |
| 2026-10-26 | adopted | Implemented in `run-loop.mjs`: real crash-after-mutation regression was red (resume incorrectly converged), then green after atomic repair checkpoints and fail-closed resume. Completed-repair resume and nonzero exits are covered. See [implementation brief](../briefs/durable-recovery-and-action-approval.md). | GitHub Copilot |
