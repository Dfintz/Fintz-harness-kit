## Implementation Summary
resource: .github/harness/memory/briefs/sidecar-schema-policy-architecture-2026-08-05.md, scripts/harness/validate-doc-contracts.mjs, .github/harness/schemas/skill-openai-sidecar.schema.json, package.json, .github/harness/HARNESS.md

### Delivered
- Added strict sidecar schema contract at .github/harness/schemas/skill-openai-sidecar.schema.json.
- Wired deterministic sidecar validation into scripts/harness/validate-doc-contracts.mjs.
- Added sidecar-only deterministic command alias in package.json: harness:skills:sidecars:check.
- Normalized all .github skill sidecars to include policy.allow_implicit_invocation.
- Updated HARNESS adapter docs with contract, enforcement path, and runtime boundary.
- Authored focused architecture evaluation for v1.2.0 behavior skill wait-what.

### Contract adherence
- Kept runtime router behavior unchanged.
- Enforced metadata contract via deterministic checker only.
- Preserved existing docs-check validations and added sidecar validation pass.

### Proof summary
- npm run harness:skills:sidecars:check -> PASS
- npm run harness:docs:check -> PASS
- git diff --check -> PASS (only pre-existing unrelated line-ending warnings)

### Change summary
CHANGES MADE:
- scripts/harness/validate-doc-contracts.mjs: strict YAML parsing + schema/policy validation for .github skill sidecars.
- .github/harness/schemas/skill-openai-sidecar.schema.json: formal contract.
- package.json: added harness:skills:sidecars:check command.
- .github/harness/HARNESS.md: documented contract and enforcement.
- .github/skills/*/agents/openai.yaml: added required policy key for all local skills.
- .github/harness/memory/briefs/v1-2-0-wait-what-adoption-architecture-2026-08-05.md: focused adoption brief.

THINGS I DIDN'T TOUCH (intentionally):
- scripts/harness/prompt-router.mjs: no sidecar-policy runtime integration.
- harness.config.json model/stage routing: unchanged.
- Additional v1.2.0 behavior skills beyond focused wait-what evaluation.

POTENTIAL CONCERNS:
- Sidecar YAML validator intentionally supports strict two-level shape only; richer YAML constructs will fail by design.

### Assumptions or deviations
- [UNVERIFIED] External consumers interpret policy.allow_implicit_invocation consistently.
