# Jev Local Model Bake-off — 2026-09-30

Brief: [jev-local-model-bakeoff-2026-09-30.md](../../memory/briefs/jev-local-model-bakeoff-2026-09-30.md)
Candidates: [decision-bakeoff-candidates.json](../../eval/decision-bakeoff-candidates.json)
Command: `node scripts/harness/decision-bakeoff.mjs --repo-root . --timeout-ms 30000`

Hardware: `windows-wsl2-gpu-16gb` (RTX 5070 Ti 16 GB), Ollama 0.34.4, lite logprob backend, Q4_K_M GGUF.
Fixture: 12 model-authored intent cases, `minProbability` 0.7, `minMargin` 0.15. This is smoke evidence
and it cannot separate close candidates.

## Results

| Rank | Candidate / style | Correct | Wrong | Abstain | Confident-wrong | p50 ms | Status |
|---|---|---|---|---|---|---|---|
| 1 | qwen3.5-4b-q4 / chat | 11 | 0 | 1 | 0 | 108–110 | eligible |
| 2 | jev-style-v2-2b-q8 / jev | 6 | 0 | 6 | 0 | 53–56 | eligible (single-author, frozen reference) |
| 3 | qwen3.5-2b-q4 / json | 3 | 0 | 9 | 0 | 54 | eligible, mostly abstains |
| — | qwen3.5-4b-q4 / json | 11 | 1 | 0 | 1 | 90–93 | DQ confident-wrong |
| — | qwen3.5-4b-q4 / jev | 9 | 1 | 2 | 1 | 92 | DQ confident-wrong |
| — | minicpm5-2b-q4 / json | 6 | 1 | 5 | 1 | 47 | DQ confident-wrong |
| — | qwen2.5-1.5b-instruct-q4 / jev, json | 6 | 2, 4 | 4, 2 | 2, 4 | 25–38 | DQ confident-wrong |
| — | qwen3.5-2b-q4 / jev | 3 | 5 | 4 | 5 | 56 | DQ confident-wrong |
| — | minicpm5-2b-q4 / jev | — | — | — | — | — | warmup-failed `low_label_mass` |
| — | qwen3-4b-instruct-2507-q4 / jev, json | — | — | — | — | — | warmup-failed `missing_logprobs` (Ollama returns an empty first token) |
| — | local-jev server (5 models) | — | — | — | — | — | not-running (needs Python + torch, not installed) |

Leader detail (repeat run): p95 120 ms, 3.14 GB VRAM, Ollama digest `03f907b6ff0f…` recorded as revision.

## Findings

- **Best local option: Qwen3.5-4B Q4_K_M, chat layout, thinking suppressed.** It matches the
  published ranking (local-jev and SemIf both lead with Qwen3.5-4B) and is an organisation-published
  Apache-2.0 base model, which avoids the freeze's single-author durability blocker.
- Hybrid reasoning models spend the forced token on `Thinking` unless `reasoning_effort: "none"` is
  sent. Before the new label-mass guard, the old backend would have renormalised that noise into
  confident answers; now it fails closed.
- Prompt layout matters by model: JSON gave full coverage for Qwen3.5-4B but one confident-wrong.
  local-jev's "JSON beats plain" finding did not carry over to this workload.
- Sub-2B models were all fast but either confidently wrong or mostly abstaining.

## Not established

Human-labelled cases (0/100), held-out calibration, jevcompat conformance, JevBench score, and
LM Studio parity. The freeze stays in force; this run is report-only.
