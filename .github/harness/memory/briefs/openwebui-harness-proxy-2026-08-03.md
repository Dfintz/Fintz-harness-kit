---
summary: "Architecture Brief — Open WebUI + Harness Proxy Integration"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [openwebui, harness, proxy, 2026]
---
# Architecture Brief — Open WebUI + Harness Proxy Integration

resource: scripts/harness/harness-proxy.mjs, docker-compose.harness.yml, package.json, SETUP.md, scripts/harness/prompt-router.mjs

**Date:** 2026-08-03  
**Status:** APPROVED (inline skeptical pass)

## Problem

The harness has no web UI. Operators on a headless Ubuntu server need a browser-accessible chat
interface that routes every prompt through the harness stage machine before hitting Ollama.

## Goals

1. Open WebUI as the chat interface (no custom UI to maintain).
2. A thin harness-aware proxy (port 11435) sits between Open WebUI and Ollama — injects stage plan
   into every chat request as a prepended system message.
3. Docker Compose profile `webui` starts the whole stack in one command.
4. Existing Ollama usage is unaffected (proxy is opt-in).

## Files Changed

| File | Action |
|---|---|
| `scripts/harness/harness-proxy.mjs` | Create |
| `docker-compose.harness.yml` | Add `harness-proxy` + `open-webui` services |
| `package.json` | Add `harness:proxy`, `harness:webui:up`, `harness:webui:down` |
| `SETUP.md` | Add Open WebUI section |

## Do-NOTs

- Do NOT modify `mcp-server.mjs`.
- Do NOT add npm dependencies.
- Do NOT replace existing system messages — prepend only.
- Do NOT expose proxy on `0.0.0.0` by default (localhost only outside Docker).

## Proxy contract

- Accepts: `POST /api/chat` (Ollama), `POST /v1/chat/completions` (OpenAI-compat)
- Passthrough: `GET /api/tags`, `GET /api/ps`, `GET /api/version`, `GET /v1/models`, `GET /healthz`
- Injection: prepend `[HARNESS] mode/stages/first-model` as first system message
- Streaming: Ollama NDJSON response piped verbatim
- Body size cap: `HARNESS_PROXY_MAX_BODY_BYTES` (default 4 MB)
