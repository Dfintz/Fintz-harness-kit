---
summary: "Implementation Summary - T4 DEP0190 cmd-shim hardening"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [implement, t4, dep0190]
---
# Implementation Summary - T4 DEP0190 cmd-shim hardening
resource: scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-diff.mjs, .github/harness/runs/t4-lurkr-diff-production-main.json

## Changes implemented
1. Added npx rewrite path in `lurkr-core`:
- Detects `npx` executable variants.
- Rewrites execution to `process.execPath` with npm CLI args: `npm exec -- <args>`.
- Keeps `shell: false` for scanner execution.

2. Preserved safety controls:
- Existing argument parsing and safe-token checks unchanged.

## Validation executed
- `node --check scripts/harness/lurkr-core.mjs` -> pass
- `node --check scripts/harness/lurkr-diff.mjs` -> pass
- `HARNESS_LURKR_COMMAND="npx lurkr scan ."`
- `npm run harness:security:lurkr:diff -- --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-production-main.json` -> pass, no `DEP0190` warning printed in final run output.

## Evidence artifact
- `.github/harness/runs/t4-lurkr-diff-production-main.json` regenerated with current run timestamp.
