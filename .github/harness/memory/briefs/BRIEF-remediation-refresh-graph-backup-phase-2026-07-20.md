# Architecture Brief: Remaining Shell Path Hardening + Runtime Backup-Code Phase Enforcement
resource: scripts/harness/refresh-graph.mjs, scripts/harness/command-validation.mjs, backend/dist/services/authentication/TwoFactorService.js, backend/dist/services/authentication/TwoFactorService.d.ts, backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts, backend/dist/migrations/20260719000000-MigrateBackupCodesToBcrypt.js

Date: 2026-07-20
Status: Architect -> Implement

## Objective
- Complete the remaining command hardening gap in graph refresh orchestration.
- Implement runtime backup-code enforcement policy so bcrypt-only mode can be enabled at runtime.

## Scope and boundaries
- In scope:
  - subprocess command execution in refresh graph backend invocation.
  - runtime backup-code verification/removal behavior in TwoFactorService runtime artifact.
  - migration contract wording/logs to stay truthful after runtime policy change.
- Out of scope:
  - broad refactor of all backend auth surfaces.
  - changing backup code format/entropy in this run.

## Artifacts to create
- .github/harness/reviews/remediation-refresh-graph-backup-phase-2026-07-20-implementation-notes.md
- .github/harness/reviews/remediation-refresh-graph-backup-phase-2026-07-20-review-breadth-findings.md
- .github/harness/reviews/remediation-refresh-graph-backup-phase-2026-07-20-review-depth-findings.md
- .github/harness/reviews/remediation-refresh-graph-backup-phase-2026-07-20-feedback-verdict.md

## Artifacts to modify
- scripts/harness/refresh-graph.mjs: replace shell string spawn with parsed executable + argv invocation.
- backend/dist/services/authentication/TwoFactorService.js: add BACKUP_CODE_HASH_PHASE runtime policy and enforce-mode behavior.
- backend/dist/services/authentication/TwoFactorService.d.ts: declaration alignment for new private runtime phase member/helper.
- backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts: update contract text for enforce-mode availability.
- backend/dist/migrations/20260719000000-MigrateBackupCodesToBcrypt.js: align emitted runtime guidance logs.

## Key decisions
- Decision: use parseValidatedCliCommand in refresh-graph to remove final shell:true subprocess in scripts/harness.
  - Reasoning: consistent hardening posture across harness runner surfaces.
- Decision: implement phase policy with compat default and enforce opt-in using BACKUP_CODE_HASH_PHASE.
  - Reasoning: backward-compatible rollout while enabling explicit security tightening.
- Decision: keep enforcement to verification/removal paths only.
  - Reasoning: minimal blast radius and preserves existing code generation/hash flows.

## Constraints
- Do not break default compat behavior.
- Keep command allowlist/validation central to command-validation helper.
- Keep migration communication aligned with actual runtime behavior.

## Validation plan
- npm run harness:graph -- status
- npm run harness:mcp:impact -- --file scripts/harness/refresh-graph.mjs --depth 2
- grep shell:true across scripts/harness should return no matches.
- npm run harness:docs:check
- get_errors on modified files

## Do NOT
- Do NOT reintroduce shell-based command execution in modified paths.
- Do NOT force enforce mode by default.
- Do NOT leave phase-enforcement instructions disconnected from runtime behavior.

## Assumptions and risks
- [UNVERIFIED] Dist-based backend artifact edits are the operational source in this workspace snapshot.
- [UNVERIFIED] Existing operators will use allowed executable+arg command forms for graphify refresh command.
- Risk: invalid BACKUP_CODE_HASH_PHASE values now downgrade to compat with warning; misconfiguration could silently preserve legacy behavior.

## Inline skeptical pass (architect-challenge fallback)
- Challenge: could parser-based subprocess execution break existing refresh command strings?
  - Resolution: only shell-metacharacter command forms are blocked; standard executable+args remain supported.
- Challenge: does enforce mode create user lockout risk for accounts with legacy hashes?
  - Resolution: yes if enabled prematurely; mitigated by opt-in toggle and compat default.
- Challenge: should enforce mode be implemented in source TS instead of dist JS?
  - Resolution: source service is not present in backend/src in this workspace; dist is the available runtime surface for this pass.

VERDICT: APPROVED