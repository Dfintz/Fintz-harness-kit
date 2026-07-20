# Architecture Brief: Command Hardening + MCP Contract Sync + Backup-Code Contract Alignment
resource: scripts/harness/command-validation.mjs, scripts/harness/run-loop.mjs, scripts/harness/run-experiment.mjs, scripts/harness/plan-review.mjs, scripts/harness/council-review.mjs, scripts/harness/eval/run-eval.mjs, .github/harness/registry.json, .github/harness/MCP-INTEGRATION.md, .github/MCP-INTEGRATION.md, .github/harness/HARNESS.md, backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts

Date: 2026-07-20
Status: Architect -> Implement

## Objective
- Close high-risk command execution gaps, synchronize MCP command contracts/docs with actual CLI behavior, and align backup-code phase-enforcement claims with implemented runtime behavior.

## Scope and boundaries
- In scope:
  - Harness command execution paths that currently execute user-configurable command strings through shell mode.
  - MCP contract documentation and machine-readable registry command examples.
  - Backup-code migration contract text and emitted operator logs.
- Out of scope:
  - Major behavior redesign of all harness subprocess calls.
  - Full backend auth refactor beyond contract alignment.

## Artifacts to create
- None required beyond this brief and existing stage artifacts.

## Artifacts to modify
- scripts/harness/command-validation.mjs: add stricter validation + safe parsing helper.
- scripts/harness/run-loop.mjs: execute validated command via executable + argv (no shell).
- scripts/harness/run-experiment.mjs: same hardening; replace shell-built git commit/add with argv-safe calls.
- scripts/harness/plan-review.mjs: reviewer/author command execution via argv-safe calls.
- scripts/harness/council-review.mjs: member execution via argv-safe calls.
- scripts/harness/eval/run-eval.mjs: agent execution via argv-safe calls.
- .github/harness/registry.json: fix mcpTools command examples to --query and --file forms.
- .github/harness/MCP-INTEGRATION.md: fix find/impact invocation and examples.
- .github/MCP-INTEGRATION.md: fix troubleshooting command examples to current CLI.
- .github/harness/HARNESS.md: point MCP integration reference to canonical harness doc.
- backend/src/migrations/20260719000000-MigrateBackupCodesToBcrypt.ts: remove unsupported BACKUP_CODE_HASH_PHASE enforcement claims.

## Key decisions
- Decision: introduce a shared parsed-command helper in command-validation and consume it in runners.
  - Reasoning: preserves allowlist guard while removing shell interpretation risk.
- Decision: synchronize docs/registry to implemented CLI instead of changing CLI compatibility in this pass.
  - Reasoning: least-risk, smallest scope, immediate operator correctness.
- Decision: align backup-code contract text to current runtime behavior rather than add unscoped runtime enforcement changes in dist-only code.
  - Reasoning: source for runtime service is not present in backend/src; contract honesty is required now.

## Constraints
- Keep changes minimal and backwards-compatible for normal command forms.
- Do not weaken existing allowlist restrictions.
- Avoid speculative security claims in docs.

## Validation plan
- npm run harness:docs:check
- npm run harness:mcp:find -- --query "registry.json"
- npm run harness:mcp:impact -- --file scripts/harness/command-validation.mjs --depth 2
- get_errors on modified files

## Do NOT
- Do NOT execute raw command strings with shell:true in the hardened paths.
- Do NOT leave MCP examples that diverge from harness-mcp-tasks.mjs usage.
- Do NOT claim phase enforcement that the runtime does not implement.

## Assumptions and risks
- [UNVERIFIED] Existing command strings used by operators do not rely on shell-only constructs (pipes, redirects, chaining).
- [UNVERIFIED] backend/dist is generated from sources outside current backend/src snapshot.
- Risk if wrong: some operator command patterns may need migration guidance.

## Inline skeptical pass (architect-challenge fallback)
- Challenge: Could this break existing workflows that pass a single string command?
  - Resolution: no for standard executable + args strings; only shell metacharacter usage is blocked by design.
- Challenge: Should we change CLI behavior instead of docs for MCP mismatch?
  - Resolution: docs sync is safer and required immediately; compatibility aliases can be a follow-up.
- Challenge: Is migration text-only alignment sufficient for backup-code issue?
  - Resolution: yes for this task's contract-alignment requirement; runtime phase enforcement can be separately implemented when source ownership is available.

VERDICT: APPROVED