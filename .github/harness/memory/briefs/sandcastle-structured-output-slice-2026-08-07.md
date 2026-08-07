---
summary: "Architecture Brief - Sandcastle structured output cherry-pick slice"
type: brief
status: active
source: research
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, structured-output, validation, cherry-pick]
---
# Architecture Brief - Sandcastle structured output cherry-pick slice

resource: .github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md, scripts/harness/prompt-router.mjs, scripts/harness/council-review.mjs, scripts/harness/test/comparative-ledger-merge-test.mjs, package.json, external sandcastle commit e99f832f26dc9d245c019a9ddd19fa5dee792427 docs/adr/0010-structured-output.md and src/extractStructuredOutput.ts

## Architecture Brief

### Objective

- Start the Sandcastle cherry-pick process by implementing the first bounded slice from the comparative review: a harness-native structured artifact extraction utility.
- Provide deterministic tests for tagged string and JSON object extraction without adding Sandcastle, Docker, Effect, or provider-specific session handling.

### Scope and boundaries

- In scope: a small `scripts/harness` helper for tagged output extraction, parser/schema-like validation, and a test script wired through `package.json`.
- Out of scope: retry/resume orchestration, PR comment posting, GitHub workflow automation, sandbox providers, worktree locking, or integration into existing stage runners.
- Primary boundary: this slice creates a reusable parsing primitive; callers decide when to require structured output.

### Artifacts to create

- `scripts/harness/structured-output.mjs` - dependency-light extraction and validation helper inspired by Sandcastle's structured output concept.
- `scripts/harness/test/structured-output-test.mjs` - deterministic test coverage for missing tags, last-match-wins, fenced JSON unwrap, invalid JSON, schema failure, string mode, and success.
- `.github/harness/memory/reviews/implementation-notes-sandcastle-structured-output-slice-2026-08-07.md` - implementation evidence and self-review record.
- `.github/harness/memory/briefs/sandcastle-structured-output-slice-review-breadth-2026-08-07.md` - breadth review ledger.
- `.github/harness/memory/briefs/sandcastle-structured-output-slice-review-depth-2026-08-07.md` - depth gate ledger.
- `.github/harness/memory/reviews/feedback-verdict-sandcastle-structured-output-slice-2026-08-07.md` - terminal verdict record.

### Artifacts to modify

- `package.json` - add a narrow `test:harness:structured-output` script for the new test.

### Key decisions

- Decision: Reimplement the generic idea locally instead of importing Sandcastle. The helper needs only tagged extraction and validation, not Sandcastle's execution runtime.
- Decision: Keep extraction orthogonal to completion signals. The utility parses payloads from text; it does not decide whether an agent run is done.
- Decision: Use a minimal validator function contract instead of adding a schema library. Existing harness scripts already use lightweight local validation and this avoids new dependencies.
- Decision: Make failure loud and typed enough for callers: missing tag, invalid JSON, and validation failure each produce a specific error code.
- Decision: Do not integrate the utility into `prompt-router` or `council-review` in this first slice; prove the primitive first, then wire callers in a separate slice.

### Constraints

- Do not add `@ai-hero/sandcastle` or any new runtime dependency.
- Do not copy Sandcastle source verbatim.
- Last matching tag wins, to support model self-correction.
- JSON object mode may unwrap optional Markdown fences but must not accept malformed JSON.
- The helper must be importable by other `.mjs` harness scripts and testable without network, git, or model calls.

### Validation plan

- Run `npm run test:harness:structured-output`.
- Run `npm run harness:docs:check`.
- Run `git diff --check`; because new files are untracked until staged, also run a direct trailing-whitespace scan over newly added files.

### Do NOT

- Do not add retry/resume behavior before a caller and provider contract exist.
- Do not couple structured output to agent run completion markers.
- Do not introduce GitHub PR comment automation in this slice.
- Do not weaken parser strictness with JSONC, single-quote parsing, or silent coercion.

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| A standalone parser is the right first integration point. | Slice value | If callers require end-to-end retries first, a second integration slice will be needed sooner. |
| A validator function is sufficient before adopting schema adapters. | API shape | Future Standard Schema/Zod integration may need a thin adapter layer. |
| Existing harness scripts prefer small local helpers and deterministic node tests. | Placement and validation | If a shared library layout emerges later, this helper may move. |

### Understand status

- Graph status: fresh; `npm run harness:graph -- status` reported graph matches `HEAD` with provider `understand-anything` and refresh readiness `ready`.
- Changed components: planned `scripts/harness/structured-output.mjs`, its test, package script, and stage artifacts.
- Affected components: future prompt-pack, plan-review, council-review, and review-ledger callers.
- Affected layers: Core and Test layers.
- Residual risk: low for the primitive; medium for future integration until a caller adopts it.