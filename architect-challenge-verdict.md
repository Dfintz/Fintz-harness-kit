# Architect Challenge Verdict

## Verdict

REVISE

## Evidence

- Challenged brief: `.github/harness/memory/briefs/external-harness-source-audit-2026-08-03.md`.
- Recommendation ordering for the first three slices is supported by the repo and by the cited source audit:
  - Gate-first acceptance belongs first because it fits existing validation-loop ownership and matches the repo's existing emphasis on bounded proof and separate reviewer judgment.
  - Unified run bundles belong second because this repo already records workflow and loop journals in `.github/harness/runs`, so the next step is consolidation, not a new control plane.
  - Consensus/divergence artifacts belong third because `scripts/harness/plan-review.mjs` and `scripts/harness/council-review.mjs` already provide the structural review surfaces that could emit a machine-readable reviewer ledger.
- The new Slice D is the only major problem. The brief says it can "report and, when safe, roll back only agent-introduced breaches" for harness-owned subprocess workflows, but the current source surfaces do not yet provide the hard attribution boundary needed to make that safe repo-wide:
  - `scripts/harness/run-loop.mjs` explicitly allows running with a dirty working tree and warns that uncommitted changes will mix with loop fixes, which defeats precise authorship attribution for rollback.
  - `scripts/harness/run-experiment.mjs` only snapshots declared target files and warns that other dirty changes remain the user's problem; it is not a general repo mutation auditor.
  - `scripts/harness/harness-evolve.mjs` already has a narrower integrity gate via `evolve-guard.mjs`, but that guard protects forbidden paths and aborts on tamper; it is not the same as safely attributing and reverting arbitrary spawned-agent breaches in the main worktree.
- Because of that source reality, Slice D is justified only as a much narrower extension of existing guarded/sandboxed flows, not yet as a general fourth candidate for "harness-owned subprocess workflows" on the shared repo tree.

## Required Revision Or Unblock Step

- Revise Slice D to require all of the following before implementation proceeds:
  - scope it to isolated worktree/sandbox executions or to explicit manifest-declared target sets only;
  - forbid operation on a dirty shared worktree unless the dirty-state policy is made part of the ownership model;
  - frame it as reuse/extension of existing `harness-evolve` / `run-experiment` integrity primitives rather than a parallel mutation-audit mechanism.

## Residual Risk Notes (Non-blocking)

- Typed envelope parity remains correctly parked; the current repo still lacks the homogeneous runtime needed to enforce that contract safely.
- The first three recommendations do not need reordering after the source audit.
