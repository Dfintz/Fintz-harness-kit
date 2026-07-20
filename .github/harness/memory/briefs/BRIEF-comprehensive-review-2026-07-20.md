<!-- markdownlint-disable-next-line MD022 -->
# Architecture Brief: Comprehensive Whole-App Review (Harness Stage Run)
resource: scripts/harness/command-validation.mjs, scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs, scripts/harness/harness-mcp-tasks.mjs, .github/harness/registry.json, .github/harness/MCP-INTEGRATION.md, .github/MCP-INTEGRATION.md, .github/skills/setup-harness-bootstrap/SKILL.md, backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts, backend/dist/services/authentication/TwoFactorService.js, frontend/, apps/mobile/

Date: 2026-07-20
Architect: GPT-5.3-Codex
Route: understand -> architect -> implement -> review-breadth -> review-depth -> feedback

## Objective

- Deliver a full, evidence-based review of the repository for bugs, security issues, technical debt, and standards drift, with multi-model challenger coverage.

## Scope and boundaries

- In scope:
  - Harness runtime and CLI surfaces under scripts/harness/.
  - Harness contracts/docs/skills under .github/harness/, .github/instructions/, .github/skills/.
  - Backend migration and runtime 2FA backup-code handling.
  - Existence/health check of frontend and mobile workspace surfaces.
- Out of scope:
  - Editing production code in this run.
  - Deep product feature review where source code is absent from workspace.

## Artifacts to create

- .github/harness/reviews/comprehensive-review-2026-07-20-implementation-notes.md - stage 2 implementation artifact for this review run.
- .github/harness/reviews/comprehensive-review-2026-07-20-review-breadth-findings.md - stage 3 findings ledger.
- .github/harness/reviews/comprehensive-review-2026-07-20-review-depth-findings.md - stage 4 gate ledger and structural findings.
- .github/harness/reviews/comprehensive-review-2026-07-20-feedback-verdict.md - stage 5 adjudication artifact.

## Artifacts to modify

- None in this run (review-only execution).

## Key decisions

- Decision: Run comprehensive read-only analysis first, then produce stage artifacts without mixing remediation changes.
  - Reasoning: Preserves clean separation between discovery/verdict and implementation.
- Decision: Treat missing graph snapshot as reduced-confidence condition and compensate with direct file evidence + multi-model challenger passes.
  - Reasoning: Understand gate could not be fully satisfied because graph snapshot was missing/stale.
- Decision: Perform inline architect challenge fallback even though router omitted architect-challenge stage.
  - Reasoning: Required by harness-feature prompt fallback rule.

## Constraints

- Do not weaken safety/approval boundaries while reviewing.
- Do not claim proof without runnable evidence from commands or direct file inspection.
- Keep findings severity-focused and actionable with concrete file references.

## Validation plan

- Router and handoff commands:
  - node scripts/harness/prompt-router.mjs route --task "..." --json
  - node scripts/harness/prompt-router.mjs handoff --task "..."
- Understand/contract checks:
  - npm run harness:graph -- status
  - npm run harness:graph -- provider-status
  - npm run harness:docs:check
  - npm run harness:mcp -- --help
- Static diagnostics and challenger evidence:
  - get_errors across workspace
  - Multi-model Explore subagent passes (Opus, Gemini, GPT-5.3-Codex)

## Do NOT

- Do NOT mark graph status as healthy when .understand-anything/knowledge-graph.json is missing.
- Do NOT merge docs-contract claims that diverge from script argument contracts.
- Do NOT classify absent frontend/mobile source as clean code; classify as insufficient context.

## Assumptions and risks

- [UNVERIFIED] Some backend source files are only available as compiled dist output in this workspace.
  - Affects: line-level source mapping for backend runtime findings.
  - Risk: remediation patch locations may need source-repo alignment.
- [UNVERIFIED] Frontend/mobile code may exist in another branch or repository.
  - Affects: completeness of product-surface review.
  - Risk: undetected product issues outside visible workspace.

## Inline skeptical pass (architect-challenge fallback)

- Challenge 1: Could shell-command bypass findings be false positives due to command allowlist?
  - Verdict: No. Allowlist validates only first token; runner executes full string via shell=true.
- Challenge 2: Could MCP docs mismatch be acceptable as alias behavior?
  - Verdict: No. implementation requires --query and --file; published command forms are non-functional.
- Challenge 3: Could backup-code migration no-op be intended and harmless?
  - Verdict: Partially intended, but current text overclaims phase enforcement and leaves a security-control mismatch.

VERDICT: APPROVED (review artifacts proceed without blocking architecture change work).
