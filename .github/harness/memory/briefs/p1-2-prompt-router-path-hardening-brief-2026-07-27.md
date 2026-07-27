# P1-2 Prompt-Router Path Hardening Brief - 2026-07-27
resource: scripts/harness/prompt-router.mjs, scripts/harness/mcp-tools.mjs, .github/instructions/02-UNDERSTAND-WORKFLOW.md, .github/instructions/03-ARCHITECT.md, .github/instructions/04-IMPLEMENT.md

## Architecture Brief

### Objective
- Resolve remaining file-inclusion warnings in prompt-router next-actions path by introducing safe-root path wrappers and canonicalization checks.
- Preserve existing route, handoff, prompt-pack, and next-actions behavior while hardening filesystem boundary handling.

### Scope and boundaries
- In scope:
  - Harden filesystem path construction and read/list checks used by next-actions prompt-pack discovery and fallback selection.
  - Add canonicalization-boundary checks to reject root escapes (including symlink escape scenarios for existing paths).
  - Re-run prompt-router behavior smoke tests and diagnostics.
- Out of scope:
  - Any change to router stage selection, model assignment, or handoff content.
  - Any functional redesign of prompt-pack manifest schema.
  - Broad filesystem hardening outside prompt-router next-actions path.

### Artifacts to create
- .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-implementation-2026-07-27.md - implementation proof and self-review record.
- .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-review-breadth-2026-07-27.md - breadth findings ledger.
- .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-review-depth-2026-07-27.md - gate ledger and structural findings.
- .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-feedback-2026-07-27.md - verdict record.

### Artifacts to modify
- scripts/harness/prompt-router.mjs - replace unconstrained join/read/list file operations in next-actions support paths with validated safe-root wrappers and canonicalization checks.

### Key decisions
- Decision: enforce safe-root resolution for prompt pack and brief traversal helpers.
  - Evidence: static analysis flags identify file inclusion risk where untrusted or derived segments are joined then read.
- Decision: require segment validation plus root containment checks for resolved paths.
  - Reasoning: segment validation alone prevents obvious traversal strings, but canonical root checks address symlink and path-normalization escape cases.
- Decision: keep hardening localized to next-actions file IO helpers.
  - Reasoning: fulfills dedicated backlog item with minimal behavioral blast radius.

### Constraints
- No new dependencies.
- Maintain existing CLI contracts and JSON output shapes.
- Preserve deterministic failure behavior using existing fail() conventions.
- Keep code style and module patterns consistent with nearby prompt-router helpers.

### Validation plan
- npm run harness:graph -- status
- node scripts/harness/prompt-router.mjs next-actions --task "ship auth audit" --json
- node scripts/harness/prompt-router.mjs route --task "fix auth middleware race" --json
- node scripts/harness/prompt-router.mjs next-actions --pack ".." (must fail non-zero)
- node scripts/harness/prompt-router.mjs next-actions --pack "../../escape" (must fail non-zero)
- tampered-manifest containment test: reject non-contained files.nextSteps, files.stagePrompts[*].outputFile, and files.stagePrompts[*].promptFile values with deterministic fail
- npm run harness:docs:check
- get_errors on scripts/harness/prompt-router.mjs
- explicit post-patch re-check that prior file-inclusion warnings in prompt-router are cleared or residuals are documented

### Do NOT
- Do NOT change non-filesystem routing logic or stage computation.
- Do NOT expand this pass into unrelated refactors.
- Do NOT relax validation failures into silent fallbacks.
- Do NOT allow manifest path fields that are not safe segments or that fail root-containment checks.

### Assumptions and risks
- Enforced contract: stage output and manifest filenames must be safe segments and root-contained; non-conforming values are rejected via fail.
- [UNVERIFIED] Assumption: canonicalization checks will satisfy static analysis warnings for all flagged lines.
  - Risk if wrong: additional wrapper tightening or callsite reshaping may be needed.
