# Use the harness in your environment

The harness is agent- and editor-neutral. It is plain Node.js plus markdown, so it runs the same in a
terminal, an IDE, a cloud agent, or CI — VS Code is one option, not a requirement.

## 0. One command to orient yourself

```bash
node scripts/harness/doctor.mjs          # or: npm run harness:doctor
```

The doctor checks your runtime (Node ≥ 20, git), what the harness can see (config, loops, domain
packs, MCP deps), which agent CLIs and optional tooling you have installed, runs the self-tests, and
prints the exact MCP registration for your client. Add `--quick` to skip self-tests, `--json` for
scripting.

## 1. Two layers — pick what you need

| You want…                                        | Use                          | How                                                                 |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------- |
| The **playbook** (stages/gates/loops guidance)   | the Agent Skill              | `npx skills add <owner>/harness-kit -g` — installs into 70+ agents  |
| The **runnable engine** (loops, dashboard, MCP)  | the scaffold in this repo    | copy the kit per [`SETUP.md`](../SETUP.md), then `harness:doctor`   |
| Both, on Claude Code, auto-updating              | the Claude Code plugin       | `/plugin marketplace add <owner>/harness-kit` → `/plugin install`   |

Everything below assumes the engine is present (you cloned/copied this repo). The loop runners need
nothing but Node; the MCP server needs `npm install` (it pulls the optional `@modelcontextprotocol/sdk`).

## 2. Register the MCP server in your client

The MCP server (`scripts/harness/mcp-server.mjs`) exposes the read-only graph/memory/vector/loop/metrics
tools. Generate the right config for your client instead of hand-writing it:

```bash
node scripts/harness/doctor.mjs --mcp <client>          # print it
node scripts/harness/doctor.mjs --write-mcp <client>    # write the project-local file (merges, never clobbers)
```

| Client            | Config file (project unless noted)                        | Key               | Notes                                  |
| ----------------- | --------------------------------------------------------- | ----------------- | -------------------------------------- |
| `claude-code`     | `.mcp.json`                                               | `mcpServers`      | committed in this repo — works on open |
| `cursor`          | `.cursor/mcp.json`                                        | `mcpServers`      | committed in this repo                 |
| `vscode`          | `.vscode/mcp.json`                                        | `servers`         | committed; uses `${workspaceFolder}`   |
| `zed`             | `.zed/settings.json`                                      | `context_servers` |                                        |
| `windsurf`        | `~/.codeium/windsurf/mcp_config.json` *(global)*          | `mcpServers`      | absolute path                          |
| `cline`           | Cline panel → MCP Servers → Configure *(global)*          | `mcpServers`      | absolute path                          |
| `claude-desktop`  | `claude_desktop_config.json` *(global)*                   | `mcpServers`      | absolute path                          |
| `generic`         | your client's MCP config                                  | `mcpServers`      | absolute path                          |

Project-local files (`claude-code`, `cursor`, `vscode`, `zed`) ship with relative paths so they work
for anyone who clones the repo. Global clients get an absolute path because their config lives outside
the repo.

## 3. Per-environment recipes

### Claude Code (CLI, desktop, web, or IDE extension)

- **Playbook:** install the skill or plugin (§1); or just point Claude at `.github/harness/HARNESS.md`.
- **MCP:** `.mcp.json` is already in the repo — Claude Code will prompt to approve the `harness` server
  on first open. (Or `claude mcp add harness -- node scripts/harness/mcp-server.mjs`.)
- **Loops:** Claude runs them natively via the `run-loop` skill, or from the terminal:
  `node scripts/harness/run-loop.mjs build-fix --agent "claude -p"`.

### Cursor

- **Playbook:** add the skill (§1), or reference `AGENTS.md` / `.github/harness/HARNESS.md` in chat.
- **MCP:** `.cursor/mcp.json` ships in the repo; enable it under Settings → MCP. Or
  `node scripts/harness/doctor.mjs --write-mcp cursor`.
- **Loops:** run from Cursor's terminal with `--agent "cursor-agent -p"` (or any CLI you prefer).

### VS Code + GitHub Copilot

- **Playbook:** Copilot reads `.github/copilot-instructions.md` and `.github/instructions/0*.md`
  (already wired by the kit).
- **MCP:** `.vscode/mcp.json` ships in the repo; VS Code discovers it automatically.
- **Loops:** the loop JSON is a protocol — follow `.github/harness/LOOPS.md` natively, or run the
  CLI runner in the integrated terminal.

### Windsurf / Cline / Zed / Claude Desktop

- **Playbook:** add the skill (§1) where supported, else point the agent at `AGENTS.md`.
- **MCP:** run `node scripts/harness/doctor.mjs --mcp <windsurf|cline|zed|claude-desktop>` and paste the
  output into that client's MCP config (global clients need the absolute path the doctor prints).
- **Loops:** drive the CLI runner with whatever agent command the client exposes.

### JetBrains IDEs (IntelliJ, PyCharm, …)

- Use the JetBrains AI Assistant or the Claude/Copilot plugins for the playbook.
- For MCP, use the plugin's MCP settings with the `generic` config from the doctor (absolute path).
- Loops run from the IDE terminal like any Node script.

### Plain terminal / any CLI agent / headless

The harness needs no editor at all:

```bash
node scripts/harness/doctor.mjs --quick                       # orient
node scripts/harness/run-loop.mjs --list                      # see loops
node scripts/harness/run-loop.mjs test-fix --check-only        # report state, no agent
node scripts/harness/run-loop.mjs build-fix --agent "<any CLI that reads a prompt on stdin>"
npm run harness:domains                                        # domain packs
```

Any agent that reads a prompt on stdin and edits files works as the `--agent`. Local models via Ollama
or LM Studio are first-class (`scripts/harness/ollama-agent.mjs`); see the README.

### CI / GitHub Actions

Run the whole deterministic, agent-free regression gate with one command — no model, no network,
no install:

```bash
npm run harness:selftest          # = node scripts/harness/selftest-all.mjs
```

It runs every component's `--self-test` (eval suite, domain packs, doctor, git-guard, grade-trace,
otel, plan-review, command-validation, evolve-guard), the six domain deliverable-check unit tests, and
a JSON-validity sweep over the committed harness JSON; it exits non-zero if anything fails. The kit
ships this as a workflow at [`.github/workflows/harness-selftest.yml`](../.github/workflows/harness-selftest.yml)
(runs on push/PR across Node 20 and 22). `harness:doctor --json` is handy for asserting environment
prerequisites in a CI step.
