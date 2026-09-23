# Local Open Agent Model Evidence - 2026-09-23

## Scope

Evaluate Jev-style open/agentic model signals and decide which open-weight local model candidates
belong in the harness workflow for existing hardware profiles. This artifact does not change hosted
Copilot stage routing; it supports advisory local/offline policy and deterministic workflow gates.

## Sources Checked

- OpenRouter rankings: `https://openrouter.ai/rankings`
- OpenRouter direct model URL attempted: `https://openrouter.ai/typesafe/jev-1.13`
- LLM Stats Open LLM Leaderboard: `https://llm-stats.com/leaderboards/open-llm-leaderboard`
- BenchLM leaderboard: `https://benchlm.ai/`
- Existing hardware profile notes in `harness.config.json`

## Evidence Taxonomy

| Evidence class | Meaning | Can become executable default? |
| --- | --- | --- |
| `adoption-signal` | Usage/trending evidence only, such as OpenRouter token traffic. | No. |
| `benchmark-quality` | Public benchmark/leaderboard quality signal. | No, not by itself. |
| `artifact-available` | A downloadable local artifact or known Ollama/LM Studio identifier exists. | No, not by itself. |
| `profile-fit` | Parameter/quant/memory estimate fits a named hardware profile. | No, not by itself. |
| `locally-measured` | This repo or operator has measured the model on the named hardware profile. | Yes, within the measured lane and profile. |

## Jev Signal

OpenRouter ranks `Jev 1.13` by `typesafe` as a new/trending model this week with about `1.03T`
tokens processed. OpenRouter states its usage rankings measure adoption, not quality. The direct
OpenRouter model URL tried during this run returned HTTP 404, and no local open-weight artifact was
verified.

Decision: `jev-1.13` is `signal-only`. It can inspire agentic coding candidate scouting, but it must
not become a local executable default until it has `artifact-available`, `profile-fit`, and
`locally-measured` evidence.

## Open-weight Candidate Signals

| Candidate | Evidence | Local policy decision |
| --- | --- | --- |
| `qwen2.5:latest` | Existing repo local assistant hint; current hardware profile-compatible Ollama model. | Keep as `supported-default` for assistant/triage lanes where configured. |
| `qwen2.5-coder:14b` / `qwen2.5-coder:14b-instruct-q4_K_M` | Existing repo local dev hint and hardware profile recommendation; known Q4 footprint around 8.5 GB. | Keep as `supported-default` for dev/code-repair on 50 GB CPU; too large for 8 GB Mac default. |
| `devstral:24b` | Existing repo full local hint; local validation artifact from prior refresh recorded pass. | Keep as `supported-default` / `optional-measured` for full local workflows on 50 GB CPU only. |
| `qwen2.5-coder:32b` | Existing notes show high quality but slower and transient local failures in prior measurement. | `optional-measured` on 50 GB CPU, never default. |
| `qwen3.8-max` | BenchLM best open-weight signal; LLM Stats top open model. Very large model family. | `candidate-unverified` for remote/open-provider scouting; `disallowed` for 8 GB Mac and 50 GB CPU local defaults until a quantized local artifact is measured. |
| `qwen3.8-27b` | BenchLM/LLM Stats list open-weight 27B-class candidate. | `candidate-unverified` on 50 GB CPU profiles; `disallowed` on 8 GB Mac. |
| `deepseek-v4.1-flash` / `deepseek-v4-flash-0731` | LLM Stats coding/adoption leaders; OpenRouter usage leader among open families. | `candidate-unverified`; do not default without local artifact and measurement. |
| `glm-5.3` / `glm-5.3-flash` | LLM Stats top open-weight family and OpenRouter usage leader. | `candidate-unverified`; useful for future remote/open-provider evaluation, not local default. |
| `kimi-k3` | LLM Stats top GPQA/open long-context signal; Copilot caveat in hosted config. | `candidate-unverified` for local; likely too large for current local defaults. |
| `kimi-k2.7-code` | Copilot supported open-weight coding model; scheduled replacement by Kimi K3 in hosted policy. | `candidate-unverified`; avoid new local default. |
| `mimo-v2.6-pro` / `mimo-v2.6-flash` | New OpenRouter trending/open leaderboard entries. | `candidate-unverified` until artifact and local measurements exist. |

## Hardware Fit Matrix

| Hardware profile | supported-default | optional-measured | candidate-unverified | disallowed |
| --- | --- | --- | --- | --- |
| `macbook-air-m1-8gb` | `Qwen2.5-Coder-7B-Instruct-Q4_K_M`, `Phi-4-Mini-Instruct-Q4_K_M` | `Meta-Llama-3.1-8B-Instruct-Q4_K_M` | future 7B-class Qwen/DeepSeek/GLM coder quants | 14B+, 27B+, 32B+, 70B, large MoE models |
| `proxmox-lxc-xeon-v3-50gb` | `qwen2.5-coder:14b-instruct-q4_K_M`, `llama3.1:8b-instruct-q4_K_M` | `qwen2.5:32b-instruct-q4_K_M` if NUMA/latency remains acceptable | 24B-32B Q4-class new open models such as `qwen3.8-27b` after artifact verification | 70B and large MoE models by default because NUMA pinning reduces the safe memory envelope |
| `cpu-only-50gb-intel` | `qwen2.5:14b`, `llama3.1:8b` | `qwen2.5:32b`, `devstral:24b` | 24B-32B Q4-class Qwen/DeepSeek/GLM/MiMo candidates after artifact verification | 70B and large MoE models unless separately measured with acceptable latency and memory pressure |

## Deterministic Workflow Lanes

| Lane | Allowed stages / loops | Forbidden stages | Required proofs | Escalation |
| --- | --- | --- | --- | --- |
| `local-assistant-triage` | assistant mode, `diagnose`, `technique-triage` | architect, review-depth, feedback, security-sensitive decisions | graph status when code impact is claimed; cited evidence artifact for model recommendations; docs check for docs edits | high-reasoning cloud route for architecture/security/review |
| `local-dev-implementation` | implement, prototype, build-fix, test-fix, tdd-cycle | architect, review-depth, feedback | relevant focused test or config validation; review-breadth before closure; route smoke when routing config changes | high-reasoning review route if multi-file/shared/security work appears |
| `local-loop-repair` | convergence loops with max iterations and existing checks | weakening loop guardrails or deleting checks | loop terminal state plus command output; no skipped/empty checks | human approval if guardrails or destructive defaults must change |
| `local-offline-fallback` | assistant/dev only when hosted models unavailable | final approval, feedback adjudication, security review, destructive operations | record reduced-confidence note; run deterministic validation matrix before claiming completion | rerun review on hosted high-reasoning model when available |

## Adopted Policy

- Use local open models to reduce cost and preserve offline capability in assistant, triage, prototype,
  implementation, and bounded loop lanes.
- Preserve hosted high-reasoning or equivalent reviewer lanes for architecture, review-depth,
  feedback, security, destructive operations, and final adjudication.
- Require `locally-measured` evidence before promoting any new local model beyond advisory candidate.
- Treat OpenRouter usage as adoption signal only.

## Validation Commands

- `node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"`
- `npm run test:harness:local-open-model-policy`
- `npm run harness:catalog:sync`
- `npm run harness:docs:check`
- `git diff --check`