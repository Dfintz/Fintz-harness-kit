# Model Routing Benchmark Refresh - 2026-09-23

## Scope

Refresh hosted GitHub Copilot model recommendations and validation hints for the harness Phase 5
model policy. This update is limited to hosted Copilot model routing metadata, model-selection
packages, and validator hints. Local Ollama and LM Studio hardware profiles are unchanged.

## Sources Checked

- GitHub Copilot supported models: `https://docs.github.com/en/copilot/reference/ai-models/supported-models`
- GitHub Copilot model comparison: `https://docs.github.com/en/copilot/reference/ai-models/model-comparison`
- GitHub Copilot model pricing: `https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing`
- BenchLM leaderboard: `https://benchlm.ai/`
- OpenRouter rankings: `https://openrouter.ai/rankings`
- LLM Stats leaderboard: `https://llm-stats.com/`
- Onyx LLM leaderboard: `https://onyx.app/llm-leaderboard`

## Copilot Availability Snapshot

GitHub Copilot docs list these relevant GA models that were not fully represented in the previous
2026-08-07 snapshot:

| Model | Provider | Copilot status | VS Code minimum | Notes |
| --- | --- | --- | --- | --- |
| `gpt-6-astra` | OpenAI | GA | `1.136.1` | Long-horizon autonomous coding; high cost. |
| `gpt-6-luna` | OpenAI | GA | TBD | Lightweight fast/cheap model; model-picker availability depends on client/plan. |
| `gpt-6-sol` | OpenAI | GA | TBD | Powerful all-round agentic coding and validation; lower cost than Astra. |
| `claude-opus-5-5` | Anthropic | GA | TBD | Long-running agentic coding and knowledge work; lower listed output price than Opus 5. |
| `claude-fable-5` | Anthropic | GA | `1.124` | Data-retention/EFS caveat; not a universal default. |
| `claude-fable-5-1` | Anthropic | GA | TBD | Data-retention/EFS caveat; not a universal default. |
| `claude-opus-4-7` | Anthropic | GA | TBD | Retires 2026-10-02; use Opus 5+ instead. |
| `claude-opus-4-8-fast` | Anthropic | GA preview-style entry | not supported for extended capabilities | Higher price; do not use as default. |
| `gemini-3.7-flash` | Google | GA | `1.128.0` | Retires 2026-10-02 in favor of Gemini 3.8 Flash. |
| `gemini-3.8-flash` | Google | GA | TBD | Fast/simple tasks; promotional pricing through 2026-12-31. |
| `mai-code-1.1-flash` | Microsoft | GA | `1.121` | Replaces retired `mai-code-1-flash`; continuously improving checkpoint. |
| `grok-4-5` | xAI | GA | TBD | General-purpose coding; client support is uneven. |
| `grok-4-6` | xAI | GA | TBD | General-purpose coding; client support is uneven. |
| `grok-4-7` | xAI | GA | TBD | Agentic coding and complex workflows; client support is uneven. |

GitHub docs also retain `kimi-k2.7-code` and `kimi-k3`, but Kimi models are open weight and not
eligible for default enablement in enterprise default policy. `kimi-k2.7-code` is scheduled to retire
on 2026-10-02 with `kimi-k3` as the suggested alternative.

## External Benchmark Evidence

| Source | Relevant finding | How it is used |
| --- | --- | --- |
| BenchLM | `gpt-6-astra` ranks #1 overall at 88.47; `claude-opus-5-5` ranks #2 at 88.45; `gpt-6-sol` ranks #4 at 82.17 and is identified as near-frontier value at `$10` output / 1M tokens; `gpt-5.6-sol` remains #5 at 80.44. | Supports Astra as ultra-reasoning ceiling, Opus 5.5 as top review/knowledge candidate, and GPT-6 Sol as powerful value fallback. |
| OpenRouter | Weekly/monthly usage rankings put `gpt-5.6-luna` high in traffic; benchmark section lists `claude-opus-5-5`, `gpt-6-astra`, `claude-opus-5`, `gpt-6-sol`, and `gpt-5.6-sol` in the top benchmark band. OpenRouter explicitly says usage rankings measure adoption, not quality. | Use traffic only as adoption signal for cheap/fast Luna; use benchmark section as secondary quality signal, not sole evidence. |
| LLM Stats | Overall score top band includes `claude-opus-5-5` rank #1, `gpt-6-astra` rank #2, `claude-opus-5` rank #3, and `gpt-5.6-sol` rank #5; reasoning index places `claude-opus-5-5`, `gpt-6-astra`, `claude-opus-5`, and `gpt-5.6-sol` in the top reasoning band. | Supports Opus 5.5 review/knowledge promotion and keeps GPT-5.6 Sol as stable fallback where GPT-6 is restricted. |
| Onyx | Tier list places `gpt-5.6-sol`, `claude-opus-4.8`, `claude-sonnet-5`, `gpt-5.5`, and `kimi-k3` in high tiers; task scores show GPT-5.6 Sol strong on Terminal-Bench 2.1 and high reasoning. | Reinforces existing GPT-5.6 Sol/Sonnet 5/Kimi K3 positioning; does not alone justify Fable defaults. |
| GitHub model comparison | `gpt-6-astra` is for long-horizon autonomous coding, `gpt-6-sol` for all-round development with multistep validation, `gpt-6-luna` for quick cost-efficient tasks, `claude-opus-5-5` for efficient multistep tasks/error recovery/collaboration, and `gpt-5.6-terra` for balanced everyday interactive and agentic coding. | Primary task-fit evidence for harness tier assignments. |
| GitHub pricing | Default output / 1M tokens: `gpt-6-astra` `$50`, `gpt-6-sol` `$10`, `gpt-6-luna` `$0.50`, `claude-opus-5-5` `$20`, `claude-opus-5` `$25`, `gpt-5.6-sol` `$20`, `gpt-5.6-terra` `$12`, `gemini-3.8-flash` `$3.75`, `mai-code-1.1-flash` `$1.20`. | Keeps Astra restricted to ultra-reasoning; makes GPT-6 Sol a strong high-value fallback; upgrades Opus 5.5 over Opus 5 for high-reasoning cost/performance. |

## Adopted Hosted Copilot Packages

| Tier | Primary package | Fallbacks | Rationale |
| --- | --- | --- | --- |
| Ultra reasoning | `gpt-6-astra` | `claude-opus-5-5`, `gpt-6-sol`, `gpt-5.6-sol` | Astra leads BenchLM and is explicitly positioned for long-horizon autonomous coding; Opus 5.5 and GPT-6 Sol cover Anthropic/OpenAI policy variance and lower-cost high-quality fallback. |
| High reasoning | `claude-opus-5-5` | `gpt-6-sol`, `claude-opus-5`, `gpt-5.6-sol`, `gpt-5.5` | Opus 5.5 scores highly and is lower listed cost than Opus 5; GPT-6 Sol is the OpenAI fallback. |
| Balanced coding | `gpt-5.6-terra` | `claude-sonnet-5`, `gpt-5.4`, `gpt-5.3-codex` | GitHub positions Terra as balanced interactive/agentic coding; Sonnet 5 remains strong general coding; Codex remains coding-specialist/LTS fallback. |
| Fast execution | `gpt-6-luna` | `gemini-3.8-flash`, `mai-code-1.1-flash`, `claude-haiku-4-5` | Luna has the best listed OpenAI cost; Gemini 3.8 and MAI-Code-1.1 are low-cost fast alternatives. |
| Universal fallback | `claude-haiku-4-5` | `gpt-5-mini` | Preserve the existing safety-net class while keeping GPT-5 mini as a common low-cost fallback. |

## Caveated Models

| Model | Caveat | Default policy |
| --- | --- | --- |
| `claude-fable-5`, `claude-fable-5-1` | GitHub docs note Anthropic data-retention/EFS requirements and ZDR exemption constraints. | Supported snapshot only; do not use as kit default. |
| `kimi-k2.7-code`, `kimi-k3` | Open weight models are not eligible for default enablement in enterprise default policy; Kimi K2.7 Code retires 2026-10-02. | Supported snapshot with caveat; Kimi K3 may be optional long-context coding fallback, not universal default. |
| `claude-opus-4-7` | Retires 2026-10-02. | Supported for completeness only; avoid defaults. |
| `gemini-3.7-flash` | Retires 2026-10-02. | Supported for completeness only; prefer Gemini 3.8 Flash. |
| `grok-4-5`, `grok-4-6`, `grok-4-7` | Copilot supported but VS Code support appears unavailable or TBD in docs excerpts; enterprise/client support may vary. | Supported snapshot only until local demand warrants routing. |
| `gpt-6-astra` | Highest quality signal but high cost and higher VS Code minimum. | Ultra-reasoning only; never cheap/balanced default. |

## Routing Changes Authorized By This Evidence

- `architect` and `feedback`: upgrade primary to `gpt-6-astra`; fallback to `claude-opus-5-5`, `gpt-6-sol`, then `gpt-5.6-sol`.
- High-reasoning review/synthesis skills: prefer `claude-opus-5-5` with `gpt-6-sol` fallback; keep `claude-opus-5`, `gpt-5.6-sol`, or `claude-opus-4-8` as stability fallbacks where useful.
- `implement` and prototype-like balanced coding: prefer `gpt-5.6-terra` with `claude-sonnet-5`, `gpt-5.4`, and `gpt-5.3-codex` fallbacks.
- `budget-aware-execution`: prefer `gpt-6-luna` with `gemini-3.8-flash`, `mai-code-1.1-flash`, and `claude-haiku-4-5` fallbacks.
- `architect-challenge`: upgrade from `gpt-5.3-codex` to `gpt-6-sol` so the challenger remains distinct from the Astra architect while staying in a high validation tier.

## Validation Commands

To be completed after config/test/doc updates:

- `node -e "JSON.parse(require('fs').readFileSync('harness.config.json','utf8'))"`
- `npm run test:harness:model-routing-validator-refresh`
- `npm run test:harness:model-selection-wizard`
- `npm run harness:model-routing:validate`
- `npm run harness:docs:check`
- `git diff --check`

## Residual Notes

- Hosted model availability remains subject to Copilot plan, organization policy, model-picker
  configuration, client, extension version, and regional/data-residency policy.
- OpenRouter usage rankings are not quality rankings; they were used only to understand adoption and
  cheap-model traffic.
- Synthetic validator profiles in `scripts/harness/phase5/validate-skills.mjs` are deterministic
  routing-test hints, not independent benchmark evidence.