# Review Depth - P1-1 Router Complexity + Parity Docker Hardening - 2026-07-27
resource: .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-brief-2026-07-27.md, .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-implementation-2026-07-27.md, .github/harness/memory/briefs/p1-1-router-complexity-and-parity-docker-hardening-review-breadth-2026-07-27.md

## Gate ledger

| Artifact or path | Gates run | Status | Evidence |
|---|---|---|---|
| `scripts/harness/graph-parity-self-test.mjs` docker execution path | 1,2,3,4,4b,5 | PASS | Absolute-only override and fixed-path candidate resolution harden execution boundary without policy changes. |
| `scripts/harness/prompt-router.mjs` next-actions refactor path | 1,2,3,4,5 | PASS | Helper extraction reduced complexity concentration while preserving command outputs and ownership boundaries. |

## Structural findings ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact or path: prompt-router file IO joins/reads
- Gate / depth check failed: Gate 4b (safety boundary) partial concern
- Evidence: remaining file inclusion warnings reported by static analysis in router read/join helpers.
- Why the current placement or structure is wrong: current placement is valid, but safety boundary guarantees are incomplete around path canonicalization checks.
- Recommended fix: implement a focused safe-path wrapper in router and route all next-actions file reads through it in a follow-up hardening pass.
- Confidence: HIGH

## Brief divergence
- None. Implementation order, scope, and constraints remained aligned with the brief.
