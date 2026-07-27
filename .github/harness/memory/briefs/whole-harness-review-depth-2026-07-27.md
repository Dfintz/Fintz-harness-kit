## Review Depth
resource: .github/harness/memory/briefs/whole-harness-review-brief-2026-07-27.md,scripts/harness/command-validation.mjs,scripts/harness/graph-provider.mjs,harness.config.json,.github/instructions/03-ARCHITECT.md,.github/instructions/06-REVIEW-DEPTH.md

### Gate ledger
- Artifact/path: `scripts/harness/command-validation.mjs` CLI self-test path
- Gates run: 1, 3, 4, 5
- Verdicts: G1 PASS, G3 PASS, G4 PASS, G5 PASS
- Evidence: self-test branch is colocated with command-validation owner module; no cross-layer leakage; additive compatibility aliases preserved.

- Artifact/path: understand-anything refresh-readiness path (`harness.config.json` + `scripts/harness/graph-provider.mjs`)
- Gates run: 3, 4, 4b
- Verdicts: G3 PASS, G4 PASS, G4b FAIL
- Evidence: ownership and boundary placement are correct, but safety/isolation for non-trivial workflows is weakened when refresh cannot be activated in operator runtime.

- Artifact/path: architect-challenge execution path (`plan-review` reviewer invocation in this run)
- Gates run: 4, 5
- Verdicts: G4 PASS, G5 PASS
- Evidence: explicit fallback recorded in brief; no silent bypass.

### Structural findings ledger
### Major
- Artifact/path: graph readiness boundary across `harness.config.json` and `scripts/harness/graph-provider.mjs`
- Gate/depth check failed: Gate 4b (Isolation/safety boundary)
- Evidence: provider readiness marks refresh degraded when `pluginRoot` is unset/placeholder; current workspace status stayed stale.
- Why structure is wrong: The review workflow requires fresh graph confidence for non-trivial changes, but current operational boundary leaves that guarantee environment-dependent without enforced remediation.
- Recommended fix: Add an operator-facing preflight gate that fails early (with explicit remediation) when non-trivial routes are selected and refresh readiness is degraded.
- Confidence: HIGH

### Minor
- Artifact/path: architect-challenge runtime command dependency
- Gate/depth check failed: additional depth check (specialization/capability boundary)
- Evidence: reviewer command failed and returned no verdict; fallback handled manually.
- Why structure is wrong: challenge stage robustness depends on external command availability not asserted before execution.
- Recommended fix: add a lightweight preflight in `plan-review` for reviewer command availability with actionable error text.
- Confidence: HIGH

### Brief divergence
- No divergence in architecture ownership decisions.
- Implementation introduced one corrective code change (self-test branch) to satisfy deterministic validation proof requirements.