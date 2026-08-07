---
summary: "Architecture Brief - Agent Plugins v1 compatibility assessment and skills-only pilot"
type: brief
status: implemented
source: research
created: 2026-08-07
updated: 2026-08-07
tags: [agent-plugins, agent-skills, mcp, portability, packaging]
---
# Architecture Brief - Agent Plugins v1 compatibility assessment and skills-only pilot

resource: [agent-plugins.org](https://agent-plugins.org/), [agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec), .claude-plugin/plugin.json, .github/skills/, skills/harness/SKILL.md, scripts/harness/harness-catalog.mjs, scripts/harness/mcp-server.mjs, .vscode/mcp.json, .github/harness/HARNESS.md

## Architecture Brief

### Objective

- Assess the harness against Agent Plugins Specification v1.0.0 and define the smallest safe path to portable packaging.
- Establish that the repository is not currently an Agent Plugins client and must not claim client conformance.
- Deliver a skills-only export pilot that packages one reusable skill without changing harness routing, MCP execution, permissions, or installation behavior.

### Scope and boundaries

- In scope: compatibility assessment, specification-to-local mapping, and a bounded implementation plan for a portable skills-only package.
- Out of scope: plugin discovery/loading runtime, package installation, plugin updates, MCP server launch from a plugin, client extension semantics, credential handling, or changes to existing Claude/Copilot adapters.
- Primary boundary: Agent Plugins defines a distributable package format; this harness remains an orchestrator and an MCP server, not an Agent Plugins client.

### Context sufficiency check

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| Agent Plugins v1.0.0 specification | Normative manifest, discovery, MCP, containment, and client conformance rules | External specification |
| `.claude-plugin/plugin.json` | Existing Claude-specific plugin metadata and one harness skill export | Claude adapter |
| `.github/skills/` and `skills/harness/SKILL.md` | Reusable skill content and cross-agent harness entry skill | Skill payloads |
| `scripts/harness/harness-catalog.mjs` | Generated capability catalog and `llms.txt` output | Catalog generation |
| `scripts/harness/mcp-server.mjs` and `.vscode/mcp.json` | Existing command-capable MCP server and VS Code client registration | MCP integration |

| Missing artifact | Needed to answer |
| --- | --- |
| A consumer client that loads Agent Plugins packages | Whether a generated package interoperates with a real conforming client |

Proceeding is safe because this is an architecture assessment, not a conformance claim or runtime launch.

### Compatibility assessment

| Agent Plugins v1 requirement | Local state | Result |
| --- | --- | --- |
| A package root has a validated `plugin.json` | `.claude-plugin/plugin.json` is Claude-specific and lacks Agent Plugins `$schema` | Not an Agent Plugins package |
| Skills are immediate `skills/*/SKILL.md` children | The repo has portable-style skill directories, but not beneath an Agent Plugins package root | Reusable source exists |
| MCP configuration lives in root `mcp.json` | `.vscode/mcp.json` is a VS Code client configuration, not portable plugin configuration | Not conformant |
| A client validates paths, schemas, failures, and extensions | No package loader exists; the harness exposes MCP tools but does not load plugins | Not a client |
| Stdio MCP launch supplies `PLUGIN_ROOT` and `PLUGIN_DATA` | Existing command-capable MCP server is launched directly from the workspace and has no plugin lifecycle | Not applicable without a client |

### Architectural gates

| Gate | Verdict | Evidence |
| --- | --- | --- |
| 1. Domain alignment | PASS | Cross-client skill packaging belongs with existing skill adapters and catalog surfaces. |
| 2. Generality | PASS | A standalone skills export can be used by any compatible client without encoding a provider runtime. |
| 3. Ownership | PASS | Package metadata owns portable distribution facts; routing stays owned by `harness.config.json` and `prompt-router.mjs`. |
| 4. Boundary integrity | PASS | A skills-only package avoids conflating the exported skills with the harness MCP server or its VS Code configuration. |
| 4b. Isolation and safety | PASS with constraint | Do not package MCP launch configuration until a dedicated client implements containment, `PLUGIN_DATA`, schema validation, and approval policy. |
| 5. Reuse | PASS | Export generation should consume canonical skill sources, not introduce independently maintained copies. |

### Key decisions

- Decision: Do not claim Agent Plugins v1 client conformance. The mandatory loader, schema-selection, containment, per-component failure isolation, and subprocess lifecycle behavior are absent by design.
- Decision: Do not add `mcp.json` to an exported package in the first slice. Doing so would imply support for subprocess/remote server semantics that no local package client owns.
- Decision: Keep `.claude-plugin/plugin.json` unchanged. It is a provider adapter, not a portable manifest.
- Decision: The first adoption slice is implemented as a generated skills-only package rooted at a dedicated distribution path, containing only the explicit allowlist member `wait-what` and an Agent Plugins v1 `plugin.json`.
- Decision: Exclude `harness`, all MCP references, and every skill with repository/runtime command assumptions from the pilot. `wait-what` is user-invoked only and has no tool, command, or process-execution behavior.
- Decision: Add deterministic validation of manifest shape, skill discovery layout, and source/export drift before advertising the package.

### Artifacts to create

- `plugins/agent-plugins/harness-kit/plugin.json` - Agent Plugins v1 portable package manifest for a skills-only export.
- `plugins/agent-plugins/harness-kit/skills/wait-what/SKILL.md` - generated copy of the allowlisted canonical skill.
- `scripts/harness/agent-plugins-export.mjs` - deterministic export and validation owner.
- `scripts/harness/test/agent-plugins-export-test.mjs` - tests for manifest, immediate discovery, and drift detection.

### Artifacts to modify

- `package.json` - add narrowly scoped export and validation commands after the implementation owner exists.
- `README.md` - document the portable package only after validation proves it is generated and current.

### Artifacts explicitly not being created

- A plugin loader/client: wrong owner for this repository until a concrete consuming runtime needs it.
- An exported `mcp.json`: unsafe without a client-owned launch, containment, and persistent-data policy.
- Agent Plugins extension namespaces: no stable harness-owned reverse-domain namespace or client-specific behavior exists.
- Duplicated hand-authored skill trees: would drift from `.github/skills/` and `skills/harness/`.

### Constraints

- Generated content must originate from canonical local skill sources and fail validation on drift.
- The first export must contain only root `plugin.json` and immediate `skills/wait-what/SKILL.md`; broadening the allowlist requires a separate compatibility review.
- No network schema retrieval during validation or runtime.
- Do not change stage routing, sidecar policy semantics, MCP tool permissions, or existing provider configuration.
- Any future MCP export requires explicit human approval and a separate design that implements all applicable Agent Plugins v1 client requirements.

### Validation plan

- Run an export self-test that verifies manifest schema identifier, legal name, and immediate skill discovery layout.
- Run source/export drift validation.
- Run `npm run harness:docs:check`, `npm run test:harness:core`, and `git diff --check`.
- Manually load the produced directory with a real conforming Agent Plugins client before claiming interoperability.

### Do NOT

- Do not label the harness or its MCP server as an Agent Plugins client.
- Do not copy `.vscode/mcp.json` into `mcp.json`, expose `harness-command-dispatch`, or launch plugin-defined commands.
- Do not use unscoped package paths, symlink escapes, ambient secrets, or opaque shell command strings.
- Do not add provider-specific data at top-level of `plugin.json`; any future client data belongs in a stable reverse-domain extension namespace.

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| The `wait-what` skill can be deterministically copied without provider-only references. | Export scope | No risk observed in the approved pilot; additional skills still require separate review. |
| `[UNVERIFIED]` A conforming client accepts a skills-only package. | Interoperability claim | The package may need client testing or a different selected skill subset. |
| The Agent Plugins v1 specification remains stable at its published canonical schema URLs. | Manifest validation | Upgrade mapping will be needed for a future major spec version. |

### Sequencing

1. Add the deterministic `wait-what` skills-only exporter and validation test before adding public documentation. Complete.
2. Generate the package from the allowlisted canonical source and prove source/export drift detection. Complete.
3. Validate with a real conforming client, then document the package as an experimental portable export. Deferred until a conforming client is available.

### Understand status

- Graph status: fresh after `npm run harness:graph:refresh:once`; graph matches `HEAD`.
- Changed components: exporter, focused test, generated portable package, package scripts, and README documentation.
- Affected components: skill sources, package/documentation surfaces, and future external plugin consumers.
- Affected layers: skill packaging and distribution; MCP runtime remains intentionally unaffected.
- Residual risk: medium until a real conforming client validates the generated package.
