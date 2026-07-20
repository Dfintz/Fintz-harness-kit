# Architecture Brief: Comprehensive Domain Review
resource: .github/harness/HARNESS.md, .github/harness/registry.json, scripts/harness/prompt-router.mjs, scripts/harness/mcp-server.mjs, README.md, backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts

## Objective

Run a full, evidence-based review across all repository domains, focusing on bugs, risk, technical debt, and standards compliance, without making runtime behavior changes in this pass.

## Scope and boundaries

- In scope:
  - Harness runtime scripts in scripts/harness.
  - Harness governance and stage docs in .github/harness and .github/instructions.
  - Skill and agent packaging surfaces in .github/skills, .claude/skills, skills, and .github/agents.
  - Backend source footprint and migration/auth-adjacent boundaries.
  - Workspace domain completeness checks for frontend and mobile folders.
- Out of scope:
  - Large refactors or remediation implementation across all findings in one pass.
  - Product feature changes.

## Artifacts to create

- .github/harness/reviews/comprehensive-domain-review-2026-07-20-implementation-notes.md
- .github/harness/reviews/comprehensive-domain-review-2026-07-20-review-breadth-findings.md
- .github/harness/reviews/comprehensive-domain-review-2026-07-20-review-depth-findings.md
- .github/harness/reviews/comprehensive-domain-review-2026-07-20-feedback-verdict.md

## Artifacts to modify

- None for this review run.

## Key decisions

- Use router-emitted non-trivial stage flow exactly: understand, architect, implement, review-breadth, review-depth, feedback.
- Keep this pass read-only and evidence-driven; document actionable remediation backlog instead of mixing fixes into review output.
- Treat graph freshness as healthy but record refresh-readiness degradation as an operational risk.

## Constraints

- No guardrail weakening or approval-boundary bypass.
- No inferred claims without command-backed or file-backed evidence.

## Validation plan

- Run route and handoff bootstrap commands.
- Run graph status, provider-status, and hubs checks.
- Run MCP impact checks on representative cross-domain files.
- Run docs contract validation.
- Collect diagnostics with get_errors and structural checks on missing domains.

## Do NOT

- Do NOT report stale assumptions as confirmed facts.
- Do NOT collapse packaging surfaces (skills) into a single tree when adapter-specific layout is intentional.
- Do NOT mark frontend/mobile domain as healthy application surfaces without source files.

## Assumptions and risks

- [UNVERIFIED] frontend and apps/mobile may be intentionally omitted from this workspace snapshot.
- Risk: markdown lint debt in root docs and older review artifacts can erode trust in published contracts.
- Risk: backend source/dist asymmetry complicates safe future edits.
- Risk: graph refresh readiness remains degraded unless pluginRoot is configured.

## Inline skeptical pass (architect-challenge fallback)

- Challenge: Could the comprehensive review overstate risk by relying on old findings?
  - Resolution: Findings are tied to fresh command outputs in this run (graph, errors, file searches).
- Challenge: Is the skills/agents placement actually wrong?
  - Resolution: No. Contract and docs-check confirm dual-layout is intentional and valid.
- Challenge: Are missing frontend/mobile files proof of defect?
  - Resolution: Not proof of defect; reported as confidence-reducing coverage gap requiring confirmation.

VERDICT: APPROVED
