---
summary: "Architect Challenge - Prompt Router Run-Bundle Root Determinism"
type: brief
status: active
source: human
created: 2026-09-18
updated: 2026-09-18
tags: [architect-challenge, prompt-router, tests]
artifact_family: challenge
immutability: frozen
immutable_since: 2026-09-18
---
## Architect Challenge
resource: .github/harness/memory/briefs/prompt-router-run-bundle-root-determinism-2026-09-18.md, scripts/harness/test/prompt-router-run-bundle-test.mjs, scripts/harness/prompt-router.mjs

### Verdict
- VERDICT: APPROVED

### Evidence
- The failure was caused by inherited `HARNESS_PROJECT_ROOT` pointing to another repository.
- The test now pins its default subprocess root to the repository under test.
- Explicit `--repo-root` coverage remains unchanged and continues to test alternate project routing.
- `npm run test:harness:prompt-router:run-bundle` passes after the fix.
