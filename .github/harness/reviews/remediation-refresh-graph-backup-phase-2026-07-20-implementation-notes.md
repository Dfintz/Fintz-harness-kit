## Implementation Summary

### Delivered
- Hardened the final shell-based subprocess invocation in scripts/harness by moving refresh-graph graphify refreshCommand execution to parsed executable+args invocation.
- Added runtime backup-code hash phase policy in TwoFactorService:
  - compat mode (default): accepts bcrypt + legacy SHA-256.
  - enforce mode: accepts bcrypt only.
- Synchronized migration source and compiled log messaging to reflect runtime enforce toggle availability.
- Updated type declarations for TwoFactorService private phase policy members.

### Contract adherence
- Followed requested scope precisely:
  1. final shell-based subprocess path hardened
  2. deferred runtime backup-code enforcement policy implemented
- Preserved backward compatibility via compat default.

### Proof summary
- npm run harness:graph -- status -> graph fresh.
- npm run harness:mcp:impact -- --file scripts/harness/refresh-graph.mjs --depth 2 -> OK.
- grep shell:true in scripts/harness/** -> no matches.
- npm run harness:docs:check -> OK.
- get_errors on modified files -> no new errors in changed backend or docs targets.

### Change summary
CHANGES MADE:
- scripts/harness/refresh-graph.mjs: import parseValidatedCliCommand; spawn validated executable+args, no shell parsing.
- backend/dist/services/authentication/TwoFactorService.js: add backupCodeHashPhase property + getBackupCodeHashPhase helper; enforce-mode gating in verifyBackupCode/removeBackupCode.
- backend/dist/services/authentication/TwoFactorService.d.ts: declaration updates for new private members.
- backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts: contract text and runtime guidance logs updated for enforce-mode support.
- backend/dist/migrations/20260719000000-MigrateBackupCodesToBcrypt.js: runtime guidance log updated to match source contract.

THINGS I DIDN'T TOUCH (intentionally):
- backup code entropy/length generation behavior.
- non-related backend auth controllers and routes.

POTENTIAL CONCERNS:
- Enforce mode can reject valid legacy SHA-256 backup codes if enabled before user regeneration strategy is complete.

### Assumptions or deviations
- [UNVERIFIED] Dist artifacts are currently used operationally in this repository snapshot.
- [UNVERIFIED] No external scripts rely on shell-only graphify refresh command syntax.