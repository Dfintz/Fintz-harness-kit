---
summary: "Architecture Brief - Skill Routing and Eval Coverage Validation"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [skill-routing, eval-first, routing, validation]
---
## Architecture Brief
resource: harness.config.json, .github/harness/eval-sets/*.json, scripts/harness/skill-routing-eval.mjs, scripts/harness/test/skill-routing-eval-test.mjs, scripts/harness/optimize-all-skills.mjs, package.json

### Objective
- Add a deterministic baseline/coverage check tying configured skill-model mappings to non-empty, structurally valid skill eval sets before tuning or optimization runs.

### Scope and boundaries
- In scope:
  - Validate every `skillModelMapping.mappings` entry has a matching eval set.
  - Validate five or more non-empty prompts, unique IDs, and expected stage sequences using known stage names.
  - Emit a machine-readable coverage report and support focused skill selection.
  - Expose package commands for validation and self-test.
- Out of scope:
  - Changing model assignments or prompt-router decisions.
  - Running LLMs, optimizing skill text, or judging response quality.
  - Requiring auxiliary eval packets that are not mapped skills.

### Artifacts to create
- `scripts/harness/skill-routing-eval.mjs` - deterministic coverage validator and JSON report CLI.
- `scripts/harness/test/skill-routing-eval-test.mjs` - validator contract tests.
- `.github/harness/memory/briefs/skill-routing-eval-coverage-2026-09-18.md` - Architecture Brief.

### Artifacts to modify
- `package.json` - add validation and self-test commands.
- `scripts/harness/optimize-all-skills.mjs` - run the coverage check before optimization and refuse mapped skills with missing/invalid eval sets.

### Key decisions
- Decision: Treat configured `skillModelMapping.mappings` as the routing source of truth and auxiliary eval packets as separate research artifacts.
- Decision: Make the validator deterministic and model-free; quality tuning remains downstream of a valid baseline.
- Decision: Require at least five tests per mapped skill, matching the eval-first skill guidance.
- Decision: Fail closed before optimization when coverage is incomplete; no silent `No eval set found` skips for mapped skills.

### Constraints
- No changes to prompt-router stage/model selection.
- Use repository-relative paths and existing JSON eval-set shape (`tests`, `expected.stageSequence`).
- Preserve existing optimizer dry-run and selected-skill behavior.

### Validation plan
- `npm run test:harness:skill-routing-eval`
- `npm run harness:skill-routing:validate`
- `npm run harness:eval:self-test`
- `npm run harness:docs:check`
- `node --check scripts/harness/skill-routing-eval.mjs`

### Do NOT
- Do not infer missing eval sets from skill names or silently skip mapped skills.
- Do not call models or mutate skill files from the validator.
- Do not classify auxiliary eval packets as routing coverage unless they are named in mappings.

### Assumptions and risks
- `[UNVERIFIED]` Five tests are sufficient as a baseline gate, not a quality guarantee; deeper quality scoring remains the eval runner's responsibility.
- Risk: Adding a new mapped skill requires an eval set before optimizer runs; this is intentional fail-closed behavior.

### Architectural gates
- Gate 1 domain alignment: PASS. Coverage validation belongs beside routing and skill optimization tooling.
- Gate 2 generality: PASS. The validator is model/provider agnostic.
- Gate 3 ownership: PASS. Config owns mappings, eval sets own cases, validator owns cross-surface consistency.
- Gate 4 boundary integrity: PASS. No prompt-router behavior or skill content is mutated.
- Gate 4b isolation/safety: PASS. Validator is read-only and model-free.
- Gate 5 reuse: PASS. Existing mapping and eval-set contracts are reused.
