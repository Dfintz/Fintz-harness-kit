# Model Routing Benchmark Refresh - 2026-08-07

## Scope

Re-evaluate hosted Copilot model recommendations, local Ollama model routing, context-window assumptions, and cheap/balanced/high packages for these operator modes:

- `assistant` (`/ask:`)
- `dev` (`/dev:`)
- `super-plus` / full harness (`/full:`)

## External Benchmark Evidence

Sources checked on 2026-08-07:

- GitHub Copilot supported models: `https://docs.github.com/en/copilot/reference/ai-models/supported-models`
- GitHub Copilot model comparison: `https://docs.github.com/en/copilot/reference/ai-models/model-comparison`
- GitHub Copilot model pricing: `https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing`
- SWE-bench leaderboard: `https://www.swebench.com/`
- Aider leaderboards: `https://aider.chat/docs/leaderboards/`
- LiveBench: `https://livebench.ai/`

Key findings:

- GitHub model comparison places `GPT-5.6 Luna` in fast/cost-efficient smaller tasks, not the deepest reasoning lane.
- GitHub model comparison places `GPT-5.6 Sol` in complex reasoning over large codebases and long-running agentic work.
- GitHub model comparison positions `GPT-5.6 Terra` as balanced everyday interactive and agentic coding.
- GitHub pricing makes `GPT-5.6 Luna` cheaper than `GPT-5 mini` in listed input/output rates, while `GPT-5.6 Sol`, `GPT-5.5`, and Opus-class models are high-cost/high-reasoning choices.
- LiveBench 2026-06-25 ranks `GPT-5.6 Sol Max Effort`, `GPT-5.5 Thinking xHigh Effort`, and `Claude 5 Opus Thinking Max Effort` in the top reasoning/general band, while `GPT-5.6 Luna` is lower overall but cheaper.
- SWE-bench data supports keeping stronger agentic/deep reasoning models for long-running development work; cheap models are useful for small tasks but not full workflow defaults.

## Local Ollama Inventory

Available local models from `http://localhost:11434/api/tags`:

| Model | Parameters | Quant | Advertised context |
| --- | ---: | --- | ---: |
| `qwen2.5:latest` | 7.6B | Q4_K_M | 32,768 |
| `qwen2.5-coder:14b` | 14.8B | Q4_K_M | 32,768 |
| `qwen2.5-coder:32b` | 32.8B | Q4_K_M | 32,768 |
| `devstral:24b` | 23.6B | Q4_K_M | 131,072 |
| `deepseek-r1:14b` | 14.8B | Q4_K_M | 131,072 |
| `nomic-embed-text:latest` | 137M | F16 | 2,048 |

## Local Eval Evidence

### Harness Real Measurement

Initial route (`deepseek-r1:14b`, `qwen2.5-coder:32b`, `devstral:24b`, `qwen2.5-coder:32b`, `qwen2.5-coder:14b`):

- Result: FAIL
- Passing tasks: 4/5
- Failure: high-reasoning via `qwen2.5-coder:32b` had two Ollama 500 responses in the median-of-3 run.
- Evidence: `.github/harness/phase5/validation-results/phase5c-real-local-baseline-2026-08-07T090737457.json`

Refreshed route (`devstral:24b`, `qwen2.5-coder:14b`, `devstral:24b`, `qwen2.5:latest`, `qwen2.5-coder:14b`):

- Result: PASS
- Passing tasks: 5/5
- Overall score: 0.940 against 0.800 baseline
- Evidence: `.github/harness/phase5/validation-results/phase5c-real-local-baseline-2026-08-07T091657371.json`

### Local Mode Matrix

Prompt matrix covered `assistant`, `dev`, and `super-plus` representative deterministic prompts across installed Ollama models.

- Evidence: `.github/harness/phase5/validation-results/local-mode-matrix-2026-08-07.json`
- `qwen2.5:latest`: all 3 prompts scored 1.00; fastest assistant/dev responses.
- `qwen2.5-coder:14b`: all 3 prompts scored 1.00; reliable dev/local fallback.
- `qwen2.5-coder:32b`: all 3 prompts scored 1.00 but was slow and had transient 500s in harness real measurement.
- `devstral:24b`: all 3 prompts scored 1.00; strong local super-plus/full default with 131K context.
- `deepseek-r1:14b`: direct simple prompts returned empty visible responses for two tasks; do not use as default without a thinking-aware adapter.

## Adopted Recommendations

### Hosted Copilot Packages

| Mode | Low / cheap | Balanced | High |
| --- | --- | --- | --- |
| `assistant` | `gpt-5.6-luna`, `gpt-5-mini`, `mai-code-1-flash` | `gpt-5.6-terra`, `gpt-5.4`, `claude-sonnet-5` | `gpt-5.6-sol`, `claude-opus-5`, `gpt-5.5` |
| `dev` | `gpt-5.3-codex`, `gpt-5.4-mini`, `gpt-5.6-luna` | `gpt-5.4`, `claude-sonnet-5`, `gpt-5.3-codex` | `gpt-5.6-sol`, `claude-opus-5`, `gpt-5.5` |
| `super-plus` | `gpt-5.6-luna`, `gpt-5-mini`, `mai-code-1-flash` | `gpt-5.6-terra`, `claude-sonnet-5`, `gpt-5.4` | `gpt-5.6-sol`, `claude-opus-5`, `gpt-5.5` |

### Local Ollama Packages

| Mode | Low / cheap | Balanced | High |
| --- | --- | --- | --- |
| `assistant` | `qwen2.5:latest` | `qwen2.5-coder:14b` | `devstral:24b` |
| `dev` | `qwen2.5:latest` | `qwen2.5-coder:14b` | `devstral:24b` |
| `super-plus` | `qwen2.5-coder:14b` | `devstral:24b` | `devstral:24b` |

## Config Updates Made

- `modeMappings.assistant.localModelHint`: `qwen2.5:latest`
- `modeMappings.full.localModelHint`: `devstral:24b`
- `modelPolicy.tiers.ultra-reasoning`: primary examples moved to `gpt-5.6-sol`, `claude-opus-5`
- `skillModelMapping.mappings.architect.primary`: `gpt-5.6-sol`
- `skillModelMapping.mappings.feedback.primary`: `gpt-5.6-sol`
- `modelPolicy.modelSelectionWizard.modePackages`: added assistant/dev/super-plus low/balanced/high packages with local and cloud recommendations
- `scripts/harness/measure-phase5c-real.mjs`: local measurement map updated to the passing route; cloud allowlists updated for Sol/Terra

## Validation Commands

- `node scripts/harness/measure-phase5c-real.mjs --provider local` -> PASS, 5/5, score 0.940
- `npm run test:harness:model-selection-wizard` -> PASS
- `npm run harness:model-wizard:check` -> PASS
- `npm run harness:model-routing:validate` -> PASS
- `npm run harness:docs:check` -> PASS
- `npm run harness:config:self-test` -> PASS

## Residual Notes

- `harness:model-routing:validate` still prints a synthetic historical quality table that names `gpt-5.6-luna` as top. The pass/fail check remains green, but the explanatory synthetic table is not yet updated to the 2026 benchmark refresh.
- Hosted model availability is still subject to Copilot plan, organization policy, client, extension version, and model-picker settings.
- `qwen2.5-coder:32b` remains useful for deep local code analysis when stable, but it should not be the default route on this machine because it is slower and produced transient Ollama 500s during median measurement.