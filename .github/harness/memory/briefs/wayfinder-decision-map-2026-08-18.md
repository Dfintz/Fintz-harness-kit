---
summary: "Wayfinder Decision Map - Token/Context/Memory Radar Batch to Harness Tickets"
type: brief
status: active
source: human
created: 2026-08-18
updated: 2026-08-18
tags: [wayfinder, decision-map, radar, tickets, context-engineering]
---
# Wayfinder Decision Map - Token/Context/Memory Radar Batch to Harness Tickets

Resource: .github/harness/memory/briefs/radar-batch-governance-gate-and-token-hardening-2026-08-18.md, .github/harness/memory/radar/anthropic-context-compaction.md, .github/harness/memory/radar/manus-kv-cache-stable-prefix.md, .github/harness/memory/radar/anthropic-agentic-memory-file-notes.md, .github/harness/memory/radar/manus-recitation-attention-bias.md, .github/harness/memory/radar/coleam00-dark-factory-protected-governance-files-gate.md, .github/harness/memory/radar/coleam00-dark-factory-dispatcher-priority-order.md

## Objective

- Chart the remaining open work from the 2026-08-18 token/context/memory/recursion radar sweep into a bounded, sequenced ticket queue, following the same decision-map/30-60-90 pattern used for the 2026-08-05 wayfinder radar expansion.
- One ticket already shipped in the prior pass (protected-governance-files gate) is recorded here as complete for continuity, not re-planned.

## Inputs covered

- Anthropic context-engineering post: compaction, structured note-taking / agentic memory, sub-agent isolation.
- Manus context-engineering post: KV-cache stable-prefix design, mask-don't-remove tools, recitation (attention manipulation via todo rewriting).
- coleam00/skills `build-dark-factory`: protected-governance-files gate (shipped), dispatcher-priority-order (still parked, no dispatcher exists).

## Ticket topology

- Pattern: single-owner, small-slice tickets — this batch has no multi-agent fan-out need.
- Supervisor artifact: this decision map.
- Lanes: loop-context-growth (compaction), llm-provider-hardening (KV-cache), memory-surfaces (agentic notes), loop-prompting (recitation), governance (gate — complete).

## Prioritized ticket queue

1. T1 - Protected-governance-files gate CI rollout decision

- Type: task
- Status: gate shipped (warn-mode) 2026-08-18; this ticket covers only the *strict-mode adoption* decision, not re-implementation.
- Why first: lowest risk, tool already exists and is self-tested; only remaining work is a go/no-go on wiring `harness:protected-paths:check --strict` into `harness:docs:check` or CI.
- Target surfaces: `package.json` (`harness:docs:check`, `test:harness:core`), `.github/workflows/*.yml` (optional example workflow), `scripts/harness/protected-path-guard.mjs` (no code changes expected).
- Exit criteria: an explicit recorded decision (adopt-strict / stay-warn) backed by at least one real warn-mode run's evidence from a legitimate governance-file change, plus (if adopting strict) a documented `--allow` escape-hatch runbook step.

1. T2 - Loop context-growth tripwire (operationalize "measure first")

- Type: task
- Status: ready
- Why second: the 2026-08-18 brief's compaction/KV-cache findings were a one-time measurement; without a standing check, a future loop could silently grow past the point where compaction becomes necessary and nobody would notice.
- Target surfaces: `scripts/harness/run-experiment.mjs` (`composeImprovementPrompt`), `scripts/harness/plan-review.mjs` (`composeReviewerPrompt`), `scripts/harness/llm-provider.mjs` (`recordMetrics`, `extractUsage` already capture `promptTokens`).
- Exit criteria: prompt-token count from `extractUsage`/metrics file is compared against a configurable soft threshold at the end of each experiment/review run; crossing it emits a warning (not a block) naming which loop and which artifact (`anthropic-context-compaction.md`) to reopen.

1. T3 - Context compaction implementation (compaction entry)

- Type: task, gated
- Status: parked-until-trigger
- Why later: `anthropic-context-compaction.md`'s own measurement (2026-08-18) found no current loop needs it; building it now is speculative.
- Trigger condition: T2's tripwire fires on a real loop run, OR a human names a specific loop whose context has grown unmanageable.
- Target surfaces: `scripts/harness/run-experiment.mjs`, `scripts/harness/plan-review.mjs`, `.github/harness/loops/*.json` (optional per-loop compaction directive).
- Exit criteria: compaction prompt tuned against a real captured trace from the triggering loop, not a synthetic example; must preserve architectural decisions/unresolved issues per the Anthropic pattern.

1. T4 - KV-cache hardening re-audit tripwire (stable-prefix entry)

- Type: research (monitor-only, no code now)
- Status: watchlist
- Why later: `manus-kv-cache-stable-prefix.md`'s 2026-08-18 audit found no violation; the only future risk is if `llm-provider.mjs` ever gains a tool-calling schema (dynamic tool lists are the one failure mode that doesn't yet apply here because there is no tool-calling schema).
- Trigger condition: any PR adds tool/function-calling definitions to `llm-provider.mjs`.
- Target surfaces: `scripts/harness/llm-provider.mjs`.
- Exit criteria: re-run the same three-failure-mode audit from the 2026-08-18 brief against the new tool-calling code before merge.

1. T5 - Agentic memory scratch-file pilot (structured note-taking entry)

- Type: prototype
- Status: parked-until-trigger
- Why later: `anthropic-agentic-memory-file-notes.md` is parked pending a loop that shows measurable drift or repeated re-discovery of the same state across turns; no such loop is currently known.
- Trigger condition: a long-running loop (candidate: `experiment-loop.mjs`'s unattended local-model loop) is observed re-deriving the same facts across iterations, evidenced by journal review.
- Target surfaces: `scripts/harness/experiment-loop.mjs` or `scripts/harness/run-experiment.mjs` (optional per-run scratch file, kept explicitly separate from committed `.github/harness/memory/` briefs/lessons/radar).
- Exit criteria: a bounded pilot on exactly one loop shows reduced repeated-discovery in its journal, with a retention/cleanup rule for the scratch file.

1. T6 - Recitation anti-drift pilot (attention-bias entry)

- Type: prototype
- Status: parked-until-trigger
- Why later: `manus-recitation-attention-bias.md` is parked pending observed goal drift in a long tool-call loop; no such drift is currently documented.
- Trigger condition: a long-running loop's journal shows the agent losing track of its original goal across iterations (evidenced, not assumed).
- Target surfaces: `.github/harness/loops/*.json` prompt text for the triggering loop only.
- Exit criteria: bounded recitation block (size-capped) added to that one loop's prompt; journal comparison shows reduced drift.

1. T7 - Dispatcher priority order (no ticket)

- Type: n/a
- Status: parked, no ticket opened
- Why: `coleam00-dark-factory-dispatcher-priority-order.md` has nothing to attach to — no autonomous dispatcher exists or is proposed. Left off the active queue per explicit instruction; revisit only if `harness-evolver-meta-harness` or an equivalent dispatcher idea is ever promoted.

## Completed (recorded for continuity, not re-planned)

- Protected-governance-files gate (`scripts/harness/protected-path-guard.mjs`) shipped 2026-08-18, warn-by-default, `--strict`/`HARNESS_ENABLE_PROTECTED_PATH_GATE` opt-in, audited `--allow` bypass. See `.github/harness/memory/briefs/radar-batch-governance-gate-and-token-hardening-2026-08-18.md`.

## Execution cadence

- Wave 1 (decision only, near-zero build cost): T1.
- Wave 2 (instrumentation, low risk): T2.
- Wave 3 (gated on real evidence — do not start early): T3, T5, T6.
- Watchlist (no work scheduled): T4, T7.

## Risk controls

- No tool-permission expansion without explicit approval.
- T3/T5/T6 must not start until their named trigger condition has real evidence — building any of them speculatively repeats the over-engineering mistake this batch's brief explicitly avoided.
- Each ticket that does proceed starts with an Understand graph gate and ends with review breadth, review depth, and feedback artifacts, per existing harness stage machine.
