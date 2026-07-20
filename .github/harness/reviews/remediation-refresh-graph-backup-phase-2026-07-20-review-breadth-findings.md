## Review Breadth Findings Ledger

### Coverage note
- Reviewed modified command execution path in refresh-graph and modified runtime backup-code policy behavior in TwoFactorService plus migration contract alignment.

### Missing-context note
- Backend TypeScript source for TwoFactorService is not present under backend/src in this workspace, so runtime policy edits were applied on dist artifacts.

### Blocker
- None.

### Major
1. Artifact: backend/dist/services/authentication/TwoFactorService.js
   Finding: Enforce mode can lock out users with only legacy SHA-256 backup hashes if rollout is not staged.
   Evidence: verifyBackupCode and removeBackupCode now skip legacy branch when BACKUP_CODE_HASH_PHASE=enforce.
   Impact: operational user support risk during phase transition.
   Confidence: HIGH
   Recommended fix: gate enforce rollout with explicit comms and regeneration campaign; monitor failed backup-code verification rates.

### Minor
1. Artifact: scripts/harness/refresh-graph.mjs
   Finding: refresh command parsing is stricter and may reject previously tolerated shell-composed command strings.
   Evidence: parseValidatedCliCommand now validates/blocks shell metacharacter patterns.
   Impact: low migration friction for custom command strings.
   Confidence: MEDIUM
   Recommended fix: document supported command syntax (executable + args only) in operator docs if needed.

### Nit
1. Artifact: backend/dist/services/authentication/TwoFactorService.js
   Finding: phase-mode logging occurs at startup and may add small operational log noise.
   Evidence: getBackupCodeHashPhase logs mode selection/warnings.
   Impact: negligible.
   Confidence: HIGH
   Recommended fix: keep as-is unless log verbosity policy changes.