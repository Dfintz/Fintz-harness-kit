## Architect Challenge Verdict
resource: .github/harness/memory/briefs/sidecar-schema-policy-architecture-2026-08-05.md, .github/harness/memory/briefs/v1-2-0-wait-what-adoption-architecture-2026-08-05.md, scripts/harness/validate-doc-contracts.mjs, .github/skills/*/agents/openai.yaml

### Challenge focus
- Is strict policy enforcement too risky without runtime integration?
- Is docs-check the correct enforcement boundary?
- Is wait-what adoption recommendation appropriately scoped?

### Findings
- Strict schema/policy enforcement at docs-check is low-risk and deterministic if parser is deliberately constrained and errors are explicit.
- Enforcing policy presence in metadata is acceptable even when runtime behavior is unchanged, as long as docs state this boundary clearly.
- wait-what adoption should remain pilot/deferred in this run to avoid scope creep.

### Required adjustments
- Ensure HARNESS docs explicitly state policy is contract-validated metadata, not router behavior.
- Add dedicated script alias so sidecar checks are runnable independently from full docs-check.

### Verdict
VERDICT: APPROVED
