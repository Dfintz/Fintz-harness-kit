---
summary: "Implementation record - Agent Plugins v1 compatibility assessment"
type: brief
status: implemented
source: implementation
created: 2026-08-07
updated: 2026-08-07
tags: [agent-plugins, implementation, assessment]
---

# Implementation Summary - Agent Plugins v1 compatibility assessment

resource: .github/harness/memory/briefs/agent-plugins-v1-compatibility-2026-08-07.md, .github/skills/wait-what/SKILL.md, scripts/harness/mcp-server.mjs, scripts/harness/mcp-tools.mjs, harness.config.json

## Delivered

- Persisted the compatibility assessment and implemented the pilot contract.
- Added a generated, skills-only `wait-what` package.
- Explicitly excluded `mcp.json`, command dispatch, process execution, plugin-client conformance, and changes to existing provider adapters.
- Added deterministic export and validation commands plus a focused regression test.

## Contract adherence

- The approved brief was followed without creating a runtime or widening capabilities.
- The architect challenge correction was incorporated: the local MCP surface is command-capable and must remain outside the pilot.

## Proof summary

- `npm run harness:graph:refresh:once` then `npm run harness:graph -- status`: graph is fresh and matches `HEAD`.
- Independent Architect Challenge using GPT-5.3 Codex: `VERDICT: APPROVED` after revision.
- `npm run test:harness:agent-plugins`: passed manifest, layout, MCP/config rejection, content drift, missing-file, and manifest-parity cases.
- `npm run harness:agent-plugins:validate`: passed for the committed generated package.
- `npm run test:harness:core`: passed, including the Agent Plugins test and validator.
- `npm run harness:docs:check`: passed.
- `git diff --check`: passed.
- Editor diagnostics for the assessment brief: no errors.

## Change summary

CHANGES MADE:

- `.github/harness/memory/briefs/agent-plugins-v1-compatibility-2026-08-07.md`: records the evidence, compatibility matrix, safety boundaries, and implemented single-skill pilot.
- `scripts/harness/agent-plugins-export.mjs`: generates and validates the fixed skills-only package.
- `scripts/harness/test/agent-plugins-export-test.mjs`: proves manifest, layout, source equality, and drift rejection.
- `plugins/agent-plugins/harness-kit/`: generated Agent Plugins v1 package containing only `wait-what`.
- `package.json` and `README.md`: expose and document the export, validation, and test commands.

THINGS I DIDN'T TOUCH (intentionally):

- `.claude-plugin/plugin.json`: existing provider adapter remains unchanged.
- `.vscode/mcp.json`, `scripts/harness/mcp-server.mjs`, `scripts/harness/mcp-tools.mjs`, and `harness.config.json`: no MCP or command-dispatch behavior changed.

POTENTIAL CONCERNS:

- A real Agent Plugins client has not yet load-tested the generated package, so interoperability remains unverified.

## Assumptions or deviations

- No deviation from the brief.
- `[UNVERIFIED]` A conforming client accepts the generated skills-only package.
