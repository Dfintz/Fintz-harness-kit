---
summary: "Architecture Brief - Sandcastle comparative review and integration candidates"
type: brief
status: active
source: research
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, comparative-review, structured-output, agent-workflows, sandboxing]
---
# Architecture Brief - Sandcastle comparative review and integration candidates

resource: https://github.com/mattpocock/sandcastle@e99f832f26dc9d245c019a9ddd19fa5dee792427, README.md, package.json, .sandcastle/agent-workflows/shared/run-with-extraction.ts, .sandcastle/agent-workflows/shared/review-output.ts, .sandcastle/agent-workflows/shared/diff-lines.ts, docs/adr/0010-structured-output.md, docs/adr/0007-worktree-locking.md, docs/adr/0017-sandbox-owned-sync-base-ref.md, .github/workflows/agent-review.yml, .github/workflows/agent-implement.yml, scripts/harness/prompt-router.mjs, scripts/harness/council-review.mjs, .github/harness/loops/review-fix.json, .github/harness/loops/feature-cycle.json

## Architecture Brief

### Objective

- Review Sandcastle for patterns this harness kit can cherry-pick or integrate.
- Identify integration candidates that improve the harness without replacing its stage machine, graph-first workflow, memory model, MCP server, or local-LLM loop runners.
- Produce a decision record that separates near-term adoptable slices from heavy runtime ideas that should stay deferred.

### Scope and boundaries

- In scope: comparative architecture review, integration candidate ranking, and a no-code implementation record for follow-up planning.
- Out of scope: importing Sandcastle as a dependency, adding Docker/Podman/Vercel sandbox orchestration, creating GitHub Actions that mutate PRs, or copying Sandcastle source code into the harness.
- Primary boundary: Sandcastle is an isolated agent execution library; this harness is an agent-agnostic operating contract plus local scripts, graph/memory surfaces, MCP tools, and deterministic workflow loops.

### Context sufficiency check

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| Sandcastle README and package metadata | Public API, provider model, template/workflow positioning | External reference project |
| Sandcastle `.sandcastle/agent-workflows/shared/*` | Structured extraction, review-output validation, diff-line filtering | External reusable workflow patterns |
| Sandcastle ADRs | Decisions for structured output, worktree locking, sandbox sync refs | External architecture rationale |
| Sandcastle GitHub workflows | Label-triggered implement/review automation and failure labels | External CI/agent workflow examples |
| Harness `prompt-router.mjs`, `council-review.mjs`, loops | Current local routing, prompt-pack, review synthesis, and workflow-loop surfaces | Harness orchestration |
| Harness graph status | Local graph is fresh and ready at HEAD | Understand-stage evidence |

| Missing artifact | Needed to answer |
| --- | --- |
| A local use case requiring isolated parallel agent execution | Whether sandbox providers or worktree locking should be implemented now |
| A GitHub App/Actions permission threat model for mutating PRs | Whether label-triggered implement/review workflows are safe to ship |

Proceeding is safe because this run records an integration assessment and follow-up plan, not a runtime capability change.

### Sandcastle patterns assessed

| Pattern | Sandcastle evidence | Harness fit | Verdict |
| --- | --- | --- | --- |
| Typed structured output extraction | `Output.object`, `extractStructuredOutput`, `runWithExtraction`, ADR 0010 | Strong fit for prompt-pack stage artifacts, council synthesis, and review ledgers | Adopt as a harness-native utility, not a dependency |
| Review output validation and diff-line filtering | `review-output.ts`, `diff-lines.ts`, `agent-workflows/review/review.ts` | Strong fit if/when the harness posts PR review comments or validates inline findings | Adopt the concept with repo-local schema and diff validation |
| Label-triggered agent workflows | `agent-implement.yml`, `agent-review.yml` | Useful operator pattern, but high permission and `pull_request_target` risk | Defer pending threat model and explicit human approval |
| Parallel planner/execute/review/merge template | `parallel-planner-with-review/main.mts` | Concept overlaps with `prompt-pack`, `feature-cycle`, and `council-review` | Reuse as prompt-pack template inspiration only |
| Worktree locking and sandbox-owned sync refs | ADR 0007, ADR 0017, `WorktreeManager.ts`, `syncOut` path | Valuable only if harness starts owning concurrent worktrees/sandboxes | Defer until that runtime exists |
| Full sandbox provider abstraction | `SandboxProvider.ts`, Docker/Podman/Vercel providers | Misaligned with current script-first harness and MCP command boundaries | Do not integrate now |

### Artifacts to create

- `.github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md` - this Architecture Brief and candidate ranking.
- `.github/harness/memory/reviews/implementation-notes-sandcastle-comparative-review-2026-08-07.md` - no-code implementation evidence for this comparative run.
- `.github/harness/memory/briefs/sandcastle-comparative-review-breadth-2026-08-07.md` - breadth review findings for the assessment.
- `.github/harness/memory/briefs/sandcastle-comparative-review-depth-2026-08-07.md` - depth gate ledger for the assessment.
- `.github/harness/memory/reviews/feedback-verdict-sandcastle-comparative-review-2026-08-07.md` - terminal feedback verdict and settled recommendations.

### Artifacts to modify

- None in this pass. Runtime changes should be separate, risk-ranked slices.

### Key decisions

- Decision: Do not import Sandcastle wholesale. Its core value is isolated agent execution, but this harness already owns a different abstraction: staged operating contracts, bounded loops, prompt packs, graph/memory retrieval, and MCP surfaces.
- Decision: The best near-term cherry-pick is a harness-native structured artifact contract inspired by Sandcastle's `Output.object`: tag extraction, JSON parsing, schema validation, loud failure, and retry/resume only when the owning agent provider supports it.
- Decision: Pair structured extraction with diff-aware review filtering before any PR-comment automation. Inline comments must target changed lines, and replies must target known unresolved thread IDs.
- Decision: Treat Sandcastle's label-triggered GitHub workflows as a future operations package, not as a default harness feature. Mutating PRs from `pull_request_target` requires a separate threat model, permissions design, and approval boundary.
- Decision: Keep worktree locks and sandbox sync refs deferred until the harness owns long-lived concurrent worktrees. They solve real problems, but adopting them before the runtime exists would create unused complexity.
- Decision: Use Sandcastle's ADR habit as a documentation-quality signal. For harness decisions, the existing Architecture Brief memory surface should remain the owner rather than introducing a second ADR directory now.

### Constraints

- Any structured-output utility must be dependency-light and must not require Sandcastle, Effect, Docker, Podman, Vercel, or Claude-specific session storage.
- Any schema contract must fail loudly on missing tags, invalid JSON, or validation errors; do not silently coerce malformed model output.
- Any PR review automation must validate file paths, line numbers, and thread IDs against GitHub/diff evidence before posting.
- Any GitHub workflow that writes branches, labels, or PR comments must preserve explicit approval boundaries and cannot be added under `pull_request_target` without a security design.
- Keep the project-agnostic kit boundary: external examples may inform local patterns, but provider-specific automation must remain optional.

### Validation plan

- For this no-code assessment: run `npm run harness:docs:check` and `git diff --check` after writing artifacts.
- For a future structured-output slice: add self-tests covering missing tag, last-match-wins, fenced JSON unwrap, invalid JSON, schema failure, and success.
- For a future review-filter slice: add tests proving comments outside changed hunks and replies to unknown IDs are rejected before any GitHub API call.
- For any future GitHub workflow slice: require a threat model, dry-run mode, least-privilege permissions, label transition tests, and explicit human approval.

### Do NOT

- Do not add `@ai-hero/sandcastle` as a dependency for this harness kit.
- Do not copy Sandcastle source code verbatim; reimplement only the small generic ideas that match local ownership.
- Do not introduce Docker/Podman/Vercel sandbox providers unless the harness deliberately becomes an execution runtime.
- Do not add mutating GitHub Actions copied from Sandcastle without a repository-specific security review.
- Do not make structured output part of the completion signal; keep payload extraction and run termination separate.

### Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| Structured artifact extraction is useful for prompt-pack stage outputs and council/review envelopes. | Priority of the first follow-up slice | If current JSON emitters are sufficient, the slice may be lower value than review-comment validation. |
| The harness may eventually post inline PR review comments. | Value of diff-line filtering | If PR mutation remains out of scope, the filter belongs only in optional workflow docs. |
| No immediate local need exists for isolated parallel agent execution. | Deferring sandbox/worktree runtime adoption | If users want AFK parallel execution now, Sandcastle integration may deserve a separate design. |
| Sandcastle commit `e99f832f26dc9d245c019a9ddd19fa5dee792427` is representative of the current external design. | Comparative evidence | Future Sandcastle changes may alter the recommendation. |

### Recommended follow-up slices

1. Structured artifact extraction utility: add a small `scripts/harness` helper plus tests for tagged JSON/string extraction and schema-like validation. Integrate only with one low-risk caller, likely a prompt-pack or plan-review validation path.
2. Review output schema and diff filter: create a local schema for review findings that can reject invalid inline-comment targets before a PR automation path exists.
3. Prompt-pack template enhancement: add a generated parallel planner/reviewer prompt-pack variant that expresses Sandcastle's planner/implement/review/merge topology without adding sandbox execution.
4. GitHub workflow pilot: design label-triggered `agent:review` or `agent:implement` workflows only after a threat model and permission matrix are approved.
5. Worktree concurrency hardening: revisit Sandcastle-style locks only if the harness adds managed worktrees or concurrent agent execution.

### Understand status

- Graph status: fresh; `npm run harness:graph -- status` reported graph matches `HEAD` with provider `understand-anything` and refresh readiness `ready`.
- Changed components: memory brief and review artifacts only.
- Affected components: future prompt-pack, council-review, review automation, and workflow-loop design surfaces.
- Affected layers: Core and Test layers for any future utility; current pass is documentation/memory only.
- Residual risk: medium because Sandcastle was reviewed from a shallow clone at one commit and no runtime integration was implemented.