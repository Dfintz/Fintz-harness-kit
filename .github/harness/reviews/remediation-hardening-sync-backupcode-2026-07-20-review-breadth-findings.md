## Review Breadth Findings Ledger

### Coverage note
- Reviewed all changed runtime command-execution files, MCP contract/docs surfaces, and backup-code migration contract files in source and dist.

### Missing-context note
- backend runtime source for TwoFactorService is not present under backend/src; full runtime enforcement behavior changes were out of scope for this pass.

### Blocker
- None in changed scope after remediation.

### Major
1. Artifact: scripts/harness/refresh-graph.mjs
   Finding: one shell:true command execution path remains unhardened.
   Evidence: grep shell:true in scripts/harness returns refresh-graph only.
   Impact: residual command execution surface still depends on shell parsing.
   Confidence: HIGH
   Recommended fix: move refresh command execution to parsed executable+args with explicit allowlist and optional compatibility fallback.

### Minor
1. Artifact: scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs, scripts/harness/plan-review.mjs
   Finding: static analyzer still reports generic taint/file-path warnings despite hardening.
   Evidence: get_errors flags command/path warnings on these files after change.
   Impact: review noise and potential false-positive fatigue.
   Confidence: MEDIUM
   Recommended fix: add targeted path-normalization guards and documented NOSONAR annotations only where protections are explicit and verified.

2. Artifact: backend backup-code flow (runtime)
   Finding: contract is now aligned, but runtime still supports legacy SHA-256 fallback.
   Evidence: migration claims removed; runtime policy unchanged in this pass.
   Impact: security posture unchanged; this is acceptable for contract-alignment scope but still a roadmap concern.
   Confidence: HIGH
   Recommended fix: schedule separate runtime enforcement rollout with source-level change and migration plan.

### Nit
1. Artifact: command-validation tokenizer
   Finding: complexity increased to support quote-safe parsing.
   Evidence: function complexity warning from static analyzer.
   Impact: low maintainability cost.
   Confidence: MEDIUM
   Recommended fix: optional refactor into smaller helpers if maintainability becomes an issue.