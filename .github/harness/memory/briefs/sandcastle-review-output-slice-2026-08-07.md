---
summary: "Architecture Brief - Sandcastle review output validation cherry-pick slice"
type: brief
status: active
source: research
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, review-output, diff-filtering, cherry-pick]
---
# Architecture Brief - Sandcastle review output validation cherry-pick slice

resource: .github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md, .github/harness/memory/briefs/sandcastle-structured-output-slice-2026-08-07.md, scripts/harness/structured-output.mjs, package.json, external sandcastle commit e99f832f26dc9d245c019a9ddd19fa5dee792427 .sandcastle/agent-workflows/shared/review-output.ts and .sandcastle/agent-workflows/shared/diff-lines.ts

## Architecture Brief

### Objective

- Continue the Sandcastle cherry-pick process by implementing the second bounded slice: a local review-output validation and diff-filtering utility.
- Provide deterministic tests proving inline comments outside changed diff lines and replies to unknown thread IDs are rejected before any future GitHub API caller exists.

### Scope and boundaries

- In scope: review-output shape validation, unified-diff changed-line extraction, inline-comment filtering, reply filtering, and a focused test script wired through `package.json`.
- Out of scope: posting PR comments, fetching GitHub review threads, resolving GitHub GraphQL IDs, workflow labels, sandbox execution, and integration into existing review stages.
- Primary boundary: this slice validates model-produced review payloads locally; future PR automation remains a separate approved design.

### Artifacts to create

- `scripts/harness/review-output.mjs` - local validators and filters for review summaries, inline comments, thread replies, and unified diff lines.
- `scripts/harness/test/review-output-test.mjs` - deterministic tests for parsing, filtering, lineRange fallback, invalid shape rejection, and thread ID rejection.
- `implementation-notes-sandcastle-review-output-slice-2026-08-07.md` - implementation evidence and self-review record.
- `.github/harness/memory/briefs/sandcastle-review-output-slice-review-breadth-2026-08-07.md` - breadth review ledger.
- `.github/harness/memory/briefs/sandcastle-review-output-slice-review-depth-2026-08-07.md` - depth gate ledger.
- `feedback-verdict-sandcastle-review-output-slice-2026-08-07.md` - terminal verdict record.

### Artifacts to modify

- `package.json` - add `test:harness:review-output` and include it in `test:harness:core`.

### Key decisions

- Decision: Implement this as a pure local utility, not a GitHub workflow or API client. This preserves the approval boundary around mutating PRs.
- Decision: Accept a minimal review output shape: `{ summary, inlineComments, replies }`, with inline comments `{ path, line|lineRange, body|comment }` and replies `{ commentId, body|comment }`.
- Decision: Parse unified diffs into a map of file paths to allowed right-side line numbers. Include added and context lines from hunks so comments can target any line GitHub can accept inside the changed hunk.
- Decision: Filtering returns accepted and rejected items with reasons instead of silently dropping invalid model output. Future callers can decide whether to warn, fail, or omit.
- Decision: Do not depend on the structured-output helper in this slice. The review validator should work on already-parsed values and remain reusable with any extraction source.

### Constraints

- Do not add dependencies.
- Do not add GitHub API calls or workflow automation.
- Do not accept empty paths, non-positive line numbers, empty bodies, or replies without known comment IDs.
- Do not silently coerce malformed review payloads into apparently valid comments.
- Preserve existing package script entries that may belong to parallel work in the dirty tree.

### Validation plan

- Run `npm run test:harness:review-output`.
- Run `npm run test:harness:core`.
- Run `npm run harness:docs:check`.
- Run `git diff --check`; because new files are untracked until staged, also run a direct trailing-whitespace scan over newly added files.

### Do NOT

- Do not post, resolve, or reply to PR comments in this slice.
- Do not copy Sandcastle source code verbatim.
- Do not turn the utility into a GitHub-specific workflow runner.
- Do not integrate with label-triggered `pull_request_target` workflows without a separate threat model.

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Future review automation will benefit from pre-API payload filtering. | Slice value | If PR mutation remains permanently out of scope, this helper remains useful only for optional adapters. |
| Right-side hunk line validation is sufficient for first-pass inline comment safety. | Filtering correctness | GitHub API nuances may require stricter position/side metadata later. |
| A pure local shape validator should not import structured-output yet. | Reuse boundary | A future caller may compose both helpers in a thin integration layer. |

### Understand status

- Graph status: fresh; `npm run harness:graph -- status` reported graph matches `HEAD` with provider `understand-anything` and refresh readiness `ready`.
- Changed components: planned `scripts/harness/review-output.mjs`, its test, package script, and stage artifacts.
- Affected components: future review automation, council-review, prompt-pack review artifacts, and PR adapter surfaces.
- Affected layers: Core and Test layers.
- Residual risk: low for local validation; medium for future GitHub API integration until tested against a real PR.