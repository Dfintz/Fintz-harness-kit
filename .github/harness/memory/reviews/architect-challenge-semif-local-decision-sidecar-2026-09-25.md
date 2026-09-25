# Architect Challenge - SemIf Local Decision Sidecar

## Verdict

VERDICT: REVISE

## Evidence

- The ownership split is sound: `planTask` remains authoritative and `main` owns run creation and
  command output. The original brief did not specify the advisory receipt location, reuse rule, or
  handoff visibility.
- Disabled routing can remain unchanged, but enabled/unavailable output needs an exact contract and
  tests through repeated route and handoff calls.
- The worker contract lacked startup failure, request correlation, framing, disconnect behavior,
  queue expiry, process exit, and readiness semantics.
- Probability validation was named without freezing the minimal `/v1/systemone` and worker wire
  shapes needed for deterministic tests.
- Receipt privacy needed a bounded field allowlist. Existing run artifacts already contain task
  text, so the new guarantee must be scoped to sidecar logs and advisory receipts.
- Promotion and demotion were underspecified while the slice has no live decision authority.

## Required revision

- Specify one run-scoped advisory artifact, manifest/handoff reference, sticky reuse rule, field
  allowlist, size bound, and disabled/unavailable behavior.
- Freeze versioned HTTP and JSONL worker contracts with lifecycle, queue, cancellation, expiry, and
  readiness behavior.
- Keep promotion eligibility and demotion as report-only pure calculations. Any live transition is
  a later separately approved and calibrated change.

## Non-blocking recommendations

- Test repeated route/handoff use, malformed worker output, and queued-request expiry.
- Keep real SemIf/CUDA and jevcompat runs environment-gated.

## Second review

VERDICT: REVISE

- The first revision resolved receipt ownership, lifecycle, queue, privacy, and authority concerns.
- The remaining blocker was an incomplete public contract: Choice/Score/Noul question and answer
  fields, worker result fields, confidence formulas, and numeric tolerance were not frozen.
- Required revision: add compact version-1 schemas or examples so Implement does not choose the
  wire contract.

## Final review

VERDICT: APPROVED

- The Brief resolves receipt ownership and reuse, worker lifecycle and queue behavior, privacy
  bounds, primitive schemas, worker result fields, and numeric rules.
- Deterministic routing remains authoritative and shadow-only operation preserves approval
  boundaries.
- Implement may proceed without making new architecture decisions.

Finalized: 2026-09-25

