---
summary: "Architecture Brief - residual analyzer warning reduction follow-up"
type: brief
status: active
source: implementation
created: 2026-08-06
updated: 2026-08-06
tags: [harness, analyzer, warnings, refactor, policy-detector, doc-verifier, 2026]
---
# Architecture Brief - residual analyzer warning reduction follow-up
resource: scripts/harness/doc-verifier.mjs, scripts/harness/policy-detector-registry.mjs, scripts/harness/test/adoption-slices-test.mjs, .github/harness/memory/briefs/policy-detector-registry-closure-review-2026-08-06.md

## Task
Reduce residual analyzer warnings in doc-verifier and policy-detector-registry without changing detector behavior or closure semantics.

## Context Sufficiency Check

### Available artifacts
- Current diagnostics showing regex/runtime and complexity warnings in both files.
- Existing adoption/core tests proving current expected behavior.
- Prior closure brief defining behavior-preservation boundary.

### Missing artifacts
- Formal performance benchmark thresholds for regex alternatives.

Proceeding is safe because this is a warning-reduction refactor bounded by existing behavior tests.

## Understand map
- Components: document verifier pipeline and policy detector registry.
- Dependencies: verifier consumes detector findings; adoption tests assert detector/verifier behavior.
- Layers: quality validation and policy-check layer, no runtime command execution paths.

## Architecture decisions
1. Keep external APIs unchanged: runPolicyDetectors, listPolicyRules, verifyDocument invocation behavior.
2. Replace high-risk regex patterns with bounded/string-scanning helpers where practical.
3. Reduce nested templates/ternaries and split high-complexity logic into composable helpers.
4. Preserve deterministic finding order and existing severity/advisory semantics.
5. Freeze a pre-change behavioral baseline for detector outputs and verifier semantics, then require post-change parity against the same vectors.

## Architectural Gates

### Gate 1 - Domain alignment
Pass. Task is directly within harness quality validation surfaces.

### Gate 2 - Generality
Pass. Refactors improve maintainability without introducing domain-specific coupling.

### Gate 3 - Ownership
Pass. Changes remain within scripts/harness ownership plus tests.

### Gate 4 - Boundary integrity
Pass. Detector-registry and verifier boundaries remain unchanged; only internal implementation style is adjusted.

### Gate 4b - Isolation/safety
Pass. No new privileged operations, tool access, or execution surfaces.

### Gate 5 - Reuse
Pass. Shared helper extraction in verifier reduces duplication and keeps behavior centralized.

## Constraints
- Do not alter observable detection outcomes for existing adoption tests.
- Do not weaken or remove existing policy detector rules.
- Do not expand scope to new rules in this pass.
- Treat adoption test updates as additive coverage only; do not relax or rewrite existing assertions that encode current behavior.

## Do-NOTs
- Do not perform broad file rewrites unrelated to flagged warnings.
- Do not suppress analyzer findings with ignore comments as a first-line strategy.

## Assumptions
- Existing tests represent accepted behavioral contract for this slice.
- Warning count reduction is beneficial even if not reduced to zero in one pass.

## Reviewed False Positives

Accepted as reviewed false positives (2026-08-06):
- File-inclusion warning on `resolve(filePath)` in `readInputDocument`.
- File-inclusion warning on `readFileSync(resolvedPath, 'utf8')` in `readInputDocument`.

Rationale:
- Input path is checked for existence and then validated by `isTrustedInputPath`, which requires canonical containment inside one of: repository root, current working directory, or system temp directory.
- The verifier still exits with code 2 for disallowed paths, preserving fail-closed behavior.
- Adoption and core harness suites remain green after the guard was introduced, confirming no behavior regressions in supported workflows.

Review guard conditions:
- Re-open if trusted-root policy changes (for example, repo-only enforcement), if verifier starts ingesting network/untrusted remote sources, or if analyzer policy no longer accepts guarded local file reads.

## Validation plan
1. Capture pre-change behavior baseline and preserve the output artifact:
	- node --input-type=module -e "import { runPolicyDetectors, listPolicyRules } from './scripts/harness/policy-detector-registry.mjs'; const vectors=[['maxIterations: 0','document'],['maxIterations: -1','document'],['maxIterations: 5','document'],['```sh\\nrm -rf ./build\\n```','document'],['rm -rf ./build','document'],['kind: convergence\\nmaxIterations: 0','document'],['kind: convergence\\nnotes: prose\\nmaxIterations: 3','document'],['Gate status: pass','document'],['The test status: pass is recorded in the report.','document'],['kind: convergence\\nline2\\nline3\\nline4\\nline5\\nline6\\nline7\\nline8\\nmaxIterations: 5','document'],['kind: convergence\\nmaxIterations: 3','repository']]; const out={rules:listPolicyRules('document').map(r=>r.id), hits:vectors.map(([text,scope])=>({scope,text,hits:runPolicyDetectors(text,scope).map(f=>f.id)}))}; console.log(JSON.stringify(out,null,2));"
2. Run targeted adoption test suite:
	- node scripts/harness/test/adoption-slices-test.mjs
3. Run harness core regression suite.
4. Run docs and command contract checks.
5. Re-run file diagnostics and confirm warning delta trends lower with no functional regressions.
6. Re-run the same parity vector command from step 1 post-change and compare output equality with the pre-change baseline.