---
applyTo: '**'
---

# Hardware Profile: 2× Xeon E5-2640 v3, 50 GB RAM, No GPU

Target machine for local Ollama inference. Apply these settings when working in this environment.

## Environment variables

Set in `.env` or shell profile:

```bash
export HARNESS_LLM_PROVIDER=ollama
export HARNESS_LLM_HOST=http://localhost:11434

export HARNESS_LLM_MODEL=qwen2.5-coder:14b
export HARNESS_EMBED_MODEL=nomic-embed-text

# Haswell CPUs are slower — 2 min prevents embed timeout
export HARNESS_EMBED_TIMEOUT_MS=120000

export HARNESS_FS_CHUNK_SIZE=2000
export HARNESS_FS_CHUNK_OVERLAP=200
export HARNESS_FS_MAX_FILE_BYTES=524288

# Set once understand-anything plugin is cloned
export UNDERSTAND_PLUGIN_ROOT=/opt/understand-anything-plugin
```

## Ubuntu prerequisites — verify before running Ollama

```bash
# Confirm AVX2 is visible (it is on Haswell — if missing, check BIOS virtualization/CPU flags)
grep -o 'avx2' /proc/cpuinfo | head -1

# Confirm dual-socket NUMA topology
numactl --hardware
# Expected: 2 nodes, each with ~25 GB and 8 cores

# Install numactl if missing
sudo apt install -y numactl
```

## AVX2 without AVX-512 — what this means for model selection

E5-2640 v3 has AVX2 + FMA3 but **no AVX-512**. Ollama auto-detects this at startup and
links the AVX2 llama.cpp kernel — no manual flag is needed.

Practical impact on quant format choice:

| Quant | AVX2 throughput | Notes |
|---|---|---|
| `Q4_K_M` | Best | Primary recommendation; AVX2 kernels are well-optimized |
| `Q5_K_M` | Good | ~10% slower than Q4_K_M, slightly better quality |
| `Q8_0` | Poor | 2× the memory bandwidth with marginal quality gain; avoid |
| `IQ2_XS` / `IQ3_S` | Slow | IQ kernels benefit disproportionately from AVX-512; avoid on Haswell |
| `F16` | Very slow | Haswell has no native FP16 compute; all FP16 math is emulated |

## Inference engine choice for this server

| Engine | Verdict | Reason |
|---|---|---|
| **Ollama** | **Use this** | Wraps llama.cpp, auto-detects AVX2, handles model management, OpenAI API compatible, Open WebUI ready |
| llama.cpp bare (`llama-server`) | Optional upgrade | Same kernel as Ollama; compiling with `-DGGML_AVX2=ON -DGGML_AVX512=OFF` gives ~5% t/s gain, but adds ops complexity |
| vLLM | Not viable | Requires CUDA/ROCm — CPU-only mode is experimental and unmaintained; no benefit here |
| text-generation-webui | Avoid | Python overhead, wraps llama-cpp-python which wraps llama.cpp — three layers with no gain |

If you hit a t/s ceiling after applying NUMA pinning and Q4_K_M quants, the only remaining lever is compiling llama.cpp from source. Until then, Ollama is the correct choice.

**Pull models as Q4_K_M explicitly** to avoid Ollama pulling a larger default quant:
```bash
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull qwen2.5-coder:14b-instruct-q4_K_M
ollama pull qwen2.5:32b-instruct-q4_K_M
```

AVX-512 would double the SIMD width (512-bit vs 256-bit) and roughly double matrix-multiply
throughput. Without it, the token-per-second rates in the table below are the realistic ceiling
for this hardware class.

## NUMA — the real reason models stall on this server

With 2× E5-2640 v3 you have **2 NUMA nodes** (one per socket). If Ollama allocates model
weights across both nodes, every token generation crosses the inter-socket interconnect.
On Haswell this is severe enough that a 14b model appears to produce no output at all —
it is actually running, but latency per token exceeds any reasonable timeout.

**Fix: pin Ollama to one NUMA node.**

Option A — run Ollama under numactl (test first):
```bash
numactl --cpunodebind=0 --membind=0 ollama serve
```

Option B — add to the systemd drop-in (`xeon-tuning.conf`):
```ini
ExecStart=
ExecStart=numactl --cpunodebind=0 --membind=0 /usr/local/bin/ollama serve
```

This restricts Ollama to socket 0 (8 physical cores, ~25 GB RAM) — enough for the 8b and
14b models. The 32b model (18 GB q4) still fits within socket 0's memory allocation.

## Ollama systemd tuning

File: `/etc/systemd/system/ollama.service.d/xeon-tuning.conf`

```ini
[Service]
# 16 physical cores only — hyperthreads hurt llama.cpp throughput
Environment="OLLAMA_NUM_THREADS=16"
# Never load two models simultaneously — 50 GB fills fast
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_KEEP_ALIVE=30m"
# Required for Open WebUI reaching Ollama from Docker
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Apply with:
```bash
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

## Mode-to-model mapping

| Mode prefix | Model | ~Speed | RAM (q4) | First-token latency |
|---|---|---|---|---|
| `/ask:` (assistant) | `llama3.1:8b` | ~18 t/s | 4.5 GB | ~8–15 s |
| `/dev:` (coder) | `qwen2.5-coder:14b` | ~10 t/s | 8.5 GB | ~15–25 s |
| `/full:` (full feature) | `qwen2.5:32b` | ~4 t/s | 18 GB | ~30–60 s |
| embeddings | `nomic-embed-text` | — | 274 MB | — |

**Latency note:** Haswell CPUs have no hardware AI acceleration. Even the 8b model has a noticeable first-token delay (~8–15 s) on a cold prompt. This is normal for this hardware class. Token streaming begins after that delay and is subjectively faster than the cold start suggests.

The 8b and 14b models can stay resident simultaneously (13 GB combined), which eliminates model-swap overhead. The 32b requires a cold load (~15 s on Haswell) and evicts the others.

## harness.config.json hardware profile key

Profile name: `dual-xeon-e5-2640v3-50gb`

```json
"dual-xeon-e5-2640v3-50gb": {
  "description": "2× Intel Xeon E5-2640 v3 @ 2.6 GHz, 50 GB RAM, no GPU",
  "recommendedGenerationModels": [
    { "model": "llama3.1:8b",       "q4SizeGB": 4.5, "note": "assistant mode — ~18 t/s" },
    { "model": "qwen2.5-coder:14b", "q4SizeGB": 8.5, "note": "dev/coder mode — ~10 t/s" },
    { "model": "qwen2.5:32b",       "q4SizeGB": 18,  "note": "full feature mode — ~4 t/s" }
  ],
  "recommendedEmbedModels": [
    { "model": "nomic-embed-text",  "sizeMB": 274,   "note": "default embed model" }
  ],
  "ollamaEnv": {
    "OLLAMA_NUM_THREADS": "16",
    "OLLAMA_MAX_LOADED_MODELS": "1",
    "OLLAMA_NUM_PARALLEL": "1",
    "OLLAMA_KEEP_ALIVE": "30m",
    "OLLAMA_HOST": "0.0.0.0:11434"
  },
  "harnessEnv": {
    "HARNESS_LLM_PROVIDER": "ollama",
    "HARNESS_LLM_MODEL": "qwen2.5-coder:14b",
    "HARNESS_LLM_HOST": "http://localhost:11434",
    "HARNESS_EMBED_MODEL": "nomic-embed-text",
    "HARNESS_EMBED_TIMEOUT_MS": "120000"
  }
}
```

## RAM budget at steady state

| Component | RAM used |
|---|---|
| Ubuntu OS + services | ~2–3 GB |
| Harness (Node.js) | ~0.3 GB |
| Open WebUI (Docker) | ~0.5 GB |
| Ollama runtime | ~0.5 GB |
| Active model | 4.5–18 GB |
| **Free headroom** | **28–42 GB** |

## Optional: compile llama.cpp from source (AVX2-tuned)

Only do this if you have hit the Ollama t/s ceiling and want the ~5% gain from a CPU-targeted build.
The result replaces `ollama serve` with `llama-server`, which exposes the same OpenAI-compatible API.

### Build dependencies

```bash
sudo apt install -y build-essential cmake libcurl4-openssl-dev git
```

### Clone and build

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

cmake -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_AVX2=ON \
  -DGGML_AVX512=OFF \
  -DGGML_FMA=ON \
  -DGGML_F16C=ON \
  -DLLAMA_CURL=ON

cmake --build build --config Release -j $(nproc)
```

`-DGGML_F16C=ON` enables Haswell's float16↔float32 conversion instructions (not full FP16 compute, but speeds up attention weight casting).

### Run the server

```bash
# Pin to socket 0, same as Ollama tuning
numactl --cpunodebind=0 --membind=0 \
  ./build/bin/llama-server \
    --model /path/to/qwen2.5-coder-14b-instruct-q4_K_M.gguf \
    --ctx-size 4096 \
    --threads 16 \
    --host 0.0.0.0 \
    --port 11434
```

Open WebUI connects to `http://host-ip:11434` — same URL as Ollama, no config change needed.

### Model files

GGUF files can be downloaded directly from Hugging Face without Ollama:

```bash
# Example — adjust repo/filename as needed
wget https://huggingface.co/bartowski/Qwen2.5-Coder-14B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf
```

