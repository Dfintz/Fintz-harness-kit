# Architecture Brief: Fix Full Review Findings — 2026-07-25
resource: .github/harness/pilot/INTEGRATION-PLAN.md, .github/harness/pilot/QUICK-START.md, .github/skills/setup-harness-bootstrap/SKILL.md, package.json, scripts/harness/validate-doc-contracts.mjs, harness.config.json, scripts/harness/phase5-multi-model-optimizer.mjs, scripts/harness/phase5/validate-skills.mjs, .github/instructions/02-UNDERSTAND-WORKFLOW.md, scripts/harness/measure-phase5c-real.mjs

## Architecture Brief

### Objective
- Resolve the previously identified blocker and major issues by making shipped docs and tooling internally consistent and executable.
- Preserve backward compatibility where practical while converging naming and validation signal quality.

### Scope and boundaries
- In scope:
  - Pilot docs command correctness.
  - Missing script alias in package scripts.
  - Validator exclusion scope for generated artifacts.
  - Skill slug consistency for eval-first-tuning surfaces.
  - Understand-stage degraded graph guidance.
  - Local measurement prompt optimization guidance for understand-process.
- Out of scope:
  - Large pilot doc restructuring beyond command correctness.
  - Re-enabling graph provider by default.

### Artifacts to create
- .github/harness/memory/briefs/BRIEF-fix-full-review-findings-2026-07-25.md - decision record for this remediation.

### Artifacts to modify
- .github/harness/pilot/INTEGRATION-PLAN.md - replace non-existent script references with shipped command/script surfaces.
- .github/harness/pilot/QUICK-START.md - replace non-existent cross-model script reference.
- .github/skills/setup-harness-bootstrap/SKILL.md - deterministic validation command update.
- package.json - add script alias compatibility for harness:skills:validate.
- scripts/harness/validate-doc-contracts.mjs - exclude optimized-skills generated docs from citation checks.
- harness.config.json - canonicalize mapping key to eval-first-tuning and add alias compatibility metadata.
- scripts/harness/phase5-multi-model-optimizer.mjs - canonicalize eval-first-tuning key and add alias-safe lookup.
- scripts/harness/phase5/validate-skills.mjs - canonicalize skill slug and shifted-skill tracking.
- .github/instructions/02-UNDERSTAND-WORKFLOW.md - explicitly define deterministic non-graph fallback path when graph refresh unavailable.
- scripts/harness/measure-phase5c-real.mjs - improve understand-process local-tier prompt/task packaging for targeted optimization signal.

### Key decisions
- Decision: Keep `eval-first-tuning` as canonical slug to match registry + skill directory and add compatibility handling for legacy `evaluate-first-tuning` references.
- Decision: Fix pilot docs by replacing dead command paths with existing harness scripts/commands rather than introducing placeholder scripts.
- Decision: Preserve backward compatibility by adding `harness:skills:validate` alias in package scripts and keeping newer `harness:docs:check`.
- Decision: Keep `.github/harness/optimized-skills/` in validator scan, but suppress only script-citation warnings for known generated filenames (`*--ollama--*.md`) so other contract checks remain visible.

### Constraints
- Do not weaken safety guardrails or review-stage requirements.
- Do not introduce fake/empty scripts just to satisfy docs.
- Keep changes minimal and deterministic.

### Validation plan
- `npm run harness:docs:check`
- `npm run harness:route -- --task "fix all findings" --json` (sanity)
- `npm run harness:graph -- status` (expected degraded warning retained, now documented with fallback)
- Targeted grep checks for removed missing script names in pilot docs.
- `node scripts/harness/phase5/validate-skills.mjs --dry-run` to confirm canonicalized skill slug map still enumerates 20 skills and shifted set.
- `node scripts/harness/measure-phase5c-real.mjs --provider local --dry-run` to verify understand-process prompt-packaging edits are loaded without runtime failures.
- Slug compatibility check: verify both `eval-first-tuning` and legacy `evaluate-first-tuning` references resolve consistently in edited scripts/config.
- Pilot doc completeness check: confirm runnable snippets, failure-recovery snippets, and file-tree/script listings no longer point to non-existent pilot scripts.

### Do NOT
- Do NOT change stage machine order.
- Do NOT claim graph freshness if graph asset is absent.
- Do NOT remove historical context from pilot docs; only make operational commands truthful.
- Do NOT hide non-generated docs-contract regressions while suppressing generated artifact noise.

### Assumptions and risks
- [UNVERIFIED] Some legacy artifacts may still reference `evaluate-first-tuning`; compatibility handling mitigates runtime risk while cleanup can continue incrementally.
- [UNVERIFIED] Updating local measurement prompt for understand-process improves signal without requiring baseline threshold changes.

### Architect challenge resolution
- Challenge outcome: REVISE (blocking concern: validation plan too weak for runtime-affecting changes).
- Resolution: expanded validation plan with script-level dry-runs, slug compatibility checks, and explicit pilot-doc completeness checks; narrowed validator-noise strategy to generated filename patterns only.
- VERDICT: APPROVED
