---
summary: Retain an opt-in fresh-run Stryker comparison/logical/boolean pilot after strengthening the pure evidence gate's tests and killing all 37 selected mutants.
status: adopted
source: https://stryker-mutator.io/docs/stryker-js/configuration/
author_project: Stryker Mutator / StrykerJS
captured: 2026-10-23
tags: [testing, mutation-testing, evidence, validation-independence]
---

# Scoped Gate Mutation Tests

## Technique Summary

Stryker changes selected production expressions in a temporary copy and checks whether the
existing tests reject each mutant. Its command runner can invoke the harness's standalone Node
test scripts without changing test frameworks. Surviving mutants identify possible test gaps
or equivalent behavior, not automatically bugs or vulnerabilities.

## Source Evidence

- Inspected the official [configuration](https://stryker-mutator.io/docs/stryker-js/configuration/) and [incremental-mode documentation](https://stryker-mutator.io/docs/stryker-js/incremental/) on 2026-10-23. No newly published release or local speedup is claimed.
- The command runner has no per-test coverage or test-change information. Incremental reuse also does not account for configuration, dependency, or environment changes. Use a fresh run for the first pilot, not a cached score.
- This is independently sourced library research. No external mutation-testing skill was installed or adapted. The original triage added no dependency; the separate adoption trial below supplies the pinned runner and measured evidence.

## Repository Relevance

The adopted [validation independence entry](coleam00-dark-factory-validation-independence-line.md)
already calls for known-defect gate self-audits. The incremental contribution is a concrete
runner for one existing decision surface, not a second policy or a claim that mutation testing
is new to the harness.

[evaluateSecurityReviewGate](../../../../scripts/harness/security-review-gate.mjs) combines
report status, required checklist evidence, review terminal state, and verdict into one decision.
Its [existing tests](../../../../scripts/harness/test/security-review-gate-test.mjs) are a
bounded target for checking whether weakened guards are actually detected.

## Adoption Notes

- **Target files/domains:** The pure gate function and existing test linked above; keep CLI file loading and unrelated runtime modules outside the first mutation range.
- **Decision scope:** The follow-up trial passed. Retain Stryker 9.6.1 as a pinned Node-20-compatible development tool and opt-in pilot, not a repository-wide mutation threshold or default mutation CI job.
- **Smallest discriminating evaluation:** Establish the unchanged test baseline, then run a pinned Stryker version with `testRunner: command`, the existing Node test command, `coverageAnalysis: off`, `incremental: false`, `inPlace: false`, and one worker. Bound the selected source range to at most 100 mutants and a five-minute outer cap. Include two known guard-weakening controls and retain a machine-readable outcome for every attempted mutant.
- **Risks/constraints:** Run only in a disposable copy without provider credentials or dashboard uploads. Stryker's copy is not a security sandbox. Count compile errors, timeouts, and unresolved equivalent mutants separately from meaningful kills; an exhausted budget is incomplete evidence. Never mutate tests or the user's dirty worktree. Any later caching proposal needs explicit source/test/config/dependency/environment invalidation.
- **Measured outcome:** The initial selected set had 22 kills and 15 survivors and exposed a verdict-only control escaping the existing combined negative case. Additive public-contract tests now kill all 37 selected mutants in 4,180 ms and reject both seeded weakened guards; 111 ignored mutants remain separately recorded. No production gate behavior was changed. The [proof and review](../reviews/testing-techniques-adoption-2026-10-23.md) records the fixed ignored-mutant accounting defect and limitations.
- **Next step:** Use `npm run harness:testing:adoption -- --technique mutation` for the fresh bounded BooleanLiteral/EqualityOperator/LogicalOperator pilot. Preserve raw statuses and fail on incomplete/error outcomes; broader families and caching require separate evaluation, not reuse of this scoped score.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-23 | candidate | Identified a command-runner implementation path for the existing gate self-audit policy. | GitHub Copilot |
| 2026-10-23 | adopted | Approve a fresh-run, one-gate evaluation task with explicit limits; do not adopt cached scores or a new CI gate without evidence. | GitHub Copilot |
| 2026-10-23 | adopted | Retain the opt-in pinned runner: same 37 selected mutants improve from 22 killed/15 survived to 37 killed/0 survived after additive tests; both weakened controls now fail. Exclusions and SDK security limits remain explicit. | GitHub Copilot |
