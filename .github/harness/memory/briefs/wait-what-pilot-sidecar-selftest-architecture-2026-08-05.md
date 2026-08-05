## Architecture Brief
resource: .github/harness/memory/briefs/wait-what-pilot-sidecar-selftest-understand-2026-08-05.md, .github/skills/wait-what/SKILL.md, scripts/harness/test/sidecar-validator-edge-cases-test.mjs, scripts/harness/validate-doc-contracts.mjs, .github/harness/HARNESS.md, .github/harness/registry.json

### Objective
- Add a tiny wait-what pilot surface that is optional and user-invoked only.
- Add a focused deterministic self-test for sidecar validator edge cases.

### Scope and boundaries
- In scope:
  - New pilot skill under .github/skills/wait-what.
  - New test file under scripts/harness/test/.
  - Registry/docs/script metadata updates for discoverability and execution.
- Out of scope:
  - Auto-invocation wiring in router.
  - Runtime behavior changes based on sidecar policy.

### Artifacts to create
- .github/skills/wait-what/SKILL.md
- .github/skills/wait-what/agents/openai.yaml
- scripts/harness/test/sidecar-validator-edge-cases-test.mjs

### Artifacts to modify
- package.json (test script)
- .github/harness/HARNESS.md (pilot skill listing)
- .github/harness/registry.json (pilot skill entry)

### Key decisions
- Decision: keep wait-what as user-invoked only with explicit no-auto rule.
- Decision: validate edge cases through CLI-driven integration-style test instead of unit-only parser tests.
- Decision: use a temporary fixture skill directory created/removed inside test for deterministic isolation.

### Constraints
- No auto-invocation behavior.
- No new dependencies.
- Cleanup temporary test artifacts even on failure.

### Validation plan
- npm run test:harness:sidecar:validator
- npm run harness:skills:sidecars:check
- npm run harness:docs:check
- git diff --check

### Do NOT
- Do NOT change prompt-router stage routing.
- Do NOT relax sidecar schema strictness.

### Assumptions and risks
- [UNVERIFIED] Optional pilot skill can remain out of default stage routing while still being useful for manual invocation.
- [UNVERIFIED] Contributors running tests have permission to create/remove temporary folders in .github/skills.
