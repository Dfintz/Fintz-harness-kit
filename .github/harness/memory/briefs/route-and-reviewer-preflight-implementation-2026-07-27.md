## Implementation Summary
resource: scripts/harness/prompt-router.mjs,scripts/harness/plan-review.mjs,.github/harness/memory/briefs/route-and-reviewer-preflight-hard-fail-brief-2026-07-27.md

### Delivered
- Added non-trivial route preflight hard-fail in `prompt-router`: route-family commands now stop when graph refresh readiness is degraded.
- Added reviewer command smoke preflight in `plan-review`: command is validated and executed before review rounds, with actionable errors when it cannot produce a verdict non-interactively.

### Contract adherence
- Changes follow the Architecture Brief ownership boundaries.
- No stage-contract changes were introduced outside routing and architect-challenge execution surfaces.

### Proof summary
- `npm run harness:plan-review:self-test` -> PASS
- `npm run harness:command-validation:self-test` -> PASS
- `node scripts/harness/prompt-router.mjs route --task "fix typo in readme" --json` -> PASS (trivial route unaffected)
- `node scripts/harness/prompt-router.mjs route --task "add multi-file route hardening and review gates" --json` -> FAIL as expected with explicit preflight block message
- `node scripts/harness/plan-review.mjs --lens plan --plan ... --reviewer "claude -p" --max-rounds 1` -> FAIL as expected at preflight with actionable output preview
- `npm run harness:docs:check` -> PASS
- `npm run harness:health` -> PASS with expected graph-status WARN

### Change summary
CHANGES MADE:
- `scripts/harness/prompt-router.mjs`: imported graph core status builder, added `enforceNonTrivialGraphPreflight`, and invoked it after route planning.
- `scripts/harness/plan-review.mjs`: added reviewer preflight execution (`runReviewerPreflight`) with command safety check, smoke prompt invocation, verdict requirement, and diagnostic preview.
- `.github/harness/memory/briefs/route-and-reviewer-preflight-hard-fail-brief-2026-07-27.md`: architecture contract for this task.

THINGS I DIDN'T TOUCH (intentionally):
- `scripts/harness/graph-provider.mjs`: refresh readiness semantics already correct; this task enforces usage, not semantics.
- Existing broader static-analysis debt in `plan-review.mjs` unrelated to this feature scope.

POTENTIAL CONCERNS:
- Non-trivial prompt-router route commands will now block in environments that have not configured graph refresh prerequisites.

### Assumptions or deviations
- `[UNVERIFIED]` Some automation surfaces may depend on non-trivial route output while running degraded graph environments; they must now satisfy readiness or use trivial/profile-appropriate flows.