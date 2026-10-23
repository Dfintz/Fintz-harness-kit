# Jev Local Model Bake-off Restart

resource: scripts/harness/decision-eval.mjs, scripts/harness/decision-backend-openai.mjs, scripts/harness/decision-sidecar.mjs, scripts/harness/decision-advisory.mjs, harness.config.json, package.json, .github/harness/eval/decision-intent-cases.json, .github/harness/memory/briefs/jev-decision-sidecar-freeze-2026-09-25.md, .github/harness/memory/briefs/decision-calibration-review-workflow-2026-09-28.md

## Architecture Brief

### Objective

Restart local Jev-style decision testing as one reproducible bake-off across the candidates named in
<https://codinghorizon.dev/jev-qwen-local-ai-that-takes-action/> (checked 2026-09-30) that can run on
`windows-wsl2-gpu-16gb`, rank them on this repository's intent workload, and name the best local
solution. The bake-off produces comparative evidence only. It does not unfreeze the sidecar.

### Scope and boundaries

- Understand: graph status `fresh: false`, 1 commit behind, refresh readiness ready. Impact map is
  source-grounded, not a fresh graph claim. Runtime: Ollama 0.34.4, RTX 5070 Ti 16 GB, no Python
  torch, WSL Ubuntu stopped, no LM Studio.
- Existing seams reused: `OpenAiLogprobScorer` (letter-token logprob readout, same method as
  local-jev's `llm` backend and SemIf's direct logits), `createDecisionSidecar`, and the live mode of
  `decision-eval.mjs`. The advisory already speaks the Jev `/v1/systemone` wire shape, so a running
  local-jev server is testable with `--endpoint`/`--model` alone.
- Key finding from the article sources: local-jev and SemIf both use **organisation-published base
  models** (Qwen team, OpenBMB; Apache-2.0) with a harness-side readout. That is the route around the
  freeze's single-author durability blocker; the readout contract becomes ours to version.

### Candidate matrix

| Candidate | Source | Runnable here | Decision |
|---|---|---|---|
| Qwen3.5-4B Q4_K_M | `bartowski/Qwen_Qwen3.5-4B-GGUF` (Qwen, Apache-2.0) | Ollama | test: jev, chat, json |
| Qwen3.5-2B Q4_K_M | `bartowski/Qwen_Qwen3.5-2B-GGUF` | Ollama | test |
| Qwen3-4B-Instruct-2507 Q4_K_M | `bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF` | Ollama | test |
| MiniCPM5-2B Q4_K_M | `openbmb/MiniCPM5-2B-GGUF` (OpenBMB, Apache-2.0) | Ollama | test |
| Qwen2.5-1.5B-Instruct Q4_K_M | `Qwen/Qwen2.5-1.5B-Instruct-GGUF` | Ollama | test |
| Jev-Style v2 2B / v3 0.8B | `chaoliangUNSW` (installed) | Ollama | reference re-run |
| local-jev `llm-*` / `nli-deberta-large` | `amithgc/local-jev` | needs Python+torch+9 GB | endpoint candidate, skipped unless server reachable |
| SemIf BF16 Qwen3.5-4B | existing `semif` backend | needs torch/CUDA | not run; GGUF row covers the model |
| NanoJev | Qwen3-0.6B + game heads | — | excluded: game-action heads, not a text-choice interface |
| Imajev / Jev-Omni | image/multimodal, 9B / 12B | — | excluded: text-only workload; Omni exceeds shared VRAM |
| Jev 1.13 hosted, jev-ultrafast | TypeSafe / Browser Use | — | excluded: hosted, paid, local-only policy |

### Artifacts to create

- `.github/harness/eval/decision-bakeoff-candidates.json`: declarative candidate matrix (id, kind
  `ollama-logprob` | `systemone-endpoint`, model, prompt styles, source, licence, publisher class)
  plus the excluded list with reasons.
- `scripts/harness/decision-bakeoff.mjs`: for each candidate × style, start the lite scorer and an
  in-process loopback sidecar on an ephemeral port, warm up, run the existing live evaluator, record
  summary, median/p95 latency, cold start and Ollama digest as revision; probe endpoint candidates
  and skip if unreachable; rank; write ignored JSON under `.github/harness/runs/decision-bakeoff/`.
- `scripts/harness/test/decision-bakeoff-test.mjs`: ranking and matrix validation, no network.
- `.github/harness/phase5/validation-results/jev-local-bakeoff-2026-09-30.md`: measured results.

### Artifacts to modify

- `scripts/harness/decision-backend-openai.mjs`: (a) add a `json` prompt style (local-jev measured
  Qwen3.5-4B 73.2% plain vs 80.5% JSON layout): state/question/lettered options serialised as one
  JSON object, still ending in `Answer:` so readout remains a single letter token. Default stays
  `jev`. (b) fail closed on low label mass: sum the raw probability of in-range label tokens before
  normalising; below `minLabelMass` (default 0.5) throw `BackendError("low_label_mass")` so the row is
  unavailable rather than a renormalised near-1 confidence.
- `scripts/harness/decision-eval.mjs`: export `evaluateLiveReport(root, { endpoint, model, revision,
  timeoutMs })`; runner always passes a finite positive `timeoutMs`. No behaviour change.
- `package.json`: `harness:decision:bakeoff`, `test:harness:decision-bakeoff` added to the
  decision-sidecar aggregate.
- `harness.config.json`: append measured rows to `localDecisionSidecar.measuredCandidates`. Freeze,
  `enabled`, `mode` unchanged.

### Key decisions

- Gate 1 Domain: evaluation tooling stays beside `decision-eval.mjs`; no routing change. PASS.
- Gate 2 Generality: candidates are data, not code branches; any OpenAI-logprob or Jev-wire server
  fits. PASS.
- Gate 3 Ownership: evaluator owns scoring; bake-off owns orchestration and ranking; config owns
  policy; human owns unfreeze. PASS.
- Gate 4 Boundary: sidecar binds loopback only; bake-off never writes the fixture or freeze block;
  no auto-download — missing models report `not-installed`. PASS.
- Gate 5 Reuse: reuses scorer, sidecar, evaluator; no new backend or Python dependency. PASS.
- Ranking: disqualify any `unavailable > 0` or `confidentWrong > 0`; then correct desc, wrong asc,
  abstained asc, median warm latency asc, id asc (deterministic ties). Coverage
  (`correct+wrong`/total) is reported beside accuracy so an abstaining row cannot look strong. No
  eligible row yields `bestCandidate: null`. Caveat: 12 model-authored cases cannot separate close
  candidates.
- Run protocol: upstream endpoint must be loopback; sidecar binds 127.0.0.1 port 0; warm-up call is
  timed as cold start and excluded from warm latency; every sidecar closes in `try/finally`; missing
  models are `not-installed`, never pulled.
- Architect Challenge (subagent, requested GPT-6 Sol): REVISE — low label mass, timeout contract,
  JSON style readout, ranking ties/abstention, close contract. All five folded in above.

### Constraints

- `enabled: false`, `mode: shadow`, `freeze.status: frozen` stay; freeze test must pass.
- No model download by the tool; operator pulls explicitly.
- No generated text; single-token prefill readout only.
- Report file lives under the ignored runs tree; task text is fixture text (model-authored, public).

### Validation plan

- `npm run test:harness:decision-bakeoff`, `npm run test:harness:decision-sidecar`,
  `npm run harness:config:self-test`, `npm run harness:docs:check`,
  `npm run harness:memory:references:check`.
- Live proof: `npm run harness:decision:bakeoff` against pulled candidates.

### Do NOT

- Do not lift the freeze or treat bake-off rank as promotion evidence.
- Do not add a Python/torch dependency or start large downloads from code.
- Do not relax `minProbability`/`minMargin` to make a candidate look better.

### Assumptions and risks

- `[UNVERIFIED]` Ollama chat templates for Qwen3.5 may prepend thinking tokens; if label mass
  collapses the row shows as uniform/abstain, and `json`/`jev` styles are compared rather than
  patched per model.
- `[KNOWN]` Q4_K_M quantisation shifts probabilities versus BF16 published numbers.
- `[KNOWN]` 12 synthetic cases give coarse resolution; JevBench (231 public items, MIT) is the
  follow-up discriminator for general decision quality.

## Implementation Proof (2026-09-30)

- Delivered: candidate matrix, `decision-bakeoff.mjs`, focused test, `json` prompt style,
  `low_label_mass` fail-closed guard, exported `evaluateLiveReport`, package wiring, measured config
  row, [validation results](../../phase5/validation-results/jev-local-bakeoff-2026-09-30.md).
- Decision added during Implement: the `[UNVERIFIED]` thinking-token risk was confirmed (Qwen3.5-4B
  first token `Thinking` p=0.985). Added opt-in `disableThinking` (sends `reasoning_effort: "none"`)
  per candidate; default off so LM Studio and other servers see no new field.
- Live result: Qwen3.5-4B Q4_K_M / chat — 11/12, 0 wrong, 1 abstain, 0 confident-wrong, p50 108 ms,
  3.14 GB VRAM; reproduced on a second run. Only three rows were eligible.
- Gates: `test:harness:decision-sidecar` (incl. freeze and bake-off), `harness:config:self-test`,
  `harness:docs:check`, `harness:memory:references:check`, `test:harness:local-open-model-policy`,
  `git diff --check` — all pass. Snyk Code: backend and test clean; bake-off has two Low CWE-23 flows
  from the operator-chosen `--repo-root` (matrix now contained to the eval directory; residual matches
  the existing decision-eval model). Sonar not run.

## Review Breadth

| Sev | Finding | Disposition |
|---|---|---|
| Minor | npm script inherited a foreign `HARNESS_PROJECT_ROOT` during the first run | Fixed: script passes `--repo-root .` |
| Minor | `--matrix` accepted any path | Fixed: contained to `.github/harness/eval` |
| Minor | label-mass guard changes lite-sidecar behaviour | Accepted: fails closed; sidecar is frozen |
| Info | Qwen3-4B-2507 GGUF returns an empty first token via Ollama | Recorded as `warmup-failed`; not patched |

## Review Depth

Gates 1–5 hold. Freeze block, `enabled`, `mode`, fixture and thresholds unchanged. Evaluator change is
export-only. `disableThinking` is the one Brief deviation and is recorded above.

## Feedback

| # | Point | Verdict |
|---|---|---|
| 1 | Best local solution | Qwen3.5-4B Q4_K_M, chat layout, thinking suppressed, lite backend |
| 2 | Does this unfreeze? | No. It addresses unfreeze criterion 1 (organisation-published model) and partly 2 (Ollama digest pin); criteria 3–5 remain unmet |
| 3 | Next evidence | Label real cases toward 100; run JevBench through the same sidecar; optional local-jev server row once Python/torch is installed |

Status: ACCEPTED as report-only evidence. Freeze remains in force pending human decision.
