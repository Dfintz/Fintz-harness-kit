---
summary: "Architecture Brief - Prompt Router Run-Bundle Root Determinism"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [prompt-router, tests, feature-runs, determinism]
---
## Architecture Brief
resource: scripts/harness/prompt-router.mjs, scripts/harness/test/prompt-router-run-bundle-test.mjs, .github/harness/runs/feature-runs/index.json, harness.config.json

### Objective
- Make the prompt-router feature-run bundle regression deterministic when the host environment sets `HARNESS_PROJECT_ROOT` to another repository.

### Scope and boundaries
- In scope:
  - Pin the regression test subprocess environment to the repository under test.
  - Preserve the test's explicit alternate `--repo-root` project coverage.
- Out of scope:
  - Changing prompt-router root-precedence behavior.
  - Changing feature-run index key normalization or persistence logic.
  - Modifying existing run artifacts or unrelated workspace changes.

### Artifacts to create
- `.github/harness/memory/briefs/prompt-router-run-bundle-root-determinism-2026-09-18.md` - Architecture Brief and stage record.

### Artifacts to modify
- `scripts/harness/test/prompt-router-run-bundle-test.mjs` - set `HARNESS_PROJECT_ROOT` to the test repository for default-root subprocesses.

### Key decisions
- Decision: Fix the test environment rather than product root resolution because `HARNESS_PROJECT_ROOT` is documented operator configuration and explicit project-root routing is already tested separately.
- Decision: Keep the alternate project-root test path unchanged so it continues to verify `--repo-root` precedence.

### Constraints
- Do not mutate the caller's environment.
- Do not change feature-run index persistence or route semantics.
- Keep cleanup and artifact restoration behavior unchanged.

### Validation plan
- `npm run test:harness:prompt-router:run-bundle`
- `npm run harness:docs:check`
- `npm run harness:route -- --task "..."` with the external root override still present.

### Do NOT
- Do not unset or overwrite `HARNESS_PROJECT_ROOT` globally.
- Do not hardcode a second repository path.
- Do not weaken the explicit alternate project-root assertions.

### Assumptions and risks
- `[UNVERIFIED]` The test runner should treat the repository containing the test as the default project root when no explicit `--repo-root` is supplied.
- Risk: Other tests may rely on inherited project-root overrides; this change is scoped only to the prompt-router run-bundle subprocess helper.

### Architectural gates
- Gate 1 domain alignment: PASS. The change belongs in the test harness setup for feature-run persistence.
- Gate 2 generality: PASS. It makes subprocess tests independent of ambient project-root state.
- Gate 3 ownership: PASS. Product configuration remains owned by prompt-router; test isolation remains owned by the test helper.
- Gate 4 boundary integrity: PASS. No runtime routing or artifact schema changes.
- Gate 4b isolation/safety: PASS. The test cannot write feature artifacts into an unrelated repository.
- Gate 5 reuse: PASS. Existing `repoRoot` fixture is reused rather than adding a new path constant.
