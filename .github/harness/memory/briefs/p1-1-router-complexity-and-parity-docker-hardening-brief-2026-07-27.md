# P1-1 Router Complexity Refactor With Parity Docker Hardening Brief - 2026-07-27
resource: scripts/harness/prompt-router.mjs, scripts/harness/graph-parity-self-test.mjs, scripts/harness/command-validation.mjs, package.json

## Architecture Brief

### Objective
- Complete P1-1 router complexity refactor for next-actions flow by decomposing high-complexity logic into focused helpers while preserving behavior.
- First harden parity Docker executable resolution as a security follow-up by removing PATH-based docker lookup.

### Scope and boundaries
- In scope:
  - next-actions helper decomposition in prompt-router.
  - parity script docker executable resolution hardening.
  - regression checks for parity and router command behavior.
- Out of scope:
  - changing router decisions, stage mapping, or profile semantics.
  - changing graph provider semantics or docker availability policy.
  - broad path-hardening sweep across all router file reads.

### Artifacts to create
- None.

### Artifacts to modify
- scripts/harness/graph-parity-self-test.mjs: resolve docker executable via fixed absolute path list or explicit absolute override.
- scripts/harness/prompt-router.mjs: extract helpers from inferNextActions and remove nested selector ternary complexity.

### Key decisions
- Decision: perform parity hardening before router refactor.
  - Reasoning: addresses the explicit security follow-up ordering requirement.
- Decision: keep router outputs stable and refactor only internal next-actions composition.
  - Reasoning: complexity reduction should be structural, not behavioral.
- Decision: use deterministic helper decomposition in router next-actions path.
  - Reasoning: lowers cognitive complexity and clarifies selector, matching, and fallback responsibilities.

### Constraints
- Preserve CLI contract for route, handoff, and next-actions commands.
- Preserve parity pass/fail semantics when docker is unavailable in non-required mode.
- Do not introduce new dependencies.

### Validation plan
- npm run harness:graph:parity -- --local-only
- HARNESS_DOCKER_EXECUTABLE=relative/docker.exe npm run harness:graph:parity -- --require-docker (must fail with docker-unavailable style diagnostic)
- node scripts/harness/prompt-router.mjs next-actions --task "ship auth audit" --json
- node scripts/harness/prompt-router.mjs route --task "fix auth middleware race" --json
- get_errors on modified files to confirm targeted complexity warning removal.

### Acceptance criteria
- Docker executable override must be absolute-path only; relative override is treated as invalid and ignored.
- In non-required mode, invalid docker override reports docker unavailable context without failing local parity assertions.
- In `--require-docker` mode, invalid docker override must fail non-zero.

### Do NOT
- Do NOT alter stage routing policy outputs.
- Do NOT make docker daemon availability a hard failure unless require-docker flag is used.
- Do NOT expand this pass into full prompt-router path-security hardening.

### Assumptions and risks
- [UNVERIFIED] Assumption: explicit absolute docker path candidates are sufficient for common developer environments.
  - Risk if wrong: users may need HARNESS_DOCKER_EXECUTABLE override for non-standard installs.
- [UNVERIFIED] Assumption: helper decomposition preserves exact next-actions selection behavior.
  - Risk if wrong: prompt-pack selection edge cases could regress and require follow-up regression tests.
