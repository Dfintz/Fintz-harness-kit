---
summary: Aggregate N failed trajectories into one evidence packet before proposing a harness change, so edits target recurring failure modes instead of the last thing that broke
status: adopted
source: https://github.com/DeepExperience/Harness-R1
author_project: DeepExperience (Shao et al., arXiv 2608.02276)
captured: 2026-08-09
tags: [harness-evolve, lessons, failure-analysis, curation]
---

# Batch Failure Packet

## Technique Summary

Instead of reacting to a single failure, Harness-R1 builds a "batch failure packet" — a fixed batch
of failed trajectories from the same benchmark — and hands the whole packet to the editor as one
prompt. One packet yields one patch, which is then applied to every remaining task. The published
held-out experiment uses ten sampled failures per benchmark to write a single benchmark-level patch,
and the resulting edits generalize to 1,270 unseen tasks.

## Repository Relevance

Our lesson capture and evolve input are effectively single-incident: something goes wrong, a lesson is
written. That produces narrow, overfitted guidance — the same anti-pattern the `bholmesdev-simplify`
entry names as "overfitting" for code. Batching forces the proposer to find the shared cause across
several failures, which is what makes a harness rule worth committing.

We already have the raw material: run journals, trace grading output, and the lessons directory. What
is missing is a step that groups failures before anything is proposed.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/grade-trace.mjs` — emit failure records in a groupable shape (stage, failure
    class, run id)
  - `scripts/harness/harness-evolve.mjs` — accept a batch of failure records as loop input rather
    than a single incident
  - `.github/harness/memory/lessons/` and `.github/skills/teach-agent/SKILL.md` — require a lesson to
    cite at least two distinct occurrences, or be marked provisional
- **Risks/constraints:** Requires enough graded failure history to batch; on a quiet repository the
  batch will often be size one. Mitigate with an explicit minimum-batch threshold that degrades to
  "provisional lesson" rather than blocking capture.
- **Next step:** Architect a failure-record shape and a grouping key in `grade-trace.mjs` output.
  Sequence **after** `harness-r1-matched-baseline-rerun-scoring`.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-09 | candidate | Initial capture from Harness-R1 deep dive | radar-pass |
| 2026-08-09 | adopted | Addresses a real overfitting problem in lesson capture; target files named; bounded first slice (groupable failure records). | radar-pass |
| 2026-08-09 | adopted | Implemented. `grade-trace.mjs` gained `failureRecords`, `groupFailures`, and a `--failures` mode with `--min-batch` (default 2); below-threshold groups are marked provisional, never dropped. See `.github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md`. | implement |
