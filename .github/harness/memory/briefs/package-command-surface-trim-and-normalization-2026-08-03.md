## Architecture Brief
resource: package.json,.github/harness/HARNESS.md,.github/harness/WORKFLOW.md,.github/harness/registry.json,README.md,AGENTS.md,scripts/harness/harness-help.mjs

### Objective
- Perform a deep, safety-first review of `package.json` scripts and reduce avoidable command-surface noise while preserving documented and high-traffic command contracts.

### Scope and boundaries
- In scope:
  - Normalize duplicate script implementations into alias-to-canonical forms.
  - Trim typo-only MCP test aliases that have no in-repo usage.
  - Preserve existing documented user-facing command behavior.
- Out of scope:
  - Renaming core workflow commands used in docs and stage contracts (`harness:feature`, `harness:review`, `harness:dashboard`, `harness:mcp:*`).
  - Changing script runtime semantics or stage-machine behavior.

### Artifacts to create
- `.github/harness/memory/reviews/architect-challenge-verdict-2026-08-03-package-command-surface-trim-and-normalization.md`
- `.github/harness/memory/reviews/implementation-notes-2026-08-03-package-command-surface-trim-and-normalization.md`
- `.github/harness/memory/reviews/review-breadth-2026-08-03-package-command-surface-trim-and-normalization.md`
- `.github/harness/memory/reviews/review-depth-2026-08-03-package-command-surface-trim-and-normalization.md`
- `.github/harness/memory/reviews/feedback-verdict-2026-08-03-package-command-surface-trim-and-normalization.md`

### Artifacts to modify
- `package.json`:
  - Convert exact-duplicate command bodies to alias chains that reference canonical command names.
  - Keep typo-only aliases for this release window as compatibility shims; do not remove in this slice.
  - Keep compatibility alias family `test:mpc:*` and schedule removal only after explicit break approval.

### Key decisions
- Decision: Keep high-usage documented aliases intact and only trim typo-specific low-signal aliases.
  - Evidence: `harness:feature`, `harness:review`, `harness:dashboard` are referenced across HARNESS/WORKFLOW/README/AGENTS.
- Decision: Normalize duplicate values through aliasing to improve maintainability without behavioral change.
  - Evidence: Exact duplicate command values exist for feature handoff, review, dashboard/control, memory link build, and llm/ollama agent commands.
- Decision: Prefer non-breaking canonicalization over command deletion when docs already expose both names.
- Decision: Treat typo-alias removal as a breaking command-surface change that requires explicit human approval and release-note communication.
  - Evidence: Architect challenge flagged unknown external automation risk for `test:mpc:*` subcommands.

### Constraints
- Preserve user-visible behavior for all documented commands.
- Do not alter stage order, model routing, or workflow logic.
- Keep changes scoped to `package.json` plus stage artifacts.

### Validation plan
- `npm run harness:docs:check`
- `npm run harness:feature -- --task "smoke"` (handoff command still resolves)
- `npm run harness:review -- --help` (review alias still resolves)
- `npm run harness:control -- --help` (dashboard/control alias still resolves)
- `npm run harness:llm:agent -- --help` (llm/ollama alias still resolves)
- `npm run test:mpc:dispatch` (retained compatibility alias still resolves)
- `npm run test:mpc:dispatch:command` (deprecated shim remains executable in this release)

### Do NOT
- Do NOT remove or rename core commands that are part of published stage instructions.
- Do NOT change script targets to different runtime files.
- Do NOT introduce breaking changes in documented workflows.
- Do NOT delete `test:mpc:*` sub-aliases without explicit approval in a dedicated breaking-change pass.

### Assumptions and risks
- `[UNVERIFIED]` External users are not relying on typo sub-aliases under `test:mpc:dispatch:*`.
  - Affects: Whether future removal of those aliases causes ecosystem breakage.
  - Risk if wrong: External automation may fail; mitigation is a staged deprecation window plus explicit approval before removal.
- `[UNVERIFIED]` Chaining aliases via `npm run` does not change behavior for wrappers in constrained environments.
  - Affects: Alias normalization safety.
  - Risk if wrong: Edge-shell behavior drift; mitigated by smoke commands after change.
