---
summary: "Feedback Verdict Record — deeper source audit of SSSF and fusion-harness"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [research, audit, feedback, 2026]
---
# Feedback Verdict Record — deeper source audit of SSSF and fusion-harness

resource: .github/harness/memory/briefs/external-harness-source-audit-2026-08-03.md, .github/harness/memory/briefs/external-harness-source-audit-implementation-2026-08-03.md, .github/harness/memory/briefs/external-harness-source-audit-review-breadth-2026-08-03.md, .github/harness/memory/briefs/external-harness-source-audit-review-depth-2026-08-03.md

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | The README-only recommendations needed source-level confirmation before any further adoption decision. | Challenge upheld and resolved | Inspected SSSF runtime files, inspected fusion-harness runtime and prompt files, revised source-audit brief | HIGH | Replaced README-only assumptions with source-backed findings and refreshed the recommendation rationale. |
| 2 | Slice D was initially too broad for the repo's current execution boundaries. | Challenge upheld and resolved | Architect challenge, `run-loop.mjs`, `run-experiment.mjs`, `harness-evolve.mjs`, revised source-audit brief | HIGH | Narrowed Slice D to isolated worktrees or manifest-bounded subprocess targets only, and required reuse of existing integrity primitives. |
| 3 | Source inspection might justify adopting SSSF typed envelopes or fusion session persistence more aggressively. | Current decision holds | SSSF `data_types.py`, fusion `fusion-harness.ts`, depth review ledger | HIGH | Keep typed-envelope parity parked and keep Pi-specific persistence/UI mechanisms rejected for harness-core adoption. |

## Accepted changes

- The prior recommendation order remains valid: gate-first acceptance, unified run bundle, consensus/divergence ledger.
- Source inspection adds a new, narrower fourth candidate: mutation auditing for isolated or manifest-bounded spawned-agent workflows only.
- Gate-first acceptance is now defined more precisely around immutable validator-owned artifacts, red-baseline proof, bounded escalation, and audited repair.

## Rejected challenges

- None.

## Deferred points

- Full live execution of the external repos remains deferred; this run is source-level, not trace-level.
- Any implementation of Slice D should be preceded by a concrete ownership decision about which harness subprocess flows are isolated enough to support safe rollback.

## Brief updates

- Decisions changed: added narrowed Slice D as a fourth candidate and sharpened Slice A with stronger validator/gate semantics.
- Constraints updated: mutation auditing is limited to isolated or manifest-bounded subprocess scopes only.
- Do NOT rules updated: no rollback from mixed dirty worktrees, no generic audit plane across all runtimes, no forced typed-envelope adoption.
- Assumptions retired or added: README-only uncertainty was reduced for inspected mechanisms; full execution-trace uncertainty remains.

## Response notes

- The deeper audit strengthens the existing recommendations more than it changes them.
- fusion-harness contributes a sharper gate-first contract; SSSF contributes stronger evidence for deterministic code phases, durable traces, and post-factum write enforcement.
- The only materially new recommendation is the narrowed subprocess mutation-audit candidate, and even that remains deliberately behind the top three operator-facing improvements.
