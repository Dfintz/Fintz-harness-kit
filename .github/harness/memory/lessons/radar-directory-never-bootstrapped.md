---
summary: radar/ memory directory and technique-triage.json loop were never created despite scripts referencing them — any script touching radarDir silently no-ops or errors on a fresh clone
type: lesson
status: promoted
source: human
reviewed_by: radar-pass
created: 2026-07-24
updated: 2026-07-24
tags: [radar, memory, setup, mcp-tools, harness-bootstrap]
---

# radar/ directory was never bootstrapped despite script references

- **Context:** Running `ai-techniques-radar` skill or any MCP tool that touches `memory/radar/` (mcp-tools.mjs, memory-link-index.mjs, mcp-contracts.mjs).
- **Symptom:** The scripts reference `radarDir` and enumerate `memory/radar/` but the directory did not exist. Git history search across all branches (including the v1.1.0 sync PR #1146 in sc-fleet-manager) confirmed no commit ever created `README.md`, `_template.md`, or `technique-triage.json`. The `radar/` folder in harness-kit was an empty ghost.
- **Cause:** The v1.1.0 sync wired `radarDir` into scripts but the memory directory structure and triage loop were never authored. The ai-techniques-radar skill requires these files before it can operate.
- **Fix / approach that worked:** Manually create: (1) `.github/harness/memory/radar/README.md`, (2) `.github/harness/memory/radar/_template.md`, (3) `.github/harness/loops/technique-triage.json`. These are now in the repo.
- **Why it matters:** Any harness-bootstrap of a new project will silently skip radar functionality until these three files are present. The `setup-harness-bootstrap` skill should explicitly check for them.
