---
summary: "Architecture Brief - harden provider skill and sidecar drift reporting"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [provider-drift, skills, sidecars, hashes, report-only]
---
## Architecture Brief
resource: scripts/harness/provider-drift-report.mjs, scripts/harness/test/adoption-slices-test.mjs, scripts/harness/sidecar-allowlist-report.mjs, scripts/harness/validate-doc-contracts.mjs, package.json, docs/harness/COMMAND_INDEX.md

### Objective
- Make the provider drift checker a reliable report-only first slice for stale or partial copied skill/sidecar trees.
- Ensure explicit provider roots are compared exactly once, file shape/hash drift is deterministic, and existing canonical sidecar policy validation remains authoritative.

### Scope and boundaries
- In scope: fix CLI root selection, deduplicate roots, normalize deterministic compared paths, report missing/extra/content drift for `SKILL.md` and `agents/openai.yaml`, and add fixture tests for all drift categories and clean comparisons.
- In scope: document that generic drift is file shape/hash reporting while sidecar allowlist validation remains semantic and canonical `.github` policy validation.
- Out of scope: copying, installing, updating, deleting, or auto-remediating provider trees; changing sidecar policy semantics; making `.claude` and `.github` trees identical when their stage ownership intentionally differs.
- Primary boundary: `provider-drift-report.mjs` owns portable tree comparison; `sidecar-allowlist-report.mjs` and `validate-doc-contracts.mjs` own canonical sidecar policy/schema semantics.

### Artifacts to create
- None. Extend the existing adoption fixture suite rather than creating a duplicate test command.

### Artifacts to modify
- `scripts/harness/provider-drift-report.mjs` - make defaults explicit, use explicit roots when supplied, dedupe normalized roots, and match only the intended relative file shapes.
- `scripts/harness/test/adoption-slices-test.mjs` - test clean, missing, extra, content-drift, duplicate-root, and CLI root-selection behavior using temporary trees.
- `docs/harness/COMMAND_INDEX.md` - clarify default roots and report-only semantics.
- `package.json` - inspect current user-edited content; modify only if a required drift test command is missing, preserving unrelated changes.
- `.github/harness/memory/briefs/provider-drift-follow-up-2026-08-06.md` - record review decisions and deferred provider integration.

### Key decisions
- Decision: default CLI comparison is canonical `.github/skills` against `.claude/skills`; when one or more `--installed-root` flags are supplied, use only those supplied roots and do not append defaults.
- Decision: repeated canonical/installed roots are normalized and deduplicated while preserving first-seen order; comparing a root with itself yields a clean report.
- Decision: compare exactly `skill/SKILL.md` and `skill/agents/openai.yaml` shapes under any nested skill slug, normalized to forward-slash relative paths. Do not treat arbitrary files as drift.
- Decision: accepted compared paths are exactly `<skill-slug>/SKILL.md` or `<skill-slug>/agents/openai.yaml`, where `<skill-slug>` is one non-empty path segment; nested arbitrary `SKILL.md` files are excluded.
- Decision: preserve report exit semantics: 0 clean, 1 drift, 2 usage/error. Never write or mutate provider files.
- Decision: generic hash/shape drift and canonical sidecar semantic validation remain separate; the generic report must not parse or reinterpret YAML policy.

### Constraints
- Use SHA-256 over file bytes for content drift; include both hashes on `content-drift` findings.
- Report missing and extra paths per installed root with deterministic path ordering.
- A missing root is an empty installed tree and therefore reports missing canonical files; it must not throw for normal report operation.
- Keep helper exports stable (`compareProviderTrees`) and preserve JSON fields unless additive.
- Tests must not mutate committed provider trees; use temporary fixtures and clean them in `finally`.
- CLI fixture tests must cover clean exit 0, drift exit 1, usage/error exit 2, explicit-root replacement of defaults, repeated-root deduplication, missing/extra/content drift, and ignored path shapes.
- Do not alter current `package.json` user/formatter edits unrelated to this task.

### Validation plan
- Run the focused adoption self-test after implementation.
- Run the provider drift CLI against identical temporary trees and assert clean exit/output.
- Run `npm run test:harness:adoption`, `npm run test:harness:core`, `npm run harness:docs:check`, `npm run harness:commands:check`, `npm run harness:graph -- status`, and `git diff --check`.

### Do NOT
- Do not auto-copy, install, update, delete, or rewrite provider skills.
- Do not force `.claude` stage skills to mirror `.github` model-invoked sidecars.
- Do not merge generic file drift into sidecar allowlist policy findings without a shared schema contract.
- Do not silently add default roots when explicit CLI roots are supplied.

### Assumptions and risks
- `[UNVERIFIED]` Provider trees may intentionally contain provider-only stage skills; extra/missing findings are informational drift, not automatic defects.
- Risk: users may interpret every drift finding as remediation-required. Mitigation: command docs label report-only semantics and explain provider-specific ownership.
- Risk: path matching may miss future provider artifact types. Mitigation: keep compared shapes explicit and extend through a reviewed fixture change.
- Understand status: graph fresh and ready; direct source owners are the existing drift CLI, sidecar validator, and adoption test; residual risk medium until explicit-root and shape fixtures pass.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: explicit installed roots replace defaults, roots dedupe in first-seen order, compared paths are exact one-segment skill shapes, and CLI fixture coverage includes exit codes and all drift categories.
