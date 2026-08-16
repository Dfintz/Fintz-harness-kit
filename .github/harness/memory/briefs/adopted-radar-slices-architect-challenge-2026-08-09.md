# Architect Challenge: Adopted Radar Slices

resource: .github/harness/memory/briefs/adopted-radar-slices-2026-08-09.md, scripts/harness/harness-evolve.mjs, scripts/harness/grade-trace.mjs, scripts/harness/evolve-guard.mjs

- **Date:** 2026-08-09
- **Run ID:** run-20260809131412-b306ddfa
- **Method:** `plan-review.mjs --lens plan` requires a second-provider `--reviewer` command, which is
  not configured here. Fallback per the feature prompt: inline skeptical pass, recorded here.

## Challenges raised

**C1 — The task manifest is redundant. `computeIntegrity()` already hashes the eval suite.**
*Partially upheld.* The manifest adds no new *detection* — the suite hash already catches any change
to tasks or verifiers. It adds *diagnosis*: which task was added, removed, or edited. The brief must
not claim the manifest as a new safety property, only as abort-message detail. Condition: implement
it as a diagnostic layered on the existing check, never as a replacement for it, and do not let a
manifest match override a hash mismatch.

**C2 — A new exit code is a breaking change for any caller switching on the exit status.**
*Upheld, accepted.* Exit 4 is new, so nothing currently returns it and no existing caller can be
reading it. The risk is the inverse: a caller doing `if (code !== 0) treatAsNoImprovement` will now
see 4 and lump it in. That is still strictly better than today, where the same caller sees 1 and
cannot distinguish at all. Condition: 0, 1, and 2 keep exact current meanings, and the new code is
documented in the script header and `--help` output.

**C3 — Four slices in one pass violates incremental implementation.**
*Rejected.* The slices share no code and touch five disjoint files. Splitting would produce four
review cycles over the same brief with no added safety. Condition: each slice must be independently
provable, and both scripts must pass `--self-test` after every slice rather than only at the end.

**C4 — `failureRecords` re-derives what `gradeTrajectory` already computed. Duplicate logic.**
*Upheld.* Condition: `failureRecords` must consume a `gradeTrajectory` result rather than re-reading
the journal's iterations. If it re-implements any threshold, that is a Gate 5 reuse failure.

**C5 — `minBatch` defaulting to 2 will mark almost everything provisional on a quiet repository.**
*Accepted as intended.* That is the honest output. The alternative — silently promoting a
single-incident failure to a general rule — is the overfitting the entry exists to prevent. Groups
are marked, never dropped, so nothing is hidden.

**C6 — The line-level criteria will generate review churn on untouched code.**
*Upheld.* Condition: the section must open with an explicit scope limit and must be phrased as
criteria that justify a finding within the current change, never as a standing instruction to
rewrite.

**C7 — Is a "no raw passages" rule in `teach-agent` actually enforceable?**
*Partially upheld.* It is not machine-enforceable today. It is still worth stating, because the rule
is both a legal boundary and a quality one, and an unstated rule is certainly not followed.
Condition: state it as a rule, and do not claim automated enforcement that does not exist.

## Verdict

**VERDICT: APPROVED** — proceed to Implement with conditions C1, C2, C4, and C6 binding.
