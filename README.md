# AI Agent Harness Kit

A **project-agnostic** harness that gives any AI coding agent (Claude Code, GitHub Copilot, Codex,
Cursor, Gemini, …) a consistent operating contract: what to load, what sequence to follow, and how to
iterate until done — plus autonomous, metric-driven self-improvement loops that can run on a **local
LLM**, and a live metrics dashboard.

Extracted as a clean, reusable kit. See [`CREDITS.md`](CREDITS.md) for the prior work it builds on.

## What's inside

| Capability | Where | Notes |
| --- | --- | --- |
| **Workflow stage machine** | [`.github/harness/HARNESS.md`](.github/harness/HARNESS.md), [`.github/instructions/`](.github/instructions/) | Understand → Architect → Implement → Review (breadth+depth) → Feedback, with 5 architectural gates |
| **Convergence loops** | [`.github/harness/loops/`](.github/harness/loops/), [`run-loop.mjs`](scripts/harness/run-loop.mjs) | Iterate until checks (lint/type/build/test) go green |
| **Workflow loops** | same | Rubric-graded passes (review-fix, feature-cycle, ci-green) |
| **Experiment loops (autoresearch-style)** | [`run-experiment.mjs`](scripts/harness/run-experiment.mjs), [`experiment-loop.mjs`](scripts/harness/experiment-loop.mjs) | Hill-climb a numeric metric; keep-if-improved, else revert |
| **Local-LLM agents** | [`ollama-agent.mjs`](scripts/harness/ollama-agent.mjs), [`ollama-apply-agent.mjs`](scripts/harness/ollama-apply-agent.mjs) | Drive loops with a local model via Ollama |
| **Memory** | [`.github/harness/memory/`](.github/harness/memory/) | Committed lessons + Architecture Briefs (structure only — no lessons shipped) |
| **Knowledge graph** | [`graph-refresh-loop.mjs`](scripts/harness/graph-refresh-loop.mjs) | Optional structural memory (needs the Understand-Anything plugin) |
| **MCP server** | [`mcp-server.mjs`](scripts/harness/mcp-server.mjs) | Exposes graph/memory/vector tools over MCP |
| **Dashboard** | [`report-server.mjs`](scripts/harness/report-server.mjs) | Always-on HTML metrics dashboard |

## The three loop kinds

```
convergence   run until pass/fail checks are all green        (build-fix, test-fix)
workflow      run rubric-graded passes to a terminal state    (review-fix, feature-cycle, ci-green)
experiment    hill-climb a numeric metric, keep-if-improved   (lint-debt-experiment)   ← autoresearch-style
```

## Quick start

```bash
# 1. Point the harness at your project's commands.
cp harness.config.json harness.config.json   # then edit: project name + commands
node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"  # sanity-check

# 2. List and run a convergence loop (uses your configured commands).
npm run harness:loops
node scripts/harness/run-loop.mjs build-fix --agent "<your agent CLI>"

# 3. Record the baseline of an experiment metric (no agent needed).
node scripts/harness/run-experiment.mjs lint-debt-experiment --measure-only

# 4. See the dashboard.
npm run harness:report          # writes .github/harness/runs/report.html
npm run dashboard:up            # or serve it always-on at http://localhost:8099
```

Full adoption guide: [`SETUP.md`](SETUP.md). Loop protocol: [`.github/harness/LOOPS.md`](.github/harness/LOOPS.md).

## Autoresearch with a local model

```bash
# One bounded experiment, edits driven by a local model that actually rewrites the target file:
node scripts/harness/run-experiment.mjs lint-debt-experiment \
  --agent "node scripts/harness/ollama-apply-agent.mjs --model qwen2.5-coder:14b"

# Continuous overnight hill-climbing, committing each kept improvement:
npm run harness:experiment:ollama -- --commit
```

The apply-agent edits only the experiment's single declared `target`; the runner re-measures and
reverts anything that doesn't improve the metric — so letting a small local model rewrite a file is
safe by construction.

## Requirements
- Node.js ≥ 20 (uses built-in `fetch`; no install needed for the core loops).
- Optional: Docker (dashboard/graph sidecars), Ollama (local-LLM loops), the Understand-Anything
  plugin (knowledge graph).

## License
MIT — see [`LICENSE`](LICENSE) and [`CREDITS.md`](CREDITS.md).
