## Architecture Brief
resource: scripts/harness/prompt-router.mjs,scripts/harness/plan-review.mjs,scripts/harness/graph-provider.mjs,scripts/harness/command-validation.mjs,.github/instructions/02-UNDERSTAND-WORKFLOW.md,.github/instructions/03-ARCHITECT.md

### Objective
- Add an explicit emergency/operator bypass flag for degraded graph-readiness preflight in prompt-router with structured audit logging.
- Refactor and harden plan-review to reduce static-analysis findings while preserving behavior and output contracts.

### Scope and boundaries
- In scope:
  - `scripts/harness/prompt-router.mjs` argument parsing, non-trivial preflight override, and override audit logging.
  - `scripts/harness/plan-review.mjs` targeted security/maintainability refactors that do not change review-loop behavior.
- Out of scope:
  - Changing graph-provider readiness semantics.
  - Altering plan-review loop verdict semantics or stage meanings.
  - Repository-wide lint cleanup outside touched surfaces.

### Artifacts to create
- `.github/harness/memory/briefs/preflight-bypass-and-plan-review-hardening-brief-2026-07-27.md` - architecture contract.
- `.github/harness/memory/briefs/preflight-bypass-and-plan-review-hardening-implementation-2026-07-27.md` - implement artifact.
- `.github/harness/memory/briefs/preflight-bypass-and-plan-review-hardening-review-breadth-2026-07-27.md` - breadth findings.
- `.github/harness/memory/briefs/preflight-bypass-and-plan-review-hardening-review-depth-2026-07-27.md` - depth findings.
- `.github/harness/memory/briefs/preflight-bypass-and-plan-review-hardening-feedback-2026-07-27.md` - feedback verdict record.

### Artifacts to modify
- `scripts/harness/prompt-router.mjs`:
  - add dedicated bypass flag parsing (`--allow-degraded-preflight`),
  - allow non-trivial routing preflight bypass only when flag is present,
  - emit explicit warning and append structured audit JSONL record for each bypass.
- `scripts/harness/plan-review.mjs`:
  - simplify verdict parsing,
  - replace risky shell-command spawning style with safer command execution abstraction,
  - reduce low-value complexity findings and targeted style/code-smell findings without behavior changes.

### Key decisions
- Gate 1 Domain alignment: bypass and audit belong in prompt-router (policy orchestration owner).
- Gate 2 Generality: command-execution hardening stays local to plan-review; no shared module extraction in this pass.
- Gate 3 Ownership: preflight override logging should live with routing telemetry surfaces under `.github/harness/runs/`.
- Gate 4 Boundary integrity: bypass requires explicit operator intent flag per invocation; no implicit env-only override in this pass.
- Gate 4b Isolation/safety: every bypass use must be auditable and visible in stderr warning and run log.
- Gate 5 Reuse: plan-review keeps existing command-validation policy (`assertSafeCliCommand`) and review contracts while improving implementation hygiene.

### Constraints
- Preserve existing command UX unless invoking the new bypass flag.
- Maintain route output and handoff output schema stability.
- Keep plan-review self-tests passing and behaviorally equivalent for approved/revise outcomes.

### Validation plan
- `npm run harness:plan-review:self-test`
- `npm run harness:command-validation:self-test`
- `node scripts/harness/prompt-router.mjs route --task "fix typo in readme" --json` (trivial unaffected)
- `node scripts/harness/prompt-router.mjs route --task "multi-file review hardening" --json` (non-trivial hard-fail)
- `node scripts/harness/prompt-router.mjs route --task "multi-file review hardening" --allow-degraded-preflight --json` (non-trivial bypass allowed + audit log)
- `node scripts/harness/plan-review.mjs --lens plan --plan .github/harness/memory/briefs/preflight-bypass-and-plan-review-hardening-brief-2026-07-27.md --reviewer "node .github/harness/runs/tmp-reviewer.mjs" --max-rounds 1`
- `npm run harness:docs:check`

### Do NOT
- Do NOT silently bypass degraded preflight without explicit flag.
- Do NOT remove hard-fail as default for non-trivial routes.
- Do NOT change plan-review terminal-state semantics.

### Assumptions and risks
- `[UNVERIFIED]` Operators understand emergency bypass is exceptional and should be followed by graph readiness remediation.
- Risk: adding bypass may be overused; mitigated by explicit audit log entries and visible warnings.
- Risk: plan-review command execution refactor could regress niche command formatting; mitigated by self-tests and reviewer smoke test.