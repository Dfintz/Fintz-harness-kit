## Understand Notes - Sidecar Schema and Behavior Skill Evaluation (2026-08-05)

resource: scripts/harness/validate-doc-contracts.mjs, .github/harness/schemas/, .github/skills/*/agents/openai.yaml, .github/harness/HARNESS.md, package.json, https://github.com/mattpocock/skills/releases/tag/v1.2.0

### Task
Add a strict sidecar schema/policy contract and deterministic checker, then evaluate one v1.2.0 behavior skill for adoption with a focused architecture brief.

### Graph status
- Knowledge graph freshness: fresh (matches HEAD)
- Provider: understand-anything (query + refresh ready)

### Changed components (direct)
- scripts/harness/validate-doc-contracts.mjs
- .github/harness/schemas/ (new sidecar schema contract)
- .github/skills/*/agents/openai.yaml (policy block normalization)
- .github/harness/HARNESS.md (contract note)

### Affected components (1-hop)
- package.json scripts (deterministic checker command exposure)
- .github/harness/registry.json and docs surfaces indirectly validated by docs checker

### Affected layers
- Core layer (tooling + harness contracts + skill metadata)

### Dependencies and risks
- Existing docs-check pipeline must remain deterministic and backward-compatible for existing validation lanes.
- Sidecar parser must be robust enough for strict contract checks without new dependencies.
- Policy field adoption should not silently alter prompt-router behavior.

### External release integration target
- v1.2.0 cross-harness sidecar policy pattern (`agents/openai.yaml` with policy semantics).
- Behavior skill chosen for focused architecture evaluation: wait-what (lightweight corrective interaction skill).
