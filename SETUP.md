# Adopting the Harness in Your Project

## Two layers — keep them separate

The harness has two distinct layers. **Never mix them into the same repo:**

| Layer | Lives in | Contains |
|-------|----------|----------|
| **Engine** | This repo (harness-kit) — or installed as a package | `scripts/harness/`, loop definitions, MCP server, Phase 5 model config |
| **Project overlay** | Your project repo | Config, memory, entrypoints, domain knowledge |

The engine is a tool. Your project repo holds only what is specific to your project.

## Quick onboarding checklist

Use this checklist if you want to get to a first valid harness run quickly.

1. Choose Option A (overlay only) unless you explicitly need local engine execution inside the project repo.
2. Fill `harness.config.json` first (`project.*` and all `commands.*` values).
3. Run `npm run harness:health -- --fast` and resolve required failures.
4. Run `npm run harness:loops` and then one loop (`build-fix`) with your agent command.
5. Run `npm run harness:report` to produce `.github/harness/runs/report.html`.
6. Run `npm run harness:catalog:sync` to publish `llms.txt` and catalog profile metadata.

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
npm run harness:health -- --fast                                                 # quick required preflight
npm run harness:health -- --json                                                 # full machine-readable health report
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

### Optional security scan: Lurkr

Use Lurkr as an opt-in static capability-risk scan in local checks or CI:

- Wrapper script: `scripts/harness/lurkr-check.mjs`

```bash
# Configure your scanner command once (example):
export HARNESS_LURKR_COMMAND="npx lurkr scan ."

# Warning-mode run (never fails if scanner is missing/unconfigured):
npm run harness:security:lurkr

# Required mode (fails on missing config or scan failure):
node scripts/harness/lurkr-check.mjs --required
```

Lurkr remains optional and is not required for baseline harness commands.

### Optional docs drift check for changed capability surfaces

Run warning-mode checks to detect changed capability surfaces that lack citations in harness docs:

- Validator script: `scripts/harness/validate-doc-contracts.mjs`

```bash
npm run harness:docs:check:changed-surfaces
```

This mode adds warnings only and does not change default `harness:docs:check` pass/fail semantics.

Resolver notes:
- Token/config resolution is implemented in `scripts/harness/config.mjs`.

### Next-actions command (formal subcommand)

Use profile-aware and explicit prompt-pack selectors with `next-actions`:

```bash
# task-matching mode
npm run harness:next-actions -- --task "ship auth audit"

# explicit pack slug mode
npm run harness:next-actions -- --pack review-auth-audit

# latest pack mode
npm run harness:next-actions -- --pack-latest

# fail-closed profile filter
npm run harness:next-actions -- --pack-latest --profile feature
```

Selector precedence is deterministic: `--pack` > `--pack-latest` > task-match > fallback.
Invalid selector combination (`--pack` + `--pack-latest`) fails non-zero.

### Example CI workflow for optional security gates

- Example file: `.github/workflows/harness-optional-security-gates.example.yml`
- Toggle semantics: optional checks run only when `HARNESS_ENABLE_OPTIONAL_SECURITY_GATES == 'true'`.
- Optional targeted OKF strict gate: set `HARNESS_ENABLE_OPTIONAL_OKF_STRICT_TARGETED='true'` to enforce strict OKF only on changed memory markdown files.
- Optional changed-brief policy gate: set `HARNESS_ENABLE_OPTIONAL_MEMORY_BRIEF_POLICY='true'` to fail only when changed briefs violate strict status rules (`malformed-status`, `superseded-no-pointer`) or strict OKF conformance.
- Changed-surface warning run includes explicit base ref using `--changed-surface-base`.

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

---

## Ubuntu + Ollama setup (local CPU inference, 50 GB Intel server)

> **Quick path:** Run the discovery script first — it detects your hardware and tells you exactly what to install.
>
> ```bash
> bash scripts/setup-ubuntu.sh          # hardware discovery + model recommendations
> bash scripts/setup-ubuntu.sh --json   # machine-readable JSON output
> bash scripts/setup-ubuntu.sh --install # auto-install missing dependencies
> ```

The script detects:
- RAM, CPU, GPU and recommends appropriate model sizes
- Node.js, git, Docker, Ollama (installed + running status)
- Python3, pdftotext, libreoffice, python-docx, openpyxl (for document ingestion)
- Already-installed Ollama models
- Generates a personalised `.env` snippet and systemd tuning config

### Harness help command

```bash
npm run harness:help                          # quick start + topic index
npm run harness:help -- --topic modes         # mode prefixes (/ask: /dev: /full:)
npm run harness:help -- --topic search        # file search + document ingestion
npm run harness:help -- --topic loops         # convergence loops
npm run harness:help -- --topic memory        # lessons, ontology, OKF
npm run harness:help -- --topic webui         # Open WebUI + control panel
npm run harness:help -- --topic api           # HTTP adapter + MCP server
npm run harness:help -- --topic stages        # harness stage machine
npm run harness:help -- --topic knowledge     # graph, refresh, call edges
npm run harness:help -- --topic install       # installation guide
npm run harness:help -- --list                # all topics
```

### 1. Prerequisites

```bash
# Node.js ≥ 20 (via nvm or official package)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # should print v20.x or higher
npm --version
```

### 2. Install and configure Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models for a 50 GB Intel CPU server
ollama pull nomic-embed-text    # embedding (274 MB, required for vector search)
ollama pull qwen2.5:14b         # generation, ~9 GB Q4 — good balance
# Optional: higher quality, slower
# ollama pull qwen2.5:32b       # ~20 GB Q4
# ollama pull llama3.3:70b      # ~43 GB Q4 — leaves ~7 GB headroom
```

### 3. Tune Ollama for CPU-only servers

Create (or edit) the Ollama systemd override so it does not OOM under load:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/cpu-tuning.conf <<'EOF'
[Service]
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_KEEP_ALIVE=30m"
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo systemctl status ollama
```

| Variable | Value | Reason |
|---|---|---|
| `OLLAMA_NUM_PARALLEL` | `1` | Prevents concurrent requests from doubling RAM use |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | Prevents model swap that exhausts 50 GB |
| `OLLAMA_KEEP_ALIVE` | `30m` | Keeps the model warm between requests without hogging RAM indefinitely |
| `OLLAMA_HOST` | `0.0.0.0:11434` | Exposes Ollama on LAN if needed; use `127.0.0.1:11434` for localhost-only |

### 4. Install the harness

```bash
git clone https://github.com/Dfintz/Fintz-harness-kit.git
cd Fintz-harness-kit
npm install

# Verify
npm run harness:health -- --fast
```

### 5. Environment variables

Add to `~/.bashrc` or `~/.profile` (or a `.env` file not committed to git):

```bash
# Harness local LLM
export HARNESS_LLM_PROVIDER=ollama
export HARNESS_LLM_MODEL=qwen2.5:14b
export HARNESS_LLM_HOST=http://localhost:11434
export HARNESS_EMBED_MODEL=nomic-embed-text
export HARNESS_EMBED_TIMEOUT_MS=120000      # CPU embedding is slower; 2 min timeout

# Filesystem indexing defaults
export HARNESS_FS_CHUNK_SIZE=2000
export HARNESS_FS_CHUNK_OVERLAP=200
export HARNESS_FS_MAX_FILE_BYTES=524288     # skip files > 512 KB
```

The same values are documented in `harness.config.json` under `hardwareProfiles.cpu-only-50gb-intel`.

### 6. File search and analysis

**Index a directory:**

```bash
# Index the current project
npm run harness:file-index -- --root .

# Index an external directory (e.g. logs, docs, source tree)
npm run harness:file-index -- --root /var/log --ext .log,.txt
npm run harness:file-index -- --root /path/to/project --chunk-size 1500 --chunk-overlap 150
```

**Search indexed files:**

```bash
npm run harness:search -- --query "authentication flow" --root .
npm run harness:search -- --query "error handling" --root /path/to/project --top 10

# Low-level: use vector-search.mjs directly with full control
node scripts/harness/vector-search.mjs search \
  --query "rate limiting middleware" \
  --scope fs \
  --root /path/to/project \
  --top 8 \
  --min-score 0.5
```

**How chunking works:**

Large files are split into overlapping text windows before embedding. Defaults:
- Chunk size: 2000 characters (`HARNESS_FS_CHUNK_SIZE`)
- Overlap: 200 characters (`HARNESS_FS_CHUNK_OVERLAP`)
- Max file: 512 KB (`HARNESS_FS_MAX_FILE_BYTES`)
- Binary files are automatically skipped (null-byte detection)

**Incremental re-index** — already-indexed chunks whose content hash has not changed are reused
without re-embedding. Only changed or new files incur Ollama calls.

### 7. Prompt routing middleware

Every prompt can be routed through the harness stage machine before execution:

```bash
# Route a prompt and get the stage/model plan (JSON)
echo "add OAuth login to the API" | npm run harness:prompt:route

# Human-readable output
npm run harness:prompt:route -- --task "fix flaky test" --pretty

# Use in a shell script pipeline
PLAN=$(echo "$MY_PROMPT" | node scripts/harness/prompt-middleware.mjs --json)
FIRST_STAGE=$(echo "$PLAN" | node -e \
  "const p=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(p.stages[0])")
echo "First stage: $FIRST_STAGE"
```

### 8. Run a loop with the local Ollama model

```bash
# Build-fix convergence loop using qwen2.5:14b
node scripts/harness/run-loop.mjs build-fix \
  --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5:14b"

# Experiment loop with apply-agent (rewrites files on disk)
npm run harness:experiment:ollama
```

### 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `fetch failed` / connection refused | Ollama not running | `sudo systemctl start ollama` |
| Embedding times out | Model loading slowly | Increase `HARNESS_EMBED_TIMEOUT_MS=180000` |
| OOM / system freezes | Two models loaded | Set `OLLAMA_MAX_LOADED_MODELS=1` and restart |
| `nomic-embed-text` not found | Model not pulled | `ollama pull nomic-embed-text` |
| Slow first embed (>60 s) | Model loading from disk | Normal; subsequent calls are faster |
| Binary file indexed as garbage | Extension allowed but file is binary | Add `--ext` flag to restrict extensions |



---

## Open WebUI + harness proxy (browser chat interface)

Open WebUI provides a full ChatGPT-style interface for your local Ollama models. A thin
harness-aware proxy sits between Open WebUI and Ollama — every prompt is automatically routed
through the harness stage machine and the plan is injected as a system message before Ollama sees it.

```
Browser  →  Open WebUI :3000  →  harness-proxy :11435  →  Ollama :11434
```

### Quick start (Docker)

```bash
# Start both harness-proxy and Open WebUI
npm run harness:webui:full

# Open browser
open http://localhost:3000
# Create an admin account on first visit, then start chatting.

# Stop
npm run harness:webui:down
```

On first visit, create an admin account. Open WebUI will automatically use the harness proxy
(already configured via `OLLAMA_BASE_URL` in the compose file).

### What the proxy does

Every chat message is transparently routed through `prompt-middleware.mjs`. The result is prepended
to the conversation as a system message before Ollama receives it:

```
[HARNESS] mode: non-trivial | stages: understand → architect → implement → review-breadth → review-depth → feedback | first-stage-model: claude-opus-5 | why: matched non-trivial keyword: implement
```

This gives the model context about how the harness would stage the task — useful for analysis,
code generation, and multi-step work. It does not force the model to follow the stages; it is
contextual guidance only.

### Run the proxy standalone (no Docker)

```bash
# Default: localhost:11435 → localhost:11434
npm run harness:proxy

# Custom ports
node scripts/harness/harness-proxy.mjs --port 11435 --ollama-host http://192.168.1.10:11434

# Passthrough mode (disable injection, pure transparent proxy)
HARNESS_PROXY_INJECT=0 npm run harness:proxy
```

### MCP tools in Open WebUI

Open WebUI 0.4+ supports external tools. To expose harness MCP tools:

1. In Open WebUI → **Settings → Tools** → Add tool server.
2. The harness MCP server runs as a stdio process — wrap it for Open WebUI using `mcphost` or any
   MCP-to-HTTP bridge, then point Open WebUI at it.
3. Alternatively, use the harness tools directly from VS Code: `.vscode/mcp.json` registers the
   stdio server automatically.

For the simplest setup, VS Code users have full MCP tool access out of the box. Open WebUI users
benefit from the stage-plan injection in every chat message regardless.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `HARNESS_PROXY_PORT` | `11435` | Proxy listen port |
| `HARNESS_PROXY_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in Docker) |
| `HARNESS_PROXY_OLLAMA_HOST` | `http://localhost:11434` | Upstream Ollama URL |
| `HARNESS_PROXY_MAX_BODY_BYTES` | `4194304` | Max chat request body size |
| `HARNESS_PROXY_INJECT` | `1` | Set to `0` for passthrough mode |
| `OPEN_WEBUI_PORT` | `3000` | Host port for Open WebUI |
| `WEBUI_SECRET_KEY` | `change-me-in-production` | Open WebUI session secret — **change this** |
| `WEBUI_AUTH` | `true` | Require login (`false` = open access) |

> **Security:** Change `WEBUI_SECRET_KEY` before exposing Open WebUI on a network. Set
> `HARNESS_PROXY_HOST=127.0.0.1` (default) to keep the proxy localhost-only on the host.
> In the Docker setup the proxy is internal to the compose network and not directly reachable
> from outside — only Open WebUI's port 3000 is exposed.

### Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Docker compose (--profile webui)                           │
│                                                             │
│  ┌──────────────┐    ┌────────────────────────┐            │
│  │  Open WebUI  │───►│  harness-proxy :11435  │            │
│  │  :3000       │    │  (harness-proxy.mjs)   │            │
│  └──────────────┘    │  - planTask() inject   │            │
│                      │  - stream passthrough  │            │
│                      └───────────┬────────────┘            │
│                                  │ host.docker.internal     │
└──────────────────────────────────┼──────────────────────────┘
                                   ▼
                         Ollama :11434  (on host)
```

The harness dashboard (`:8099`) and graph-refresh sidecar remain on separate profiles and are
independent of the webui profile.


## Maintainer release checklist

When preparing a new harness release:

1. Update version surfaces consistently (`package.json`, release notes filename/title, git tag).
2. Run `npm run harness:docs:check` and `npm run harness:health -- --fast`.
3. Commit with a release-focused message that includes version.
4. Push branch and tag (`git push origin <branch>` then `git push origin <tag>`).
5. Publish GitHub release notes using the release note file for that version.
