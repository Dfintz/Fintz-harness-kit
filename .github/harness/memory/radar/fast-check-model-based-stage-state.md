---
summary: Use fast-check command models to generate and shrink goal-state sequences that complement the harness's hand-written lifecycle fixtures.
status: adopted
source: https://fast-check.dev/docs/advanced/model-based-testing/
author_project: fast-check
captured: 2026-10-23
tags: [testing, state-machines, property-based-testing, reproducibility]
---

# Model-Based Goal-State Tests

## Technique Summary

fast-check generates sequences of commands against a deliberately simpler reference model and
the real implementation. Command preconditions constrain legal operations; shrinking reduces
a failure to a smaller sequence. Reproduction needs the seed, path, and commands replayPath,
not the seed alone.

## Source Evidence

- Inspected the official model-based testing documentation on 2026-10-23. It documents `commands`, `modelRun`, `asyncModelRun`, and `scheduledModelRun`; the page was last updated 2026-08-18. This is new to this radar, not a claim of a new October release.
- This proposal comes from library documentation, not an external skill. No package was installed during the original radar triage; the separate adoption trial below provides installation and execution evidence.

## Repository Relevance

[stage-state.mjs](../../../../scripts/harness/stage-state.mjs) validates goal ownership and
normalizes progress metadata. Existing [goal-progress tests](../../../../scripts/harness/test/run-loop-goal-progress-test.mjs)
exercise explicit success, failure, resume, and legacy cases. Generated sequences could expose
ordering boundaries that those fixtures do not enumerate; no missing defect is asserted here.

The local hypothesis is that a small independent ownership model will detect deliberately
seeded lifecycle faults and produce replayable counterexamples at a reasonable cost. A model
that copies the implementation would not provide independent evidence. Progress metadata is
not completion proof; acceptance gates and terminal run journals retain that authority.

## Adoption Notes

- **Target files/domains:** The state owner and existing lifecycle tests linked above; reuse their disposable fixture roots instead of creating a separate testing framework.
- **Decision scope:** The follow-up trial passed. Retain fast-check 4.10.2 as a pinned development dependency and the supplemental state model in the core test aggregate.
- **Smallest discriminating evaluation:** Compare the current fixtures with at most 100 sequential command sequences of at most 20 operations, under a 60-second execution cap. Exercise goal writes, conflicting ownership, progress updates, and resumed reads. Check an untouched control and two deliberately seeded ownership/evidence-link faults in disposable copies. Record shrunk failures, the pinned library version, seed, path, replayPath, initial state, and source revision.
- **Risks/constraints:** Keep the model simpler than the implementation. Inspect the exact API's ownership and evidence rules before defining properties. Do not treat metadata saying complete as accepted validation. Start sequentially; concurrency and race safety are outside the first comparison. A budget overrun or unreplayable failure is inconclusive.
- **Measured outcome:** 100 clean sequences in 1,634 ms; both seeded faults detected and shrunk to two-command counterexamples, with exact seed/path/replayPath reproduction. Existing fixtures also caught both faults, so unique fault coverage or a speedup is not established. See the [proof and review](../reviews/testing-techniques-adoption-2026-10-23.md).
- **Next step:** Maintain the cheap public-API model alongside existing fixtures; use `npm run test:harness:stage-state:model` and `npm run harness:testing:adoption -- --technique model`. Concurrency and completion authority remain outside this adoption.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-23 | candidate | Captured the official command-model and shrinking technique against the existing state owner and fixtures. | GitHub Copilot |
| 2026-10-23 | adopted | Approve a bounded evaluation task for goal ownership and replayable state sequences. Effectiveness and dependency adoption remain unproved. | GitHub Copilot |
| 2026-10-23 | adopted | Retain the pinned supplemental model after the clean 100-run control and two shrunk, exactly replayed faults; existing fixtures also detect those faults. | GitHub Copilot |
