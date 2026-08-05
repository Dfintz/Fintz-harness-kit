---
summary: "Wayfinder Decision Map - External Ideas to Harness Tickets"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [wayfinder, decision-map, radar, tickets]
---
# Wayfinder Decision Map - External Ideas to Harness Tickets

Resource: .github/harness/memory/briefs/wayfinder-radar-expansion-2026-08-05.md

## Objective

- Convert large external discovery scope into executable, bounded tickets.
- Sequence by risk-first and smallest safe slice.

## Inputs covered

- Orchestration and durability: langgraph, temporal, deepagents, SWE-agent, gpt-researcher, grok-build, qm.
- Memory and retrieval: graphrag, HippoRAG, graphiti, TencentDB-Agent-Memory, codebase-memory-mcp, KGGen, Anthropic cookbooks.
- Safety and workflow quality: mattpocock, obra, disler, codex-security, no-ai-slop, oh-my-pi, awesome-harness-engineering, best-of-Agent-Harnesses.

## Ticket topology

- Pattern: Supervisor + expert-pool fan-out/fan-in.
- Supervisor artifact: this decision map.
- Expert lanes: orchestration, memory/retrieval, security/quality.

## Prioritized ticket queue

1. T1 - Prompt-prefix caching activation path

- Type: task
- Status: ready
- Why first: low-risk, low-complexity, cost/perf win.
- Target surfaces: scripts/harness/llm-provider.mjs, scripts/harness/mcp-cache.mjs, harness.config.json.
- Exit criteria: optional provider-flagged cache path and deterministic docs alignment.

1. T2 - Contextual embeddings ingestion pilot

- Type: prototype
- Status: ready
- Why second: high upside for retrieval quality, bounded to ingestion.
- Target surfaces: scripts/harness/doc-ingest.mjs, scripts/harness/file-search.mjs.
- Exit criteria: measurable improvement in retrieval precision on harness eval prompts.

1. T3 - Lease/heartbeat loop envelope

- Type: task
- Status: ready
- Why third: reliability and stuck-run recovery for long loops.
- Target surfaces: scripts/harness/run-loop.mjs, scripts/harness/experiment-loop.mjs, scripts/harness/phase5c-live-monitor.mjs.
- Exit criteria: terminal-state clarity with heartbeats and deterministic expiry handling.

1. T4 - Differential security scan workflow

- Type: task
- Status: ready
- Why fourth: strengthen pre/post security drift detection.
- Target surfaces: scripts/harness/lurkr-check.mjs, SETUP.md, .github/instructions/05-REVIEW-BREADTH.md.
- Exit criteria: repeatable before/after findings report path with optional CI integration.

1. T5 - Memory graph persistence hardening

- Type: research -> task
- Status: ready
- Why fifth: architectural gain but needs careful stale-graph controls.
- Target surfaces: scripts/harness/graph-provider.mjs, scripts/harness/graph-refresh-loop.mjs, scripts/harness/graph.mjs.
- Exit criteria: freshness checks and fallback behavior documented and tested.

1. T6 - Teach-agent anti-slop doc linting policy

- Type: task
- Status: ready
- Why sixth: quick communication-quality gain.
- Target surfaces: scripts/harness/doc-verifier.mjs, .github/skills/teach-agent/SKILL.md.
- Exit criteria: deterministic doc checks that reduce generic language patterns.

1. T7 - Temporal-style continue-as-new model

- Type: research
- Status: parked-until-capacity
- Why later: higher complexity and lifecycle impact.
- Target surfaces: scripts/harness/run-loop.mjs, scripts/harness/harness-mcp-tasks.mjs.
- Exit criteria: architecture proof showing ROI over current loop model.

1. T8 - Hybrid fusion retrieval (semantic + lexical)

- Type: research
- Status: in-progress-research-kickoff (runtime implementation gated; current disposition PARK)
- Why later: extra infra complexity.
- Target surfaces: scripts/harness/file-search.mjs, scripts/harness/graph-provider.mjs.
- Exit criteria: benchmark evidence semantic-only fails target thresholds.

## Watchlist (monitor-only)

- openworker, turbo-fieldfare, graphbit, HippoRAG, graphiti, T3MP3ST, nativ.
- Rule: capture in radar with candidate status and no implementation claim until concrete harness benefit is proven.

## Source disposition appendix (requested comprehensive coverage)

| Source | Disposition | Notes |
| --- | --- | --- |
| github.com/mattpocock | adopt | Wayfinder and review/process patterns already align with harness flow. |
| github.com/obra | park | Session-start hook patterns valuable but platform-specific; pilot later. |
| github.com/disler | adopt | Deterministic orchestration and lifecycle guard ideas map to acceptance/loop surfaces. |
| github.com/rtk-ai/rtk | monitor | Interesting token-efficiency direction; no immediate harness integration surface selected. |
| github.com/DeusData/codebase-memory-mcp | adopt | Persistent memory graph directly maps to graph-provider and refresh surfaces. |
| github.com/xai-org/grok-build | park | Toolset partitioning useful, but partial overlap with current routing policies. |
| github.com/yc-software/qm | adopt | Lease/heartbeat/reaper pattern selected for T3 reliability ticket. |
| github.com/andrewyng/openworker | monitor | Keep on watchlist for workflow-runtime evolutions. |
| github.com/drumih/turbo-fieldfare | monitor | Runtime optimization focus is lower priority for current harness mission. |
| github.com/Blaizzy/nativ | monitor | Explore later for lightweight agent-runtime interfaces. |
| github.com/openai/codex-security | adopt | Differential security scanning selected for T4. |
| github.com/elder-plinius/T3MP3ST | park | Reproducibility discipline is useful; offensive/specialized patterns not default-fit. |
| github.com/petergyang/no-ai-slop | adopt | Warning-first doc quality linting selected for T6. |
| github.com/can1357/oh-my-pi | park | Hashline and protocol ideas promising but higher integration complexity. |
| github.com/ai-boost/awesome-harness-engineering | monitor | Discovery catalog reference; use as periodic radar intake source. |
| ryanalberts.github.io/best-of-Agent-Harnesses | monitor | Discovery catalog reference; use as periodic radar intake source. |
| github.com/langchain-ai/langgraph | adopt | Checkpoint/interrupt patterns inform reliability tickets. |
| github.com/temporalio/temporal | park | High-complexity durability model, keep as research-first path (T7). |
| github.com/SWE-agent/mini-swe-agent | adopt | Trajectory/progress ideas support observability improvements. |
| github.com/assafelovic/gpt-researcher | adopt | Budgeted planner-executor principles align with budget-aware execution. |
| github.com/langchain-ai/deepagents | adopt | Parallel local-context discovery and gating concepts are transferable. |
| github.com/InfinitiBit/graphbit | monitor | Runtime architecture ideas noted; no immediate fit selected. |
| github.com/microsoft/graphrag | monitor | Valuable retrieval patterns; defer until ticketed benchmark need appears. |
| github.com/OSU-NLP-Group/HippoRAG | monitor | Research-quality retrieval approach to evaluate in later wave. |
| github.com/getzep/graphiti | monitor | Temporal graph memory model noted for future exploration. |
| github.com/anthropics/anthropic-cookbooks | adopt/park | Adopt contextual embeddings (T2); park fusion retrieval (T8). |
| github.com/stair-lab/kg-gen | park | Schema-constrained KG extraction is promising but high-complexity now. |
| github.com/TencentCloud/TencentDB-Agent-Memory | monitor | Memory architecture reference; keep in watchlist until clear gap emerges. |

## Execution cadence

- Wave 1 (quick wins): T1, T6.
- Wave 2 (quality/reliability): T2, T3, T4.
- Wave 3 (structural evolution): T5.
- Wave 4 (advanced optional): T7, T8.

## Risk controls

- No tool-permission expansion without explicit approval.
- Each ticket starts with Understand graph gate and brief.
- Each ticket must end with review breadth, review depth, and feedback artifacts.
