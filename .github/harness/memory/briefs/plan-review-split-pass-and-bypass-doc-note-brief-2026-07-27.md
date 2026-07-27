## Architecture Brief
resource: scripts/harness/plan-review.mjs,scripts/harness/prompt-router.mjs,.github/harness/HARNESS.md,.github/instructions/03-ARCHITECT.md

### Objective
- Perform a second focused plan-review refactor pass that further splits `main` and `runSelfTest` orchestration to reduce complexity warnings while preserving behavior.
- Add an operator-facing harness doc note explaining when `--allow-degraded-preflight` is appropriate and how to review override audit entries.

### Scope and boundaries
- In scope:
  - `scripts/harness/plan-review.mjs` structural extraction of self-test and CLI setup code.
  - `.github/harness/HARNESS.md` small operator note for degraded-preflight bypass + audit log review.
- Out of scope:
  - semantic changes to plan-review verdicts, loop behavior, or reviewer/author contracts.
  - changing prompt-router preflight decision logic in this pass.

### Artifacts to create
- `.github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-brief-2026-07-27.md`
- `.github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-implementation-2026-07-27.md`
- `.github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-review-breadth-2026-07-27.md`
- `.github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-review-depth-2026-07-27.md`
- `.github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-feedback-2026-07-27.md`

### Artifacts to modify
- `scripts/harness/plan-review.mjs`
- `.github/harness/HARNESS.md`

### Key decisions
- Gate 1 Domain alignment: complexity reduction belongs in plan-review owner file, not separate module.
- Gate 2 Generality: extraction into local pure helpers provides reuse inside file without premature abstraction.
- Gate 3 Ownership: CLI preflight/run orchestration remains fully owned by plan-review.
- Gate 4 Boundary integrity: preserve existing command-line contract and output shapes.
- Gate 4b Isolation/safety: keep reviewer preflight and untrusted wrapping unchanged; do not relax checks.
- Gate 5 Reuse: centralize repeated self-test check assembly and CLI path setup in helper functions.

### Constraints
- Maintain all existing self-test pass expectations.
- Maintain run loop terminal-state semantics and verdict parsing behavior.
- Keep documentation note concise and operator-actionable.

### Validation plan
- `npm run harness:plan-review:self-test`
- `node scripts/harness/plan-review.mjs --lens plan --plan .github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-brief-2026-07-27.md --reviewer "node -e \"process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('ok\\nVERDICT: APPROVED\\n'));\"" --max-rounds 1`
- `node scripts/harness/plan-review.mjs --lens plan --plan .github/harness/memory/briefs/plan-review-split-pass-and-bypass-doc-note-brief-2026-07-27.md --reviewer "claude -p" --max-rounds 1` (expected preflight fail)
- `npm run harness:docs:check`

### Do NOT
- Do NOT alter externally visible verdict tokens or exit code semantics.
- Do NOT remove or dilute read-only and untrusted-data protections.
- Do NOT weaken default non-trivial degraded-preflight hard-fail semantics.

### Assumptions and risks
- `[UNVERIFIED]` Additional helper extraction will meaningfully reduce complexity diagnostics.
- Risk: over-refactoring could obscure behavior; mitigated by deterministic self-tests and behavior checks.