---
summary: "Implementation Summary - T4 Production Security Evidence + CI Optional Gates"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [implement, t4, security, ci]
---
# Implementation Summary - T4 Production Security Evidence + CI Optional Gates
resource: scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-diff.mjs, .github/workflows/harness-optional-security-gates.example.yml, .github/harness/runs/t4-lurkr-diff-production-main.json

## Implemented changes
1. Live-branch production evidence execution
- Set session scanner command to `npx lurkr scan .` and ran:
  - `npm run harness:security:lurkr:diff -- --base HEAD~1 --output .github/harness/runs/t4-lurkr-diff-production-main.json`
- Produced report artifact with refs, scan diagnostics, and deterministic drift section.

2. Scanner execution hardening and compatibility
- `lurkr-core` now resolves Windows executables with `where` and supports cmd/bat shim invocation path.
- `lurkr-diff` records `spawnError` for failed scanner execution diagnostics.

3. Deterministic drift normalization
- `lurkr-diff` filters volatile npm log file path lines from normalized outputs to prevent false drift due to timestamped log locations.

4. CI optional-gates enablement + drift artifact capture
- Updated example workflow env toggle:
  - `HARNESS_ENABLE_OPTIONAL_SECURITY_GATES: "true"`
- Added optional steps:
  - `Lurkr differential drift report (optional)`
  - `Upload Lurkr drift report artifact (optional)`

## Validation evidence
- `node --check scripts/harness/lurkr-core.mjs`: pass
- `node --check scripts/harness/lurkr-diff.mjs`: pass
- production diff command run: completed, report emitted
- report: `.github/harness/runs/t4-lurkr-diff-production-main.json`

## Self-review checklist
- Optional policy preserved: yes
- Backward compatibility preserved: yes
- Deterministic evidence path present: yes
- Operator diagnostics improved: yes
