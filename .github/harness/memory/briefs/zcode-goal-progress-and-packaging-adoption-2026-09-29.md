---
summary: "Architecture Brief - ZCode goal progress adoption and packaging prerequisite"
type: brief
status: active
source: research
created: 2026-09-29
updated: 2026-09-29
tags: [zcode, goal-progress, validation-evidence, agent-plugins]
---
# Architecture Brief: ZCode Goal Progress and Packaging Adoption
resource: .github/harness/memory/briefs/zcode-capability-adoption-assessment-2026-09-29.md, .github/harness/LOOPS.md, scripts/harness/run-loop.mjs, scripts/harness/stage-state.mjs, scripts/harness/agent-plugins-export.mjs, scripts/harness/test/stage-state-maintenance-approval-test.mjs, scripts/harness/test/agent-plugins-export-test.mjs

## Architecture Brief

### Objective

Adopt evidence-backed goal progress for opt-in convergence runs. One caller-provided `goalId` must
link the run journal, every recorded validation check, and the live goal state without changing how
existing loops execute. Do not implement ZCode packaging or scheduling until their explicit
prerequisites are met.

### Context Sufficiency

| Artifact | Role | Owner |
| --- | --- | --- |
| `run-loop.mjs` | Executes bounded convergence runs and writes iterations/check results to a journal. | Loop runtime |
| `stage-state.mjs` | Persists normalized, live goal metadata. | Live-state runtime |
| `harness-report.mjs` | Reads journals but does not own or mutate their execution state. | Reporting |
| `agent-plugins-export.mjs` | Produces a root Agent Plugins manifest and allowlisted skills-only export. | Packaging |
| Local ZCode discovery check | No ZCode executable was found in the configured shell or standard Windows locations. | Environment prerequisite |

Scope: software plus focused tests and decision-memory documentation. Primary boundary: convergence
loop journals and live goal state. The implementation does not create an ADE client, scheduler, or
remote execution pathway.

### Understand Impact Map

- Graph status: fresh at `646372654df58f550f9af10242e1b8490dad0dc4`; active provider is
  `understand-anything`.
- Changed components: `run-loop.mjs`, `stage-state.mjs`, and focused tests for their public CLI
  contract.
- Affected components: `harness-report.mjs` will consume the additive journal fields unchanged;
  existing loops remain compatible because goal metadata is opt-in.
- Affected layers: Core and Test Layer.
- Dependency path: CLI `--goal-*` inputs -> run journal `goal` metadata and iteration `checks` ->
  live `stage-state.goal` evidence references -> report-compatible journal reader.

### Design

#### Artifacts to modify

- `scripts/harness/run-loop.mjs`: accept `--goal-id` and `--goal-objective` as an all-or-nothing
  opt-in pair; persist a `goal` object in the journal; write the journal successfully before
  publishing live JSON-pointer evidence references. The `--test-fixture-root` override is rejected
  unless `NODE_ENV=test` and scopes temporary loop and run directories beneath one fixture root.
- `scripts/harness/stage-state.mjs`: normalize additive `journalRef` and `evidenceRefs` fields on
  the existing `goal` object, and provide a locked goal-progress update that rejects a different
  active goal rather than overwriting it. These fields are observational only.
- `scripts/harness/test/stage-state-maintenance-approval-test.mjs`: prove the added goal fields
  normalize and survive state writes.
- `scripts/harness/test/run-loop-goal-progress-test.mjs`: invoke the public loop CLI against
  temporary loop, run, and live-state directories and prove one `goalId` appears in the journal
  and live state, with evidence pointers resolving to successful checks.
- `package.json`: expose `test:harness:run-loop-goal-progress` for the focused proof command.

#### Artifacts explicitly not being created

- A scheduler or read-only scheduled-report runner: no concrete local use case exists.
- A ZCode adapter package: the required local client-loading proof cannot run because ZCode is not
  installed. Static manifest similarity is not a substitute.
- A report UI: current journal consumers tolerate additive fields; displaying a goal-progress UI is
  a separate product decision.
- A new state database or second journal: the existing journal and live-state owners remain the
  sources of history and current status respectively.

### Key Decisions

- `goalId` is the sole cross-artifact identity. It is caller-provided and copied verbatim to the
  run journal and live goal state; no derived identifier, scheduler id, or background task id is
  introduced. A live state with a different active `goalId` rejects the update under an exclusive
  state lock; concurrent goal-enabled loops must use separate state directories.
- Validation evidence is a JSON Pointer into the same journal, formatted as
  `<journalRef>#/iterations/<n>/checks/<n>`. It is an observational link to an already-recorded
  check result, never a success authority. `journalRef` is the POSIX workspace-relative journal
  path, and the pointer is published only after that journal write succeeds. The first durable
  journal write establishes `goal.journalRef`; every resumed run reuses it verbatim. A resume with
  conflicting goal flags fails before executing checks.
- Goal completion remains determined solely by the existing loop terminal state and checks. A
  goal becomes `complete` only when the run converges; non-converged outcomes never become
  completion claims. `exhausted` maps to `budget-limited`; `blocked` maps to `paused`; `stuck`,
  lease loss, and durable journal-write failures map to `error`, all with an explanatory reason.
- Persistence ordering is journal then live state for every iteration and terminal update. A failed
  journal write prevents matching evidence or terminal-state publication. A failed live-state
  update is recorded in the durable journal's `goal.progressSyncError` when that write is possible;
  it does not change the existing loop terminal state, but it never publishes a live `complete`
  claim. No new terminal state is introduced.
- `--goal-id` and `--goal-objective` are all-or-nothing. Runs without both preserve current
  journal and state behavior.
- The package adapter is BLOCKED, not simulated. Re-open it only after a ZCode client can load a
  local skills-only fixture and produce observable discovery evidence.

### Architectural Gates

| Gate | Verdict | Evidence |
| --- | --- | --- |
| 1. Domain / module alignment | PASS | Journal mutation stays in `run-loop`; live normalization stays in `stage-state`. |
| 2. Generality | PASS | JSON-pointer validation evidence applies to every convergence loop and does not encode ZCode UI behavior. |
| 3. Ownership | PASS | The loop owns historical checks; live state owns the current goal summary; reporting is read-only. |
| 4. Boundary integrity | PASS | The CLI performs no scheduling, remote calls, client loading, or permission changes. |
| 4b. Isolation / safety | PASS | User-provided fields are persisted as data; evidence does not authorize continuation or completion. |
| 5. Reuse | PASS | Reuse journal checks, `writeStageState`, existing normalization, and the current test style. |

### Constraints

- Preserve bounded-loop and terminal-state semantics.
- Keep every existing CLI invocation valid and behaviorally unchanged without the two new flags.
- Do not interpret a journal pointer as proof unless its referenced check has `pass: true`.
- Do not publish a live evidence reference until the corresponding journal write succeeded.
- Reject goal-state ownership conflicts instead of overwriting a different active goal.
- Keep the fixture-root override test-only and reject it in normal CLI execution.
- Do not add a network dependency, a ZCode download, an external package, or a background process.
- Keep the ZCode adapter and scheduled reports out of this change.

### Acceptance Plan

1. A goal-enabled passing loop writes the exact `goalId` to both artifacts.
2. Every live `evidenceRefs` entry resolves to a `pass: true` journal check.
3. A goal-enabled failed loop does not mark the live goal complete.
4. A loop without goal flags retains its existing journal shape and does not write goal metadata.
5. A conflicting active goal id is rejected without replacing its live state.
6. The focused test uses temporary loop, run, and state directories; it creates no real journal.
7. Partial goal flags and legacy no-goal calls preserve their existing behavior.
8. A resumed goal run preserves its original `journalRef` and rejects conflicting goal flags.
9. Converged, exhausted, blocked, stuck, lease-loss, and journal/state-write failure paths follow
  the documented goal mapping without publishing an unsupported completion claim.
10. The existing stage-state and agent-plugin focused tests pass unchanged.

### Do NOT

- Do not fabricate ZCode client-loading proof.
- Do not alter report aggregation, plugin allowlists, approval policy, or stage routing.
- Do not add an auto-continue, scheduler, or unattended mutation behavior.
- Do not store command output or untrusted check text in live state; store only structured pointers.

### Assumptions and Risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| A JSON Pointer is sufficiently usable for operators and future report renderers. | Evidence contract | A later UI may need a resolver helper, but journal truth remains unchanged. |
| Writing opt-in goal state does not conflict with another active live state owner. | Live state | Concurrent loops may overwrite the single live state; no new concurrency behavior is introduced. |
| ZCode is absent on this workstation. | Adapter scope | The adapter remains blocked until the client is installed and manually exercised. |

### Implementation Summary

- Delivered opt-in `--goal-id` / `--goal-objective` convergence-loop metadata, durable journal
  references, passing-check-only evidence pointers, resume-stable identity, live-state conflict
  protection, and failure-state reporting.
- Added `test:harness:run-loop-goal-progress` and included it in `test:harness:core`.
- Kept the ZCode packaging adapter blocked because no local ZCode client is installed for required
  manifest discovery and skills-only loading proof. Kept scheduled reporting parked.

### Feedback Verdict Record

| Point | Verdict | Evidence | Action |
| --- | --- | --- |
| Journal and live-state ownership | Current decision holds | Depth review gates 1-5 and 4b pass; journal writes precede live publication. | Keep the split ownership contract. |
| Sync failure resilience | Challenge upheld and resolved | `progressSyncError` is journaled; final journal-write failure publishes only a live `error` state. | Keep the hardened failure path. |
| Evidence truthfulness | Challenge upheld and resolved | Focused test proves failed checks emit no evidence pointers. | Keep pointers limited to `pass: true` checks. |
| ZCode adapter | Insufficient evidence | Local client discovery returned no ZCode executable. | Remain blocked; do not simulate a loading result. |
| Read-only scheduling | Deferred | No concrete local reporting use case exists. | Keep parked. |

Validation: `npm run test:harness:run-loop-goal-progress`, `npm run test:harness:stage-state`,
`npm run test:harness:agent-plugins`, and isolated `npm run test:harness:core` all passed.