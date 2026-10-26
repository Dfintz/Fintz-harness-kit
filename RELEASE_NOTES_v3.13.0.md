# Release Notes v3.13.0

Date: 2026-10-26

## Summary

v3.13.0 adds fail-closed experiment resume identity and an opt-in, report-only
contrastive composition pilot. Neither feature broadens autonomous mutation,
routing, or promotion authority.

## Changes

- Bind experiment journals to a versioned SHA-256 execution configuration and
  target checkpoint. Reject incompatible configuration, changed targets, missing
  identity, inconsistent progress, and interrupted in-flight checkpoints before
  lease takeover, journal writes, metric execution, or agent invocation.
- Add `harness:eval:contrastive` to compare baseline, general, domain, and composed
  instruction proposals against an equal-search-call independent control.
- Require disjoint development and held-out task IDs, explicit invocation and
  timeout budgets, pinned model metadata, and independent deterministic scoring.
- Keep proposals in temporary evaluation sandboxes. Reports do not modify the
  checkout, authorize promotion, or claim model-backed quality gains.
- Reuse protected-file integrity checks and add the experiment identity helper to
  the evolve guard's protected paths.
- Add focused regression suites, CI coverage, operator documentation, and the
  bounded Harness2 adaptation brief and radar records. No dependencies are added.

## Validation Evidence

The focused identity and contrastive-pilot suites pass all five test groups,
including real CLI subprocesses, resume rejection without side effects, held-out
isolation, timeout handling, safety rejection, and target-tampering checks.

Implementation decisions, prior evolve regression results, security analysis, and
self-review limits are recorded in
[the Architecture Brief](.github/harness/memory/briefs/harness2-bounded-adaptations.md).
Release preparation also passes the documentation contract, fast health, and
memory-reference checks, plus all 13 evolve-runner and four evolve-guard self-tests.

## Compatibility And Known Limits

- Legacy experiment journals without identity cannot be resumed. Start a fresh
  run; no automatic migration or restoration over changed user files is provided.
- Identity digests establish consistency, not authenticity. External agent files,
  undeclared environment inputs, and provider weights are not attested.
- The local evaluation sandbox isolates fixtures, not hostile executable code.
  Operators remain responsible for required OS and network isolation.
- A representative live-model comparison, token/USD measurement, statistical
  significance, and independent cross-model approval remain unverified.
- Current Sonar analysis reports six Critical, one Major, and 17 Minor findings
  across new and existing runtime files; see the brief. This release does not
  claim a clean security audit or a full aggregate harness-suite run.
- Fresh Snyk scans of five source/test files found zero issues. The runner rescan
  was blocked by network connectivity, then authentication; its earlier security
  findings are not cleared.
- The existing `body-parser` dependency warning remains; no dependency versions
  are changed by this release.
- Node.js >=20 remains the declared engine. Generated browser captures and the
  merge-test ledger are excluded from the release.
