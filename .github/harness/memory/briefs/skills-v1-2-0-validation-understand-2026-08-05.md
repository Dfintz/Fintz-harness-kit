## Understand Notes - Skills v1.2.0 Validation (2026-08-05)

resource: scripts/harness/prompt-router.mjs, scripts/harness/graph.mjs, .github/harness/HARNESS.md, .github/harness/registry.json, harness.config.json, .github/skills/, https://github.com/mattpocock/skills/releases/tag/v1.2.0

### Task
Validate this release's skill surfaces against mattpocock/skills v1.2.0 and identify integration opportunities that fit harness-kit.

### Graph freshness
- Status: fresh (graph commit matches HEAD 67610924)
- Provider: understand-anything
- Query backend: understand-anything

### Changed components (expected)
- Skills metadata surfaces under .github/skills/
- Harness contract docs that describe skill packaging and invocation
- Stage artifacts in .github/harness/memory/briefs/

### Affected components (1-hop / likely)
- .github/harness/registry.json (skill inventory contract)
- .github/harness/catalog/harness-profile.json (catalog view)
- scripts/harness/prompt-router.mjs (routing semantics are adjacent to skill metadata)

### Affected layers
- Core (documentation/contracts/scripts)

### Hotspots
- scripts/harness/prompt-router.mjs (top graph hub)
- scripts/harness/mcp-server.mjs
- scripts/harness/harness-report.mjs

### External release findings (v1.2.0)
- Added Codex metadata sidecars (agents/openai.yaml) beside skills.
- Added explicit invocation policy metadata for user-invoked skills.
- Graduated or reshaped several skills (prototype, wayfinder updates, wizard, to-questionnaire, wait-what, writing-for-agents rename).

### Local validation snapshot
- Already aligned in-part:
  - wayfinder is referenced in harness docs and intent profiles.
  - prototype exists as a shipped local skill.
- Not aligned yet:
  - no agents/openai.yaml files under local .github/skills/.

### Risk
- Low-medium: metadata-only changes are low runtime risk, but introducing policy fields must avoid changing current harness routing behavior without explicit intent.
