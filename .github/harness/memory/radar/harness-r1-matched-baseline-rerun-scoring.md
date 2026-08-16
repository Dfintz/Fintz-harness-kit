---
summary: Score harness edits by rerunning the same task identities against a frozen baseline, and separate "invalid patch" from "infrastructure failure" so a failed run can never be retried until it looks positive
status: adopted
source: https://github.com/DeepExperience/Harness-R1
author_project: DeepExperience (Shao et al., arXiv 2608.02276)
captured: 2026-08-09
tags: [harness-evolve, evaluation, keep-if-improved, anti-gaming, grade-trace]
---

# Matched-Baseline Rerun Scoring

## Technique Summary

Harness-R1 rewards a proposed harness edit only by compiling it, installing it, and rerunning a
frozen target agent on *exactly the same task identities* that produced the baseline. Reward is
`patched metric − baseline metric` from real reruns, never from a judge. Two protocol rules carry
most of the rigor: a run is reportable only when the baseline and patched task manifests agree
(matching integer indices are explicitly declared insufficient proof of a paired comparison), and an
invalid patch scores zero while an infrastructure failure is a *missing* evaluation that must be
reported separately and never retried until it turns positive.

## Repository Relevance

`harness-evolve.mjs` already implements keep-if-improved, and `grade-trace.mjs` scores traces. What
is missing is the comparison-validity discipline around them. Today nothing forces the evolve loop to
prove that the baseline run and the candidate run covered the identical task set, and nothing
distinguishes "the change was bad" from "the run crashed." Both gaps let a scoring loop drift toward
optimistic results — the exact failure mode a self-improving harness must not have.

This is distinct from `harness-evolver-meta-harness.md`, which covers worktree isolation and parallel
proposers. That entry is about *where* a candidate runs; this one is about *whether the comparison is
valid at all*.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/harness-evolve.mjs` — record a task-identity manifest with the baseline and
    require an exact manifest match before a delta is accepted as a score
  - `scripts/harness/grade-trace.mjs` — add an explicit `missing-evaluation` outcome distinct from a
    zero score
  - `.github/harness/loops/harness-evolve.json` — state that a run with any missing evaluation is
    inconclusive, not a pass
- **Risks/constraints:** Manifest matching will make some existing evolve runs report "inconclusive"
  that previously reported a delta. That is the point, but it is a behavior change for anyone reading
  historical evolve output. Needs a documented migration note.
- **Next step:** Architect a manifest-hash field on the evolve baseline record plus a hard gate that
  refuses to emit a delta when the hashes differ. Sequence this **before** entry
  `harness-r1-batch-failure-packet`, because batch evidence is only worth collecting once scoring is
  trustworthy.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from Harness-R1 deep dive | radar-pass |
| 2026-08-09 | adopted | Concrete gap in `harness-evolve.mjs` scoring validity, named target files, bounded first slice (manifest hash gate). Cross-checked against `harness-evolver-meta-harness.md` — different concern. | radar-pass |
| 2026-08-09 | adopted | Implemented. `harness-evolve.mjs` gained `classifyIterationOutcome` (three-way outcome), `evalTaskManifest` / `manifestDiff` (named tamper diagnosis), and exit code 4 for an inconclusive run. See `.github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md`. | implement |
