---
summary: "P0-2 Harness Health Command Implementation - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [harness, health]
---
# P0-2 Harness Health Command Implementation - 2026-07-27
resource: .github/harness/memory/briefs/p0-2-harness-health-command-brief-2026-07-27.md, scripts/harness/health.mjs, package.json, SETUP.md

## Implementation Summary

### Delivered
- Added unified health command script at `scripts/harness/health.mjs`.
- Added `harness:health` script to `package.json`.
- Added health command examples in `SETUP.md` verification section.

### Contract adherence
- Brief followed: command aggregation uses existing checks as subprocesses.
- Required vs warning semantics implemented per brief contract.
- Exit behavior implemented: non-zero only when required checks fail.

### Proof summary
- `npm run harness:docs:check` => OK.
- `npm run harness:config:self-test` => PASS.
- `npm run harness:health -- --fast` => PASS.
- `npm run harness:health -- --fast --json` => `{ ok: true }` with required checks only.
- `npm run harness:health` => PASS with graph status reported as warning.
- `npm run harness:health -- --json` => `{ ok: true, warnings: 1 }` (graph stale/degraded warning).

### Change summary
CHANGES MADE:
- scripts/harness/health.mjs: new aggregator command with `--fast`, `--json`, deterministic exit semantics, and per-check reporting.
- package.json: added `harness:health` command.
- SETUP.md: added quick examples for `harness:health` fast and json usage.

THINGS I DIDN'T TOUCH (intentionally):
- scripts/harness/graph.mjs: graph status semantics preserved and treated as warning in aggregator.
- scripts/harness/validate-doc-contracts.mjs: docs contract logic reused as-is.
- scripts/harness/config-self-test.mjs: config validation proof surface reused unchanged.

POTENTIAL CONCERNS:
- JSON mode includes full stdout/stderr payloads which may be verbose in CI logs.

### Assumptions or deviations
- [UNVERIFIED] Operators may later request strict graph mode; this pass intentionally keeps graph as warning-only.
- No deviations from brief boundaries.
