# Slice B Run Bundle Warning Suppression And Checks 2026-08-03
resource: scripts/harness/prompt-router.mjs, scripts/harness/test/prompt-router-run-bundle-test.mjs, package.json

## Stage 1 Understand Summary
- Graph freshness gate: ready; graph matches HEAD.
- Impacted primary component: scripts/harness/prompt-router.mjs.
- Impacted validation surface: scripts/harness/test/prompt-router-run-bundle-test.mjs and npm script registration in package.json.
- Downstream dependents of prompt-router: scripts/harness/mcp-tools.mjs and scripts/harness/prompt-middleware.mjs.
- Scope classification: constrained runtime and test-only additions; no protocol or schema changes.

## Objective
- Add a tiny suppression or annotation strategy for the remaining file-inclusion warning in prompt-router feature-run JSON read path.
- Execute broader checks after the slice with emphasis on docs/contracts and router-adjacent tests.

## Architectural Gates
- Gate 1 Problem framing: PASS.
  - The remaining warning is noisy but localized; suppression must not weaken path safety.
- Gate 2 Boundary integrity: PASS.
  - Keep behavior inside prompt-router feature-runs helper path only.
- Gate 3 Safety and correctness: PASS with constraint.
  - Suppression must be paired with explicit rationale at callsite and existing path containment checks retained.
- Gate 4 Operability and proof: PASS.
  - Add deterministic test and broader command checks for docs/contracts and router-adjacent scripts.
- Gate 5 Change minimization: PASS.
  - Minimal edits; no route decision logic changes.

## Decisions
- Use a minimal annotation strategy at the exact JSON read callsite in readJsonFileOrDefault.
- Keep all existing containment controls (assertContainedPath + allowlisted file names).
- Preserve current run bundle behavior and test contract.
- Run a broader proof pass including harness docs/contracts plus router-adjacent tests.

## File Plan
- Update scripts/harness/prompt-router.mjs.
  - Add concise suppression annotation at the remaining flagged readFileSync call.
- Keep scripts/harness/test/prompt-router-run-bundle-test.mjs as deterministic guardrail.
- Keep package.json test script for focused verification.

## Constraints
- Do not alter route stage selection or model mapping behavior.
- Do not change manifest schema fields or output names.
- Do not expand writes outside .github/harness/runs/feature-runs.

## Do-NOTs
- Do not remove existing path containment checks.
- Do not broad-suppress warnings at file scope.
- Do not mutate unrelated files in dirty worktree.

## Assumptions
- The warning is from static analysis and acceptable to suppress when path safety guarantees are documented in-line.
- Broader checks requested are docs/contracts plus router-adjacent tests, not full repo test matrix.

## Validation Plan
- Run npm run test:harness:prompt-router:run-bundle.
- Run npm run harness:docs:check.
- Run npm run test:harness:acceptance.
- Re-check diagnostics for prompt-router to confirm no new relevant issues.
