## Review Breadth Findings
resource: scripts/harness/command-validation.mjs,scripts/harness/graph-provider.mjs,harness.config.json,.github/harness/memory/briefs/whole-harness-review-brief-2026-07-27-REVIEW-LOG.md

### Blocker
- None.

### Major
- Artifact: `harness.config.json`
- Finding: Graph refresh readiness is degraded for understand-anything because `graph.pluginRoot` remains a placeholder, which prevents mandatory freshness restoration in non-trivial runs.
- Evidence: `harness:graph -- status` reported stale graph and degraded readiness; `harness.config.json` uses placeholder `pluginRoot`; refresh readiness reason is hard-coded in provider state.
- Impact: Stage-0 confidence for architecture discovery is reduced and can mask new dependency drift in high-degree nodes.
- Confidence: HIGH
- Recommended fix: Set `graph.pluginRoot` (or `UNDERSTAND_PLUGIN_ROOT`) in operator environment and rerun graph refresh workflow.

### Minor
- Artifact: `.github/harness/memory/briefs/whole-harness-review-brief-2026-07-27-REVIEW-LOG.md`
- Finding: Architect-challenge reviewer command invocation failed (`claude -p`), producing UNCLEAR verdict in review-only mode.
- Evidence: `plan-review` output: reviewer exited code 1 with no output.
- Impact: Reduced adversarial diversity for this run; fallback skepticism is weaker than a true external reviewer pass.
- Confidence: HIGH
- Recommended fix: Configure a valid reviewer command for `plan-review` in this runtime and re-run lens-plan challenge.

### FYI
- Artifact: `scripts/harness/command-validation.mjs`
- Finding: Self-test pathway now exists and passes, restoring expected behavior for `harness:command-validation:self-test`.
- Evidence: deterministic 5-check self-test pass output.
- Impact: Increases confidence in command allowlist/blocklist guard behavior.
- Confidence: HIGH
- Recommended fix: None.

### Coverage note
- Reviewed: router/bootstrap routing outputs, harness health/self-tests, graph parity/provider status, command-validation surface.
- Not deeply reviewed in this pass: every domain skill body and every experimental script branch.

### Missing-context note
- Full graph freshness could not be restored in this environment; dependency confidence therefore used deterministic fallback evidence.