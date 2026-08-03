---
applyTo: '**'
---

# Hardware Profile: Proxmox LXC — 2× Xeon E5-2640 v3, 50 GB RAM, SSD, No GPU

Target machine for Ollama inference inside a Proxmox LXC container. Apply these settings when working in this environment.

## Quant format — pick correctly or inference stalls

E5-2640 v3 has AVX2 + FMA3 but **no AVX-512**. Ollama auto-selects the AVX2 llama.cpp kernel automatically.

| Quant | Verdict | Reason |
|---|---|---|
| `Q4_K_M` | **Use this** | Best AVX2 throughput; well-optimized kernels |
| `Q5_K_M` | Acceptable | ~10% slower, marginal quality gain |
| `Q8_0` | Avoid | 2× memory bandwidth, no real quality gain |
| `IQ2_XS` / `IQ3_S` | Avoid | Tuned for AVX-512; slow on Haswell |
| `F16` | Never | No native FP16 on Haswell — fully emulated |

Pull models explicitly as Q4_K_M to avoid Ollama selecting a larger default quant:

```bash
ollama pull qwen2.5-coder:14b-instruct-q4_K_M
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull qwen2.5:32b-instruct-q4_K_M
ollama pull nomic-embed-text
```

## Proxmox LXC container config

Edit `/etc/pve/lxc/<CTID>.conf` on the **Proxmox host**, then restart the CT:

```ini
cores: 16
memory: 51200
swap: 0
lxc.cgroup2.cpuset.cpus: 0-7,16-23
lxc.cgroup2.cpuset.mems: 0
lxc.prlimit.nofile: 1048576
```

Why each line matters:

| Setting | Reason |
|---|---|
| `cores: 16` | All 16 physical cores required — 8 cores (single socket) causes model to appear unresponsive |
| `memory: 51200` | Full 50 GB assigned; 32b model fits at ~18 GB with ~30 GB headroom |
| `swap: 0` | Swap destroys inference latency — always disabled |
| `cpuset.cpus: 0-7,16-23` | Socket 0 physical cores + HT siblings; blocks cross-socket NUMA traffic |
| `cpuset.mems: 0` | All allocations stay on socket 0's memory controller |
| `nofile: 1048576` | Ollama mmaps the model file; default OS limit of 1024 causes load failures |

Alternative cpuset if you need HT siblings available to other CTs:

```ini
lxc.cgroup2.cpuset.cpus: 0-15
```

## Ollama systemd drop-in (inside the CT)

Create `/etc/systemd/system/ollama.service.d/xeon-v3-tuning.conf`:

```ini
[Service]
Environment="OLLAMA_NUM_THREADS=16"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_KEEP_ALIVE=30m"
Environment="OLLAMA_HOST=0.0.0.0:11434"
ExecStart=
ExecStart=numactl --cpunodebind=0 --membind=0 /usr/local/bin/ollama serve
```

Apply:

```bash
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

Why each setting matters:

| Setting | Reason |
|---|---|
| `OLLAMA_NUM_THREADS=16` | Physical cores only; HT siblings hurt llama.cpp throughput |
| `OLLAMA_NUM_PARALLEL=1` | One request at a time; two concurrent requests halve t/s each |
| `OLLAMA_MAX_LOADED_MODELS=1` | Prevents two models competing for the same 50 GB |
| `numactl --cpunodebind=0 --membind=0` | **Critical** — without this, memory crosses the inter-socket QPI bus and the 14b model produces no output at all |

## NUMA — why models stall without pinning

With 2× E5-2640 v3 you have 2 NUMA nodes (one per socket). If Ollama allocates model weights across both nodes, every token generation crosses the inter-socket interconnect. On Haswell this is severe enough that a 14b model appears to produce no output — it is actually running, but latency per token exceeds any reasonable timeout.

Verify NUMA is pinned correctly inside the CT:

```bash
cat /proc/self/status | grep Cpus_allowed_list
# Should show: 0-7,16-23

numactl --hardware
# Should show: node 0 only available
```

## Expected performance ceiling

| Model | RAM (Q4) | ~t/s | First token |
|---|---|---|---|
| `llama3.1:8b-instruct-q4_K_M` | 4.5 GB | ~18 t/s | ~10 s |
| `qwen2.5-coder:14b-instruct-q4_K_M` | 8.5 GB | ~10 t/s | ~15 s |
| `qwen2.5:32b-instruct-q4_K_M` | 18 GB | ~4 t/s | ~30 s |
| `nomic-embed-text` | 0.3 GB | — | — |

These are the hardware ceiling for Haswell/AVX2 with no GPU. The only lever beyond this is compiling llama.cpp from source with `-DGGML_AVX2=ON -DGGML_AVX512=OFF` for a ~5% gain — not worth it until the above config is confirmed working.

## Harness environment variables

Set in the container's `/etc/environment` or in your shell profile on the client machine:

```bash
export HARNESS_LLM_PROVIDER=ollama
export HARNESS_LLM_HOST=http://<CT-IP>:11434
export HARNESS_LLM_MODEL=qwen2.5-coder:14b-instruct-q4_K_M
export HARNESS_EMBED_MODEL=nomic-embed-text
export HARNESS_EMBED_TIMEOUT_MS=120000
export HARNESS_FS_CHUNK_SIZE=2000
export HARNESS_FS_CHUNK_OVERLAP=200
export HARNESS_FS_MAX_FILE_BYTES=524288
```

## Verification checklist

```bash
# 1. Confirm AVX2 is visible inside the CT (required for Ollama AVX2 kernel)
grep -o avx2 /proc/cpuinfo | head -1

# 2. Confirm NUMA is pinned to socket 0
cat /proc/self/status | grep Cpus_allowed_list

# 3. Confirm Ollama is running and reachable
curl http://localhost:11434/api/version

# 4. Quick inference smoke test (~10 s)
curl http://localhost:11434/api/generate \
  -d '{"model":"llama3.1:8b-instruct-q4_K_M","prompt":"hello","stream":false}'

# 5. Check memory pressure — should be 0 pages swapped
vmstat 1 3 | awk '{print $7, $8}'
```

## RAM budget at steady state

| Component | RAM |
|---|---|
| Ubuntu CT (OS + services) | ~0.5 GB |
| Ollama runtime | ~0.5 GB |
| `qwen2.5-coder:14b` Q4 + KV cache | ~10–11 GB |
| **Free headroom** | **~38 GB** |

The 32b model (~18 GB) fits comfortably. `llama3.1:8b` and `qwen2.5-coder:14b` can both stay resident simultaneously (~13 GB combined) to eliminate model-swap overhead.

## harness.config.json profile key

Profile name: `proxmox-lxc-xeon-v3-50gb`

```bash
export HARNESS_HW_PROFILE=proxmox-lxc-xeon-v3-50gb
```
