# Architecture Brief: Harness Full Review — 2026-07-25
resource: AGENTS.md, .github/harness/HARNESS.md, .github/harness/LOOPS.md, .github/instructions/02-UNDERSTAND-WORKFLOW.md, .github/instructions/03-ARCHITECT.md, .github/instructions/04-IMPLEMENT.md, .github/instructions/05-REVIEW-BREADTH.md, .github/instructions/06-REVIEW-DEPTH.md, .github/instructions/07-FEEDBACK.md, harness.config.json, package.json, scripts/harness/validate-doc-contracts.mjs, scripts/harness/prompt-router.mjs, .github/harness/pilot/INTEGRATION-PLAN.md, .github/harness/optimized-skills/

## Architecture Brief

### Objective
- Execute a full harness-wide review run that identifies concrete defects, optimization surfaces, and structural risks across docs, scripts, and workflow contracts.
- Produce severity-ranked findings with evidence and architecture-gate verdicts.

### Scope and boundaries
- In scope:
  - Harness routing/stage contracts, docs-contract validation signals, memory/brief hygiene, graph readiness, and script/docs consistency.
  - Read-only review of repository artifacts; no behavior-changing code edits in this run.
- Out of scope:
  - Broad style-only markdown cleanup unless it blocks harness correctness.
  - New feature implementation unrelated to review findings.

### Artifacts to create
- .github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-25.md - Architecture contract for this review run.

### Artifacts to modify
- None during this run; this is an execution+review pass.

### Key decisions
- Decision: Continue despite failed graph freshness gate, with explicit reduced-confidence annotation.
  - Evidence: `npm run harness:graph -- status` and `graph genui-status` show missing `.understand-anything/knowledge-graph.json` and pluginRoot requirement.
- Decision: Use deterministic repository checks (`harness:docs:check`, `harness:report`, `harness:loops`) as primary evidence surfaces.
- Decision: Treat stale generated artifacts under `.github/harness/optimized-skills/` as separate from core runtime script correctness, unless they pollute validation signal.

### Constraints
- Preserve harness safety posture: no weakening loop guardrails, approvals, or destructive-default protections.
- Findings must cite concrete artifact evidence.
- Architect challenge must run and return `VERDICT: APPROVED|REVISE` before final review conclusions.

### Validation plan
- Routing and handoff:
  - `node scripts/harness/prompt-router.mjs route --task "..." --json`
  - `node scripts/harness/prompt-router.mjs handoff --task "..."`
- Understand evidence:
  - `npm run harness:graph -- status`
  - `npm run harness:graph -- provider-status`
  - `node scripts/harness/graph.mjs genui-status --json`
- Review evidence:
  - `npm run harness:docs:check`
  - `npm run harness:report`
  - `npm run harness:loops`
  - targeted text/file inspection for all warnings surfaced.
- Architect challenge:
  - `node scripts/harness/plan-review.mjs --lens plan --subject <brief> --reviewer "<command>"`

### Do NOT
- Do NOT claim graph-derived dependency certainty while graph freshness is degraded.
- Do NOT present generalized “quality” claims without deterministic evidence.
- Do NOT silently reinterpret generated artifact warnings as core runtime failures without path-level explanation.

### Assumptions and risks
- [UNVERIFIED] Existing warning-heavy docs areas are intentionally archival/generated and may be accepted debt.
  - Affects: severity calibration for docs-contract findings.
- [UNVERIFIED] `plan-review` reviewer command can run reliably against locally available model backend in this environment.
  - Affects: architect-challenge execution confidence.
- Risk: Missing graph snapshot lowers confidence for full dependency blast-radius mapping.

### Architect challenge (fallback)
- Trigger: `node scripts/harness/plan-review.mjs --lens plan --subject .github/harness/memory/briefs/BRIEF-harness-full-review-2026-07-25.md --reviewer "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b" --json`
- Runtime result: reviewer command exited non-zero with no critique; direct reviewer probe (`"test" | node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b`) returned `fetch failed`.
- Fallback applied: inline skeptical pass per harness-feature prompt runtime/tool-limit adjustment rule.

Challenge points and resolutions:
1. Should warning-heavy generated docs under `.github/harness/optimized-skills/` be Blocker findings?
  - Resolution: No. Treat as Major signal-quality issue only if these files are intentionally generated artifacts and not runtime contracts.
2. Is missing graph snapshot sufficient reason to halt review?
  - Resolution: No. Continue with reduced-confidence annotation for dependency mapping, but not for deterministic command evidence.
3. Should markdown lint volume from legacy docs dominate review output?
  - Resolution: No. Focus findings on correctness, contract drift, and missing-script references that affect operators.

VERDICT: APPROVED
