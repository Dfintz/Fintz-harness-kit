# Feedback Verdict: Ensemble Routing Guardrails

## Context

Reviewed the requested "fix all", the Architecture Brief, implementation notes, breadth/depth
ledgers, prior stage-separation brief, router/config behavior, and tests.

## Challenges and verdicts

### Distinct model IDs can still hide overlapping ensemble members

**Verdict: Upheld.** Configured model-name inequality alone is not a valid independence guarantee for
ensemble execution. The router now rejects ensemble/dynamic targets as active reviewers and rejects
known declared member overlap.

### The router should attest which model actually executed

**Verdict: Insufficient evidence / execution surface unavailable.** `prompt-router.mjs` routes and
emits handoffs but does not execute inference and has no trusted runtime identity input. A configured
member list cannot prove actual execution. The safe current decision is to report independence as
unverified for ensemble/dynamic implementation and state that runtime identity is not observable.
Future work may add trusted attestation only at an execution adapter boundary.

### The non-trivial route probe used a different repository root

**Verdict: Current environment contract holds.** `HARNESS_PROJECT_ROOT` intentionally selects the
target workspace for an externally run harness. The harness repository remains selectable with
explicit `--repo-root .`; no machine-global environment change is appropriate here.

### The first family-resolution change altered ordinary local-model routing (release-time)

**Verdict: Upheld.** Prefix-first matching for every family let cloud prefixes capture local
`name:tag` ids, and it dropped the `default` fallback when `localFamily` is unset. The brief requires
ordinary family resolution to stay unchanged. Now only ensemble and dynamic-selection families
outrank `localFamily` for tagged ids, which keeps the tag-suffix bypass closed. A regression test
covers both cases and was proven red against the prior logic.

### Review-stage docs still recommended Copilot Auto (release-time)

**Verdict: Upheld.** Stage instructions 05/06/07, the `HARNESS.md` tier table, and `README.md`
contradicted the new review-stage rejection. They now require a pinned fixed model for Review
Breadth, Review Depth, and Feedback. Auto remains documented for non-review stages.

## Result

No unresolved code change remains in the implemented scope. The brief now records runtime
attestation as a future capability boundary rather than claiming the router can prove it today.
