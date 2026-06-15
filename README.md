# AI Agent Harness Kit

A **project-agnostic** harness that gives any AI coding agent (Claude Code, GitHub Copilot, Codex,
Cursor, Gemini, …) a consistent operating contract: what to load, what sequence to follow, and how to
iterate until done — plus autonomous, metric-driven self-improvement loops that can run on a **local
LLM**, and a live metrics dashboard.

Extracted as a clean, reusable kit. See [`CREDITS.md`](CREDITS.md) for the prior work it builds on,
and [`HARNESS_CARD.md`](HARNESS_CARD.md) for the one-page control/agency/runtime design summary.

## Install

The kit is packaged as an [Agent Skill](https://agentskills.io/) and a Claude Code plugin, so it
installs into 70+ agents (Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Cline, …)
without copying folders by hand.

```bash
# Any of 70+ agents, via the open Agent Skills CLI (-g installs globally for your user):
npx skills add <owner>/harness-kit -g

# A specific agent (or several):
npx skills add <owner>/harness-kit -g -a github-copilot -a claude-code

# Or from a local checkout of this kit:
npx skills add ./harness-kit --list      # discover, then add --skill harness to install
```

```text
# Claude Code, via the native plugin marketplace (auto-updates):
/plugin marketplace add <owner>/harness-kit
/plugin install harness-kit
```

**Two layers, on purpose.** The skill above is the **playbook** — it teaches the agent the harness
contract (stages, gates, loops, memory) and is enough for guidance in any repo. The **runnable
engine** (the `scripts/harness/*.mjs` loop runners, dashboard, and MCP server) ships with the kit
files; get it by either installing the Claude Code **plugin** (bundles everything) or adopting the
kit scaffold per [`SETUP.md`](SETUP.md). Replace `<owner>/harness-kit` with wherever you publish this
kit.

## What's inside

| Capability                                | Where                                                                                                                      | Notes                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Workflow stage machine**                | [`.github/harness/HARNESS.md`](.github/harness/HARNESS.md), [`.github/instructions/`](.github/instructions/)               | Understand → Architect → Implement → Review (breadth+depth) → Feedback, with 5 architectural gates |
| **Convergence loops**                     | [`.github/harness/loops/`](.github/harness/loops/), [`run-loop.mjs`](scripts/harness/run-loop.mjs)                         | Iterate until checks (lint/type/build/test) go green                                               |
| **Workflow loops**                        | same                                                                                                                       | Rubric-graded passes (review-fix, feature-cycle, ci-green)                                         |
| **Experiment loops (autoresearch-style)** | [`run-experiment.mjs`](scripts/harness/run-experiment.mjs), [`experiment-loop.mjs`](scripts/harness/experiment-loop.mjs)   | Hill-climb a numeric metric; keep-if-improved, else revert                                         |
| **Local-LLM agents**                      | [`ollama-agent.mjs`](scripts/harness/ollama-agent.mjs), [`ollama-apply-agent.mjs`](scripts/harness/ollama-apply-agent.mjs) | Drive loops with a local model via **Ollama** or **LM Studio** (`--provider`)                      |
| **Memory**                                | [`.github/harness/memory/`](.github/harness/memory/)                                                                       | Committed lessons + Architecture Briefs (structure only — no lessons shipped)                      |
| **Knowledge graph**                       | [`graph-refresh-loop.mjs`](scripts/harness/graph-refresh-loop.mjs)                                                         | Optional structural memory (needs the Understand-Anything plugin)                                  |
| **MCP server**                            | [`mcp-server.mjs`](scripts/harness/mcp-server.mjs)                                                                         | Exposes 15 graph/memory/vector + loop/report tools over MCP (`.vscode/mcp.json` registers it)      |
| **Dashboard**                             | [`report-server.mjs`](scripts/harness/report-server.mjs)                                                                   | Always-on HTML metrics dashboard                                                                   |

## The three loop kinds

```text
convergence   run until pass/fail checks are all green        (build-fix, test-fix)
workflow      run rubric-graded passes to a terminal state    (review-fix, feature-cycle, ci-green)
experiment    hill-climb a numeric metric, keep-if-improved   (lint-debt-experiment)   ← autoresearch-style
```

## Quick start

```bash
# 1. Point the harness at your project's commands.
cp harness.config.json harness.config.json   # then edit: project name + commands
node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"  # sanity-check

# Optional: preview the repo's harness routing and operator handoff plans.
# PowerShell: run each npm wrapper command separately instead of chaining wrappers with semicolons.
npm run harness:route -- --task "fix auth middleware race"
npm run harness:feature -- --task "ship federation audit hardening"
npm run harness:handoff:review -- --task "review cache invalidation changes"

# 2. List and run a convergence loop (uses your configured commands).
npm run harness:loops
node scripts/harness/run-loop.mjs build-fix --agent "<your agent CLI>"

# 3. Record the baseline of an experiment metric (no agent needed).
node scripts/harness/run-experiment.mjs lint-debt-experiment --measure-only

# 4. See the dashboard.
npm run harness:report          # writes .github/harness/runs/report.html
npm run dashboard:up            # or serve it always-on at http://localhost:8099

# Optional: record a workflow run with explicit pending approval marker
node scripts/harness/record-run.mjs --loop review-fix --state blocked --approval-required --approval-status pending --approval-note "Awaiting reviewer sign-off" --fail "Gate 3 ownership unresolved"
```

The dashboard's Pending approvals section is strict: it only shows runs with explicit journal markers
(`approval.required=true` and `approval.status=pending`). It does not infer pending approvals from
brief status or blocked/stuck terminal states.

Full adoption guide: [`SETUP.md`](SETUP.md). Loop protocol: [`.github/harness/LOOPS.md`](.github/harness/LOOPS.md).

## Prompt routing policy

The kit ships a repo-local prompt router in [`scripts/harness/prompt-router.mjs`](scripts/harness/prompt-router.mjs).
It does not intercept editor prompts by itself; instead it gives operators a deterministic route and
stage/model handoff plan based on [`harness.config.json`](harness.config.json).

- `harness:route` classifies a prompt as trivial or non-trivial.
- `harness:feature` and `harness:handoff:feature` print the full feature-delivery handoff: Understand → Architect → Implement → Review Breadth → Review Depth → Feedback.
- `harness:handoff:review` prints the independent review handoff: Understand → Review Breadth → Review Depth → Feedback.
- `harness:review` runs the plan-review workflow for backward compatibility.

By default the shipped environment policy separates execution and judgment:

- `gpt-5.3-codex` for Implement and fix loops.
- `claude-opus-4.8` for Understand, Architect, Review Breadth, Review Depth, and Feedback.

## Autoresearch with a local model

Works with **Ollama** (default, `:11434`) or **LM Studio** (OpenAI-compatible, `:1234`) — pick with
`--provider` or `HARNESS_LLM_PROVIDER`.

```bash
# One bounded experiment, edits driven by a local model that actually rewrites the target file:
node scripts/harness/run-experiment.mjs lint-debt-experiment \
  --agent "node scripts/harness/ollama-apply-agent.mjs --model qwen2.5-coder:14b"

# Same via LM Studio (load a model there first):
node scripts/harness/run-experiment.mjs lint-debt-experiment \
  --agent "node scripts/harness/ollama-apply-agent.mjs --provider lmstudio --model <loaded-model-id>"

# Continuous overnight hill-climbing, committing each kept improvement:
npm run harness:experiment:ollama -- --commit      # or: harness:experiment:lmstudio
```

The apply-agent edits only the experiment's single declared `target`; the runner re-measures and
reverts anything that doesn't improve the metric — so letting a small local model rewrite a file is
safe by construction. The shared adapter [`llm-provider.mjs`](scripts/harness/llm-provider.mjs)
handles both runtimes (chat + embeddings); `vector-search.mjs` honors `--provider` too.

## MCP integration

The harness ships a first-class MCP stdio server exposing **15 read/observe tools** — knowledge graph
(7), memory (3), vector search (3), plus loop discovery (`harness-loops`) and metrics
(`harness-report`). [`.vscode/mcp.json`](.vscode/mcp.json) registers it for VS Code; for Claude
Code / Cursor use the same `command`/`args` in their MCP config.

```bash
node scripts/harness/mcp-tools.mjs list-tools     # inspect the tool catalog
npm run harness:mcp:server                         # run the stdio server directly
```

Loop **execution** stays CLI-only on purpose: a loop invokes an agent and runs for minutes, so
exposing it as an auto-callable MCP tool (when the MCP client _is_ the agent) would recurse and time
out. The MCP surface is for discovery and context, not for driving loops.

## Requirements

- Node.js ≥ 20 (uses built-in `fetch`; no install needed for the core loops).
- Optional: Docker (dashboard/graph sidecars), Ollama or LM Studio (local-LLM loops), the Understand-Anything
  plugin (knowledge graph).

## License

MIT — see [`LICENSE`](LICENSE) and [`CREDITS.md`](CREDITS.md).
