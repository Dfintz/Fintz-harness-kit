---
summary: "Architecture Brief - closure for adoption slices 6-8"
type: brief
status: active
source: implementation
created: 2026-08-06
updated: 2026-08-06
tags: [harness, adoption, shortcuts, journal-retention, hook-guard, 2026]
---
# Architecture Brief - closure for adoption slices 6-8
resource: scripts/harness/shortcut-generator.mjs, scripts/harness/journal-retention.mjs, scripts/harness/hook-command-guard.mjs, scripts/harness/test/adoption-slices-test.mjs, package.json, docs/harness/COMMAND_INDEX.md

## Task
Complete and verify backlog slices 6-8: shortcut pinning, bounded journal retention policy, and cross-provider hook command guard strategy.

## Understand findings
- Graph gate status: ready and fresh.
- Slice implementation presence:
  - shortcuts: present (`shortcut-generator.mjs`, script alias already present).
  - retention policy: present (`journal-retention.mjs`, deterministic plan output).
  - hook guard strategy: core renderer present; CLI/script discoverability and stronger cross-platform tests needed.

## Architectural gates
- Gate 1 (Domain alignment): PASS
- Gate 2 (Generality): PASS
- Gate 3 (Ownership): PASS
- Gate 4 (Boundary integrity): PASS
- Gate 4b (Isolation/safety): PASS
- Gate 5 (Reuse): PASS

## Decisions
1. Keep existing slice 6 and 7 behavior intact; treat them as implemented and validated.
2. Close remaining operational gap for slice 8 by adding a CLI surface and package script alias for hook command guard.
3. Strengthen deterministic cross-platform quoting coverage in adoption tests.
4. Keep all changes additive and low-risk.

## Constraints
- Preserve existing helper semantics for quoting and retention planning.
- Avoid shell execution side-effects; only render safe command strings.
- Keep command documentation synchronized with script aliases.

## Do-NOTs
- Do not introduce automatic destructive retention pruning in this pass.
- Do not alter route policy behavior while working on adoption slices.

## Assumptions
- Plan-only retention is acceptable for this slice definition.
- Hook-command rendering utility is intended to be consumed by wrappers/hooks, not to execute commands itself.

## Exit criteria
1. `test:harness:adoption` passes.
2. `harness:docs:check` and `harness:commands:check` pass.
3. No diagnostics in changed files.
4. Command index reflects adoption command surfaces for slices 6-8.