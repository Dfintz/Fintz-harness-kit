# Open WebUI — Harness Mode Setup

This directory contains system prompts and configuration for running harness-aware
mode-specific "models" in Open WebUI backed by the harness proxy.

## Architecture

```
Open WebUI  →  harness-proxy :11435  →  Ollama :11434
                    │
              Mode prefix detection
              /ask:  → assistant profile  → llama3.1:8b
              /dev:  → coder profile      → qwen2.5-coder:14b
              /full: → feature profile    → qwen2.5:32b
```

## Wiring named models in Open WebUI

Open WebUI supports "Model" configs with custom system prompts.
Create three models:

| Name | Base model (in Ollama) | System prompt file |
|---|---|---|
| `harness-assistant` | `llama3.1:8b` | `system-prompt-assistant.md` |
| `harness-dev` | `qwen2.5-coder:14b` | `system-prompt-dev.md` |
| `harness-full` | `qwen2.5:32b` | `system-prompt-full.md` |

### Steps in Open WebUI

1. Pull models: `ollama pull llama3.1:8b`, `ollama pull qwen2.5-coder:14b`, `ollama pull qwen2.5:32b`
2. Open WebUI → Admin → Models → **Create Model**
3. Set:
   - **Name**: `harness-assistant` (or dev / full)
   - **Base model**: select the Ollama model above
   - **System prompt**: paste content of the corresponding `.md` file
4. Repeat for all three modes.

Users can then select `harness-assistant`, `harness-dev`, or `harness-full` from the model dropdown.
Mode prefixes (`/ask:`, `/dev:`, `/full:`) still work in any model for per-message overrides.

## Mode prefix cheat sheet (works in any model)

| Prefix | Effect | Use when |
|---|---|---|
| `/ask: question` | assistant mode — concise answer | quick questions, explanations, summaries |
| `/dev: task` | coder mode — implement + review | write/fix/refactor code |
| `/code: task` | coder mode (alias) | same as /dev: |
| `/full: task` | full 7-stage harness | complex features, architecture |
| `/review: task` | review-only mode | review without implementing |
| `/loop:build-fix` | signals loop intent | trigger build-fix convergence |
| `/loop:test-fix` | signals loop intent | trigger test-fix convergence |
| `/loop:feature-cycle` | signals loop intent | full feature cycle |

## Docker Compose env for mode-specific models

Add to `docker-compose.harness.yml` open-webui service environment:

```yaml
# Optional: pre-select default model per role
WEBUI_DEFAULT_MODEL: "harness-dev"
```

## Environment variables for the proxy

```bash
# Proxy reads these env vars (already in .env.example)
HARNESS_PROXY_INJECT=1          # enable mode injection (default)
HARNESS_LLM_PROVIDER=ollama
HARNESS_LLM_HOST=http://localhost:11434
```
