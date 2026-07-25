# Adopting the Harness in Your Project

## Two layers — keep them separate

The harness has two distinct layers. **Never mix them into the same repo:**

| Layer | Lives in | Contains |
|-------|----------|----------|
| **Engine** | This repo (harness-kit) — or installed as a package | `scripts/harness/`, loop definitions, MCP server, Phase 5 model config |
| **Project overlay** | Your project repo | Config, memory, entrypoints, domain knowledge |

The engine is a tool. Your project repo holds only what is specific to your project.

---

## Option A — Project overlay only (recommended)

Use this when the harness engine runs from harness-kit (local install, npx, or Claude Code plugin)
and your project repo only needs the thin overlay.

**Drop in the template:**

```bash
# From harness-kit root:
cp -r templates/project-adoption/. /path/to/your-project/
```

Then edit the placeholders in:

| File | What to fill in |
|------|----------------|
| `AGENTS.md` | Project name, tech stack, key commands, conventions |
| `.github/copilot-instructions.md` | Project name, project-specific standards |
| `harness.config.json` | Real commands (`lint`, `build`, `test`), project name |
| `docs/agents/domain.md` | Domain concepts, invariants, external systems, ownership map |
| `docs/agents/issue-tracker.md` | Issue tracking mode (github / local-markdown) |
| `docs/agents/triage-labels.md` | Project-specific labels and aliases |

The engine commands (`npm run harness:*`) run from the harness-kit install. Point agents at
harness-kit's `HARNESS.md` as the operating contract.

**Template layout:**

```
templates/project-adoption/
├── AGENTS.md                              ← project entry point
├── harness.config.json                    ← project config (commands, models, graph)
├── .github/
│   ├── copilot-instructions.md            ← Copilot App entrypoint
│   └── harness/
│       └── memory/
│           ├── README.md                  ← memory protocol
│           ├── lessons/
│           │   └── _template.md           ← lesson format
│           ├── briefs/
│           │   └── README.md              ← briefs protocol
│           └── quarantine/
│               └── README.md              ← quarantine protocol
└── docs/
    └── agents/
        ├── domain.md                      ← project domain knowledge
        ├── issue-tracker.md               ← issue tracking config
        └── triage-labels.md               ← label vocabulary
```

---

## Option B — Full engine copy (self-contained)

Use this when you want loops, experiments, dashboard, and MCP server to run directly from your
project repo without a separate harness-kit install.

### Install paths

| Path                          | Command                                                                          | What you get                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Agent Skill** (70+ agents)  | `npx skills add Dfintz/harness-kit -g`                                           | The harness **playbook** (`skills/harness/SKILL.md`) — agent guidance on stages/gates/loops |
| **Claude Code plugin**        | `/plugin marketplace add Dfintz/harness-kit` then `/plugin install harness-kit`  | The plugin bundle (playbook + engine files)                                                 |
| **Copy the scaffold** (below) | manual                                                                           | The full runnable **engine** dropped into your repo                                         |

### 1. Copy the kit into your repo

Copy these into your project root (merge, don't overwrite your own files):

```
.github/copilot-instructions.md   # GitHub Copilot App entrypoint for the harness
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

If you use the GitHub Copilot App, keep `.github/copilot-instructions.md` committed. It is the repo
surface Copilot reads to discover the harness entrypoint and standards.

### 2. Edit `harness.config.json`

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
  "graph": {
    "provider": "understand-anything", // or "graphify" | "both"
    "path": ".understand-anything/knowledge-graph.json",
    "sync": {
      "rebuildVectorIndex": false,
      "rebuildMemoryLinkIndex": false,
      "continueOnSyncError": false
    },
    "observability": {
      "eventsPath": ".github/harness/runs/graph-events.jsonl"
    },
    "graphify": {
      "path": ".graphify/knowledge-graph.json",
      "graphHtmlPath": ".graphify/graph.html",
      "refreshCommand": "graphify export --out .graphify/knowledge-graph.json", // required for graphify refresh
      "refreshCwd": "."
    }
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

### 3. Verify

```bash
node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"   # valid JSON
npm run harness:loops                                                            # lists loops
node scripts/harness/run-experiment.mjs lint-debt-experiment --measure-only      # measures baseline
npm run harness:report                                                           # builds the dashboard
```

### 4. (Optional) Wire an agent

Loops invoke an agent command via stdin. Any CLI works:

```bash
# Hosted agent (example):
node scripts/harness/run-loop.mjs build-fix --agent "claude -p"

# Resume an interrupted convergence run from the latest unfinished journal:
node scripts/harness/run-loop.mjs build-fix --resume latest

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

### 5. (Optional) Sidecars

```bash
# Always-on metrics dashboard:
npm run dashboard:up           # http://localhost:8099

# Knowledge-graph refresh (needs the Understand-Anything plugin checkout):
UNDERSTAND_PLUGIN_ROOT=/abs/path/to/understand-anything-plugin \
  docker compose -f docker-compose.harness.yml --profile graph-refresh up -d --build graph-refresh

# Inspect provider abstraction + availability:
npm run harness:graph:provider
npm run harness:graph:genui
npm run harness:graph:parity -- --local-only
```

### 6. (Optional) MCP integration

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
(graph/memory/vector + routing/catalog discovery tools like `harness-pick-profile`,
`harness-tool-discover`, `harness-catalog`); run loops from the CLI.

Publish machine-readable capability artifacts for external recommenders:

```bash
npm run harness:catalog:sync    # writes llms.txt + .github/harness/catalog/harness-profile.json
```

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
