---
summary: "Architecture Brief - Radar Reevaluation and Adoption Audit"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [radar, reevaluation, and, adoption]
---
# Architecture Brief - Radar Reevaluation and Adoption Audit
resource: .github/harness/memory/radar/, .github/harness/memory/radar/README.md, .github/harness/memory/radar/_template.md, .github/harness/runs/run-contract.md, scripts/harness/record-run.mjs, scripts/harness/harness-report.mjs, .github/instructions/03-ARCHITECT.md, .github/instructions/05-REVIEW-BREADTH.md
status: active

## Architecture Brief

### Objective
- Re-evaluate every radar entry, determine whether currently parked/rejected entries are now usable, and verify whether all adopted entries are actually integrated.

### Scope and boundaries
- In scope:
  - Produce one auditable reevaluation matrix for all radar entries.
  - Classify each adopted entry as integrated, partially integrated, or not integrated based on file evidence.
  - Update decision logs for entries whose status changed or whose integration state was confirmed in this pass.
- Out of scope:
  - Implementing all newly promotable parked items.
  - Introducing new radar ideas.

### Artifacts to create
- `.github/harness/memory/briefs/radar-reevaluation-matrix-2026-07-26.md` - per-entry verdicts and adopted-integration audit.

### Artifacts to modify
- `.github/harness/memory/radar/*.md` - add decision-log reevaluation rows for entries changed or explicitly audited for integration state.

### Key decisions
- Decision: Use file-backed evidence only for integration claims; no assumptions from prior chat summaries.
- Decision: Treat an adopted entry as integrated only when target behavior appears in shipped repo artifacts, not just in radar notes.
- Decision: Keep status changes conservative; only promote parked/rejected entries where next step is concrete and immediately actionable with current repo prerequisites.

### Integration rubric (adopted entries)
- `integrated`:
  - At least one target behavior from the entry is present in shipped files, and
  - At least one target file/domain named in the entry shows corresponding implementation evidence, and
  - The evidence path(s) are recorded in the reevaluation matrix.
- `partially integrated`:
  - Some target behavior is present, but one or more required target behaviors or target-file implementations are still missing.
- `not integrated`:
  - No qualifying implementation evidence exists in shipped files, or progress is blocked on unmet external prerequisites.

### Promotion checklist (parked/rejected entries)
Promote only when all are true:
- Prerequisites are currently met (tooling, approvals, external dependencies).
- A concrete next step is executable now in this repository.
- Target files/domains are explicit and verifiable.
- Risks/constraints are bounded and do not widen guardrails without explicit approval.
- Evidence paths supporting the promotion are listed in the reevaluation matrix.

### Constraints
- Preserve one-idea-per-file radar structure.
- Keep decision-log updates concise and date-stamped.
- Avoid changing unrelated adopted entries beyond audit annotations.
- Record per-entry evidence paths in the matrix for every status or integration verdict.

### Validation plan
- Run `npm run harness:docs:check` after updates.
- Run a grep-based evidence check for each adopted entry listed as integrated.
- Verify changed radar files still parse with frontmatter fields (`summary`, `status`, `source`, `author_project`, `captured`, `tags`).

### Do NOT
- Do NOT mark adopted entries as integrated without concrete evidence files.
- Do NOT promote parked/rejected entries solely on interest; require a bounded next step.
- Do NOT rewrite historical decision rationale; append reevaluation rows only.

### Assumptions and risks
- `[UNVERIFIED]` Graph is stale due to missing `understand-anything` pluginRoot; dependency map confidence is reduced and compensated by direct file evidence.
- `[UNVERIFIED]` Some adopted entries may intentionally remain pending due to external prerequisites (for example, third-party app installation).