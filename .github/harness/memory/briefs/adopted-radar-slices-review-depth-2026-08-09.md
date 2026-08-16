---
summary: "Review depth - adopted radar slices (rerun scoring, failure batching, line-level review, skill output shape)"
type: brief
status: implemented
source: review
created: 2026-08-09
updated: 2026-08-09
tags: [radar, review-depth, harness-evolve, grade-trace, teach-agent]
artifact_family: review
immutability: mutable
---

# Review Depth: Adopted Radar Slices

resource: .github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md, .github/harness/memory/briefs/adopted-radar-slices-architect-challenge-2026-08-09.md, scripts/harness/harness-evolve.mjs, scripts/harness/grade-trace.mjs, scripts/harness/validate-doc-contracts.mjs

- **Date:** 2026-08-09
- **Run ID:** run-20260809131412-b306ddfa

## Gate ledger

| Artifact | Gates | Verdict | Evidence |
|---|---|---|---|
| `harness-evolve.mjs` | 1, 3, 4, 4b, 5 | Pass | Scoring validity stays with the runner that owns commit gating. The guardrail path is untouched; the manifest is layered on top of `computeIntegrity`, never in place of it (challenge condition C1). |
| `grade-trace.mjs` | 1, 2, 3, 5 | Pass | `failureRecords` consumes a `gradeTrajectory` result and re-implements no threshold (challenge condition C4). Both new exports are pure. |
| `06-REVIEW-DEPTH.md` | 1, 4 | Pass | Line-level criteria sit alongside the structural gates, opening with an explicit scope limit (challenge condition C6). |
| `04-IMPLEMENT.md` | 1, 5 | Pass | Four checkboxes added to the existing "Reuse and clarity" block; no new section invented. |
| `teach-agent/SKILL.md` | 1, 3 | Pass | Artifact shape belongs to the authoring skill. The no-raw-passage rule is stated without claiming automated enforcement (challenge condition C7). |
| `validate-doc-contracts.mjs` | 3, 4 | Pass | See D1. |

## Structural findings

**D1 — Brief divergence: `validate-doc-contracts.mjs` was modified.**
Not in the Brief's file list. Editing `06-REVIEW-DEPTH.md` caused `classifyArtifactFamily` to treat a
stage *instruction* as a review *artifact*, because the classifier keys on the filename substring
`review-depth`. Two options existed: add review-artifact frontmatter to a stage instruction, or fix
the classifier. The first would have made the file lie about what it is to satisfy a check. The
classifier fix is the correct owner-level repair — `.github/instructions/` holds the contract, not
the artifacts the contract produces. Severity: Minor. The divergence is recorded here and in the
Feedback verdict rather than being silently absorbed.

**D2 — Gate 4b, safety boundary: no guardrail was weakened.**
Traced the changed path end-to-end. `integrityMatches(baseline, computeIntegrity())` still runs
before and after every iteration, and both call sites still route to `abortOnTamper`. The manifest
only supplies the abort message. A `missing-evaluation` never commits, because the commit call sits
inside the `improved` branch. Confirmed by reading `runEvolutionLoop` rather than inferring it.

**D3 — Gate 5, reuse: the extraction was real, not relocation.**
`runEvolutionLoop` took `main` from cognitive complexity 43 to 18. This satisfies the
complexity-reduction test: the concept count a reader holds when reading `main` genuinely dropped —
argument handling and guardrail setup are now separable from iteration control. Both functions
remain above the configured threshold of 15, which is pre-existing and out of scope.

**D4 — The new line-level criteria were applied to this change.**
A useful self-check, since the criteria landed in the same pass. Applying them found and fixed: one
unused parameter (`abortOnTamper(loopName, …)` never read `loopName` — pre-existing, in scope
because the function was being edited), three locale-unsafe sorts, four nested template literals, and
three nested ternaries. No comment in the diff narrates the conversation, and no unshipped-code
compatibility shim was introduced.

**D5 — Prior finding D4 is discharged.**
The previous Review Depth carried forward a condition that each gap claim rested on a keyword search
and must be re-confirmed. All four were re-confirmed during Understand by reading the target files:
the `result.status ?? 1` conflation was read at `runOneExperimentIteration`, and the three absences
were confirmed against the actual file structure rather than a grep.

**D6 — Residual weakness.**
`--failures` has been exercised only against synthetic journals. The first real experiment run should
be followed by a manual `--failures` pass to confirm the records shape is useful in practice.
Non-blocking.

## Verdict

**PASS** — one Minor Brief divergence (D1), recorded rather than absorbed. D6 carried forward.
