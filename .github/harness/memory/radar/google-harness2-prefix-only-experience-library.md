---
summary: Park chronological, domain-scoped experience replay until a local continual-learning evaluation justifies its storage and trust costs.
status: parked
source: https://github.com/google-research/harness2/tree/1cfe254e8d25b15f37048c3730134686abe60335
author_project: google-research/harness2
captured: 2026-10-24
tags: [memory, evaluation, continual-learning, isolation]
---

# Harness2 Prefix-Only Experience Library

## Technique Summary

Harness2 stores selected harness trees with cue, lesson, and evidence fields in per-domain
libraries. Before each task, the scheduler retains only entries from earlier tasks in that
stream; recursion modes use separate libraries. This makes chronological replay and cross-arm
isolation explicit instead of treating all accumulated memory as available to every evaluation.

## Evidence

- Reviewed [library.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/library.py),
  [schedule.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/schedule.py), and
  [test_workflow.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/tests/test_workflow.py)
  at revision `1cfe254e8d25b15f37048c3730134686abe60335`.
- `Library.add` requires nonempty cue/lesson/evidence; `run_domain` restricts each library to
  the prior-task prefix. Tests inspect prior-task visibility and absence of answer-key files.
  A model-supplied evidence string is provenance to inspect, not independent verification.
- The library carries full harness trees rather than summaries. Its seed controls task order,
  not model sampling; deterministic ordering is not deterministic model execution.

## Repository Relevance

Our [memory protocol](../README.md), [self-improving brief](../briefs/self-improving-harness.md),
and [continual-refinement entry](continual-harness-trajectory-window-refinement.md) already
cover evidence, quarantine, and reviewed promotion. A domain library would be useful specifically
for a future chronological memory-transfer evaluation, not as another trusted memory store.

## Adoption Notes

- **Target files/domains:** future evaluation fixtures under `scripts/harness/eval/`, run-local
  evidence artifacts, and `.github/harness/memory/quarantine/`; not promoted lessons.
- **Risks/constraints:** growing full-tree copies add context/storage costs and preserve potentially
  poisoned instructions. Never automatically replay upstream-selected trees as trusted local
  policy. Keep domain, evaluation arm, model/configuration, and stream order isolated; domain
  partitioning alone is not a security or tenant boundary.
- **Next step:** park until a concrete memory-transfer benchmark is requested. Then route through
  Understand -> Architect and compare no-memory, reviewed-memory, and prefix-only untrusted-memory
  arms at equal budgets, with tests proving no current/future-task leakage on resume.
- **Security scan scope:** no external skill or executable imported; SkillSpector not applicable.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-24 | candidate | Captured prior-task-only replay and isolated evaluation libraries from source. | copilot-radar |
| 2026-10-24 | parked | Useful experimental discipline, but no current local continual-learning task justifies another library. Existing quarantine and human promotion remain authoritative. | copilot-radar |
