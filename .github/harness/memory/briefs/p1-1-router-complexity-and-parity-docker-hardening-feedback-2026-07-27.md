# Feedback Verdict Record - P1-1 Router Complexity + Parity Docker Hardening - 2026-07-27
resource: .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-brief-2026-07-27.md, .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-implementation-2026-07-27.md, .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-review-breadth-2026-07-27.md, .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-review-depth-2026-07-27.md

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Parity docker hardening must happen before router refactor | Current decision holds | implementation ordering and proof logs show parity hardening first | HIGH | Accept |
| 2 | Relative docker override must be invalid while preserving non-required behavior | Current decision holds | relative override passes non-required run with unavailable context; require-docker mode fails non-zero | HIGH | Accept |
| 3 | Router complexity should be reduced without behavior changes | Current decision holds | next-actions and route smoke commands match expected outputs after helper decomposition | HIGH | Accept |
| 4 | Remaining router path warnings should be resolved in this pass | Third option | warnings are real but outside this pass scope; no policy regression introduced | MEDIUM | defer to dedicated path-hardening follow-up |

## Accepted changes
- Keep absolute-only docker override hardening in parity self-test.
- Keep helper-based next-actions decomposition in prompt-router.

## Rejected challenges
- None.

## Deferred points
- Dedicated prompt-router path hardening (safe-root canonicalization wrappers).
- Optional documentation note for absolute HARNESS_DOCKER_EXECUTABLE expectation.

## Brief updates
- Decisions changed: none.
- Constraints updated: none.
- Do NOT rules updated: none.
- Assumptions retired or added: assumption about custom docker install override remains active.

## Response notes
- Requested ordering was satisfied: security follow-up first, then P1-1 complexity refactor.
- Functional router behavior for validated commands is preserved while complexity concentration is reduced.
