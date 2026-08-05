---
summary: "Implementation Summary - T2/T3/T7/T8 remediation"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [t2, t3, t7, t8, implementation]
---
# Implementation Summary - T2/T3/T7/T8 remediation
resource: .github/harness/memory/briefs/t2-t3-t7-t8-remediation-architecture-2026-08-05.md, scripts/harness/file-search.mjs, scripts/harness/run-loop.mjs, scripts/harness/t7-roi-evaluate.mjs, scripts/harness/t8-benchmark-gap-evaluate.mjs

## Delivered
- T7 default packet is included as a repository artifact; test invokes the default evaluator path.
- T7 only credits recovery latency and complexity when the packet explicitly supplies observations.
- T8 evaluates selected evidence per source and rejects an input set containing any invalid source.
- T2 selects eval-pilot JSON through the repository manifest allowlist.
- T3 tokenizes validated agent commands and launches without shell interpretation.
- T2-T6 aliases name existing executable ticket surfaces; T1 remains intentionally unmapped because `mcp-cache.mjs` is a library, not a CLI.

## Proof
- `npm run test:harness:continue-as-new:roi` -> PASS (7/7).
- `npm run test:harness:hybrid-fusion:benchmark-gap` -> PASS (11/11).
- External T2 JSON path -> rejected with `eval set must resolve under allowlist root`.
- `node --check scripts/harness/run-loop.mjs` -> PASS.
- `node scripts/harness/command-validation.mjs --self-test` -> PASS.
- `npm run harness:commands:check` -> PASS.
- `git diff --check` -> PASS.

## Self-review
- No runtime retrieval ranking or loop lifecycle behavior changed.
- T3 legacy file-management analyzer findings remain outside the shell-execution scope; the command-injection finding no longer appears after this change.