## Implement Summary

### Delivered
- Refactored `scripts/harness/plan-review.mjs` to split self-test and CLI setup orchestration into focused helpers while preserving behavior:
  - self-test decomposition: collector, parser checks, loop-behavior checks, security/lens checks, result emitter
  - main-path decomposition: meta-flag handling, lens resolution, subject resolution, reviewer/round validation, context loading, log path resolution
- Added operator documentation note in `.github/harness/HARNESS.md` describing degraded preflight bypass usage and audit review of `.github/harness/runs/preflight-overrides.jsonl`.

### Behavioral intent
- No change to verdict parsing tokens, run loop terminal states, or CLI exit semantics.
- No change to reviewer preflight requirements or untrusted-data protections.
- No change to default degraded non-trivial hard-fail policy; doc note only clarifies emergency override operation.

### Proof
- `npm run harness:plan-review:self-test` => PASS (31 checks)
- `npm run harness:docs:check` => OK
- Diagnostics no longer report cognitive-complexity warnings on `runSelfTest` or `main` in `scripts/harness/plan-review.mjs`.
