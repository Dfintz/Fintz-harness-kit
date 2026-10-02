# Model-Family Skill Adapters

resource: harness.config.json, scripts/harness/prompt-router.mjs, scripts/harness/validate-doc-contracts.mjs, .github/harness/skill-adapters/, .claude/skills/, .github/skills/, .github/harness/HARNESS.md, package.json

## Architecture Brief

### Objective

Route every stage/skill to guidance optimized for the model that will execute it, including each
model in the fallback chain and the universal fallback. Apply Anthropic's Agent Skills authoring
best practices (<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>,
checked 2026-10-02) to the Claude skills, and source equivalent vendor guidance for the other
routed families:

- OpenAI GPT-5 prompting guide (developers.openai.com cookbook) and Codex "Build skills" docs.
- Google Gemini prompting strategies (ai.google.dev, Gemini 3 / agentic sections).

### Understand summary

- `skillModelMapping.mappings` (20 skills) owns primary + fallback chains; `universal_fallback` is
  `claude-haiku-4-5`. `prompt-router.mjs` resolves a model per stage but emits **no skill path and no
  per-model guidance**.
- Registry stages expose `skill` / `claudeSkill` / `instruction` / `agent`; the router already
  imports `registry.mjs`.
- 21 of 23 SKILL.md files embed hand-written "Recommended Models" sections. They contradict
  `harness.config.json` (e.g. architect says `gpt-5.6-luna` primary, config says `gpt-6-astra`;
  feedback has two conflicting sections; understand-process has one spliced mid-list). This is the
  exact failure both vendors warn about: time-sensitive content (Anthropic) and contradictory
  instructions that burn reasoning tokens (OpenAI GPT-5 guide).
- Routed model ids span: Claude Opus/Sonnet/Haiku, GPT-6 Astra/Sol, GPT-5.6 Sol/Terra, GPT-5.5,
  GPT-5.4, GPT-5.3-Codex, GPT-6 Luna, GPT-5 mini, Gemini 3.8 Flash, MAI-Code-1.1-Flash, plus local
  `name:tag` models.

### Decisions

1. **One canonical skill + thin per-family adapter, not N×M skill copies.** Duplicating 20 skills
   per family would recreate the drift problem we are removing. Each family gets one adapter file
   under `.github/harness/skill-adapters/<family>.md` that tells that model *how* to execute any
   skill (detail level, freedom, eagerness, structure, stop conditions). One level deep from the
   skill, per Anthropic progressive disclosure.
2. **Families** (config-driven prefix match, longest prefix wins across all families):
   `claude-frontier` (opus), `claude-balanced` (sonnet), `claude-compact` (haiku),
   `openai-reasoning` (gpt-6-astra/sol, gpt-5.6-sol, gpt-5.5), `openai-coding` (gpt-5.6-terra,
   gpt-5.4, gpt-5.3-codex), `openai-fast` (gpt-6-luna, gpt-5.6-luna, *-mini, *-nano),
   `gemini` (gemini-), `generic-open` (default: mai, grok, kimi, local `name:tag`).
3. **Config owns the family map**: `skillModelMapping.modelFamilies` `{ default, families: { id: {
   match: [prefix...], adapter, sources: [url...] } } }`. No model ids hardcoded in the router.
4. **Router emits `skillRouting` per stage**: `{ skill, skillPath, instruction, chain: [{ role,
   model, family, adapter }] }` where chain = primary (the resolved stage model) → mapping fallbacks
   → universal fallback, de-duplicated. Rendered in `handoff`, `route --json`, prompt-pack stage
   prompts, and manifest. Route-level shape is additive; existing fields unchanged.
5. **Skill bodies stop naming models.** Remove every "Recommended Models" section and the stale
   understand-process "Model tier" quote; replace in the 7 Claude skills with a one-line
   "Model routing" pointer to the router output + adapter. Claude skill descriptions become
   third-person ("Runs the … stage. Use when …").
6. **Validator** (`validate-doc-contracts.mjs`): errors when any routed model (primaries,
   fallbacks, universal, `models.*`, `routing.stageModelSets.*`) resolves to a family whose adapter
   is missing, or a family adapter path is missing; errors on Anthropic frontmatter limits (name
   ≤64, `[a-z0-9-]`, no `anthropic`/`claude` reserved words, description ≤1024, no XML tags);
   warns on SKILL.md body >500 lines and on `## Recommended Models` reappearing.

### Files

| File | Change |
|---|---|
| `.github/harness/skill-adapters/*.md` (8) | new family adapters |
| `harness.config.json` | add `skillModelMapping.modelFamilies` |
| `scripts/harness/prompt-router.mjs` | family resolution + `skillRouting` output/rendering |
| `scripts/harness/validate-doc-contracts.mjs` | adapter coverage + frontmatter + stale-section checks |
| `scripts/harness/test/skill-model-routing-test.mjs` | new test |
| `package.json` | test script; add to `test:harness:core` |
| `.claude/skills/*/SKILL.md` (7) | remove stale sections, third-person descriptions, routing pointer |
| `.github/skills/*/SKILL.md` (14) | remove stale "Recommended Models" sections only |
| `.github/harness/HARNESS.md` | short "Model-family skill adapters" note |

### Constraints / Do-NOTs

- Do NOT change any primary/fallback assignment or stage model resolution; this is guidance routing,
  not model re-ranking. Cross-model-review guardrail untouched.
- Do NOT duplicate skill bodies per model. Do NOT put model ids in skill bodies.
- Do NOT rename skills (gerund naming is optional per Anthropic; renames break registry/routing).
- Adapters must not contradict stage contracts or approval gates; they only tune execution style.
- `add-model-sections.mjs` would re-insert stale sections; the validator warning catches it. Leave
  the script in place (deletion needs operator approval).

### Validation

- `npm run harness:docs:check` OK.
- `node scripts/harness/test/skill-model-routing-test.mjs`.
- `npm run test:harness:core` (covers prompt-router run bundle + model routing validator).
- `node scripts/harness/prompt-router.mjs handoff --profile feature --repo-root . --task "..."`
  shows a skill + adapter chain for every stage.

### Assumptions

- Vendor guidance for GPT-5 and Gemini 3 generalizes to GPT-5.x/6 and Gemini 3.8 Flash in the same
  families; adapters cite sources so they can be re-checked.
- Adapter effectiveness is not yet measured; per Anthropic "build evaluations first" and the repo's
  `eval-first-tuning` skill, a follow-up eval run per family is recommended before tuning further.

### Architect challenge

Challenger (GPT-6 Sol) returned **VERDICT: REVISE** with three blocking concerns; resolved as:

1. **Prefix precedence** — matching is **longest-prefix-wins across all families**, independent of
   config order. `gpt-5.6-sol` → openai-reasoning, `gpt-5.6-luna` → openai-fast, `gpt-5.4-mini` →
   openai-fast (via `gpt-5.4-mini`), `gpt-5.4` → openai-coding. Local `name:tag` ids (contain `:`)
   always map to `generic-open`. The test asserts these overlap cases.
2. **Chain origin / architect-challenge** — the chain starts from the **resolved stage model**
   (`route.models[stage]`), never a mapping primary. `getStageModel` / `getStageSkillName` are not
   changed. A separate `getStageSkillDocName` maps `architect-challenge` →
   `.github/skills/architect-challenge/SKILL.md`; with no mapping entry its chain is resolved model
   → universal fallback.
3. **Path ownership** — all emitted paths are repo-relative to the same root that supplied
   `harness.config.json` and `registry.json`. `skillPath` = registry stage `skill`, else
   `claudeSkill`, else `.github/skills/<name>/SKILL.md` when present; `instruction` is emitted
   alongside so Copilot/other runtimes keep loading the stage instruction per the existing contract.
   Adopted projects without `modelFamilies` get `family: null, adapter: null` (no error).

Non-blocking accepted: `route.models` and existing manifest fields unchanged; `skillRouting` is
additive. Validator hard-errors only on executable references with missing adapters; multiline YAML
descriptions (`>-`, `|`) skip length checks.

**Status after revision: APPROVED for Implement.**
