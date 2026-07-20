# Review Breadth Findings Ledger

## Coverage note

- Reviewed harness runtime scripts, harness docs/contracts/skills, backend backup-code migration/runtime behavior, and workspace-visible frontend/mobile structure.
- Did not execute production services; this is static+contract review with command/tool evidence.

## Missing-context note

- .understand-anything/knowledge-graph.json was missing, so graph-based topology confidence is reduced.
- frontend/ and apps/mobile contained only node_modules/ and .turbo/ artifacts; no first-party source files were available.

## Blocker

1. Artifact: scripts/harness/command-validation.mjs, scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs
   Finding: Agent command validation can be bypassed while shell execution remains enabled.
   Evidence: command-validation blocks ;, pipes, &&, subshell/redirection, but not single & or CR/LF; runners execute full agentCmd with shell:true.
   Impact: command injection risk in harness loop runners.
   Confidence: HIGH
   Recommended fix: reject single & and newline chars; move to argv-based execution (shell:false) where possible.

## Major

1. Artifact: backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts
   Finding: Migration file is informational/no-op but documents active migration behavior and phase enforcement.
   Evidence: up/down only log messages; queryRunner unused.
   Impact: security/operations expectation mismatch and deferred hardening ambiguity.
   Confidence: HIGH
   Recommended fix: align docstrings with actual behavior or implement real enforcement flow in runtime controls.

2. Artifact: backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts, backend/dist/services/authentication/TwoFactorService.js
   Finding: BACKUP_CODE_HASH_PHASE enforcement is documented but not implemented in runtime verification path.
   Evidence: migration logs mention BACKUP_CODE_HASH_PHASE=enforce; runtime verifier still accepts SHA-256 fallback path and does not read phase env.
   Impact: intended security rollout gate is ineffective.
   Confidence: HIGH
   Recommended fix: wire explicit phase gate in verifyBackupCode or remove unsupported claim and define alternative deprecation path.

3. Artifact: backend/dist/services/authentication/TwoFactorService.js
   Finding: Backup codes use 32-bit entropy (randomBytes(4)).
   Evidence: code generation is 8 hex chars.
   Impact: weaker offline resilience, especially for legacy fast-hashed records.
   Confidence: HIGH
   Recommended fix: increase code entropy/length (for example 64+ bits) while preserving UX constraints.

4. Artifact: scripts/harness/run-experiment.mjs
   Finding: commitTargets builds shell git commands from interpolated strings.
   Evidence: git add/commit are shell command strings with embedded filenames/message.
   Impact: injection/robustness risk under crafted inputs; avoidable unsafe pattern.
   Confidence: HIGH
   Recommended fix: use execFileSync argv arrays and avoid --no-verify unless explicitly required.

5. Artifact: .github/harness/registry.json, .github/harness/MCP-INTEGRATION.md, scripts/harness/harness-mcp-tasks.mjs
   Finding: Published MCP command contracts do not match actual CLI requirements.
   Evidence: docs/registry show positional find and --files impact; implementation requires --query and single --file.
   Impact: operators and agents receive non-working commands.
   Confidence: HIGH
   Recommended fix: align registry/docs with actual args or add backward-compatible alias parsing.

6. Artifact: .github/skills/setup-harness-bootstrap/SKILL.md, package.json
   Finding: Skill references non-existent npm script harness:skills:validate.
   Evidence: package.json contains harness:docs:check but not harness:skills:validate.
   Impact: deterministic validation step in skill fails for operators.
   Confidence: HIGH
   Recommended fix: replace with existing script or add alias script in package.json.

## Minor

1. Artifact: .github/harness/HARNESS.md, .github/MCP-INTEGRATION.md, .github/harness/MCP-INTEGRATION.md
   Finding: dual MCP integration docs and split references create canonical-source ambiguity.
   Evidence: HARNESS links parent MCP doc while stage instructions often use harness MCP doc.
   Impact: drift risk and inconsistent operator guidance.
   Confidence: HIGH
   Recommended fix: choose one canonical MCP integration doc and repoint all references.

2. Artifact: frontend/, apps/mobile/
   Finding: no first-party source files present for review.
   Evidence: only node_modules/ and .turbo/ present.
   Impact: cannot assess app correctness/security for these domains in this workspace.
   Confidence: HIGH
   Recommended fix: restore tracked source or remove stale directories from this repository context.

## Nit

1. Artifact: backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts
   Finding: queryRunner parameter is unused.
   Evidence: no read/write operations in up/down.
   Impact: style/clarity debt.
   Confidence: HIGH
   Recommended fix: remove parameter or suppress intentionally with concise rationale if interface conformance is required.
