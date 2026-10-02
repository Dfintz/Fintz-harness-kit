# Review Breadth — Skill Adapter Eval (2026-10-02)

Brief: `.github/harness/memory/briefs/skill-adapter-eval-2026-10-02.md`
Reviewer model: claude-opus-5-5 (implementer lane gpt-5.6-terra)

## Findings (severity-ordered)

| # | Sev | Finding | Evidence | Disposition |
|---|---|---|---|---|
| 1 | Medium | Ceiling effects: with `qwen2.5-coder:14b`, 3 of 8 scenarios score 1.00 in both arms, so they cannot show adapter gains for that model. | live journal 2026-10-02T09-04-22 | Accepted as data; harder variants are a tuning follow-up, not this change. |
| 2 | Medium | Only `generic-open` has live evidence; the 7 hosted families are `untested` until an operator wrapper for Copilot/API models exists. | journal `families.*.status` | Deferred; documented in HARNESS.md. |
| 3 | Low | Ollama context is not set by the runner; the largest prompt is about 2.4k tokens, under the 4k server default, but bigger skills could be truncated silently. | `ollama-agent.mjs` sends no `num_ctx` | Deferred; note for future scenarios. |
| 4 | Low | `minimal-diff-fix` can pass on an ACTIONS-only answer (55 chars) because checks look at actions, not the code fix. | journal min `outputChars` | Accepted; the scenario measures scope discipline, not correctness. |
| 5 | Low | `git rm` staged the deletion of `add-model-sections.mjs`; everything else is unstaged. | `git status` `D ` | Informational. |
| 6 | Info | IDE diagnostics still flag file-inclusion on `loadSuite` (fixed default path) and complexity on `parseArgs`/`main`, which appear stale after the table-driven refactor. Reads of skills and adapters are now confined to `.md` files inside the kit root and tested. | `get_errors` | No action. |

## Proof

- `npm run test:harness:skill-adapter-eval`: 6/6 (coverage, under-targeted family, path escape,
  action parsing, missing ACTIONS block, signal rules).
- `node scripts/harness/skill-adapter-eval.mjs --self-test`: PASS, 8 scenarios, 8 families, every
  scenario's pass fixture ≥ 0.80 and fail fixture ≤ 0.40.
- `npm run test:harness:core` exits 0; `harness:docs:check` OK (`skill-hardcoded-models` is now an
  error); `harness:commands:check` OK.
- Live: `generic-open` with `qwen2.5-coder:14b`, 8 scenarios × 3 repeats × 2 arms in about 3.3 minutes.

## Safety

- No network client or credentials added. The agent gets a minimal environment; the journal keeps
  only the executable basename, a declared model, scores, and output hashes.
