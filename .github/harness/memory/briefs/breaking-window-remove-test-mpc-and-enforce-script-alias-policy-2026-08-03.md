## Architecture Brief
resource: package.json,scripts/harness/validate-doc-contracts.mjs,.github/workflows/harness-optional-security-gates.example.yml,RELEASE_NOTES_v2.5.0.md,README.md

### Objective
- Execute the second staged pass for command-surface cleanup by removing deprecated `test:mpc:*` aliases and introducing a deterministic policy check that fails CI when exact duplicate script bodies are introduced without alias chaining.

### Scope and boundaries
- In scope:
  - Remove all `test:mpc:*` compatibility aliases from `package.json`.
  - Add a script-level policy checker for duplicate script bodies.
  - Wire the policy checker into existing harness validation command path and CI example workflow.
  - Add release-note updates documenting the breaking-window removal and migration.
- Out of scope:
  - Renaming canonical `test:mcp:*` commands.
  - Changing behavior of MCP test implementations.
  - Changing harness stage routing, models, or loop semantics.

### Artifacts to create
- `scripts/harness/check-script-alias-policy.mjs` - deterministic policy check for exact duplicate script values.
- `RELEASE_NOTES_v3.1.1.md` - breaking-window release notes and migration guidance.
- `.github/harness/memory/reviews/architect-challenge-verdict-2026-08-03-breaking-window-remove-test-mpc-and-enforce-script-alias-policy.md`
- `.github/harness/memory/reviews/implementation-notes-2026-08-03-breaking-window-remove-test-mpc-and-enforce-script-alias-policy.md`
- `.github/harness/memory/reviews/review-breadth-2026-08-03-breaking-window-remove-test-mpc-and-enforce-script-alias-policy.md`
- `.github/harness/memory/reviews/review-depth-2026-08-03-breaking-window-remove-test-mpc-and-enforce-script-alias-policy.md`
- `.github/harness/memory/reviews/feedback-verdict-2026-08-03-breaking-window-remove-test-mpc-and-enforce-script-alias-policy.md`

### Artifacts to modify
- `package.json`
  - Remove:
    - `test:mpc:dispatch`
    - `test:mpc:dispatch:command`
    - `test:mpc:dispatch:rate-limit`
    - `test:mpc:dispatch:auth`
    - `test:mpc:dispatch:template`
    - `test:mpc:dispatch:integration`
  - Add `harness:commands:check` script.
  - Update `harness:docs:check` to include command-surface policy check.
- `scripts/harness/validate-doc-contracts.mjs`
  - Invoke script-alias policy checker directly from validator-owned path so direct validator invocation cannot bypass policy.
- `.github/workflows/harness-optional-security-gates.example.yml`
  - Add command-surface policy step so CI examples explicitly enforce the check.

### Key decisions
- Decision: Treat this pass as the explicit breaking-window cutover, removing deprecated typo aliases in full.
  - Evidence: Prior pass retained these aliases only as temporary shims.
- Decision: Enforce duplicate-body policy through a deterministic script check and integrate into shared validation path.
  - Evidence: Exact duplicate script values were previously present and required manual cleanup.
- Decision: Keep policy scope narrow (exact duplicates only) to avoid false positives and preserve command flexibility.
- Decision: Deletion of `test:mpc:*` aliases is gated by explicit break approval recorded in this run artifacts.
  - Approval role: repository maintainer.
  - Approval artifact: `.github/harness/memory/reviews/feedback-verdict-2026-08-03-breaking-window-remove-test-mpc-and-enforce-script-alias-policy.md` with accepted breaking-change row.
  - Go/no-go: do not merge alias deletion unless feedback verdict marks breaking-window removal as approved.

### Constraints
- Keep canonical `test:mcp:*` commands unchanged.
- Keep policy check deterministic and fast.
- Avoid changes to script behavior other than alias removal.
- Maintain a rollback path: if downstream breakage is reported after merge, reintroduce temporary shim aliases in one hotfix commit.

### Validation plan
- `npm run harness:commands:check`
- `npm run harness:docs:check`
- `npm run test:mcp:dispatch:command`
- `npm run test:mcp:dispatch:rate-limit`
- `npm run test:mcp:dispatch:auth`
- `npm run test:mcp:dispatch:template`
- `npm run test:mcp:dispatch:integration`
- `npm run test:mcp:dispatch`
- `npm run test:mpc:dispatch` should fail (expected) after removal
- `node scripts/harness/validate-doc-contracts.mjs` (direct invocation must enforce policy)

### Do NOT
- Do NOT remove any `test:mcp:*` canonical command.
- Do NOT broaden policy to semantic-equivalence checks; enforce exact-body duplicates only.
- Do NOT modify MCP test implementation files in this pass.
- Do NOT merge without explicit breaking-window approval recorded in feedback artifact.

### Assumptions and risks
- `[UNVERIFIED]` External automation has had prior notice and can migrate from `test:mpc:*` to `test:mcp:*`.
  - Affects: Potential breakage for downstream consumers.
  - Risk if wrong: External pipelines fail until migrated; mitigate with explicit release-note migration matrix and rollback trigger.
- `[UNVERIFIED]` CI users will adopt the updated validation command path or workflow example.
  - Affects: Enforcement coverage.
  - Risk if wrong: Policy may not run in all environments; mitigate by enforcing it in validator-owned path and packaging it in the mandatory `harness:docs:check` command.

### Breaking-window release-note requirements
- Include a complete migration matrix for removed aliases:
  - `test:mpc:dispatch` -> `test:mcp:dispatch`
  - `test:mpc:dispatch:command` -> `test:mcp:dispatch:command`
  - `test:mpc:dispatch:rate-limit` -> `test:mcp:dispatch:rate-limit`
  - `test:mpc:dispatch:auth` -> `test:mcp:dispatch:auth`
  - `test:mpc:dispatch:template` -> `test:mcp:dispatch:template`
  - `test:mpc:dispatch:integration` -> `test:mcp:dispatch:integration`
- State explicitly that `test:mpc:*` now fails by design.
- Add discoverability linkage from README release-notes section to the new release-note file.
