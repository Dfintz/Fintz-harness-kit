## Architecture Brief
resource: scripts/harness/prompt-router.mjs,scripts/harness/plan-review.mjs,scripts/harness/graph-provider.mjs,.github/instructions/02-UNDERSTAND-WORKFLOW.md,.github/instructions/03-ARCHITECT.md

### Objective
- Enforce fail-fast safety for non-trivial routing when graph refresh readiness is degraded.
- Add explicit reviewer command preflight in plan-review so architect-challenge failures are actionable before main review execution.

### Scope and boundaries
- In scope:
  - `scripts/harness/prompt-router.mjs` route/handoff/prompt-pack/pick-profile preflight guard.
  - `scripts/harness/plan-review.mjs` reviewer command preflight execution and diagnostics.
- Out of scope:
  - Changing graph provider readiness semantics.
  - Relaxing non-trivial graph preconditions.
  - Modifying stage contracts outside these two scripts.

### Artifacts to create
- `.github/harness/memory/briefs/route-and-reviewer-preflight-hard-fail-brief-2026-07-27.md` - architecture decision record.
- `.github/harness/memory/briefs/route-and-reviewer-preflight-implementation-2026-07-27.md` - implement stage artifact.
- `.github/harness/memory/briefs/route-and-reviewer-preflight-review-breadth-2026-07-27.md` - breadth findings artifact.
- `.github/harness/memory/briefs/route-and-reviewer-preflight-review-depth-2026-07-27.md` - depth artifact.
- `.github/harness/memory/briefs/route-and-reviewer-preflight-feedback-2026-07-27.md` - feedback verdict record.

### Artifacts to modify
- `scripts/harness/prompt-router.mjs` - add non-trivial graph preflight hard-fail before output/telemetry.
- `scripts/harness/plan-review.mjs` - add reviewer smoke preflight and actionable failures.

### Key decisions
- Gate 1 Domain alignment: route-policy and review-loop preflights belong in prompt-router and plan-review owners respectively.
- Gate 2 Generality: preflight helpers are local reusable utilities within each script and do not justify a shared module yet.
- Gate 3 Ownership: graph readiness enforcement is owned by routing orchestration, not by downstream stages.
- Gate 4 Boundary integrity: route guard executes after route planning but before output and telemetry so blocked plans do not appear as actionable handoffs.
- Gate 4b Isolation/safety: degraded graph readiness blocks non-trivial routes to prevent low-confidence architecture drift.
- Gate 5 Reuse: plan-review preflight reuses existing command allowlist guard (`assertSafeCliCommand`) and existing verdict parser (`parseVerdict`).

### Constraints
- Keep CLI compatibility for existing command forms.
- Preserve existing help, self-test, and journal behavior.
- Do not weaken current guardrails around reviewer read-only behavior.

### Validation plan
- `npm run harness:plan-review:self-test`
- `npm run harness:command-validation:self-test`
- `node scripts/harness/prompt-router.mjs route --task "fix typo" --json` (trivial pass)
- `node scripts/harness/prompt-router.mjs route --task "add multi file route guard" --json` (non-trivial expected hard-fail in current degraded environment)
- `node scripts/harness/plan-review.mjs --lens plan --plan .github/harness/memory/briefs/route-and-reviewer-preflight-hard-fail-brief-2026-07-27.md --reviewer "node -e \"process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('ok\\nVERDICT: APPROVED\\n'));\"" --max-rounds 1`

### Do NOT
- Do NOT silently downgrade non-trivial routes to trivial to bypass graph preflight.
- Do NOT allow reviewer preflight failures to proceed into the main review loop.
- Do NOT add broad config migrations in this change.

### Assumptions and risks
- `[UNVERIFIED]` Some operator environments may intentionally run with degraded graph readiness; this change now blocks those non-trivial route commands until prerequisites are fixed.
- Risk: stricter routing gate may interrupt existing CI/workflows until pluginRoot or alternative refresh prerequisites are set.
- Risk: reviewer smoke preflight adds one extra reviewer process invocation per run.