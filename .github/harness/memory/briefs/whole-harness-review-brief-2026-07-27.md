---
summary: "Architecture Brief"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [whole, harness, review, brief]
---
## Architecture Brief
resource: .github/harness/HARNESS.md,.github/harness/LOOPS.md,.github/instructions/02-UNDERSTAND-WORKFLOW.md,.github/instructions/03-ARCHITECT.md,.github/instructions/04-IMPLEMENT.md,.github/instructions/05-REVIEW-BREADTH.md,.github/instructions/06-REVIEW-DEPTH.md,.github/instructions/07-FEEDBACK.md,scripts/harness/prompt-router.mjs,scripts/harness/plan-review.mjs,scripts/harness/graph.mjs,scripts/harness/harness-report.mjs,harness.config.json,.github/harness/registry.json,.github/harness/loops/plan-review.json,.github/harness/loops/feature-cycle.json

### Objective
- Run an evidence-backed, repository-wide harness review cycle and produce actionable breadth/depth verdicts without speculative code churn.

### Scope and boundaries
- In scope: harness routing, stage instructions, loop protocol alignment, catalog/registry consistency, graph freshness posture, and review artifact quality.
- Out of scope: introducing new product features, changing public workflow semantics without explicit failing evidence, and broad refactors not tied to review findings.

### Artifacts to create
- `.github/harness/memory/briefs/whole-harness-review-brief-2026-07-27.md` - decision contract for this full-stage review run.
- `.github/harness/memory/briefs/whole-harness-review-breadth-2026-07-27.md` - severity-tagged breadth findings ledger.
- `.github/harness/memory/briefs/whole-harness-review-depth-2026-07-27.md` - gate ledger and structural findings.
- `.github/harness/memory/briefs/whole-harness-review-feedback-2026-07-27.md` - feedback verdict record for challenged points.

### Artifacts to modify
- No code artifacts are pre-committed for modification; only modify source files if deterministic checks expose concrete Blocker or Major issues requiring repair.

### Key decisions
- Decision: Use deterministic fallback for graph-driven confidence because graph refresh readiness is degraded (missing `pluginRoot`), while still using available graph status/layer/hub outputs.
- Decision: Treat this task as review-first implementation (evidence production) rather than feature implementation; code edits are conditional on verified high-severity findings.
- Decision: Use plan-review `--lens plan` as architect-challenge with a read-only adversarial pass before implementation evidence collection.
- Decision: `plan-review` reviewer command (`claude -p`) failed in this runtime, so perform an inline skeptical architect-challenge fallback and record fallback constraints in this brief.
- Decision: Prioritize high-leverage surfaces with known hub centrality (`prompt-router.mjs`, `harness-report.mjs`, `mcp-tools.mjs`, `graph.mjs`) for focused scrutiny.

### Constraints
- Follow staged handoff order exactly: Understand → Architect → Architect Challenge → Implement → Review Breadth → Review Depth → Feedback.
- Keep claims grounded in command outputs and concrete repository surfaces.
- Preserve bounded-loop and safety guardrail principles; do not weaken approvals, destructive defaults, or isolation boundaries.
- Keep review artifacts concise, severity-ranked, and evidence-cited.

### Validation plan
- `npm run harness:graph status`
- `npm run harness:graph -- provider-status`
- `npm run harness:graph -- layers`
- `npm run harness:graph -- hubs`
- `npm run harness:report`
- `node scripts/harness/plan-review.mjs --lens plan --plan .github/harness/memory/briefs/whole-harness-review-brief-2026-07-27.md --reviewer "claude -p"`
- `npm run harness:docs:check`
- `npm run harness:catalog:sync`
- `npm run harness:graph:parity`

### Do NOT
- Do NOT report findings without artifact-level evidence.
- Do NOT conflate stale graph state with code failure; annotate confidence impact precisely.
- Do NOT perform unrelated cleanup during a review-only task.
- Do NOT bypass architect-challenge or collapse breadth/depth into one undifferentiated pass.

### Assumptions and risks
- `[UNVERIFIED]` `claude -p` is available for external reviewer invocation in `plan-review`; if unavailable, fallback is a manual skeptical pass with explicit note.
- `[UNVERIFIED]` deterministic checks in `package.json` cover all current harness contract surfaces; hidden drift may remain in unvalidated paths.
- Risk: stale graph snapshot can hide very recent dependency shifts, especially in high-degree nodes.
- Risk: repository-wide review breadth may surface more findings than can be remediated in one session; non-blocking findings may require follow-up tasks.
- Risk: without an external rival model invocation in this environment, architect-challenge diversity is reduced to an inline skepticism pass.