---
applyTo: '**'
---

# Hardware Profile: MacBook Air M1, 8 GB Unified RAM, LM Studio

Target machine for local LM Studio inference on Apple Silicon. Apply these settings when working in this environment.

## Environment variables

Set in `~/.zshrc`, `~/.bash_profile`, or a `.env` file at the repo root:

```bash
export HARNESS_LLM_PROVIDER=lmstudio
export HARNESS_LLM_HOST=http://localhost:1234

# Copy the exact model identifier from LM Studio → My Models (hover the loaded model)
export HARNESS_LLM_MODEL=lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf

# LM Studio embed model — load nomic-embed-text in LM Studio first
# The model identifier must match what LM Studio shows; common variants:
#   nomic-ai/nomic-embed-text-v1.5-GGUF  or  nomic-embed-text-v1.5
export HARNESS_EMBED_MODEL=nomic-ai/nomic-embed-text-v1.5-GGUF/nomic-embed-text-v1.5.Q8_0.gguf

# 60 s covers cold-start model load on first embed call; subsequent calls are <5 s
export HARNESS_EMBED_TIMEOUT_MS=60000

export HARNESS_FS_CHUNK_SIZE=2000
export HARNESS_FS_CHUNK_OVERLAP=200
export HARNESS_FS_MAX_FILE_BYTES=524288
```

## LM Studio prerequisites — verify before running

```bash
# Confirm LM Studio server is running (default port 1234)
curl -s http://localhost:1234/v1/models | head -5

# Confirm the harness can reach it
node -e "
  const r = await fetch('http://localhost:1234/v1/models');
  console.log('status:', r.status, await r.text().then(t => t.slice(0,120)));
" --input-type=module
```

LM Studio must be started with the **local server enabled** (toggle in the left sidebar → Local Server tab → Start Server).

## M1 unified memory — why 8 GB is the real constraint

The M1 has a single memory pool shared by CPU, GPU (Neural Engine), and all apps. With macOS
typically holding 2–3 GB at idle, the effective budget for model weights is **5–6 GB**.

| Model | GGUF size (Q4_K_M) | Fits in 8 GB? | Notes |
|---|---|---|---|
| Phi-4-mini (3.8B) | ~2.3 GB | Yes — headroom | Fast loops, assistant tasks |
| Qwen2.5-Coder-7B | ~4.3 GB | Yes — safe | Best coder quality/speed balance |
| Llama-3.1-8B | ~5.0 GB | Marginal | Works but leaves little KV cache headroom |
| Qwen2.5-14B | ~8.8 GB | No | Exceeds total RAM |
| Any 13B+ | >8 GB | No | Will be paged to swap; unusable latency |

**Context window recommendation:** stay at `ctx ≤ 2048` for the 7B model on 8 GB. Larger
contexts expand the KV cache and can cause macOS memory pressure, which triggers swap and
destroys throughput. LM Studio exposes this as the **Context Length** setting under the loaded
model → Configure.

## Metal GPU — how LM Studio uses it

LM Studio on Apple Silicon uses the **Metal backend** (llama.cpp Metal) automatically when you
load a GGUF model. No manual flag is needed. The **Neural Engine is not used** for GGUF
inference — only Metal (the GPU shader cores). MLX-format models would use the Neural Engine,
but those require a different model format and are outside the harness GGUF workflow.

Practical token-per-second estimates with Metal on M1 8 GB:

| Model | Format | ~Speed | First-token latency |
|---|---|---|---|
| Phi-4-mini (3.8B) | GGUF Q4_K_M | ~35–50 t/s | ~3–5 s |
| Qwen2.5-Coder-7B | GGUF Q4_K_M | ~20–30 t/s | ~5–8 s |
| Llama-3.1-8B | GGUF Q4_K_M | ~15–20 t/s | ~8–12 s |

These are significantly faster than CPU-only servers (e.g., Haswell at ~10–18 t/s for 7–8B
models). First-token latency is dominated by model-load time on the first prompt; subsequent
prompts in the same session start in <1 s (model stays in VRAM).

## LM Studio model loading guidance

**Copy model identifiers from the LM Studio UI** — do not guess them. The identifier format is:
`<author>/<repo>/<filename>` (e.g., `lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf`).

Steps to find the identifier:
1. Open LM Studio → **My Models**
2. Hover over a model → click the **copy identifier** icon (or right-click → Copy Identifier)
3. Paste into `HARNESS_LLM_MODEL` / `HARNESS_EMBED_MODEL`

**Only one model can serve the API at a time.** If the generation model and the embed model are
different, you must load/unload between tasks — or load the embed model into a second LM Studio
instance on a different port (unsupported by the harness without changing `HARNESS_LLM_HOST` and
`HARNESS_EMBED_HOST` separately).

**Practical workaround for 8 GB:** use an embed model that is also a generation model (e.g.,
nomic-embed-text serves only embeddings), and keep the generation model loaded permanently while
switching only for embed tasks if needed. Most harness workflows do not interleave generation and
embedding in the same loop iteration, so this is usually not an issue in practice.

## harness.config.json hardware profile key

Profile name: `macbook-air-m1-8gb`

```json
"macbook-air-m1-8gb": {
  "description": "MacBook Air M1 @ 3.2 GHz, 8 GB unified RAM, Metal GPU, LM Studio inference",
  "recommendedGenerationModels": [
    { "model": "lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf", "q4SizeGB": 4.3, "note": "coder mode — ~20-30 t/s with Metal" },
    { "model": "lmstudio-community/Phi-4-Mini-Instruct-GGUF/Phi-4-Mini-Instruct-Q4_K_M.gguf",              "q4SizeGB": 2.3, "note": "assistant/loop mode — ~35-50 t/s" },
    { "model": "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf","q4SizeGB": 5.0, "note": "general mode — marginal fit; reduce ctx to 2048" }
  ],
  "recommendedEmbedModels": [
    { "model": "nomic-ai/nomic-embed-text-v1.5-GGUF/nomic-embed-text-v1.5.Q8_0.gguf", "sizeMB": 274, "note": "768-dim; fast on Metal" }
  ],
  "harnessEnv": {
    "HARNESS_LLM_PROVIDER": "lmstudio",
    "HARNESS_LLM_MODEL": "lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
    "HARNESS_LLM_HOST": "http://localhost:1234",
    "HARNESS_EMBED_MODEL": "nomic-ai/nomic-embed-text-v1.5-GGUF/nomic-embed-text-v1.5.Q8_0.gguf",
    "HARNESS_EMBED_TIMEOUT_MS": "60000",
    "HARNESS_FS_CHUNK_SIZE": "2000",
    "HARNESS_FS_CHUNK_OVERLAP": "200",
    "HARNESS_FS_MAX_FILE_BYTES": "524288"
  }
}
```

## RAM budget at steady state

| Component | RAM used |
|---|---|
| macOS + system services | ~2–3 GB |
| LM Studio app | ~0.3 GB |
| Harness (Node.js) | ~0.3 GB |
| Active generation model | 2.3–5.0 GB |
| Active embed model | ~0.3 GB |
| **Free headroom** | **0.1–3 GB** |

**Note:** at 8 GB total, there is no headroom for running both the 7B generation model and the
embed model simultaneously if macOS is under memory pressure. If you see paging (`vm_stat | grep
"Pages swapped out"` > 0), close other applications and reload the model in LM Studio.

## Comparison to Ollama on M1

Ollama also runs on Apple Silicon with Metal acceleration. If you prefer Ollama over LM Studio:

```bash
export HARNESS_LLM_PROVIDER=ollama
export HARNESS_LLM_HOST=http://localhost:11434
export HARNESS_LLM_MODEL=qwen2.5-coder:7b
export HARNESS_EMBED_MODEL=nomic-embed-text
export HARNESS_EMBED_TIMEOUT_MS=60000
```

Ollama is slightly easier to automate (CLI-driven model management); LM Studio has a better GUI
for interactive testing. Both use the same llama.cpp Metal backend under the hood and deliver
comparable inference speeds on M1.
