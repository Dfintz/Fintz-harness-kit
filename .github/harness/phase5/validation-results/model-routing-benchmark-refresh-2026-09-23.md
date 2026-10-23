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

## Supplemental Copilot Refresh - 2026-10-15

Sources checked: [supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models), [model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison), and [model pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing).

### Catalog changes

- Add `claude-haiku-5-5` as a lightweight option for summaries, simple edits, and routine triage. Its listed output price is `$0.50` per 1M tokens.
- `gemini-3.8-flash` and `gemini-4-argon` remain GA in GitHub's public catalog, but are excluded from this operator's recommendations because they are not visible in the current picker. GPT-6.1 Sol is the high-reasoning replacement; Claude Haiku 5.5 and GPT-6 Luna cover fast work.
- `gpt-6.1-sol` and `claude-sonnet-5-5` are GA and now listed in Copilot Auto selection. The previous 2026-10-02 `not-yet-routed` notes are stale; both are exposed as candidates, not promoted to stage primaries.
- `gpt-6.1-sol` has listed output pricing of `$10` per 1M tokens. `claude-sonnet-5-5` is positioned for efficient general-purpose coding and agent tasks, also at `$10` per 1M output tokens.

### Work-Type Fit

| Work type | Current candidates | Guidance |
| --- | --- | --- |
| Fast triage and small edits | `gpt-6-luna`, `mai-code-1.1-flash`, `claude-haiku-5-5` | Keep fast/low-cost models out of architecture and deep-review authority. |
| Balanced implementation | `gpt-5.6-terra`, `claude-sonnet-5-5`, `claude-sonnet-5`, `gpt-5.4`, `gpt-5.3-codex` | Use after the task is scoped; retain focused tests and high-reasoning review for risky changes. |
| Architecture and deep review | `gpt-6-astra`, `claude-opus-5-5`, `gpt-6-sol`, `gpt-6.1-sol`, `gpt-5.6-sol` | Keep established primaries unchanged until models are evaluated on harness review cases. |
| UI/UX product reasoning | `gpt-6-astra`, `gpt-6.1-sol`, `claude-opus-5-5`, `gpt-6-sol` | Use for information architecture, interaction tradeoffs, and design critique. |
| Screenshot and wireframe critique | `gpt-5-mini` | GitHub's current comparison explicitly recommends GPT-5 mini for visual input. Use it for image-grounded observations, then high-reasoning review for product decisions. |

Copilot access still depends on plan, client, organization policy, and rollout. The official minimum-version table lists several new models as `TBD`; verify the model picker in the target VS Code installation. The catalog and wizard suggestions are advisory only. Skill-stage primaries and the cross-model-review guard remain unchanged. The UI/UX domain wizard now prefers GPT-5.6 Sol as a low-confidence trial based on the Website Arena result; this is not a harness-measured quality claim.

## External Evaluation Refresh - 2026-10-15

Checked [BenchLM](https://benchlm.ai/), [LLM Stats](https://llm-stats.com/), [LiveBench 2.0](https://livebench.ai/), [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models), [Onyx](https://onyx.app/llm-leaderboard), [OpenRouter](https://openrouter.ai/rankings), and GitHub's Copilot model comparison/pricing pages. These sources use different model settings, benchmark suites, and cost accounting; rankings below are task evidence, not a single comparable score.

| Source | Current evidence relevant to this routing | Interpretation |
| --- | --- | --- |
| BenchLM, Oct 14 | Claude Opus 5.5 86.5; GPT-6.1 Sol 83.95; GPT-6 Astra 83.75; Claude Sonnet 5.5 82.17. BenchLM says Opus 5.5 and GPT-6.1 Sol's uncertainty intervals overlap; GPT-6.1 Sol costs half as much per output token. | Use Opus 5.5 for the quality ceiling and GPT-6.1 Sol as the high-reasoning value alternative. Do not claim a decisive quality gap between their overlapping intervals. |
| LLM Stats, Oct 8-15 | Reasoning: Opus 5.5 59.4, Astra 57.3, Sonnet 5.5 57.2, GPT-6.1 Sol 51.7. Coding: Opus 5.5 50.5, Sonnet 5.5 48.3, Astra 47.1, GPT-5.6 Sol 43.3, GPT-6.1 Sol 39.7, Terra 39.6. Tool calling: Astra 36.3, Sonnet 5.5 35.4, Opus 5.5 33.9. | Use category rankings, not its composite, to inform role fit. Its scores are conservative, uncertainty-aware indexes and missing data is not scored as failure. |
| LLM Stats UI Website Arena, Oct 8 | GPT-5.6 Sol leads the UI-design list at 1,415 with 41 matches and 63.4% wins. | Best current Copilot-listed candidate for generated UI/design comparisons, but the match count is small; treat it as a trial default, not a proven product-design winner. |
| LLM Stats research category, Oct 8 | GPT-6 Astra is rank 3 at 31.5; GPT-5.6 Sol rank 5 at 28.5; GPT-5.6 Terra rank 7 at 26.9. Kimi K3 and Opus 5 also rank highly but have different availability/cost tradeoffs. | Prefer Astra for long-form research synthesis; use retrieval tools and source checks for current facts. These scores do not evaluate a particular search index or citation workflow. |
| LiveBench 2.0, Oct 14 | Opus 5.5 86.5 overall; GPT-6 Astra 86.1; GPT-6.1 Sol 85.4; Sonnet 5.5 82.5; GPT-6 Sol 81.9; Terra 75.0. Category results vary: Astra leads the listed agentic score, while GPT-6.1 Sol scores strongly in coding/reasoning but lower in agentic work. | Supports Astra for long-horizon tool-using work, Opus for broad quality, and GPT-6.1 Sol for coding/reasoning value rather than treating it as a universal agent replacement. |
| Artificial Analysis and Onyx | Both place Opus 5.5, Sonnet 5.5, Astra, and GPT-6.1 Sol in the top bands; task-specific slices differ and some variants are reasoning-effort/fallback configurations. | Secondary corroboration only; avoid combining their scores as independent repetitions of the same underlying benchmark families. |
| OpenRouter | Its usage ranks measure tokens/requests routed through OpenRouter; its separate benchmark page includes quality evaluations. | Use usage only as adoption/availability signal, never as a quality rank. |
| GitHub Copilot docs | Official task descriptions identify Astra for long-horizon autonomous coding, Sol for careful multi-step validation, Terra for balanced coding, Luna/Haiku for fast work, GPT-5 mini for visual input, and Gemini 4 Argon for edge-case reasoning. | Primary source for Copilot feature fit and catalog status; the user's model picker remains the availability gate. |

### Decision Routing By Task Type

The executable skill owner remains `skillModelMapping.mappings`; domain/mode suggestions are in `domainSpecialists` and `modelSelectionWizard`. Keep harness-measured skill primaries and proven fallbacks first. Put external-only candidates later in each fallback chain until a fixed harness task set validates them. The UI/UX wizard is a separate domain recommendation and now starts with GPT-5.6 Sol because the directly relevant blind Website Arena ranks it first, with only 41 matches.

| Task type and skills | Primary route | Fallback route | Evidence/guardrail |
| --- | --- | --- | --- |
| Architecture and feedback: `architect`, `feedback` | GPT-6 Astra | Opus 5.5, GPT-6 Sol, GPT-5.6 Sol; GPT-6.1 Sol as an additional candidate | Astra remains the long-horizon route. Opus 5.5 leads broad reasoning; GPT-6.1 Sol is lower-cost but not harness-calibrated. |
| Code understanding and risk review: `understand-process`, `doubt-driven-development`, `review-breadth`, `review-depth`, `deterministic-validation` | Claude Opus 5.5 | GPT-6 Sol, Claude Opus 5, GPT-5.6 Sol; GPT-6.1 Sol after these | Opus leads external reasoning/coding evidence and is harness-measured on review. Keep implementation on a distinct model. |
| PR planning/tool use: `pr` | Claude Opus 5.5 | GPT-6 Sol, Opus 5, GPT-5.6 Sol, GPT-5.3 Codex; Sonnet 5.5 and GPT-6.1 Sol as additional candidates | Astra leads tool-calling scores; Sonnet 5.5 is a strong cost-effective tool model. Neither replaces the harness-tested PR primary yet. |
| Research/evaluation: `eval-first-tuning`, `retrieval-quality-ops`, `ai-techniques-radar` | GPT-6 Sol | Opus 5.5, GPT-5.5; GPT-6.1 Sol / Sonnet 5.5 after proven fallbacks | Research quality still depends on retrieval, source coverage, citation checks, and human spot-checks. |
| Bootstrap and context design: `setup-harness-bootstrap`, `context-engineering` | GPT-6 Sol | Opus 5.5, GPT-5.5; GPT-6.1 Sol / Sonnet 5.5 after proven fallbacks | Procedural/context tasks retain measured routes; new candidates require fixed-case validation. |
| Memory and instruction synthesis: `remember`, `teach-agent` | Claude Opus 5.5 | Opus 5, GPT-6 Sol; Sonnet 5.5 / GPT-6.1 Sol after proven fallbacks | Prefer Opus for long-form synthesis; use Sonnet when latency/cost wins on the fixed corpus eval. |
| Implementation, prototypes, bounded repair: `implement`, `prototype`, `run-loop` | GPT-5.6 Terra | GPT-5.4, GPT-5.3 Codex, Sonnet 5; Sonnet 5.5 after proven fallbacks | Terra remains internally measured. Sonnet 5.5 ranks higher in external coding/tool results but needs local harness evaluation before promotion. |
| Fast triage and budget work: `budget-aware-execution` | GPT-6 Luna | Haiku 5.5, MAI-Code 1.1 Flash, Haiku 4.5, GPT-5 mini | Luna remains the measured fast route. Haiku 5.5 has stronger broad category scores at similar listed output pricing. |
| Operations/monitoring: `observability-and-instrumentation` | Claude Opus 5.5 | GPT-6 Sol, GPT-5.5, Sonnet 5; GPT-6.1 Sol / Sonnet 5.5 after proven fallbacks | Preserve the measured high-reasoning route for telemetry and operational decisions. |
| UI/UX generation and design comparisons | GPT-5.6 Sol | GPT-6.1 Sol, Opus 5.5, Astra, GPT-6 Sol | GPT-5.6 Sol leads the limited blind Website Arena sample. Use GPT-5 mini separately for screenshot/wireframe input; run accessibility and responsive checks deterministically. |
| UI screenshot critique | GPT-5 mini | High-reasoning synthesis with Opus 5.5 or GPT-6.1 Sol | GitHub explicitly lists GPT-5 mini for visual input. Separate visual observations from product decisions. |
| Database domain | Claude Opus 5.5 | GPT-6 Sol, Opus 5; GPT-6.1 Sol after proven fallbacks | Require explicit validation for destructive migrations and production data paths. |
| Infrastructure domain | GPT-6 Sol | Opus 5.5, GPT-5.6 Sol, Opus 5; GPT-6.1 Sol after proven fallbacks | Keep approvals explicit for permission expansion, destructive changes, and production deployment. |
| Frontend domain | GPT-5.6 Terra | Sonnet 5.5, Sonnet 5, GPT-5.4, GPT-5.3 Codex | Use high-reasoning review for accessibility, design-system, and cross-page changes. |
| Backend domain | GPT-5.6 Terra | GPT-5.4, GPT-5.3 Codex, Sonnet 5, Sonnet 5.5 | Use high-reasoning review for shared contracts, auth, caching, tenancy, and distributed behavior. |

### Mode Packages

| Mode | Cheap | Balanced | High |
| --- | --- | --- | --- |
| Assistant / `ask` | GPT-6 Luna, MAI-Code 1.1 Flash, Haiku 5.5 | Terra, Sonnet 5.5, Sonnet 5, GPT-5.4 | GPT-6 Sol, Opus 5.5, GPT-6.1 Sol, GPT-5.6 Sol |
| Developer / `dev` | GPT-5.3 Codex, GPT-6 Luna, GPT-5.4 mini, Haiku 5.5 | Terra, Sonnet 5.5, Sonnet 5, GPT-5.4, Codex | GPT-6 Sol, Opus 5.5, GPT-6.1 Sol, GPT-5.6 Sol |
| Super-plus | GPT-6 Luna, MAI-Code 1.1 Flash, Haiku 5.5 | Terra, Sonnet 5.5, Sonnet 5, GPT-5.4 | GPT-6 Astra, Opus 5.5, GPT-6.1 Sol, GPT-6 Sol |

Use GPT-6 Astra only for the high super-plus package when its long-horizon capability is needed; its Copilot output price is substantially higher than GPT-6.1 Sol or GPT-6 Sol. Keep local-only models in their documented assistant, implementation, and bounded-loop lanes, not final review or approval.

The 20 skill mappings remain distinct by task rather than collapsing into a universal model. Skill-stage primaries remain unchanged; fallbacks prefer the previously harness-measured candidates before externally promising but unmeasured models. The UI/UX domain wizard is the exception because the direct arena score is task-specific; its low match count keeps the choice provisional. `harness:model-routing:validate` is synthetic harness regression evidence, not a benchmark of new models' real output quality. For promotion, run 5-20 fixed examples per task family, score quality, correctness, latency, and actual Copilot cost, then review failures before changing skill primaries.