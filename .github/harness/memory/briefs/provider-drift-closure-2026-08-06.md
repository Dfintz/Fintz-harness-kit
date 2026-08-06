---
summary: "Architecture Brief - provider drift first-slice closure assessment"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [provider-drift, skills, sidecars, closure, review]
---
## Architecture Brief
resource: scripts/harness/provider-drift-report.mjs, scripts/harness/test/adoption-slices-test.mjs, docs/harness/COMMAND_INDEX.md, package.json, .github/harness/memory/briefs/provider-drift-follow-up-2026-08-06.md

### Objective
- Determine whether any implementation remains for the approved report-only provider skill/sidecar drift first slice.

### Scope and boundaries
- In scope: verify explicit/default root behavior, deduplication, exact compared shapes, SHA-256 content drift, missing/extra classification, exit codes, fixture cleanup, documentation, and semantic separation from sidecar policy validation.
- Out of scope: provider installation/update/remediation, schema changes, semantic YAML validation changes, or forcing provider-specific trees to match.
- Primary boundary: existing drift report and adoption test are the owners; closure requires no new runtime surface.

### Artifacts to create
- None. Existing implementation and test suite satisfy the first-slice contract.

### Artifacts to modify
- None unless final validation discovers a concrete acceptance failure.

### Key decisions
- Decision: close the first slice when `test:harness:adoption` passes and the report remains read-only with 0/1/2 exit semantics.
- Decision: treat provider-specific extras/missing files as report findings, not automatic remediation requirements.
- Decision: defer live install/update integration and semantic sidecar policy composition to a future provider-owned task.

### Constraints
- Do not change current user-edited `package.json` or `package-lock.json` without a failing contract.
- Do not add provider mutation or a duplicate command.
- Preserve the generic file-level drift versus semantic sidecar validation boundary.

### Validation plan
- Run `npm run test:harness:adoption` and `npm run test:harness:core`.
- Run `npm run harness:docs:check`, `npm run harness:commands:check`, `npm run harness:graph -- status`, and `git diff --check`.
- Check targeted diagnostics and record analyzer-only residual warnings separately.

### Do NOT
- Do not invent missing provider integration work to extend a completed first slice.
- Do not interpret a clean report as proof of semantic policy validity.
- Do not suppress or weaken existing safety checks.

### Assumptions and risks
- `[UNVERIFIED]` Future provider trees may add artifact types beyond `SKILL.md` and `agents/openai.yaml`; extension requires a reviewed fixture and Brief.
- Residual risk low for the first slice: all current acceptance paths are fixture-tested; live provider update behavior remains intentionally unverified.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: add explicit assertions that content-drift findings contain independently calculated canonical and installed SHA-256 values.
- Deferred: live installation/update behavior remains out of scope and does not block first-slice closure.
