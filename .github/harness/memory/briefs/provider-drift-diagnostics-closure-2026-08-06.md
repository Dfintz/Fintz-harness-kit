---
summary: "Architecture Brief - provider drift diagnostics residual closure"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [provider-drift, diagnostics, closure, analyzer]
---
## Architecture Brief
resource: scripts/harness/provider-drift-report.mjs, scripts/harness/test/adoption-slices-test.mjs, .github/harness/memory/briefs/provider-drift-diagnostics-2026-08-06.md

### Objective
- Determine whether the six remaining file-inclusion diagnostics represent an unresolved runtime safety defect after real-path containment hardening.

### Scope and boundaries
- In scope: recheck diagnostics, verify all matching reads pass real-path containment, confirm external-root support and behavior tests, and record the residual analyzer disposition.
- Out of scope: suppressing diagnostics, restricting valid external roots to repository paths, or rewriting the drift report into a different architecture.
- Primary boundary: `provider-drift-report.mjs` remains a read-only external-root comparison tool; analyzer disposition is a review artifact, not runtime behavior.

### Artifacts to create
- None. Existing diagnostics Brief and Feedback record the implementation decisions.

### Artifacts to modify
- None unless the challenge finds an unguarded read or failed behavior proof.

### Key decisions
- Decision: classify the remaining warnings as analyzer-only when they occur at root normalization, directory enumeration, or hashing sites already protected by exact shape filtering and `realpathSync` containment.
- Decision: retain the warning evidence and do not add `NOSONAR`, broad suppression, or a repository-only allowlist.
- Decision: closure requires focused adoption tests plus core/docs/commands/graph/diff checks, with no behavior regression.

### Constraints
- Never claim zero diagnostics when the analyzer still reports six warnings.
- Do not weaken external-root support or remove real-path containment.
- Keep deferred future artifact types and live provider remediation out of this closure.

### Validation plan
- Run `npm run test:harness:adoption`, `npm run test:harness:core`, `npm run harness:docs:check`, `npm run harness:commands:check`, `npm run harness:graph -- status`, `git diff --check`, and targeted diagnostics.

### Do NOT
- Do not suppress analyzer output.
- Do not treat analyzer warnings as runtime failures without evidence.
- Do not alter unrelated user edits.

### Assumptions and risks
- `[UNVERIFIED]` The analyzer does not model the relationship between `realpathSync` containment and subsequent `readFileSync`; this is an analyzer-modeling limitation, not proof of universal safety.
- Residual risk low: matching files are filtered by explicit relative shape and real-path containment before hashing; external roots remain supported.
