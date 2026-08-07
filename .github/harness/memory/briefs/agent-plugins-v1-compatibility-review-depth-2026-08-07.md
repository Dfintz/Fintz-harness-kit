---
summary: "Review depth - Agent Plugins v1 implemented skills-only pilot"
type: brief
status: implemented
source: review
created: 2026-08-07
updated: 2026-08-07
tags: [agent-plugins, review-depth, architecture]
artifact_family: review
immutability: mutable
---

# Review Depth Gate Ledger - Agent Plugins v1 implemented skills-only pilot

resource: .github/harness/memory/briefs/agent-plugins-v1-compatibility-2026-08-07.md, .github/harness/memory/briefs/agent-plugins-v1-compatibility-implementation-2026-08-07.md, scripts/harness/agent-plugins-export.mjs, scripts/harness/test/agent-plugins-export-test.mjs, plugins/agent-plugins/harness-kit/plugin.json, plugins/agent-plugins/harness-kit/skills/wait-what/SKILL.md, package.json, README.md, scripts/harness/manifest-allowlist.mjs, .vscode/mcp.json, scripts/harness/mcp-server.mjs, scripts/harness/mcp-tools.mjs, .github/skills/wait-what/SKILL.md

| Artifact or path | Gate | Verdict | Evidence |
| --- | --- | --- | --- |
| Compatibility assessment brief | 1 Domain alignment | PASS | Portable skill packaging is an adapter/distribution concern, not routing logic. |
| Implemented `wait-what` skills-only export | 2 Generality | PASS | The package uses the standard immediate skill layout without provider-specific runtime behavior. |
| Manifest and generated export | 3 Ownership | PASS | The exporter owns distribution output; canonical skill sources and generated manifest parity remain authoritative. |
| Exclusion of MCP and dispatch | 4 Boundary integrity | PASS | `.vscode/mcp.json` remains client wiring and the command-capable MCP runtime is not exported. |
| Exclusion of `mcp.json` | 4b Isolation and safety | PASS | No subprocess launch, credentials, `PLUGIN_DATA`, or command-dispatch authority is introduced. |
| Single allowlisted skill | 5 Reuse | PASS | One canonical source avoids an unbounded copied skill catalog before interoperability is proven. |

## Structural findings

### Blocker

- None.

### Major

- None.

### Minor

- Optional hardening remains: shared write-path symlink checks are not added because production paths are fixed literals under the repository-owned output root.

## Brief divergence

- None. The challenge-driven correction and implementation hardening are incorporated in the current Brief rather than treated as implementation deviations.
