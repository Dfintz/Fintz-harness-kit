## Architecture Brief
resource: .github/harness/memory/radar/prime-agent-daemon-rlm-continuity.md, .github/harness/LOOPS.md, scripts/harness/stage-state.mjs, scripts/harness/test/stage-state-maintenance-approval-test.mjs, scripts/harness/record-run.mjs

### Objective
- Add a small, non-daemon continuity-state contract for long-running harness work: persisted goal metadata, continuation budgets, and post-turn refinement proposal metadata in live stage state.

### Scope and boundaries
- In scope: `stage-state` normalization, CLI write flags for continuity metadata, loop protocol documentation, and deterministic tests.
- Out of scope: daemon workers, IPython execution, model-generated Python, background scheduling, automatic continuation injection, and live trusted memory mutation.
- Primary boundary: `scripts/harness/stage-state.mjs` owns live state; `.github/harness/LOOPS.md` owns operator/agent protocol.

### Artifacts to create
- None.

### Artifacts to modify
- `scripts/harness/stage-state.mjs` - add normalized `goal`, `continuation`, and `refinement` state fields plus CLI write flags.
- `scripts/harness/test/stage-state-maintenance-approval-test.mjs` - extend existing stage-state coverage with continuity normalization assertions.
- `.github/harness/LOOPS.md` - document the continuity contract and safety boundaries.
- `package.json` - add a narrow stage-state test script and include it in the core harness test aggregate.

### Key decisions
- Decision: place the runtime contract in `stage-state`, not `run-loop`. Evidence: `stage-state` is already the live-state owner and preserves current stage/approval data, while `run-loop` owns convergence execution journals.
- Decision: make the slice metadata-only. Evidence: the radar entry explicitly rejects Prime Agent's daemon/IPython runtime; the useful transfer is persisted state ownership and explicit budgets.
- Decision: make `refinement` a proposal/completion-event pointer, not an automatic memory writer. Evidence: this repo routes memory and capability changes through review gates and quarantine rules.
- Gate 1 domain/module alignment: live continuity state belongs in `stage-state`; loop procedure belongs in `LOOPS.md`.
- Gate 2 generality: `goal`, `continuation`, and `refinement` are general long-running-work primitives that apply across loops and stages.
- Gate 3 ownership: terminal history remains with run journals; only current live state is added to `stage-state`.
- Gate 4 boundary integrity: no execution engine, scheduler, daemon, or trust boundary changes are introduced.
- Gate 4b isolation/safety: budgets and refinement scopes are explicit; global/trusted state changes remain outside this slice.
- Gate 5 reuse: extend the existing stage-state test and package aggregate instead of adding new validation infrastructure.

### Constraints
- Preserve existing stage-state behavior and unknown-key compatibility.
- Normalize invalid or missing continuity values to safe defaults.
- Keep CLI write flags metadata-only: goal identity/text/status, token/time/continuation counters or limits, refinement proposal/completion references, and scope/status metadata are allowed; flags that imply automatic execution, scheduling, prompt injection, or applying refinement are forbidden.
- Keep completion dependent on existing loop checks/rubrics, not on continuation count or elapsed time.
- Do not describe workers, kernels, or subprocesses as security sandboxes.
- Do not add a background scheduler or automatic continuation mechanism.

### Validation plan
- Run `npm run test:harness:stage-state`.
- Run `npm run test:harness:core` because `package.json` wires the new focused test into the aggregate.
- Run `npm run harness:commands:check` because `package.json` command aliases change.
- Run `npm run harness:docs:check`.
- Run `git diff --check -- scripts/harness/stage-state.mjs scripts/harness/test/stage-state-maintenance-approval-test.mjs .github/harness/LOOPS.md package.json .github/harness/memory/briefs/prime-agent-continuity-contract-2026-08-10.md`.

### Do NOT
- Do not implement a daemon, worker supervisor, IPython kernel, or direct agent-to-agent messaging.
- Do not let refinement metadata bypass Architecture Brief, review, quarantine, or human approval boundaries.
- Do not weaken loop terminal states or treat budget exhaustion as success.
- Do not change existing run journal schema requirements in this slice.

### Assumptions and risks
- `[UNVERIFIED]` Existing consumers tolerate additional normalized fields in `stage-state.json`; risk is low because `writeStageState` already preserves unrecognized keys.
- `[UNVERIFIED]` Adding a package script for the existing stage-state test will not conflict with current aggregate test timing.
- Risk: readers may mistake continuity metadata for autonomous execution. Mitigation: docs state that it records state only and does not inject prompts or mark work complete.