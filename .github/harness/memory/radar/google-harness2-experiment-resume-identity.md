---
summary: Bind experiment resume to a versioned execution identity instead of accepting an unfinished journal by loop name alone.
status: adopted
source: https://github.com/google-research/harness2/tree/1cfe254e8d25b15f37048c3730134686abe60335
author_project: google-research/harness2
captured: 2026-10-24
tags: [experiment, resume, provenance, reproducibility]
---

# Harness2 Experiment Resume Identity

## Technique Summary

Harness2 records explicit completion markers and fingerprints the harness tree that produced a
rollout. Its scheduler checks selected artifacts and harness fingerprints before reusing completed
tasks. This is a transferable identity contract, not a reason to import its Python runner.

## Evidence

- Reviewed at upstream revision `1cfe254e8d25b15f37048c3730134686abe60335`:
  [runmark.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/runmark.py),
  [schedule.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/schedule.py), and
  [test_workflow.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/tests/test_workflow.py).
- Upstream tests cover rerunning a task after its selected harness changes or its deliverable
  disappears. Tests were inspected, not executed in this assessment.
- Local `loadResumableRecord` in `scripts/harness/run-experiment.mjs` checks loop name, kind,
  unfinished state, iteration shape, and lease ownership. The inspected resume path then loads
  current loop settings and target files while retaining the old baseline. It does not bind those
  settings to a recorded execution-identity digest.

## Repository Relevance

The existing [matched-baseline entry](harness-r1-matched-baseline-rerun-scoring.md) already addresses
task-manifest validity in `harness-evolve.mjs`. This narrower delta concerns resuming the generic
experiment runner after its metric command, direction, target scope, or execution configuration
changes. Lease safety and git baseline recording do not prove semantic compatibility.

## Adoption Notes

- **Target files/domains:** `scripts/harness/run-experiment.mjs`, its existing resume tests,
  and `.github/harness/LOOPS.md` for the operator contract.
- **Risks/constraints:** preserve lease/CAS behavior and dirty user changes. Do not copy the
  upstream SHA-1 truncation or its shared `base` sentinel; use a versioned SHA-256 manifest with
  the effective base content represented. Do not include secret values in journal identity.
  Account for intended target evolution by comparing checkpoint identity, not initial target bytes.
- **Next step:** route through Understand -> Architect to define an immutable run-configuration
  manifest plus a mutable checkpoint-content digest. Reuse existing journal/integrity helpers;
  do not create another state owner. Specify an explicit legacy-journal migration policy.
- **Discriminating check:** in a temporary fixture, interrupt an experiment and alter only its
  metric command before resuming. The new contract must reject before agent invocation or target
  mutation; unchanged configuration/checkpoint must resume. Also test direction, target-scope,
  and checkpoint tampering independently. If an existing check already rejects these, reuse it
  and narrow or close this follow-up instead of duplicating it.
- **Security scan scope:** no external skill file or executable code imported; SkillSpector is
  not applicable to this research record. Any implementation needs normal security scans.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-24 | candidate | Captured from revision-pinned completion, scheduler, and regression-test sources. | copilot-radar |
| 2026-10-24 | adopted | Priority 1: approve a bounded resume-identity design task; current inspected validation does not establish configuration compatibility. No runtime change or reproduced failure claimed. | copilot-radar |
| 2026-10-24 | adopted | Adapted in `experiment-identity.mjs` and `run-experiment.mjs`; helper and real-CLI fixtures prove drift/tamper rejection before side effects and compatible resume. See [implementation brief](../briefs/harness2-bounded-adaptations.md). | copilot-implement |
