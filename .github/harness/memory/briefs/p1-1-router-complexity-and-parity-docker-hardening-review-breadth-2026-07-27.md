---
summary: "Review Breadth Findings - P1-1 Router Complexity + Parity Docker Hardening - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [router, complexity]
---
# Review Breadth Findings - P1-1 Router Complexity + Parity Docker Hardening - 2026-07-27
resource: .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-implementation-2026-07-27.md, scripts/harness/prompt-router.mjs, scripts/harness/graph-parity-self-test.mjs

## Findings ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact: `scripts/harness/prompt-router.mjs`
- Finding: path-security warnings remain around prompt-pack and brief file IO joins/reads.
- Evidence: static analysis still reports file inclusion warnings at multiple read/join sites in router script.
- Impact: moderate security-hardening debt remains in router despite complexity refactor completion.
- Confidence: HIGH
- Recommended fix: dedicated router path-hardening pass using trusted-root checks and safe path wrappers.

### Nit
- Artifact: `scripts/harness/graph-parity-self-test.mjs`
- Finding: fixed default docker candidate list may not cover all custom installations.
- Evidence: absolute candidates are platform defaults only; custom installs need explicit env override.
- Impact: minor onboarding friction for non-standard environments.
- Confidence: MEDIUM
- Recommended fix: add one-line doc note for HARNESS_DOCKER_EXECUTABLE absolute override expectation.

### FYI
- Artifact: parity runner behavior
- Finding: non-required mode intentionally treats docker unavailability as context while preserving local matrix pass.
- Evidence: parity run with relative override reported docker unavailable but `ok: true` and `failedCount: 0`.
- Impact: expected behavior and aligns with brief constraints.
- Confidence: HIGH
- Recommended fix: none.

## Coverage note
- Covered: parity security follow-up behavior, next-actions refactor behavior compatibility, command-level proofs.
- Not covered: complete router command family regression set beyond route/next-actions.

## Missing-context note
- Graph freshness remains degraded in current environment; parity contract checks were validated without requiring graph refresh success.
