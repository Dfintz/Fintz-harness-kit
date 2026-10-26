---
summary: Adapt experiment resume identity and report-only contrastive composition without broadening autonomous mutation authority.
type: brief
status: implemented
source: human
created: 2026-10-24
updated: 2026-10-26
tags: [experiment, resume, evaluation, harness-evolve]
---

# Bounded Harness2 Adaptations

## Scope And Evidence

The user approved adapting the first two Harness2 radar ideas. The generic experiment runner
owns journals, checkpoints, and lease takeover. The evolve/eval layer owns proposals and
deterministic evaluation; existing eval sandboxes, task loaders, and dangerous-diff checks are
reused. Prior authority: [self-improving harness](self-improving-harness.md).
No upstream code or skill files are imported.

## Decisions And Gates

- **Domain:** resume compatibility stays in `scripts/harness/run-experiment.mjs`; contrastive
  evaluation stays under `scripts/harness/eval/`, not routing or the simulated skill-adapter eval.
- **Generality:** hash a versioned canonical execution manifest, not provider-specific settings.
- **Ownership:** the existing journal owns configuration identity and target checkpoint digests.
  The composition pilot owns only its report and temporary evaluation sandboxes.
- **Boundaries:** immutable configuration includes effective loop settings, resolved target paths,
  agent command identity, commit mode, and scratch-note mode. Mutable checkpoint evidence includes
  target bytes and metric/iteration progress. Resume validates both before lease mutation or writes.
- **Safety:** legacy journals without identity fail closed and require a fresh run. No implicit
  migration. Never restore checkpoint bytes over a user's changed files. Missing targets and
  inconsistent progress fail validation. Interrupted in-flight edits cannot be assumed safe.
- **Reuse:** retain lease/CAS and keep-if-improved behavior. Use SHA-256, stable key ordering,
  existing eval task/verifier loaders, sandboxes, and dangerous-diff checks.
- **Pilot topology:** serial proposal/probe/composition pipeline, opt-in and depth one. One
  approved instruction target, baseline/general/domain/composed arms, and an independent-proposal
  control. No candidate is applied to the checkout. Independent deterministic verification alone
  scores held-out tasks. Model output and evidence remain untrusted.
- **Promotion:** reports are diagnostic only. Never commit, auto-promote memory, modify verifiers,
  relax sandbox/network policy, or declare quality gains from deterministic mock tests.

## Implementation And Proof

1. Add resume identity/checkpoint helpers within the experiment ownership boundary and integrate
   before takeover. Test unchanged resume, metric/direction/scope/agent drift, missing identity,
   checkpoint tampering, and interruption handling using temporary fixtures.
2. Add the smallest offline contrastive pilot using existing eval utilities. Require explicit
   disjoint development/held-out task IDs, pinned model label, timeout and invocation budgets.
   Produce evidence-linked proposals and a composition; evaluate all arms on held-out tasks at
   the same execution budget. Record failures as inconclusive, safety violations as rejected,
   and total elapsed/call counts. Do not assert token/USD bounds without usage evidence.
3. Validate with focused deterministic self-tests and existing resume/evolve checks, then docs
   and memory-reference checks, Snyk Code, and Sonar analysis for modified first-party code.
4. Update radar records with delivered paths and proof. Run breadth/depth self-review and record
   residual risks. A real model-backed performance comparison remains a separate operator run.

## Risks And Rejected Alternatives

Do not build a second state store or vendor the Python runtime. SHA digests establish identity,
not authenticity against an attacker able to rewrite both artifacts and digests. A local eval
sandbox is filesystem isolation for fixtures, not a security sandbox for hostile agent code;
operator-provided execution must provide any required OS/network isolation. No new delegation
authority is introduced. Model-backed quality, cost, and transfer remain unverified until measured.

## Delivery And Validation

- Resume identity: `scripts/harness/experiment-identity.mjs` and the existing experiment runner;
  `npm run test:harness:experiment-identity` passes both helper and real-CLI tests. Incompatible
  resumes leave the journal unchanged and never invoke the agent. Compatible resumes continue.
- Composition: `scripts/harness/eval/contrastive-pilot.mjs` with three passing test groups under
  `npm run test:harness:contrastive-pilot`, including real argv subprocesses, failed calls,
  missing artifacts, timeout reporting, held-out isolation, safety rejection, and target tampering.
- Existing regressions: `harness:evolve:test` passes 13/13 and `harness:evolve:self-test` passes
  4/4. The new focused suites are wired into `.github/workflows/harness-tests.yml`.
- Documentation, memory-reference, and script-alias checks pass. No dependencies were added.
- Snyk Code reports zero issues in the identity helper/test, pilot/test, and modified evolve guard.
  Release preparation reconfirmed those five clean scans. The earlier runner scan recorded six
  findings in unchanged code: command injection, path handling, and metric-extraction ReDoS.
  Its release-time rescan failed on network connectivity, then authentication. Those findings
  are not cleared by this change and need separate remediation.
- Release-time Sonar analysis (2026-10-26) reports 24 findings: six Critical, one Major, and
  17 Minor. This supersedes the earlier no-Critical/Major assessment for the new modules.
  Two Critical findings recommend comparators for the identity helper's deterministic string
  sorting; other Critical findings concern guard/runner sorting and runner complexity.
  The Major control-character warning remains in unchanged glob conversion. Four Minor findings
  flag intentional serial awaits; serial evaluation preserves deterministic search order and
  shared budgets. No suppressions or runtime changes were made during release preparation.

## Review And Feedback

Breadth self-review found and fixed missing-artifact handling, JSON/stdout versus stderr mixing,
credential-value redaction in artifacts, protected-file checks, and safety classification of
integrity violations. Depth self-review confirms existing journal ownership, eval utility reuse,
no default routing changes, and no proposal promotion. The lightweight protected-file hash was
extracted from the existing guard to avoid rerunning verifier self-tests on every invocation;
the suite health check still runs once and protected content is checked around calls.

This is self-review, not an independently executed cross-model review. No hosted model-backed
comparison, model-residency attestation, token/USD measurement, statistical significance claim,
or full aggregate harness suite run is recorded. Reports cannot authorize adoption. A human can
choose a representative workload and isolated executor for the first measured comparison.
