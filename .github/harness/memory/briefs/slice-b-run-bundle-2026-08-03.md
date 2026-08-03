---
summary: "Architecture Brief — Slice B unified feature run bundle"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [harness, run-bundle, prompt-router, orchestration, 2026]
---

# Architecture Brief — Slice B unified feature run bundle
resource: scripts/harness/prompt-router.mjs, scripts/harness/stage-state.mjs, scripts/harness/record-run.mjs, .github/harness/runs/, package.json, .github/harness/MCP-INTEGRATION.md

## Understand output

- Graph status: fresh at HEAD (`6ca664b6`).
- Changed components target: `scripts/harness/prompt-router.mjs` plus focused tests and package scripts.
- Affected components:
  - Dependents of `prompt-router.mjs`: `scripts/harness/mcp-tools.mjs`, `scripts/harness/prompt-middleware.mjs`.
  - Dependents of `stage-state.mjs`: `scripts/harness/control-panel.mjs`, `scripts/harness/teams-notifier.mjs`.
- Layers: Core primarily; Test layer for validation additions.
- Risk: medium (run identity and artifact indexing influence operator workflows and automation continuity).

## Gates

1. Domain alignment: PASS. The missing behavior is orchestration/run-observability infrastructure.
2. Generality: PASS. Design is repo-agnostic and bound to harness run surfaces.
3. Ownership: PASS. `prompt-router.mjs` owns route/handoff minting context; run history remains with `record-run.mjs`; live state remains with `stage-state.mjs`.
4. Boundary integrity: PASS with constraints. Do not alter routing decisions or stage ordering semantics.
4b. Safety and isolation: PASS with constraints. Run bundle metadata must be path-contained under `.github/harness/runs/feature-runs/` and must not read/write arbitrary paths.
5. Reuse: PASS. Extend prompt-router and existing runs directory instead of adding parallel orchestration system.

## Decisions

1. Add feature-run bundle storage under `.github/harness/runs/feature-runs/`.
2. Introduce `runId` mint/reuse for route/handoff/prompt-pack operations using a task-indexed mapping:
   - Reuse active run for same normalized task.
   - Mint new run when no active mapping exists.
3. Persist run-scoped manifest file per run with canonical fields:
   - `runId`, `task`, timestamps, route profile/mode/stages/models.
   - Artifact slots for `route`, `handoff`, `brief`, `implementation`, `reviewBreadth`, `reviewDepth`, `feedback`.
4. Route command writes route JSON evidence into the run folder; handoff writes handoff text evidence.
5. Prompt-pack command records pack directory path inside the same run manifest.
6. Add deterministic tests for runId reuse and manifest creation/update behavior.

## Constraints

- Do not change stage sequencing logic.
- Do not modify `stage-state.mjs` write semantics for this slice.
- Do not move existing memory brief/review paths.
- Keep all run-bundle writes contained under `.github/harness/runs/feature-runs/`.

## Do-NOTs

- Do NOT introduce transport- or editor-specific assumptions.
- Do NOT bind run identity to wall-clock only; preserve deterministic reuse by normalized task mapping.
- Do NOT claim completed stage artifacts unless files exist.
- Do NOT make route/handoff fail if bundle logging fails; emit warning and continue.

## Assumptions

- Route/handoff invocations for the same task are close in time and should share run identity by default.
- Existing downstream tools tolerate additional fields in route JSON output.
- A focused test can validate run bundle behavior without full end-to-end stage execution.

## Implementation plan

1. Add run-bundle helpers to `prompt-router.mjs` for index load/store, runId mint/reuse, and manifest writes.
2. Attach `runId` to route payload and handoff print output.
3. Write route/handoff evidence files and update run manifest slots.
4. Record prompt-pack output path in run manifest.
5. Add test file for run-bundle behavior and package scripts for execution.
6. Validate with focused tests and existing prompt-router commands.
