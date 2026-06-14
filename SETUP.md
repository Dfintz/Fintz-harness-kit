# Adopting the Harness in Your Project

The harness is configuration-driven: you copy two directories and edit one JSON file. No script edits
are required for the core loops.

## Install paths

| Path                          | Command                                                                          | What you get                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Agent Skill** (70+ agents)  | `npx skills add <owner>/harness-kit -g`                                          | The harness **playbook** (`skills/harness/SKILL.md`) — agent guidance on stages/gates/loops |
| **Claude Code plugin**        | `/plugin marketplace add <owner>/harness-kit` then `/plugin install harness-kit` | The plugin bundle (playbook + engine files)                                                 |
| **Copy the scaffold** (below) | manual                                                                           | The full runnable **engine** dropped into your repo                                         |

The skill teaches an agent _how_ to drive the harness; the **engine** (the `scripts/harness/*.mjs`
runners, dashboard, MCP server, loop definitions) is what actually runs loops. The copy-the-scaffold
steps below give you that engine in your own repo — do this when you want the loops, experiments,
dashboard, and MCP server runnable from your project.

## 1. Copy the kit into your repo

Copy these into your project root (merge, don't overwrite your own files):

```
.github/harness/         # harness contract, loops, memory protocol
.github/instructions/    # workflow stage instructions (02–07)
scripts/harness/         # runners, agents, dashboard, config loader
harness.config.json      # the one file you edit
docker-compose.harness.yml
AGENTS.md                # entry pointer (merge into yours if you have one)
CREDITS.md
```

Merge the `harness:*` and `dashboard:*` scripts from this kit's [`package.json`](package.json) into
your project's `package.json`.

## 2. Edit `harness.config.json`

This is the only required step. Point the tokens at your project's real commands:

```jsonc
{
  "project": { "name": "My App", "description": "…" },
  "commands": {
    "lint": "npm run lint", // or "ruff check .", "cargo clippy", "golangci-lint run", …
    "typeCheck": "npm run type-check",
    "build": "npm run build",
    "test": "npm test",
  },
  "llm": {
    "provider": "ollama", // or "lmstudio"
    "model": "qwen2.5-coder:14b",
    "ollama": { "host": "http://localhost:11434" },
    "lmstudio": { "host": "http://localhost:1234" },
  },
  "experiments": {
    "exampleMetricCommand": "npm run lint",
    "exampleMetricExtract": "(\\d+) problems", // regex with ONE capture group = the number
    "exampleTarget": "src/path/to/one-file.ts",
  },
}
```

Loop definitions in `.github/harness/loops/*.json` reference these via `{{commands.lint}}`,
`{{experiments.exampleTarget}}`, etc. The resolver is
[`scripts/harness/config.mjs`](scripts/harness/config.mjs); unresolved tokens are left intact with a
warning, so partial configs degrade gracefully.

## 3. Verify

```bash
node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"   # valid JSON
npm run harness:loops                                                            # lists loops
node scripts/harness/run-experiment.mjs lint-debt-experiment --measure-only      # measures baseline
npm run harness:report                                                           # builds the dashboard
```

## 4. (Optional) Wire an agent

Loops invoke an agent command via stdin. Any CLI works:

```bash
# Hosted agent (example):
node scripts/harness/run-loop.mjs build-fix --agent "claude -p"

# Local model (convergence — describe-only is fine here). Ollama by default:
node scripts/harness/run-loop.mjs build-fix \
  --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b"

# Or LM Studio (OpenAI-compatible) — load a model in LM Studio first:
node scripts/harness/run-loop.mjs build-fix \
  --agent "node scripts/harness/ollama-agent.mjs --provider lmstudio --model <loaded-model-id>"
```

> Provider is selectable per agent via `--provider ollama|lmstudio` (or `HARNESS_LLM_PROVIDER`),
> with `--host`/`HARNESS_LLM_HOST` and `--model`/`HARNESS_LLM_MODEL`. The shared adapter is
> `scripts/harness/llm-provider.mjs`; `vector-search.mjs` honors `--provider` too.

> **Experiments need an _apply_ agent.** Convergence loops only need the agent to _describe_ a fix in
> chat, but experiment loops re-measure files on disk — so use
> `scripts/harness/ollama-apply-agent.mjs` (it rewrites the single declared target), not the
> describe-only `ollama-agent.mjs`.

## 5. (Optional) Sidecars

```bash
# Always-on metrics dashboard:
npm run dashboard:up           # http://localhost:8099

# Knowledge-graph refresh (needs the Understand-Anything plugin checkout):
UNDERSTAND_PLUGIN_ROOT=/abs/path/to/understand-anything-plugin \
  docker compose -f docker-compose.harness.yml --profile graph-refresh up -d --build graph-refresh
```

## 6. (Optional) MCP integration

The kit ships `.vscode/mcp.json`, which registers the harness MCP server for VS Code automatically.
For Claude Code or Cursor, add the same stdio entry to their MCP config:

```jsonc
{
  "servers": {
    // Claude/Cursor use "mcpServers"
    "harness": {
      "type": "stdio",
      "command": "node",
      "args": ["scripts/harness/mcp-server.mjs"],
      "cwd": "/abs/path/to/your/repo",
    },
  },
}
```

Verify the catalog with `node scripts/harness/mcp-tools.mjs list-tools`. The server is read-only
(graph/memory/vector + `harness-loops`/`harness-report`); run loops from the CLI.

## What to customize next

- **Skills:** the kit ships no domain skills. Add your project's under `.github/skills/` (and/or
  `.claude/skills/`) and list them in `.github/harness/registry.json` with trigger keywords. The
  skill-routing tables in `HARNESS.md` are illustrative — replace them.
- **Gates:** the five architectural gates include a multi-tenant "4b" gate. Drop it if your project
  isn't multi-tenant; the workflow instructions note where examples are illustrative.
- **Loops:** add your own under `.github/harness/loops/` using `_template.json` as a starting point.

## Requirements

- Node.js ≥ 20 (core loops need nothing else).
- Optional: Docker, Ollama or LM Studio (local-LLM loops), the Understand-Anything plugin.
