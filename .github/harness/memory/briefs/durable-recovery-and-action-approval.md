---
summary: Adopt fail-closed interrupted convergence recovery and evidence-bound one-use maintenance approval without adding an executor.
type: brief
status: implemented
source: human
created: 2026-10-26
updated: 2026-10-26
tags: [recovery, approvals, durability, safety]
---

# Architecture Brief

## Objective and Context

Implement the two user-selected Disler radar follow-ups. The operation-mismatch regression in
`stage-state-maintenance-approval-test.mjs` failed before a local comparison repair, then passed.
The convergence runner records check results before calling its agent, without recording repair
start/completion. Existing experiment identity already rejects in-flight experiments; reuse the
fail-closed policy, not another runtime or database.

Graph status: stale by one commit/six source files; refresh unavailable because plugin configuration
is missing. Use the documented direct-source fallback. No graph preflight bypass or graph-derived
impact claim. Memory consulted: both Disler radar entries, Prime continuity, experiment identity,
and Hermes maintenance approval. No further ownership context is required for this bounded slice.

## Scope and Ownership

- Mixed runtime/tests/operator documentation. Recovery belongs in `run-loop.mjs` and its existing
  subprocess test. Live approval remains in `stage-state.mjs`; its existing append-only approval
  log is authoritative for bound request/decision/consumption history.
- Affected callers: stage-state CLI, Teams legacy decision writer, goal-progress tests and model
  tests. Legacy unbound generic approvals remain recordable but cannot satisfy maintenance guards.
  Bound approvals require explicit id/digest; a remote legacy decision cannot approve them.
- No scheduler, Pi runtime, arbitrary-command executor, external provider, deployment integration,
  authenticated remote approval service, or automatic replay/rollback is created.

## Gate Decisions

| Gate | Decision |
| --- | --- |
| Domain alignment | PASS: runner owns repairs; maintenance guard owns approval validity. |
| Generality | PASS: use existing state and journal contracts, not upstream-specific runtime APIs. |
| Ownership | PASS: one approval log; live state is a projection, not a second authorization source. |
| Boundary integrity | PASS: local guard returns a one-use claim; no effects are executed by it. |
| Isolation/safety | PASS with constraints: bind canonical project root/run, evidence bytes, scope, expiry; serialize claims; block uncertainty. Local filesystem/CLI is trusted, not a sandbox. |
| Reuse | PASS: extend existing tests and package commands; no new persistence system. |

## Implementation Contract

1. Persist repair in-flight before spawning; persist completion only after exit zero. Spawn failure,
   signal, nonzero exit, or journal persistence failure blocks the run. Reject resume of in-flight,
   interrupted, malformed, or legacy ambiguous failed iterations before lease takeover or writes.
   Preserve user edits and existing bounds/lease/CAS/terminal precedence. Journal replacement is
   atomic, with file flush before rename; no remote-effect exactly-once guarantee is claimed.
2. Request maintenance approval against the active run. Capture a versioned SHA-256 action identity
   over canonical project root, run, operation, target paths, evidence file hashes, pre/post refs,
   and expiry. Validate relative paths, realpath containment, regular files and size limits.
3. Decide only the named request/digest with a nonempty local operator identity. Recheck evidence
   at decision and claim. Reject changed operations, targets, evidence, project/run, expired or
   rejected requests, and consumed requests. Duplicate decisions are idempotent. Reject unbound
   decisions on a bound live request. New pending requests supersede the active pointer.
4. Serialize request/decision/claim using an exclusive local lock. Flush append-only receipts before
   returning. Consumption is at most one claim, not exactly-once external execution. Crash after
   claim requires reconciliation/new approval, never automatic replay. Fail closed on corrupt logs
   or retained crash locks. Do not auto-reap locks or revoke a completed effect retroactively.
5. Expose local request/evaluate/consume CLI commands, reusing the same guard. Operation manifests
   are caller-owned JSON descriptors, not executable instructions. `decidedBy` is attribution,
   not authentication; remote entrypoints still need a separate authentication design.

## Validation Plan

- Existing `test:harness:run-loop-goal-progress`: real subprocess agent mutates a fixture, then
  kills its runner before completion; expired-lease resume must reject without journal/check/effect
  changes. Successful repair and compatible completed-check resume must continue normally.
- Existing `test:harness:stage-state`: pending/restart/decision/claim, operation and evidence drift,
  wrong project/run, expiry, rejection/revocation, duplicate decisions/claims, competing claims,
  corrupt journal, retained lock, and unbound decision regression. A new request is needed after
  consumed/uncertain effects. Local CLI request/approve/consume must use the same checks.
- Existing stage-state model, experiment identity regression, `test:harness:core`, docs contracts,
  Snyk Code for changed first-party JS, Sonar file analysis, editor diagnostics and scoped diff.
- Review Breadth/Depth/Feedback: record evidence and residual risks here. Never assert independent
  model review unless the runtime actually provides it.

## Assumptions and Risks

- Trusted local callers/filesystem may create approvals; protection is against stale/repeated work,
  not a malicious operator rewriting logs and hashes. Hashes detect drift, not authorization.
- File hashes are checked at claim time. Callers must execute the claimed immutable artifact, keep
  their resource lock, and use downstream idempotency; post-claim filesystem races are not solved.
- `[UNVERIFIED]` Cross-process crash and concurrency fixtures will behave consistently on Windows;
  use explicit process handshakes/markers and bounded timeouts, not timing sleeps.

## Implementation and Proof

Delivered in `run-loop.mjs`, `stage-state.mjs`, their two existing test files, and `LOOPS.md`.
No dependencies, scheduler, remote authentication, or executor were added. Test fixture directory
selection is restricted to existing real direct children of the harness run directory. The runner
reuses `manifest-allowlist.mjs` for journal replacement paths and cleans up only owned temporary
files. Unknown action fields and incompatible project/version declarations are rejected.

| Check | Result |
| --- | --- |
| `node scripts/harness/test/run-loop-goal-progress-test.mjs` | PASS; actual process kill after mutation, preserved effect/journal on rejected resume, completed repair resume, legacy rejection, nonzero repair blocking. Original partial-edit resume assertion failed with exit 0 instead of 2 before the fix. |
| `node scripts/harness/test/stage-state-maintenance-approval-test.mjs` | PASS; identity/evidence drift, expiry, revocation, duplicates, concurrent subprocess claims, retained lock, corrupt log and CLI workflow. Original operation-mismatch assertion failed before the fix. |
| `npm run test:harness:core` | PASS on final implementation, explicit exit 0 with project-root environment isolated and restored. |
| `node scripts/harness/test/stage-state-model-test.mjs` | PASS; 100 fixed-seed sequences, no counterexample or interruption. |
| `node --test scripts/harness/experiment-identity.test.mjs` | PASS; both helper and real-CLI tests. |
| `npm run harness:docs:check` | PASS; final documentation check repeated at closeout. |
| Snyk Code | Zero issues for stage-state and both changed tests. Final runner scan retains six LOW path-traversal findings, including new atomic journal sinks, despite path confinement and owned cleanup. They are unresolved static findings, not a clean scan or independently waived false positives. |
| Sonar IDE file-list analysis | New sorting/complexity findings repaired; five baseline findings remain in unchanged Git PATH lookup, resume-journal selection, mode normalization and CLI promise handling. No independent Sonar server quality-gate claim. |

## Self-Review Breadth, Depth and Feedback

This is a self-review record, not an independently executed cross-model Review Breadth/Depth or
Feedback pass. Fixed-model runtime independence was not established in this session. Independent
security review remains required before treating this as cleared for merge/deployment.

| Finding | Disposition and Evidence |
| --- | --- |
| A partial repair could make checks pass after the runner crashed | FIXED: red/green subprocess regression and pre-takeover repair-checkpoint rejection. |
| Approved state could authorize a different maintenance operation | FIXED: action identity, active request pointer, evidence checks and one-use log receipt. |
| Duplicate clients could both claim an approved effect | FIXED at guard boundary: exclusive lock and flushed consumption receipt; two competing subprocesses yield exactly one successful claim. External effects still require caller reconciliation/idempotency. |
| Extra descriptor fields could remain unbound | FIXED: strict supported-field set and negative-control test. |
| New journal paths inherited test-fixture taint | HARDENED: existing-directory selection, manifest confinement, exclusive temporary creation and owned cleanup. Six LOW Snyk findings remain; no scanner waiver or false-positive clearance is asserted. |
| Existing remote writers do not provide bound identity | INTENTIONAL FAIL-CLOSED: control-panel and Teams generic writers cannot approve bound maintenance requests; use the local CLI/API. Remote authentication remains out of scope. |

Gate recheck: domain alignment, generality, single history/live-state ownership, boundaries,
isolation constraints and reuse remain as designed. Diff impact is grounded in sources because
the graph is stale: direct owners are the convergence runner and stage-state guard; affected
callers are existing local CLI, control-panel/Teams generic writers and tests. Runtime/governance
and operator-doc layers change; model routing and external execution authority do not.

Residual risk is MEDIUM: no independent model review, unresolved static path findings, and the
documented trusted-local/caller-resource-lock boundary. A claimed receipt must never be described
as proof that the effect completed. The adoption records are updated, but implementation status
is not a security waiver or deployment approval.
