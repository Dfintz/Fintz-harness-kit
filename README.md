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
| **Domain & industry packs**               | [`.github/harness/domains/`](.github/harness/domains/), [`domain-pack.mjs`](scripts/harness/domain-pack.mjs)               | Re-skin the engine for non-software domains; ships 6 runnable packs + deterministic deliverable checks |

## The three loop kinds

```text
convergence   run until pass/fail checks are all green        (build-fix, test-fix)
workflow      run rubric-graded passes to a terminal state    (review-fix, feature-cycle, ci-green)
experiment    hill-climb a numeric metric, keep-if-improved   (lint-debt-experiment)   ← autoresearch-style
```

## Domain & industry packs

The engine (loops, memory, review, observability, the *shape* of a gated stage machine) is
domain-agnostic — only the content is software-specific. A **domain pack** swaps that content layer
for another knowledge domain: it relabels the stages, supplies a domain gate set, and points the
convergence checks at deterministic **deliverable checks** (`scripts/harness/domain-checks/*`) that
read a written artifact — a research memo, a contract, a runbook — instead of compiling code.

Six runnable packs ship in [`.github/harness/domains/`](.github/harness/domains/):
`finance-research`, `scientific-research`, `legal-compliance`, `tourism`, `it-services`,
`business-optimization` — plus an `_template` to author your own.

```bash
npm run harness:domains                                   # list packs
node scripts/harness/domain-pack.mjs show finance-research # stages, gates, checks
npm run harness:domain:check finance-research              # run the checks on the pack's good sample
node scripts/harness/domain-pack.mjs check finance-research --deliverable my-memo.md
node scripts/harness/domain-pack.mjs activate finance-research   # wire loops + config into the engine
npm run harness:domain:self-test                           # validate ALL packs (the domain fitness gate)
```

`--self-test` is the domain analogue of the eval suite: for every pack, the **good** sample must pass
all its checks and the **broken** sample must fail at least one — proving the checks discriminate.
Full model and authoring guide: [`.github/harness/domains/README.md`](.github/harness/domains/README.md).

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

# Optional: council-style parallel review synthesis (keeps stage machine intact)
npm run harness:council:review -- --mode review --prompt "review this change set"
# Optional: catalog presets (safe fixed keys)
npm run harness:council:review -- --mode review --prompt-key review
# Or pipe prompt content from stdin (PowerShell)
Get-Content .github/harness/memory/briefs/EXAMPLE.md -Raw | npm run harness:council:review -- --mode review --prompt-stdin
# Backward compatibility: old prompt-file callers now resolve tokens only (no file reads)
npm run harness:council:review -- --mode review --prompt-file review.md

# Optional: transient per-workspace JSONL memory
npm run harness:workspace-memory -- append --mode review --text "Captured reviewer disagreement"
npm run harness:workspace-memory -- list --last 20

# Optional: record a workflow run with explicit pending approval marker
node scripts/harness/record-run.mjs --loop review-fix --state blocked --approval-required --approval-status pending --approval-note "Awaiting reviewer sign-off" --fail "Gate 3 ownership unresolved"
```

The dashboard's Pending approvals section is strict: it only shows runs with explicit journal markers
(`approval.required=true` and `approval.status=pending`). It does not infer pending approvals from
brief status or blocked/stuck terminal states.

Security hardening for spawned CLI commands is now centralized in
`scripts/harness/command-validation.mjs` and enforced at key shell-spawn points
(`run-loop`, `run-experiment`, `plan-review`). It allows known executables and rejects shell
metacharacter payloads.

Webview command surfaces and WSL-specific execution adapters are intentionally optional/deferred in
this kit release. Keep using script-first orchestration unless your environment needs a dedicated UI
or cross-shell adapter.

To normalize historical datasets, backfill legacy run journals with explicit default approval markers:

```bash
npm run harness:migrate:approvals -- --dry-run
npm run harness:migrate:approvals
```

This migration only updates loop journals missing the `approval` object, defaulting to
`required=false` and `status=not-required`.

Full adoption guide: [`SETUP.md`](SETUP.md). Loop protocol: [`.github/harness/LOOPS.md`](.github/harness/LOOPS.md).

## Prompt routing policy

The kit ships a repo-local prompt router in [`scripts/harness/prompt-router.mjs`](scripts/harness/prompt-router.mjs).
It does not intercept editor prompts by itself; instead it gives operators a deterministic route and
stage/model handoff plan based on [`harness.config.json`](harness.config.json).

- `harness:route` classifies a prompt as trivial or non-trivial.
- `harness:feature` and `harness:handoff:feature` print the full feature-delivery handoff: Understand → Architect → Implement → Review Breadth → Review Depth → Feedback.
- `harness:handoff:review` prints the independent review handoff: Understand → Review Breadth → Review Depth → Feedback.
- `harness:prompt-pack` generates a gitignored prompt pack under `.github/harness/runs/prompt-packs/` with an orchestrator prompt, canonical stage prompts, cycle-memory scaffolding, and optional scout/challenger sidecars.
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

For the `graph-refresh` sidecar, plugin dependency bootstrapping is now hardened by default: when
the plugin is mounted at `/opt/understand-plugin`, the loop copies it to a writable runtime path and
runs `corepack pnpm install --frozen-lockfile` there before refresh. This avoids regressions from
read-only mounts or host/container linker mismatches. Override with:

- `GRAPH_REFRESH_BOOTSTRAP_PLUGIN=false` to disable bootstrap.
- `GRAPH_REFRESH_FORCE_BOOTSTRAP=true` to force runtime copy/install even when source plugin already has `node_modules`.
- `GRAPH_REFRESH_RUNTIME_PLUGIN_ROOT=/custom/path` to change runtime copy location (default: `/workspace/.cache/understand-plugin-runtime`).
- `GRAPH_REFRESH_BOOTSTRAP_INSTALL_TIMEOUT_MS=120000` to cap install wait time and fail fast.

You can also run a deterministic preflight manually before starting the loop:

```bash
node scripts/harness/graph-refresh-loop.mjs --preflight-only --plugin-root <plugin-root>
```

The compose sidecar now runs this preflight first and exits with one actionable error if
prerequisites are missing.

## License

MIT — see [`LICENSE`](LICENSE) and [`CREDITS.md`](CREDITS.md).
