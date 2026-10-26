---
summary: Maintenance approvals now bind action/evidence identity and grant one serialized claim; stale decisions and duplicate effects require rejection or reconciliation.
status: adopted
source: https://github.com/disler/durable-pi/tree/37165c619573dbaf425463038bbffecfe576beec
author_project: disler / durable-pi
captured: 2026-10-26
tags: [durability, approvals, governance, replay, identity]
---

# Action-Bound Durable Approval

## Technique Summary

Treat waiting for a human as persisted workflow state rather than a process-local prompt.
Prepare evidence before requesting approval, survive disconnection, and resume only the
approved action. Persistence must not turn an old approval into permission for changed work.

## Evidence

- Durable Pi revision `37165c619573dbaf425463038bbffecfe576beec` documents a
  [proactive incident demo](https://github.com/disler/durable-pi/blob/37165c619573dbaf425463038bbffecfe576beec/README.md#the-hook-a-proactive-durable-agent)
  that prepares a fix and regression evidence before waiting for deploy approval.
  Its durable-jobs example checkpoints named phases and waits before publishing.
- Restart-safe approval and deploy behavior are upstream documentation claims in this assessment;
  they were not independently executed, nor was a production approval security audit performed.
- The initial local [stage-state](../../../../scripts/harness/stage-state.mjs) audit found
  approval records without a general action digest or one-use consumption receipt. A regression
  then proved the old evaluator accepted a different operation. The adopted implementation adds
  action/evidence identity and serialized consumption to the existing log; no external executor
  or production authorization exploit is claimed. See the
  [implementation proof](../briefs/durable-recovery-and-action-approval.md#implementation-and-proof).

## Repository Relevance

The kit already persists approval decisions. The useful delta is an auditable binding between
the evidence reviewed, the proposed operation, and the operation eventually executed.
Reuse [memory-maintenance approval](hermes-memory-maintenance-approval.md); do not create a second
approval log. The [continuity brief](../briefs/prime-agent-continuity-contract-2026-08-10.md)
does not authorize a background executor.

## Adoption Notes

- **Target files/domains:** [stage-state.mjs](../../../../scripts/harness/stage-state.mjs),
  [existing approval tests](../../../../scripts/harness/test/stage-state-maintenance-approval-test.mjs),
  and one existing approval consumer selected during Understand.
- **Risks/constraints:** approval identity must cover project/run, operation, target scope,
  artifact/configuration digest, and applicable expiry or revocation policy. Authenticate the
  approver at the entry boundary; a recorded `decidedBy` string is not authentication. Duplicate
  delivery must not trigger duplicate effects. No auto-approval, remote-control expansion, or
  permission changes. External effects still need their own idempotency and reconciliation.
- **Next step:** Understand -> Architect a local approval-integrity contract, first auditing
  the selected consumer and reusing existing journal/lease ownership. Define pending, approved,
  rejected, stale, and consumed behavior without conflating approval state with run completion.
  Choose the smallest consumer-specific slice before altering shared fields.
- **Discriminating check:** in a temporary fixture, persist a pending action, restart, approve
  it, and deliver the decision twice. The unchanged action may proceed once; changed artifact
  bytes, a different run/project, rejection, or revocation must prevent execution. Simulate
  failure between effect and receipt to require reconciliation rather than blind replay.
  If a consumer already enforces this contract, document and reuse it instead of duplicating it.
- **Security scan scope:** research Markdown only; no code, dependency, or external skill import.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-26 | candidate | Compared upstream durable human waits with the kit's existing approval record owner. | GitHub Copilot |
| 2026-10-26 | adopted | Priority 2: approve a bounded action-binding audit and architecture follow-up, not an executor, deployment feature, or claim of a reproduced authorization bug. | Manual technique-triage |
| 2026-10-26 | adopted | Implemented the local stage-state guard and CLI: the operation-mismatch regression was red then green; identity/evidence drift, expiry, revocation, duplicate decisions, repeated/concurrent claims and persistence failures are covered. No general executor or remote authentication was added. See [implementation brief](../briefs/durable-recovery-and-action-approval.md). | GitHub Copilot |
