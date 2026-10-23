---
summary: Adopt bounded, replayable goal-state property tests and an opt-in pure-gate mutation pilot without changing harness runtime behavior.
status: active
---

# Brief: State Models and Gate Mutation - active

## Architecture Brief

### Objective

The operator requested adoption of the two approved radar follow-ups:
[state models](../radar/fast-check-model-based-stage-state.md) and
[scoped mutation testing](../radar/stryker-scoped-gate-mutation-testing.md).
The current state and security-gate tests both pass. Source inspection confirms the public
boundaries are `writeGoalProgress`/`readStageState`/`writeStageState` and
`evaluateSecurityReviewGate`; neither runtime API needs modification.

### Scope and boundaries

Scope: development tests, an opt-in evaluation command, pinned development dependencies,
and adoption evidence. Preserve all existing dirty worktree changes and the Node >=20 floor.

### Constraints

- State ownership and metadata remain in [stage-state.mjs](../../../../scripts/harness/stage-state.mjs). Run-loop journals remain completion authority.
- The pure gate decision remains in [security-review-gate.mjs](../../../../scripts/harness/security-review-gate.mjs); mutation tooling must not alter it in the checkout.
- Existing tests remain the baseline: [state fixtures](../../../../scripts/harness/test/stage-state-maintenance-approval-test.mjs) and [gate tests](../../../../scripts/harness/test/security-review-gate-test.mjs).
- New test/evaluation consumers may call those public boundaries only. No routing, approval, stage-state schema, or production execution policy changes.
- Graph symbol context confirms the state writer is consumed by run-loop progress synchronization. Graph freshness must be checked separately; inferred relationships require source confirmation.

### Key decisions

| Gate | Decision |
| --- | --- |
| 1 Domain alignment | Put sequential model tests beside existing Node tests and pilot orchestration beside existing evaluation scripts. |
| 2 Generality | Keep one focused model and one fixed mutation target; do not introduce a configurable mutation framework. |
| 3 Ownership | Tests own expectations; state and gate modules retain all runtime decisions. |
| 4 Boundaries | The coordinator owns budgets, isolated fixtures, tool invocation, and evidence, not goal completion or gate approval. |
| 4b Isolation | Mutate only newly created disposable copies. Forward an OS/path environment allowlist, never provider credentials. No external target code, dashboard uploads, worktrees, or permissions expansion. |
| 5 Reuse | Reuse existing fixtures, public APIs, Babel parser, child-process facilities, and run-artifact conventions. Pin fast-check 4.10.2 and Stryker 9.6.1 as development dependencies. |

Stryker 10 was rejected because it raises the development engine requirement to Node 22.
Repository-wide mutation thresholds, incremental reuse, alternate test frameworks, concurrency
models, and external skill installation are explicitly out of scope.

### Artifacts to create

- Add `scripts/harness/test/stage-state-model-test.mjs`: a simplified ownership/evidence model, generated commands, explicit replay information, and direct-test execution.
- Add `scripts/harness/eval/testing-adoption.mjs`: run original controls and two seeded faults per technique in disposable copies, enforce bounds, and write a structured run report. Extract the pure gate and its local check helper with the existing Babel parser rather than copying runtime configuration or executing arbitrary source revisions.

### Artifacts to modify

- Update `package.json` with pinned development dependencies, a focused model-test command, and an opt-in adoption pilot command. Preserve existing scripts and unrelated changes; use the package manager for generated lock/dependency state.
- Update only the existing gate tests if mutation evidence demonstrates a missing contract case.
- Update the two radar decision logs, the operator command documentation, and a compact adoption proof/review record after measuring outcomes.

### Validation plan

1. Keep both existing test baselines green.
2. Run at most 100 generated sequences of at most 20 commands under a 60-second outer cap. Model only active-goal ownership and journal/evidence retention across updates and resumed reads; do not infer completion or race safety.
3. Detect both a disabled ownership guard and dropped evidence references in disposable state-module copies. Capture minimized commands, tool version, seed, path, command replayPath, initial model, source hashes, run counts, and timings. Replay each failure against the same fault and confirm it still fails.
4. Run fresh Stryker mutation with the existing gate test command, `coverageAnalysis: off`, `incremental: false`, `inPlace: false`, one worker, no dashboard reporter, at most 100 selected mutants, and a five-minute outer cap. A dry run may enumerate mutants before the bound is enforced; do not execute an over-budget selection.
5. Detect two known weakened gate controls and keep the unmodified control green. Record every mutant status; do not count timeout, compile error, or an unresolved survivor as a meaningful kill. A zero-mutant or incomplete report is not adoption proof.
6. Validate touched tests, dependency security, Snyk Code, SonarQube, documentation references, and command contracts. Never weaken a gate to obtain a passing result.

### Assumptions and risks

- Generated models can repeat implementation mistakes: use a small literal contract and seeded faults rather than importing private normalizers.
- A Stryker copy is not a security sandbox. The only executable target is the already trusted first-party pure gate and its existing test, with no credentials forwarded.
- Surviving mutants require review, not automatic vulnerability labels or arbitrary score targets. Retain unresolved outcomes explicitly.
- Tool incompatibility, exceeded bounds, missing replay metadata, failed controls, or new dependency vulnerabilities block the affected adoption rather than silently reducing proof.
- Review-model independence must not be claimed without runtime evidence. Author self-review and deterministic controls are distinct from an independently attested model review.

### Do NOT

Do not modify runtime state/gate semantics, mutate the original checkout, forward credentials,
execute more than the allowed mutant budget, or represent metadata as approval or completion.

Rollout:

First prove the model with seeded/replayed faults; then prove the isolated mutation runner.
Retain the additive test/tooling only when its controls pass and costs are recorded. Keep mutation
execution opt-in rather than adding a five-minute requirement to the default core suite.

Feedback settlement (2026-10-23): retain both after the [measured proof and author review](../reviews/testing-techniques-adoption-2026-10-23.md).
The state model, evaluator self-tests, and strengthened existing gate tests run in core CI;
mutation remains opt-in. Final mutation scope is BooleanLiteral/EqualityOperator/LogicalOperator
inside the pure decision function: 37 selected, 111 explicitly ignored. Stryker returns ignored
entries in its generated population, so the execution bound counts non-Ignored entries only;
the regression self-test preserves this distinction and refuses zero or more than 100 selected.
Technique deadlines are total budgets, not per-child allowances. Original input hashes are
checked after evaluation, and error/timeout/cleanup outcomes cannot become successful adoption.
The dependency lock is tracked and was generated by npm; shared `qs`/`fast-uri` paths were
patched. Execution used Node v24.15.0; engine metadata is not separate Node 20 execution or
independent model attestation.

Security/quality follow-up (2026-10-23): pin zod 4.6.6, hono 4.13.11, and ip-address 10.7.4;
retain SDK 1.32.1, fast-check 4.10.2, and Stryker 9.6.1. Inspection corrects the earlier SDK-only
claim: zod was shared with Stryker. Fresh SCA leaves one high body-parser 2.3.0 finding. Its
2.4.0 patch was published on October 22 and excluded by minimum-age protection; the operator
explicitly declined a one-invocation exception. Keep that protection and complete SDK tree;
do not treat silent optional-package omission or zero npm audit findings as remediation.

Sonar batch analysis now completes using canonical `c:/` paths matching the IDE scope.
Three targeted style/serialization fixes preserve exact replay and Windows termination;
no runtime owner changed. Five minor findings remain visible: four deliberate serial awaits
under shared total deadlines and one fixed Git invocation relying on trusted operator PATH.
No parallelism, suppression, sandbox claim, or permission change was introduced. Fresh MCP
dispatch/SDK stdio, adoption controls, and safety self-tests pass; modified-file Snyk Code
scans return zero issues. Automatic analysis was restored. The remaining high dependency
finding, minor Sonar findings, and attestation limits preclude full security/release clearance.
