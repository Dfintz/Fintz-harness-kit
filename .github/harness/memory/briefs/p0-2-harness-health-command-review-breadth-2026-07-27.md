# Review Breadth Findings - P0-2 Harness Health Command - 2026-07-27
resource: .github/harness/memory/briefs/p0-2-harness-health-command-implementation-2026-07-27.md, scripts/harness/health.mjs, package.json, SETUP.md

## Findings ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact: `scripts/harness/health.mjs`
- Finding: JSON output includes complete subprocess stdout/stderr payloads for each check.
- Evidence: `checks[].stdout` and `checks[].stderr` are emitted verbatim in `--json` mode.
- Impact: CI logs may become noisy when upstream checks print large diagnostics.
- Confidence: HIGH
- Recommended fix: add optional `--compact` mode in a follow-up pass that strips or truncates payloads while keeping summary fields.

### Nit
- Artifact: `SETUP.md`
- Finding: health examples are additive but there is no short explanation of expected warning-only graph behavior.
- Evidence: new health command examples are listed without warning-semantics note near them.
- Impact: operators might interpret warning output as failure.
- Confidence: MEDIUM
- Recommended fix: add one sentence near examples: "default health may PASS with graph warnings."

### FYI
- Artifact: `scripts/harness/health.mjs`
- Finding: cross-platform process invocation needed explicit npm_execpath handling.
- Evidence: initial run yielded empty-output failures until runner switched to node + npm_execpath.
- Impact: portability is now improved; this is a resolved implementation note.
- Confidence: HIGH
- Recommended fix: none for this pass.

## Coverage note
- Covered: command behavior, exit semantics, JSON contract, npm wiring, setup discoverability.
- Not covered: long-output performance in very large CI logs.

## Missing-context note
- Graph provider remains stale/degraded in this environment, so warning classification was validated against current output shape only.
