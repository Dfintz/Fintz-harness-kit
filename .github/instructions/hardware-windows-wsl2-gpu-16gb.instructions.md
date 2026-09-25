---
applyTo: '**'
---

# Hardware Profile: Windows 11 + WSL2 + NVIDIA 16 GB GPU, Ollama + LM Studio + Docker Desktop

Target workstation for the **lite** local decision sidecar and local model serving. Reference
machine: Ryzen 7 7800X3D, 64 GB RAM, RTX 5070 Ti 16 GB.

Profile key: `windows-wsl2-gpu-16gb`

## The one thing that decides everything: 16 GB VRAM is shared

The decision sidecar and your coding model compete for the same 16 GB. Pick a row and stay in it.

| Sidecar backend | Sidecar VRAM | Coding model that still fits |
|---|---|---|
| `openai` (lite, shared model) | 0 GB — reuses the loaded model | up to 14B Q4 (~8.5 GB) |
| `semif` 4-bit | ~3 GB | 14B Q4 (~8.5 GB), tight |
| `semif` BF16 | ~9 GB + KV | 7B Q4 (~4.5 GB) only |

The lite backend costs zero additional VRAM because it scores against the model already resident
in Ollama or LM Studio. That is the entire reason it exists.

## Process placement — where each thing runs

| Process | Where | Why |
|---|---|---|
| Ollama or LM Studio | **native Windows**, CUDA | avoids the WSL2 GPU paravirtualization layer and the WSL2↔Windows network hop |
| Lite decision sidecar | **native Windows**, Node | same loopback namespace as the model server |
| Heavy decision sidecar (`semif`) | **inside the WSL2 distro**, not a container | the Torch/CUDA stack is Linux-first; co-locating with the Python worker keeps it on stdin/stdout |
| harness-dashboard, graph-refresh, harness-proxy | Docker Desktop | not latency-critical; unchanged |

**Do not containerize the decision sidecar.** A container forces `host.docker.internal` traversal
on every decision and removes the loopback-only guarantee the sidecar depends on.

## WSL2 networking

If you run the heavy backend in WSL2 and the harness on Windows, enable **mirrored networking** so
the sidecar is reachable on real loopback rather than through the NAT port forwarder:

```ini
# %USERPROFILE%\.wslconfig
[wsl2]
networkingMode=mirrored
```

Without mirrored mode the "loopback-only" safety property is weaker than it reads, because the
forwarder terminates and re-originates the connection.

## Environment variables — lite backend

```powershell
$env:HARNESS_DECISION_BACKEND = "openai"
# LM Studio default is 1234; Ollama's OpenAI-compatible surface is 11434
$env:HARNESS_DECISION_ENDPOINT = "http://127.0.0.1:1234"

# Optional. When unset, the backend probes /v1/models and records revision "local-unpinned".
$env:HARNESS_DECISION_MODEL = "qwen2.5-coder-7b-instruct"
$env:HARNESS_DECISION_REVISION = "q4_k_m-2026-09"

$env:HARNESS_DECISION_TIMEOUT_MS = "3000"
```

Keep this below the advisory budget in `modelPolicy.localDecisionSidecar.timeoutMs` (1500 ms) plus
a small margin. The harness advisory call aborts at its own budget, but the sidecar's upstream
request keeps running and holds the single queue slot until it completes. A long backend timeout
therefore blocks the *next* decision, not the current one.

Start it:

```powershell
npm run harness:decision:sidecar:lite
```

Verify:

```powershell
curl http://127.0.0.1:11437/health
curl http://127.0.0.1:11437/ready
```

`/ready` reports `residencyVerified: false` by default — the backend confirmed the server is
reachable and the model id resolves, but did not force a model load. Pass `--warmup` if you want
`/ready` to mean the model is actually resident, at the cost of loading it at startup.

## Server prerequisites

The lite backend needs `logprobs` on the OpenAI-compatible chat route. Confirm before enabling:

```powershell
curl -Method POST http://127.0.0.1:1234/v1/chat/completions `
  -ContentType "application/json" `
  -Body '{"model":"<id>","messages":[{"role":"user","content":"A or B?"}],"max_tokens":1,"logprobs":true,"top_logprobs":2}'
```

A response without `choices[0].logprobs.content` means the server or model does not support
logprobs. The sidecar then reports unavailable and deterministic routing continues unchanged.

## Option-count ceiling

`top_logprobs` is capped at 20 upstream. The lite backend accepts **at most 20 options** per
question and rejects more with `unsupported_option_count`. It never truncates a distribution
silently. Decision sites with more than 20 options need the heavy backend.

## Known limits

- Single-token label scoring has **position bias** — models over-select the first label. Not
  corrected. This is why the sidecar stays in shadow mode until calibrated against labeled data.
- `local-unpinned` revisions are not reproducible across model swaps. A swap mid-session is
  detected; an equivalent reload of different weights under the same id is not.
- One model server shared between the coding loop and the sidecar means a long generation can
  queue ahead of a decision. At shadow volumes the 1500 ms advisory timeout degrades cleanly to an
  `unavailable` receipt.
