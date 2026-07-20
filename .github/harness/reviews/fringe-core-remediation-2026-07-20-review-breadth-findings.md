# Review Breadth Findings: Fringe Core Comprehensive Review

## Scope and coverage note
- Scope: mixed (backend, frontend, mobile, shared packages, harness runtime, CI/security/doc contracts).
- Coverage limits: challenger CLI council could not run on this machine because codex and claude executables are unavailable; challenge pass was executed via architect-challenge subagent.

## Findings ledger

### Blocker

1. Artifact: .github/workflows/
   Finding: Hosted CI gate surface is absent (no enforceable PR checks).
   Evidence: No files matched .github/workflows/**.
   Impact: Regressions, security issues, and build failures can merge without automated controls.
   Confidence: HIGH
   Recommended fix: Create required workflows for lint, type-check, test, build, and security scan; enable branch protection requiring all checks.

### Major

1. Artifact: backend/package.json
   Finding: Lint warning budgets are permissive enough to hide meaningful quality debt.
   Evidence: lint and lint:fix use max-warnings 5500; lint:fix:staged uses max-warnings 999999.
   Impact: Large warning backlog remains normalized; quality trend can degrade undetected.
   Confidence: HIGH
   Recommended fix: ratchet warning limits down by sprint and fail on net-new warnings in changed files.

2. Artifact: frontend/jest.config.cjs
   Finding: Coverage floor is set very low (branches/functions/lines/statements near low 20s).
   Evidence: coverageThreshold global values: branches 27, functions 21, lines 28, statements 27.
   Impact: High chance of uncaught regressions on UI logic and branching behavior.
   Confidence: HIGH
   Recommended fix: staged coverage ratchet with enforced non-regression in CI.

3. Artifact: backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts
   Finding: Backup code migration remains compatibility-first until explicit enforcement phase switch.
   Evidence: migration states legacy SHA-256 remains runtime-compatible unless BACKUP_CODE_HASH_PHASE=enforce.
   Impact: Legacy hash exposure window can remain open without explicit rollout deadline.
   Confidence: HIGH
   Recommended fix: define enforcement date, instrument remaining legacy usage, and execute phase switch with rollback plan.

4. Artifact: scripts/harness/plan-review.mjs
   Finding: Reviewer write-protection is subject-file-oriented; broader workspace mutation risk remains without isolation.
   Evidence: Subject hash check and revert are performed for the review subject path; no full sandbox isolation guarantee in this script.
   Impact: Non-subject artifacts could be altered by reviewer command in local runs.
   Confidence: MEDIUM
   Recommended fix: execute reviewer commands in isolated worktree/container with restricted writable paths.

5. Artifact: scripts/harness/evolve-guard.mjs
   Finding: Integrity guardrails are strong but bounded to explicit forbidden globs.
   Evidence: Forbidden list and integrity hash cover declared files; policy-driving files outside boundary are not automatically protected.
   Impact: Indirect governance drift risk if high-impact policy surfaces are omitted from forbidden set.
   Confidence: MEDIUM
   Recommended fix: expand forbidden and integrity boundary for high-impact instruction and policy surfaces.

## Concrete remediation backlog (Breadth-aligned)

| ID | Stage | Owner | Action | Acceptance criteria | Target timeline |
| --- | --- | --- | --- | --- | --- |
| RB-01 | Review Breadth | DevOps Lead | Add CI workflows for lint, type-check, test, build, security | Workflows exist in .github/workflows and run on pull_request; branch protection requires all checks | 2026-07-22 to 2026-07-25 |
| RB-02 | Review Breadth | Frontend Lead | Introduce coverage ratchet policy | CI fails if coverage drops below baseline; baseline report committed and documented | 2026-07-23 to 2026-07-30 |
| RB-03 | Review Breadth | Backend Lead | Introduce lint warning ratchet | max-warnings reduced to <=500 first pass; net-new warnings on changed files fail CI | 2026-07-23 to 2026-07-30 |
| RB-04 | Review Breadth | Security Lead | Publish 2FA hash migration rollout plan | Dated enforcement milestones, telemetry dashboard, rollback steps, and operator runbook merged | 2026-07-22 to 2026-07-29 |
| RB-05 | Review Breadth | Harness Maintainer | Document reviewer isolation requirement | Review runbook updated; non-isolated reviewer mode marked non-compliant for sensitive reviews | 2026-07-22 to 2026-07-24 |
