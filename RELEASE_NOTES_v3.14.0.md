# Release Notes v3.14.0

Date: 2026-10-26

## Summary

v3.14.0 adds fail-closed interrupted-repair recovery and evidence-bound local maintenance
approvals. Neither feature adds a scheduler, external runtime, remote authentication, or
automatic replay of uncertain effects.

## Changes

- Persist convergence repair start and successful completion using atomic, flushed journal
  replacement. Reject uncertain or legacy ambiguous failed repairs before resume can take
  over a lease, change the journal, run checks, or invoke another agent.
- Preserve partial edits and external effects for operator reconciliation. Nonzero repair
  exits block execution rather than silently accepting a partial repair as success.
- Bind maintenance requests to canonical project root, run, operation, target scope, reviewed
  evidence hashes, pre/post references, and expiry. Reject unsupported descriptor fields.
- Recheck identity and evidence at decision and consumption. Duplicate decision delivery is
  idempotent; concurrent consumers can obtain at most one claim.
- Add local request, evaluate, and consume commands to the existing stage-state CLI. These
  commands return records; they do not execute maintenance operations or deployments.
- Extend the existing subprocess and approval tests, update operator contracts, and retain
  the source-linked Disler analysis and adoption decisions. No dependencies are changed.

## Validation Evidence

- The core harness suite passed on the final implementation with exit code 0.
- Focused recovery and approval regressions passed, including a real runner kill after file
  mutation, completed-repair resume, evidence drift, expiry, revocation, concurrent claims,
  corrupt history, retained locks, and the local CLI workflow.
- The fixed-seed stage-state model passed 100 sequences, and both experiment-identity tests
  passed. Documentation-contract checks passed.
- Implementation proof and self-review dispositions are recorded in the
  [Architecture Brief](.github/harness/memory/briefs/durable-recovery-and-action-approval.md).

## Compatibility And Known Limits

- Uncertain and legacy ambiguous failed convergence journals cannot resume. Reconcile effects
  and inspect preserved edits before starting a fresh run. No automatic migration or rollback
  over user changes is provided.
- Legacy unbound approvals cannot authorize maintenance. Existing generic remote approval
  writers cannot approve bound requests; use the local CLI/API.
- A consumed receipt means claimed, not completed. External effects still require downstream
  idempotency and reconciliation. Callers must hold resource locks and execute the reviewed
  immutable artifact; post-claim file races are not solved.
- Local operators and storage are trusted. Identity hashes detect drift, not authentication
  or malicious rewriting. Crash-retained approval locks require operator reconciliation;
  they are not automatically reaped.
- Snyk found zero issues in stage-state and both changed tests, but the final runner scan
  retains six low-severity path-traversal findings, including atomic journal sinks.
- Sonar retains five baseline findings in unchanged code. Independent cross-model security
  review is pending; this release does not claim clean security clearance.
- The local graph is stale; impact analysis used the documented source-based fallback.
