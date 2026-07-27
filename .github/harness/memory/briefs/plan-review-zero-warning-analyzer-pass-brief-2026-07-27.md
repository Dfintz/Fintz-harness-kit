## Architecture Brief
resource: scripts/harness/plan-review.mjs,.github/instructions/03-ARCHITECT.md

### Objective
Achieve a zero-warning diagnostics state for plan-review by addressing the remaining three helper-boundary file-inclusion findings with analyzer-specific, behavior-preserving mitigations.

### Scope
- In scope:
  - scripts/harness/plan-review.mjs only.
  - Remaining diagnostics at helper-boundary lines involving trusted path resolution and trusted read wrapper internals.
- Out of scope:
  - Any semantic runtime changes.
  - Changes to routing, stage logic, or cross-file abstractions.

### Impact map
- Primary artifact: scripts/harness/plan-review.mjs
- Affected layer: harness workflow script internals
- Blast radius: low (localized comments/annotations and optional helper doc comments only)

### Gate results
- Gate 1 Domain alignment: PASS
- Gate 2 Generality: PASS (standard analyzer suppression on vetted trust boundary)
- Gate 3 Ownership: PASS
- Gate 4 Boundary integrity: PASS (no contract changes)
- Gate 4b Safety/isolation: PASS (no guardrail weakening; checks remain enforced)
- Gate 5 Reuse: PASS

### Decisions
1. Keep current trust-boundary runtime checks intact.
2. Add analyzer-specific suppressions only on verified false-positive boundary lines.
3. Preserve deterministic behavior and existing safety constraints.

### Constraints
- Must keep self-test green.
- Must keep reviewer preflight behavior unchanged.
- Must not introduce broad suppression across the file.

### Validation plan
- npm run harness:plan-review:self-test
- get_errors for scripts/harness/plan-review.mjs (target: no errors)

### Do NOT
- Do NOT remove path checks.
- Do NOT move logic to hide warnings without explicit trust validation.
- Do NOT change CLI outputs or exit codes.

### Assumptions and risks
- [UNVERIFIED] Analyzer suppression token is honored by the active diagnostics provider.
- Risk: provider may ignore suppression comments; fallback is to report residual diagnostics with rationale.