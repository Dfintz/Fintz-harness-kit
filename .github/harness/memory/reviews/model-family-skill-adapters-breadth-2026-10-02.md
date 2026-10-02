# Review Breadth — Model-Family Skill Adapters (2026-10-02)

Brief: `.github/harness/memory/briefs/model-family-skill-adapters-2026-10-02.md`
Reviewer model: claude-opus-5-5 (implementer gpt-5.6-terra lane; cross-model separation held)

## Findings (severity-ordered)

| # | Sev | Finding | Evidence | Disposition |
|---|---|---|---|---|
| 1 | Medium | `skillRouting` reaches route JSON, handoff, and prompt-pack manifest but not the feature-run manifest (`manifest.models = route.models` only). | `scripts/harness/prompt-router.mjs` `createOrReuseFeatureRun` | Deferred; additive, no consumer needs it yet. |
| 2 | Low | Reserved-word check matched only hyphen-delimited `claude`/`anthropic`; Anthropic forbids the substring. | `validate-doc-contracts.mjs` `validateSkillAuthoring` | Fixed. |
| 3 | Low | `scripts/harness/add-model-sections.mjs` can re-insert the removed stale sections. | script L130-153 | Validator warns `skill-hardcoded-models`; deletion left to operator. |
| 4 | Low | Adapter quality is unmeasured; vendor guidance is generalized from GPT-5 / Gemini 3 to newer ids. | Brief assumptions | Follow-up eval via `eval-first-tuning`. |
| 5 | Info | `trace-contract-prompt-pack-test` fails when the shell exports `HARNESS_PROJECT_ROOT` for another repo; passes with it unset. Environmental, not caused by this change. | test L52 | No action. |
| 6 | Info | Sonar MCP server failed to start; IDE diagnostics for new code are clean after removing a nested ternary, nested template literal, and splitting `resolveModelFamily`. | — | No action. |

## Proof

- `npm run harness:docs:check` → OK (was 20 `skill-hardcoded-models` warnings mid-change).
- `npm run test:harness:skill-model-routing` → 4/4 pass (prefix overlaps, null degradation,
  adapter coverage, per-stage chain from resolved model).
- `npm run test:harness:core` → exit 0; `harness:wrapper:smoke`, keyword and decision-router tests pass.
- `harness:handoff:feature` prints skill + adapter chain for all 7 stages.

## Standards / safety

- No stage model, fallback order, or cross-model guardrail changed. Adapters state that stage
  contracts and approval gates win. No permission or destructive-default changes.
