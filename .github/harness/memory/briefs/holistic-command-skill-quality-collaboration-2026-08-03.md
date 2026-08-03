## Architecture Brief
resource: package.json,.github/harness/HARNESS.md,.github/harness/LOOPS.md,.github/harness/WORKFLOW.md,.github/harness/MCP-INTEGRATION.md,.github/harness/registry.json,.github/instructions/02-UNDERSTAND-WORKFLOW.md,.github/instructions/03-ARCHITECT.md,.github/instructions/04-IMPLEMENT.md,.github/instructions/05-REVIEW-BREADTH.md,scripts/harness/harness-mcp-tasks.mjs,.github/harness/loops/feature-cycle.json,.github/harness/loops/review-fix.json

### Objective
- Deliver a holistic collaboration pass across harness commands, skills, loops, and quality measurement surfaces so operator guidance and runtime behavior stay aligned and avoid silent workflow failures.

### Scope and boundaries
- In scope:
  - Fix command-surface drift where workflow docs claim aliases that runtime does not provide.
  - Fix MCP impact command contract drift between documented multi-file usage and implemented single-file behavior.
  - Preserve stage-machine, loop protocol, and model-role routing behavior.
  - Re-validate deterministic quality surfaces (`harness:docs:check`, MCP status/impact smoke paths).
- Out of scope:
  - Rewriting stage contracts or loop semantics.
  - Changing model policy assignments or intent profiles.
  - Broad doc rewrites outside touched command contract surfaces.

### Artifacts to create
- `.github/harness/memory/reviews/architect-challenge-verdict-2026-08-03-holistic-command-skill-quality-collaboration.md` - challenge verdict record before implementation.
- `.github/harness/memory/reviews/implementation-notes-2026-08-03-holistic-command-skill-quality-collaboration.md` - implementation proof + self-review.
- `.github/harness/memory/reviews/review-breadth-2026-08-03-holistic-command-skill-quality-collaboration.md` - breadth findings ledger.
- `.github/harness/memory/reviews/review-depth-2026-08-03-holistic-command-skill-quality-collaboration.md` - depth gate ledger.
- `.github/harness/memory/reviews/feedback-verdict-2026-08-03-holistic-command-skill-quality-collaboration.md` - final adjudication.

### Artifacts to modify
- `package.json` - add missing command aliases documented by workflow playbook.
- `scripts/harness/harness-mcp-tasks.mjs` - support repeated/comma-separated `--file` inputs for `impact` mode, matching documented usage and multi-file review intent.
- `.github/harness/MCP-INTEGRATION.md` - tighten command examples to match supported syntax exactly (single `--file` repeat form for multi-file invocation).
- `.github/harness/registry.json` - normalize the `harness:mcp:impact` command contract text to match implemented CLI behavior.

### Key decisions
- Decision: Use a Producer-Reviewer style stage flow (Architect -> Architect Challenge -> Implement -> Review passes) rather than a direct one-shot doc tweak.
  - Evidence: Stage contract in `.github/harness/registry.json` and `.github/harness/loops/feature-cycle.json` requires full review closure for non-trivial quality/routing changes.
- Decision: Fix runtime to match workflow contracts when drift is small and backwards-compatible.
  - Evidence: `.github/harness/WORKFLOW.md` documents aliases not present in `package.json`; this causes operator confusion and weakens deterministic execution.
- Decision: Keep MCP impact output structure compact and deterministic while adding multi-file support by aggregating per-file sub-results.
  - Evidence: `.github/harness/MCP-INTEGRATION.md` already frames multi-file impact scenarios; script currently only accepts a single `--file`.
- Decision: Define a compatibility envelope for `harness:mcp:impact` so single-file consumers do not break.
  - Evidence: Architect challenge found contract drift across `.github/harness/WORKFLOW.md`, `.github/harness/MCP-INTEGRATION.md`, `.github/harness/registry.json`, and `scripts/harness/harness-mcp-tasks.mjs`.
  - Contract: Accept both `--file a,b` and repeated `--file a --file b`; preserve current top-level fields (`filePath`, `depth`, `dependents`, `neighbors`) for single-file requests; add multi-file-only additive fields (`files`, `results`).

### Constraints
- Preserve existing command names and existing single-file `impact` behavior.
- Do not change stage ordering, role routing, or guardrails.
- Keep edits minimal and ASCII-only.
- Any new command aliases must be non-destructive wrappers around existing scripts.
- Keep `harness:mcp:impact` output backward-compatible for single-file callers.

### Validation plan
- `npm run harness:docs:check`
- `npm run harness:mcp:status`
- `npm run harness:mcp:impact -- --file package.json --depth 1`
- `npm run harness:mcp:impact -- --file package.json,.github/harness/registry.json --depth 1`
- `npm run harness:mcp:impact -- --file package.json --file .github/harness/registry.json --depth 1`
- Validate single-file JSON envelope still exposes `filePath`, `depth`, `dependents`, and `neighbors`.

### Do NOT
- Do NOT weaken any review gate or skip stage artifacts.
- Do NOT introduce destructive command aliases.
- Do NOT change quality metric semantics in `harness:report`, `harness:grade`, or `harness:otel`.

### Assumptions and risks
- `[UNVERIFIED]` Operators rely on the workflow alias lines in `.github/harness/WORKFLOW.md` during real runs.
  - Affects: Priority of alias restoration versus doc-only correction.
  - Risk if wrong: Added aliases provide little practical value, but remain harmless.
- `[UNVERIFIED]` External consumers parse the current single-object JSON from `harness:mcp:impact`.
  - Affects: Whether multi-file output must preserve compatibility envelope.
  - Risk if wrong: If consumers are strict, output-shape changes could break integrations; mitigate with backward-compatible `filePath` + optional `files` list + `results` array.
