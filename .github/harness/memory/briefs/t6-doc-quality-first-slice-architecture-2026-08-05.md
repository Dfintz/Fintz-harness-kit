---
summary: "Architecture Brief - T6 documentation quality first implementation slice"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [architect, t6, docs, quality, verifier]
---
# Architecture Brief - T6 documentation quality first implementation slice
resource: .github/harness/memory/briefs/t6-doc-quality-kickoff-2026-08-05.md, .github/harness/memory/briefs/wayfinder-day-30-checkpoint-note-2026-09-04.md, scripts/harness/doc-verifier.mjs, harness.config.json, package.json, docs/harness/COMMAND_INDEX.md

## Architecture Brief

### Objective
- Deliver the first T6 code slice by adding deterministic no-ai-slop style checks into the doc-verifier path with warning-first policy support and repeatable test evidence.

### Scope and boundaries
- In scope:
  - Extend scripts/harness/doc-verifier.mjs with deterministic phrase-pattern quality checks.
  - Add warning-first severity semantics so quality checks can report findings without immediate hard-fail gating.
  - Add deterministic test coverage for the new verifier behavior.
  - Add command surface entry for the new test in package.json and command index docs.
- Out of scope:
  - Rewriting teach-agent policy docs or broad instruction contracts.
  - Converting all warning-first checks to hard-fail policy in this slice.
  - Changing T7/T8 milestone scope.

### Artifacts to create
- scripts/harness/test/doc-verifier-no-ai-slop-test.mjs - deterministic tests for warning and error mode behavior in no-ai-slop checks.
- .github/harness/memory/briefs/t6-doc-quality-first-slice-implementation-2026-08-05.md - implementation evidence and proof logs.
- .github/harness/memory/briefs/t6-doc-quality-first-slice-review-breadth-2026-08-05.md - severity findings for this slice.
- .github/harness/memory/briefs/t6-doc-quality-first-slice-review-depth-2026-08-05.md - architecture-conformance gate review.
- .github/harness/memory/briefs/t6-doc-quality-first-slice-feedback-2026-08-05.md - final verdict and adjustments.

### Artifacts to modify
- scripts/harness/doc-verifier.mjs - add no-ai-slop checks, warning/error severity handling, and repeatable CLI phrase flags.
- harness.config.json - define default warning-first no-ai-slop verifier configuration.
- package.json - expose deterministic T6 test command.
- docs/harness/COMMAND_INDEX.md - document the T6 test command.
- .github/harness/memory/briefs/wayfinder-day-30-checkpoint-note-2026-09-04.md - update T6 gate evidence references and status after proof.

### Key decisions
- Decision: Keep no-ai-slop checks deterministic and phrase-list based for this slice.
  - Reasoning: deterministic checks are auditable and align with milestone acceptance gate language.
- Decision: Use warning-first rollout by default.
  - Reasoning: kickoff and radar notes explicitly call for warning-first to manage false-positive risk.
- Decision: Introduce severity-aware pass criteria where only error-severity failures break exit status.
  - Reasoning: preserves strict current checks while enabling gradual quality policy adoption.
- Decision: Use Producer-Reviewer topology for plan pressure testing.
  - Reasoning: architecture brief is produced, then challenged before implementation.

### Constraints
- Preserve existing doc-verifier default behavior for readability and word-count checks.
- Keep CLI backward compatible for existing invocations.
- Keep output JSON deterministic and machine-readable.
- Do not weaken existing hard-fail checks by downgrading them to warnings.

### Validation plan
- npm run harness:doc:verify -- --file README.md
- npm run test:harness:doc:quality
- npm run harness:docs:check
- Capture one sample no-ai-slop warning run JSON artifact in implementation brief.

### Do NOT
- Do NOT add probabilistic or model-dependent quality scoring.
- Do NOT make warning-mode checks fail builds by default.
- Do NOT broaden scope into unrelated doc workflow refactors.

### Assumptions and risks
- [UNVERIFIED] Existing docs include few banned phrases, so warning counts should remain manageable.
  - Affects: perceived signal quality from initial rollout.
  - Risk if wrong: warning noise; mitigated by editable phrase list in config.
- [UNVERIFIED] Consumers parse doc-verifier summary text informally, not as strict schema.
  - Affects: adding warning counts into summary string.
  - Risk if wrong: downstream parser mismatch; mitigated by preserving stable top-level keys.
