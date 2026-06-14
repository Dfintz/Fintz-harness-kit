---
name: harness
description: >-
  Project-agnostic AI agent harness for driving non-trivial work to done. Provides a workflow
  stage machine (Understand → Architect → Implement → Review-Breadth → Review-Depth → Feedback)
  with five architectural gates, plus three loop kinds: convergence (iterate until lint/type/build/test
  are green), workflow (rubric-graded passes like review-fix / feature-cycle / ci-green), and
  autoresearch-style experiment loops (hill-climb a numeric metric, keep-if-improved else revert).
  Loop agents can run on a local model via Ollama or LM Studio. Includes committed memory (lessons +
  Architecture Briefs), an optional knowledge-graph, a read-only MCP server, and a live metrics
  dashboard. USE WHEN the user asks to run a harness loop, iterate until checks pass, fix
  build/type/lint/test failures, drive CI to green, keep reviewing until clean, optimize a numeric
  metric (lint warnings, bundle size, coverage) with a local LLM, plan a non-trivial change through
  gated stages, record or recall a hard-won lesson, or set up the harness in a repository.
---

# AI Agent Harness

A repository-level operating contract: it tells any AI coding agent **what to load, what sequence to
follow, and how to iterate until done**. It is project-agnostic — project-specific commands come from
`harness.config.json`.

## When this skill applies

A task is **non-trivial** (use the full workflow) when it touches more than one file, changes
APIs / shared types / routes / database behavior, or touches auth, security, tenancy, caching, or
infrastructure. Trivial one-file typo/doc fixes may skip straight to Implement.

## Authority chain

When guidance conflicts, higher wins: (1) the project's own coding-standards docs → (2)
`.github/instructions/0*.md` workflow stages → (3) domain skills → (4) this harness (orchestration
only — it never overrides standards, it tells you *when* to apply which document).

## Workflow stage machine

```
0 UNDERSTAND → 1 ARCHITECT → 2 IMPLEMENT → 3 REVIEW (breadth) → 4 REVIEW (depth) → 5 FEEDBACK
                                  ▲                                   │
                                  └──── Blocker/Major findings ───────┘
```

| # | Stage | Instruction | Output |
|---|-------|-------------|--------|
| 0 | Understand | `.github/instructions/02-UNDERSTAND-WORKFLOW.md` | component/layer impact map + graph status |
| 1 | Architect | `.github/instructions/03-ARCHITECT.md` | Architecture Brief (gates 1–5) |
| 2 | Implement | `.github/instructions/04-IMPLEMENT.md` | code + self-review checklist |
| 3 | Review breadth | `.github/instructions/05-REVIEW-BREADTH.md` | severity-tagged findings |
| 4 | Review depth | `.github/instructions/06-REVIEW-DEPTH.md` | gate verdicts + structural findings |
| 5 | Feedback | `.github/instructions/07-FEEDBACK.md` | verdict table + updated Brief |

The five gates (run at stages 1 and 4): Domain Alignment, Generality, Data Ownership, Layer
Boundaries, Reuse (plus 4b Multi-Tenant Isolation where applicable). Read
`.github/harness/HARNESS.md` for the full contract and `.github/harness/LOOPS.md` for the loop
protocol.

## The three loop kinds

```
convergence   run until pass/fail checks are all green        (build-fix, test-fix)
workflow      run rubric-graded passes to a terminal state    (review-fix, feature-cycle, ci-green)
experiment    hill-climb a numeric metric, keep-if-improved   (lint-debt-experiment)  ← autoresearch
```

Loop definitions live in `.github/harness/loops/*.json` and reference `{{tokens}}` resolved from
`harness.config.json`.

## Running it (engine commands)

The runnable engine ships with the harness-kit under `scripts/harness/`. Core commands:

```bash
node scripts/harness/run-loop.mjs --list                 # list loops
node scripts/harness/run-loop.mjs build-fix --agent "<agent CLI>"   # convergence loop
node scripts/harness/run-experiment.mjs lint-debt-experiment --measure-only   # baseline a metric
node scripts/harness/harness-report.mjs                  # write the metrics dashboard
node scripts/harness/report-server.mjs                   # serve it at http://localhost:8099
```

### Local-LLM loop agents (optional)

Convergence loops only need an agent to *describe* a fix; experiment loops re-measure files on disk,
so they need the **apply** agent that rewrites the single declared target. Both target Ollama
(default) or LM Studio (`--provider lmstudio`):

```bash
node scripts/harness/run-experiment.mjs lint-debt-experiment \
  --agent "node scripts/harness/ollama-apply-agent.mjs --model qwen2.5-coder:14b"
```

The runner reverts any edit that doesn't improve the metric, so letting a small local model rewrite
a file is safe by construction.

## Memory (read at session start, write before session end)

Before discovery, consult `.github/harness/memory/` — `lessons/` (one hard-won fact per file; scan
the first lines) and `briefs/` (persisted Architecture Briefs). Write a lesson when you discover
something non-obvious that cost real effort and the repo's docs don't already record. Never store
secrets — the directory is committed. Protocol: `.github/harness/memory/README.md`.

## MCP tools (read-only)

`scripts/harness/mcp-server.mjs` exposes 15 stdio tools — knowledge graph, memory, vector search,
plus `harness-loops` (catalog) and `harness-report` (metrics). Loop *execution* stays CLI-only on
purpose (it invokes an agent and runs for minutes). Register via `.vscode/mcp.json` or the equivalent
in your agent's MCP config.

## Setup

If this repository hasn't adopted the harness yet, follow `SETUP.md`: copy the kit scaffold, edit
`harness.config.json` to point at the project's lint/type/build/test commands, and verify with
`node scripts/harness/run-loop.mjs --list`. The validation matrix and gates are stack-agnostic.
