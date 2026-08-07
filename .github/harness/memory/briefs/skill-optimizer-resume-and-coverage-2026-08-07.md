---
summary: "Architecture Brief: resumable DSPy skill optimizer and complete eval coverage"
type: brief
status: implemented
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [skills, optimizer, dspy, evaluation, resume]
---
# Architecture Brief: Resumable DSPy Skill Optimizer and Complete Eval Coverage

resource: scripts/harness/optimize-all-skills.mjs, scripts/harness/dspy-bridge.mjs, scripts/harness/dspy-optimize.py, .github/harness/eval-sets/, .github/skills/to-questionnaire/SKILL.md, .github/skills/wait-what/SKILL.md, scripts/harness/run-experiment.mjs

## Objective

- Make the DSPy skill optimizer executable, complete for all discovered skills, and resumable without treating synthetic Phase 5 observability as live performance evidence.

## Scope and boundaries

- In scope:
  - Add `scripts/harness/requirements-dspy.txt` declaring the runtime dependency contract.
  - Add schema-aligned eval sets for `to-questionnaire` and `wait-what`.
  - Add repeatable `--skill <name>` selection and `--resume <latest|state-file>` to the optimizer.
  - Persist optimizer-owned state atomically after every completed skill and add a deterministic self-test.
- Out of scope:
  - Changing existing skills, skill routing, or `harness.config.json` model mappings.
  - Altering the Python optimization algorithm or applying generated candidates to source skills.
  - Editing `scripts/harness/phase5/` or treating its synthetic quality, latency, cost, or cascade values as live performance.

## Artifacts to create

- `scripts/harness/requirements-dspy.txt` - reproducible Python dependency declaration for the DSPy optimizer.
- `.github/harness/eval-sets/to-questionnaire.json` - evaluation prompts and expected stage context for the pilot questionnaire skill.
- `.github/harness/eval-sets/wait-what.json` - evaluation prompts and expected stage context for the pilot re-pitch skill.
- `.github/harness/memory/briefs/skill-optimizer-resume-and-coverage-2026-08-07.md` - decision, evidence, and review record.

## Artifacts to modify

- `scripts/harness/optimize-all-skills.mjs` - add selected-skill execution, resumable atomic state, and self-test coverage.
- `package.json` - expose the optimizer self-test through an existing command surface.

## Key decisions

- Gate 1 - Domain alignment: PASS. The optimizer owns execution selection and progress state; eval sets own task coverage; the Python sidecar owns one-skill optimization.
- Gate 2 - Generality: PASS. A state format covering selected skills and their terminal results supports every current and future skill without hardcoding names.
- Gate 3 - Ownership: PASS. Keep optimizer state separate from stage-machine journals because it represents a distinct long-running batch lifecycle.
- Gate 4 - Boundary integrity: PASS. The Node orchestrator manages state and process invocation; the Python sidecar contract remains unchanged.
- Gate 4b - Isolation/safety: PASS. State and reports are workspace-local; resume validates model and selection compatibility and does not widen model/provider permissions.
- Gate 5 - Reuse: PASS. Mirror existing atomic file-write and `latest` resume conventions locally, without coupling the optimizer to generic loop journals.
- Decision: every skill has a canonical ID equal to the repo-relative path of its `SKILL.md` file. `--skill` accepts either a canonical ID or a unique display name; ambiguous display names fail and list canonical IDs.
- Decision: versioned optimizer state persists repository root, canonical selected-skill IDs, resolved provider/model/API-base configuration, and SHA-256 fingerprints for each target skill and eval set.
- Decision: `--resume latest` considers only valid, unfinished state files compatible with the current model configuration and input fingerprints. It ignores malformed state safely, fails if no state qualifies, and fails with candidate paths if more than one state qualifies.
- Decision: terminal results (`success`, `no-improvement`, `skipped`) are not rerun, while errors/interrupted work remain eligible.
- Decision: preserve the existing live-versus-synthetic evidence distinction in the previous performance-validation Brief.

## Constraints

- State updates must be atomic so an interrupted run has a readable prior checkpoint.
- Dry runs must not create resumable state or invoke a model.
- Resuming cannot silently change the saved selected-skill set, repository root, provider/model/API-base configuration, target skill content, or eval-set content.
- Add only deterministic test prompts; no source skill content changes.

## Validation plan

- `node scripts/harness/dspy-bridge.mjs --self-test` proves the requirements contract is present.
- `node scripts/harness/optimize-all-skills.mjs --self-test` proves canonical selection, atomic state serialization, fingerprint validation, and latest-state ambiguity behavior without a model.
- `node scripts/harness/optimize-all-skills.mjs --model ollama --skill to-questionnaire --dry-run` proves new eval-set discovery and per-skill selection.
- `node scripts/harness/optimize-all-skills.mjs --model ollama --skill wait-what --dry-run` proves the second eval set.
- `npm run harness:docs:check` validates the skill/eval documentation contract.

## Do NOT

- Do NOT use any Phase 5 synthetic output as live-quality proof.
- Do NOT run the full live optimizer during implementation validation.
- Do NOT overwrite source `SKILL.md` files with generated candidates.
- Do NOT allow `--resume` and `--dry-run` together.

## Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[VERIFIED]` The active Python environment exposes `dspy` version `3.2.1`. | Requirements range. | A different environment may need its own resolver. |
| `[UNVERIFIED]` Existing eval prompts are representative enough to compare future candidates. | Meaningfulness of live optimizer results. | Keyword/stage results may not represent real task quality. |
| `[UNVERIFIED]` A user will resume only from a workspace-compatible state file. | Resume safety. | A stale or copied state could be rejected rather than silently reused. |

## Implementation Summary

### Delivered

- Added `scripts/harness/requirements-dspy.txt` with `dspy>=2.4,<4`.
- Added eval sets for `to-questionnaire` and `wait-what`, bringing optimizer dry-run coverage to 23 of 23 discovered skills.
- Added repeatable `--skill <name-or-canonical-SKILL.md-path>` selection.
- Added versioned, atomically written optimizer state with repo, model, API-base, target, and eval-set compatibility fingerprints.
- Added `--resume <latest|state-file>` with malformed/incompatible-state rejection and ambiguity failure.
- Added `harness:skills:optimizer:self-test` and restored dry-run report persistence.

### Proof Summary

- `npm run harness:skills:optimizer:self-test` -> PASS, 8/8 deterministic checks.
- `node scripts/harness/dspy-bridge.mjs --self-test` -> PASS, 7/7 checks.
- `node scripts/harness/dspy-bridge.mjs --check-deps` -> PASS with Python 3.13.14 and DSPy 3.2.1.
- `node scripts/harness/optimize-all-skills.mjs --model ollama --dry-run` -> PASS; 23 selected skills, 0 skipped eval sets.
- `npm run test:harness:core` -> PASS.
- `npm run harness:docs:check` -> PASS.
- `git diff --check` -> PASS; only an unrelated pre-existing CRLF warning appeared for the generated Phase 5 validation JSON.

### Self-review

- The Python sidecar and Phase 5 synthetic scripts were not modified.
- No live optimization was run, and no generated candidate was applied to a source skill.
- Resume state is limited to `.github/harness/optimization-reports/` and checks input fingerprints before reuse.

## Review Breadth Findings

### Blocker

- None.

### Major

- None.

### Minor

- `scripts/harness/optimize-all-skills.mjs`: the static analyzer still reports file-inclusion warnings at discovered and report-directory-constrained paths. The production path flow is constrained by canonical discovery IDs or the fixed report directory, so this is analyzer-modeling residue rather than a reproduced bypass. Confidence: medium.

### Proof limitation

- No live MIPROv2 run was performed in this remediation. The contract is proven by deterministic state tests and dependency/dry-run checks, not by a new claim about model quality.

## Review Depth Gate Ledger

- `scripts/harness/optimize-all-skills.mjs`: Gate 1 PASS; selection and resume behavior remain in the optimizer owner. Gate 2 PASS; canonical IDs and state descriptors generalize to future skills. Gate 3 PASS; batch checkpoint lifecycle is owned locally rather than by stage-machine journals. Gate 4 PASS; Node manages orchestration while Python remains one-skill execution. Gate 4b PASS; state is local, fingerprinted, and report-directory constrained. Gate 5 PASS; reuses atomic-write and latest-resume patterns without coupling modules.
- `scripts/harness/requirements-dspy.txt`: Gates 1-5 PASS; one dependency declaration matches the Python optimizer's documented range.
- `.github/harness/eval-sets/to-questionnaire.json` and `.github/harness/eval-sets/wait-what.json`: Gates 1-5 PASS; each eval set belongs to its skill, uses the existing schema, and introduces no routing behavior.

## Feedback Verdict Record

### Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- |
| 1 | Missing DSPy requirements declaration | Challenge upheld | Bridge self-test and runtime dependency preflight | High | Added `requirements-dspy.txt`. |
| 2 | Two pilot skills lack eval coverage | Challenge upheld | Full optimizer dry-run | High | Added both schema-aligned eval sets. |
| 3 | Batch optimizer has no safe resume/per-skill execution | Challenge upheld | Optimizer self-test and Architect Challenge | High | Added canonical selection and fingerprinted atomic resume state. |
| 4 | Synthetic Phase 5 metrics could be treated as live performance | Current decision holds | Scope, unchanged Phase 5 scripts, and proof records | High | Continue excluding synthetic metrics from live-quality claims. |

### Accepted changes

- The requested dependency, coverage, selection, and resume improvements are implemented.

### Deferred points

- A future live run should use the new `--skill` and `--resume` controls to gather real optimizer outcomes; no model-quality conclusion is made by this change.

## Live Evaluation Result

- Run: `6581d081-d520-4fa1-93a1-312b3673cad8`
- Provider/model: local Ollama `qwen2.5:latest`
- Coverage: 23 of 23 skills completed; 0 skipped; 0 errors.
- Execution path: the full DSPy sidecar was unavailable at runtime, so the bridge used its simplified Ollama optimizer fallback for every skill.
- Generated artifacts: 23 isolated files under `.github/harness/optimized-skills/`; no source `SKILL.md` files were overwritten.
- Result interpretation: the run is a successful local optimization/evaluation pass, but its baseline and trial scores are keyword-rubric results from the fallback evaluator, not real-user task quality or the synthetic Phase 5 metrics.
- Follow-up fix: `scripts/harness/validate-doc-contracts.mjs` now recognizes UUID-stamped generated optimizer files and excludes them from operator artifact-family validation.

### Brief updates

- Status changed to `implemented`.
- Retained the explicit prohibition on synthetic Phase 5 performance claims.
