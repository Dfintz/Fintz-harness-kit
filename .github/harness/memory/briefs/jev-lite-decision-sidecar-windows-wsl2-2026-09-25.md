# Jev Lite Decision Sidecar — Windows + WSL2 + GPU

resource: scripts/harness/decision-sidecar.mjs, scripts/harness/semif-worker.py, scripts/harness/decision-advisory.mjs, scripts/harness/decision-policy.mjs, harness.config.json, package.json, docker-compose.harness.yml, .github/instructions/hardware-macbook-air-m1-8gb.instructions.md, .github/harness/memory/briefs/semif-local-decision-sidecar-2026-09-25.md, .github/harness/memory/radar/jevcompat-sidecar-conformance-gate.md, .github/harness/memory/radar/manus-kv-cache-stable-prefix.md

## Architecture Brief

### Objective

Deliver a **lightweight edition** of the Jev/SemIf local decision sidecar for a
Windows 11 + WSL2 + NVIDIA GPU workstation that already runs Docker Desktop, Ollama, and
LM Studio — with no Python, no Torch, no CUDA toolchain, and no second resident model.

The lightweight edition reuses the already-running local inference server as the scorer and
keeps the existing `/v1/systemone` wire contract byte-compatible.

### The performance insight this design is built on

A System One typed decision needs a **probability distribution over a small fixed option set**,
not free-form text. That is one prefill and **zero decode steps**. The heavy edition spends a
multi-GB Torch process and a 4B BF16 model to produce it. The same distribution is obtainable
from any OpenAI-compatible server that returns `logprobs` for a single forced token.

Consequence: the fastest and lightest correct design is a **single-token label logprob scorer**
against the model server the operator is already paying VRAM for.

| | Heavy edition (existing) | Lite edition (this brief) |
|---|---|---|
| Runtime | Python 3.11/3.12 + Torch + CUDA in WSL2 | Node only, already present |
| Resident model | 2nd model, Qwen3.5-4B BF16 (~9 GB VRAM) | reuse loaded Ollama/LM Studio model |
| Install surface | pip stack + HF weights download | none |
| Per-decision cost | prefill + Torch scoring call | prefill only, `max_tokens: 1` |
| Wire contract | `/v1/systemone` v1 | identical |
| Pinning strength | HF `source@revision` | server model id, may be unpinned |

### Scope and boundaries

- **In scope:** one new scorer backend speaking the existing worker-result shape, CLI backend
  selection in `decision-sidecar.mjs`, a Windows/WSL2/GPU hardware profile, advisory config for
  the lite backend, deterministic tests with an injected fetch, and operator guidance for where
  to run each process.
- **Out of scope:** changing `createDecisionSidecar`, the HTTP contract, `decision-advisory.mjs`,
  `decision-policy.mjs`, or `prompt-router.mjs`; enabling the sidecar by default; promoting past
  shadow mode; multi-provider failover; model downloads; a GPU container; calibration.

### Artifacts to create

- `scripts/harness/decision-backend-openai.mjs` — `OpenAiLogprobScorer` implementing
  `{ start, ready, metadata, score, close }` against `POST {endpoint}/v1/chat/completions`.
- `scripts/harness/test/decision-backend-openai-test.mjs` — deterministic tests with injected
  `fetch`: label mapping, renormalization, missing-label floor, option-count bound, readiness
  probe failure, model identity stability, timeout/abort.
- `.github/instructions/hardware-windows-wsl2-rtx5070ti.instructions.md` — hardware profile
  matching the three existing profiles.

### Artifacts to modify

- `scripts/harness/decision-sidecar.mjs` — CLI only: `--backend semif|openai` selecting the
  scorer. `createDecisionSidecar` and every exported validator/mapper stay untouched.
- `harness.config.json` — `modelPolicy.localDecisionSidecar.backends` (advisory metadata, still
  `enabled: false`) and `modelPolicy.localOpenModels.hardwareFit["windows-wsl2-gpu-16gb"]`.
- `package.json` — `harness:decision:sidecar:lite` and `test:harness:decision-backend-openai`,
  the latter folded into `test:harness:decision-sidecar`.

### Key decisions

**Gate 1 — Domain/module alignment: PASS.** Scoring transport is a backend concern. It goes in a
new sibling module next to `semif-worker.py`, not inside the HTTP service.

**Gate 2 — Generality: PASS.** The backend targets the OpenAI `chat/completions` + `logprobs`
surface, which LM Studio, Ollama, llama.cpp `llama-server`, and vLLM all expose. Nothing in it is
Windows-specific; the Windows specifics live in a documentation profile.

**Gate 3 — Ownership: PASS.** `decision-sidecar.mjs` owns the wire contract and queue. The
backend owns model identity and probability production only. `prompt-router.mjs` still owns the
authoritative route.

**Gate 4 — Boundary integrity: PASS.** The backend returns the exact existing worker-result shape
(`option_ids`, `probabilities`, `input_tokens`, `model`), so `normalizeWorkerResult` validates it
unchanged. No new validation path is introduced.

**Gate 4b — Isolation/safety: PASS with constraints.** Loopback bind is unchanged. The backend
talks only to an operator-configured local endpoint, sends no credentials, applies a hard request
timeout via `AbortSignal`, and caps prompt size. Option descriptions are sent to a **local** model
server — the same trust boundary the heavy edition already crosses.

**Gate 5 — Reuse: PASS.** Reuses the queue, validators, answer mapping, advisory receipts,
uncertainty policy, and test harness. Net new logic is prompt construction and logprob→
distribution mapping.

**Scoring contract.**

- Prompt layout is **prefix-stable by construction**: system instruction → `state` → option
  legend → question. The varying part is last, so the KV prefix cache is reused across all
  questions in one `/v1/systemone` request. This is the single largest latency lever and is a
  design constraint, not an optimization.
- Request: `max_tokens: 1`, `temperature: 0`, `top_p: 1`, `logprobs: true`,
  `top_logprobs: min(20, optionCount)`, `stream: false`.
- Options are labeled with single-character ASCII labels `A..T`. Labels are chosen so each maps
  to one token on standard BPE vocabularies.
- Distribution: `exp(logprob)` for each returned top-logprob token whose trimmed text matches a
  label; labels absent from the top-k receive a floor of `1e-6`; the vector is renormalized over
  the option set. Renormalization to sum 1 is re-verified by the existing sidecar normalizer.
- `input_tokens` comes from `usage.prompt_tokens`, defaulting to `0` when the server omits it.

**Option-count bound.** `top_logprobs` is capped at 20 by the OpenAI API and by LM Studio and
Ollama. The lite backend therefore accepts **at most 20 options** and rejects more with a clear
`unsupported_option_count` error rather than silently returning a truncated distribution. The
heavy backend keeps the contract's 64-option ceiling. This is a documented capability difference,
not a contract change: `rowsFromSystemOneRequest` still validates up to 64 and the backend fails
loudly. The ceiling is published as `backends.openai.maxOptions` in config so an operator sees it
before enabling.

**Model identity.** `metadata()` returns
`{ source, revision, backend: "openai-logprobs", device, dtype }`. `source` is the server-reported
model id, captured once at readiness and asserted stable on every response — a model swap inside
LM Studio mid-session is detected by the existing identity check. `revision` is operator-supplied;
when unset it is the literal `"local-unpinned"`. `"local-unpinned"` is a **promotion blocker**: it
is recorded in the receipt, and the backend emits a one-line startup warning so an operator cannot
acquire an unpinned decision model silently.

**Readiness.** `start()` performs one `GET {endpoint}/v1/models` probe and resolves the model id.
A `GET /v1/models` probe proves reachability, not residency, so `/ready` would otherwise diverge
from the parent brief's definition of ready. Resolution: an opt-in `--warmup` flag issues one
1-token scoring request at startup, restoring the parent meaning. It is **off by default** so the
sidecar never forces a model load the operator did not intend. `metadata()` carries
`residencyVerified: boolean` so `/ready` reports which of the two meanings applies.

**Process placement (the Windows/WSL2/GPU part).** Recommended topology for lowest latency:

- LM Studio or Ollama runs **natively on Windows** with the CUDA backend. Native Windows CUDA
  avoids the WSL2 GPU paravirtualization layer and the WSL2↔Windows network hop.
- The sidecar runs as a **Node process on Windows**, loopback-bound, in the same network
  namespace as the model server.
- Docker Desktop is **not** used for the decision path. Running the sidecar in a container forces
  `host.docker.internal` traversal on every decision and removes the loopback guarantee.
- The existing `docker-compose.harness.yml` sidecars (dashboard, graph-refresh, harness-proxy)
  are unaffected and may keep running in Docker; they are not latency-critical.
- WSL2 remains the right home for the **heavy** edition when it is used, because the Torch/CUDA
  stack is Linux-first. The two editions are alternatives, never concurrent.

### Constraints

- The sidecar stays `enabled: false` and `mode: "shadow"`. This brief changes cost, not authority.
- No change to any exported symbol of `decision-sidecar.mjs` other than adding backend selection
  inside `main()`.
- Every outbound request carries an abort signal bounded by the configured request timeout.
- No API key, `Authorization` header, or credential is read or forwarded.
- The backend must never bind, listen, or accept — it is a client only.
- Tests must inject `fetch`; no test may require a running model server or network access.

### Validation plan

- `npm run test:harness:decision-backend-openai` — new focused tests, non-zero check count.
- `npm run test:harness:decision-sidecar` — proves the existing HTTP, policy, advisory, and
  router-integration contracts are unchanged.
- `npm run test:harness:local-open-model-policy` — proves the additive hardware profile is valid.
- `npm run harness:config:self-test`.
- `npm run harness:docs:check`.
- `git diff --check`.
- Live GPU latency, VRAM, label-bias, and `jevcompat` conformance remain **unmeasured** and are
  required before this backend is used for anything beyond shadow observation.

### Architect Challenge outcome

Challenge record: `.github/harness/memory/reviews/architect-challenge-jev-lite-decision-sidecar-2026-09-25.md`.
Verdict was REVISE on the `/ready` semantic divergence. Three required revisions — opt-in
`--warmup` with `residencyVerified` reporting, an unpinned-revision startup warning, and a
published `maxOptions` capability field — are folded into the decisions above.

### Do NOT

- Do not change `/v1/systemone` request or response shapes.
- Do not modify `createDecisionSidecar`, `rowsFromSystemOneRequest`, `normalizeWorkerResult`,
  `answerFrom`, `decision-policy.mjs`, `decision-advisory.mjs`, or `prompt-router.mjs`.
- Do not enable the sidecar, leave shadow mode, or add promotion logic.
- Do not add a GPU container, a Docker profile for the sidecar, or a model pull.
- Do not send prompts to any non-loopback or hosted endpoint.
- Do not silently truncate an option set that exceeds the `top_logprobs` ceiling.
- Do not treat single-token label probabilities as calibrated confidence.

### Assumptions and risks

- `[UNVERIFIED]` LM Studio and Ollama both return `logprobs`/`top_logprobs` on their
  OpenAI-compatible `chat/completions` route in the operator's installed versions. If a server
  omits them, the backend reports unavailable and routing falls back deterministically — the
  existing fail-open path already covers this.
- `[UNVERIFIED]` Single-character labels tokenize to exactly one token on the chosen model's
  vocabulary. Mismatch degrades to floor probabilities across the board, which surfaces as low
  margin and therefore an `uncertain` receipt rather than a wrong confident answer.
- `[KNOWN RISK]` Single-token label scoring carries **position bias**: models over-select the
  first label. This is not corrected here. It is a calibration problem, and calibration was
  already a precondition for leaving shadow mode.
- `[KNOWN RISK]` `"local-unpinned"` revisions make results irreproducible across model swaps. The
  identity check detects a mid-session swap but not an equivalent reload of different weights
  under the same id.
- Sharing one model server between the coding loop and the decision sidecar means a long coding
  generation can queue ahead of a decision request. At shadow-mode volumes this is acceptable;
  under load the operator should pin a separate small model.
