# Architect Challenge: Radar Deep Dive — Harness-R1, bholmesdev/skills, book-to-skill

resource: .github/harness/memory/briefs/radar-external-repo-deep-dive-2026-08-09.md, .github/harness/memory/radar/harness-evolver-meta-harness.md, .github/instructions/06-REVIEW-DEPTH.md, .github/skills/teach-agent/SKILL.md, scripts/harness/council-review.mjs

- **Date:** 2026-08-09
- **Run ID:** run-20260809130244-170154b8
- **Method:** `plan-review.mjs --lens plan` was attempted and refused — it requires a `--reviewer`
  command from a *different* provider than the author, and no second provider CLI is configured in
  this environment. Fallback per the feature prompt: inline skeptical pass, recorded here.

## Challenges raised

**C1 — "Triage only" under-delivers against the user's stated goal ("improve it").**
The user asked for improvement, and the brief ships only memory files.
*Resolution:* Upheld as a constraint, mitigated in scope. The `ai-techniques-radar` skill states the
triage loop must not implement code, and the adoption gate requires each adopted idea to route
through Understand → Architect on its own. Mitigation: every `adopted` entry must name the exact
target file and the exact change, so the follow-up task is mechanical rather than exploratory. If an
entry cannot meet that bar, it is `parked`, not `adopted`.

**C2 — Entry 1 duplicates the existing `harness-evolver-meta-harness` radar entry.**
That entry already covers keep-if-improved plus worktree isolation.
*Resolution:* Not a duplicate. `harness-evolver-meta-harness` is about *isolation* and *parallel
proposers*. Entry 1 is about *comparison validity* — identical task-identity manifests between
baseline and patched runs, and a failure taxonomy that distinguishes "invalid patch = score zero"
from "infrastructure failure = missing evaluation, never retried until positive." Different concern,
different target code path. Entries must cross-reference each other.

**C3 — Does `06-REVIEW-DEPTH.md` already carry naming/comment/prose criteria?**
*Verified:* no matches for naming, comment, prose, or readability criteria in that file. The gap is
real, so entry 5 is legitimately `adopted`.

**C4 — Does `teach-agent` already implement progressive disclosure?**
*Verified:* no matches for progressive disclosure, chapters, glossary, cheatsheet, or on-demand
loading in `teach-agent/SKILL.md`. The gap is real, so entry 8 is legitimately `adopted`.

**C5 — Is rejecting `taste-review` justified, or are we discarding a useful pattern?**
*Resolution:* The rejection is of the *implementation*, not the concept. `scripts/harness/council-review.mjs`
and `plan-review.mjs` already provide cross-model second opinions with provider separation enforced.
The external skill adds a Keychain OAuth read and an out-of-sandbox shell prefix approval — strictly
worse security posture for a capability we already have. Rejection stands; the entry must state both
reasons so the decision is not revisited.

**C6 — Four adopted entries at once is a large intake.**
*Resolution:* Accepted. Adoption is a routing decision, not a commitment to parallel implementation.
The entries carry sequencing guidance so they are picked up one at a time.

## Verdict

**VERDICT: APPROVED** — proceed to Implement with the three conditions above (C1 precision bar, C2
cross-references, C5 dual-reason rejection note).
