## Architecture Brief
resource: .github/harness/memory/briefs/sidecar-schema-policy-understand-2026-08-05.md, scripts/harness/validate-doc-contracts.mjs, .github/harness/schemas/, .github/skills/, .github/harness/HARNESS.md, package.json, https://github.com/mattpocock/skills/releases/tag/v1.2.0

### Objective
- Define and enforce a strict contract for OpenAI/Codex sidecar metadata files in local skills.
- Add deterministic validation that fails CI/local checks on contract violations.
- Produce a focused architecture evaluation for one v1.2.0 behavior skill adoption candidate.

### Scope and boundaries
- In scope:
  - New sidecar schema contract artifact under harness schemas.
  - Deterministic sidecar validation inside docs-contract checker.
  - Normalize all local sidecar files to pass strict contract.
  - Add focused architecture brief for wait-what adoption decision.
- Out of scope:
  - Runtime behavior changes to prompt-router based on sidecar policy.
  - Importing or implementing wait-what behavior in this pass.
  - Broad external skill catalog ingestion.

### Artifacts to create
- .github/harness/schemas/skill-openai-sidecar.schema.json - strict schema/policy contract.
- .github/harness/memory/briefs/v1-2-0-wait-what-adoption-architecture-2026-08-05.md - focused skill adoption architecture brief.
- Stage records for implement/review/feedback in briefs memory.

### Artifacts to modify
- scripts/harness/validate-doc-contracts.mjs - add strict sidecar parser + schema validation pass.
- .github/skills/*/agents/openai.yaml - include required policy block and conformant shape.
- package.json - add deterministic command alias for sidecar validation.
- .github/harness/HARNESS.md - document sidecar schema/policy contract and enforcement.

### Key decisions
- Decision: enforce strict schema at docs-contract layer instead of a separate ad hoc script.
  - Reasoning: keeps one deterministic gate surface and reduces drift.
- Decision: require policy.allow_implicit_invocation boolean in every sidecar.
  - Reasoning: policy contract is explicit and machine-checkable across skills.
- Decision: do not wire router semantics to policy yet.
  - Reasoning: avoid behavior drift without a dedicated runtime design and tests.
- Decision: evaluate wait-what as the focused behavior skill candidate.
  - Reasoning: minimal-surface behavior, easy to classify as optional user-facing corrective pattern.

### Constraints
- No new npm dependencies.
- Checker must fail with clear deterministic errors.
- Preserve existing docs-check validations.
- Keep schema and docs aligned.

### Validation plan
- npm run harness:docs:check
- npm run harness:skills:sidecars:check
- git diff --check

### Do NOT
- Do NOT change prompt-router execution or stage routing behavior in this pass.
- Do NOT add ambiguous optional keys to sidecar contract.
- Do NOT adopt behavior skill runtime integration before architectural evaluation verdict.

### Assumptions and risks
- [UNVERIFIED] Existing sidecar files continue using a simple two-level YAML shape.
  - Affects: parser strictness and error behavior.
  - Risk if wrong: checker false negatives/positives.
- [UNVERIFIED] policy.allow_implicit_invocation semantics are understood by all consuming surfaces.
  - Affects: external consumer expectations.
  - Risk if wrong: policy may be treated as advisory only.
