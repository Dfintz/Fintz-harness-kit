---
summary: "Architecture Brief - T4 DEP0190 cmd-shim hardening"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [architecture, t4, dep0190, windows]
---
# Architecture Brief - T4 DEP0190 cmd-shim hardening
resource: .github/harness/memory/briefs/t4-dep0190-hardening-understand-2026-08-05.md, scripts/harness/lurkr-core.mjs, scripts/harness/lurkr-diff.mjs

## Objective
- Remove Node `DEP0190` warning from Windows scanner execution path without weakening scanner-command safety controls.

## Scope
- In scope:
  - adjust scanner invocation logic in `lurkr-core` for npx command path.
  - preserve existing parsing and token safety checks.
  - validate via production diff run.
- Out of scope:
  - replacing Lurkr itself.
  - changing CI policy defaults in this task.

## Artifacts to modify
- `scripts/harness/lurkr-core.mjs`

## Artifacts to validate
- `scripts/harness/lurkr-diff.mjs` execution path
- `.github/harness/runs/t4-lurkr-diff-production-main.json`

## Key decisions
- Detect npx executable variants and rewrite execution to direct Node invocation of npm CLI (`node <npm-cli.js> exec -- ...`) so no shell fallback is needed.
- Keep shell disabled in scanner execution path.
- Keep `assertSafeCommand` unchanged as mandatory guard.

## Constraints
- no broad refactor of `lurkr-diff`.
- preserve current output report schema.

## Validation plan
- `node --check scripts/harness/lurkr-core.mjs`
- `node --check scripts/harness/lurkr-diff.mjs`
- set `HARNESS_LURKR_COMMAND="npx lurkr scan ."`
- run production evidence command and confirm terminal output no longer includes `DEP0190` warning.

## Do NOT
- Do NOT introduce shell-based execution fallback for npx path.
- Do NOT relax safe-token regex constraints.

## Assumptions and risks
- [UNVERIFIED] npm CLI location relative to `process.execPath` is stable on operator machines.
- [UNVERIFIED] static analyzer PATH warnings for process launch remain a known environmental lint limitation.

## Architectural gates
- Gate 1: PASS
- Gate 2: PASS
- Gate 3: PASS
- Gate 4: PASS
- Gate 4b: PASS
- Gate 5: PASS
