---
summary: "Architecture Brief - T2/T3/T7/T8 correctness and safety remediation"
type: brief
status: active
source: copilot
created: 2026-08-05
updated: 2026-08-05
tags: [t2, t3, t7, t8, remediation, safety]
---
# Architecture Brief - T2/T3/T7/T8 correctness and safety remediation
resource: scripts/harness/file-search.mjs, scripts/harness/run-loop.mjs, scripts/harness/t7-roi-evaluate.mjs, scripts/harness/t8-benchmark-gap-evaluate.mjs, scripts/harness/manifest-allowlist.mjs, scripts/harness/command-validation.mjs

## Context sufficiency check
- Scope: software and deterministic-test remediation across existing ticket-owned harness surfaces.
- Primary boundary: evaluator evidence selection and process invocation; no retrieval or loop lifecycle redesign.
- Graph status: graph commands were cancelled by the editor while gathering evidence; direct code, tests, package wiring, and git state provide sufficient local evidence.

## Architectural gates
- Gate 1 Domain alignment: PASS. Each fix remains in the owner that currently evaluates evidence or invokes the process.
- Gate 2 Generality: PASS. Reuse `manifest-allowlist` for repository-scoped T2 inputs and existing command-tokenization pattern for T3 argv execution.
- Gate 3 Ownership: PASS. T7 packet owns optional measured observations; T8 evaluator owns all-source decision semantics.
- Gate 4 Boundary integrity: PASS. CLI wrappers validate/select inputs; evaluators calculate decisions; tests establish regression behavior.
- Gate 4b Isolation/safety: PASS. T2 rejects paths outside the repository allowlist; T3 removes shell interpretation; T8 treats incomplete evidence as invalid.
- Gate 5 Reuse: PASS. No new command framework or generic evaluator abstraction is needed.

## Decisions
- Commit the existing T7 default packet and run a default-path regression test without `--packet`.
- T7 recovery/complexity results are only met when packet observations explicitly provide finite values; absent observations remain unmet rather than fabricated.
- T8 evaluates every valid source independently: any source breaching a threshold yields `GO_RESEARCH`; any selected input that is missing, malformed, or unsupported exits with configuration failure.
- T2 `eval-pilot --eval-set` accepts only an existing file selected through the repository manifest allowlist.
- T3 tokenizes validated agent commands and invokes `spawnSync(executable, args, { shell: false })`.

## Artifacts to modify
- scripts/harness/t7-roi-evaluate.mjs and scripts/harness/test/t7-roi-evaluate-test.mjs
- .github/harness/eval-sets/t7-temporal-continue-as-new-roi-packet.json
- scripts/harness/t8-benchmark-gap-evaluate.mjs, its test, manifest, registry, and fixtures
- scripts/harness/file-search.mjs and focused regression coverage
- scripts/harness/run-loop.mjs and focused regression coverage

## Constraints and Do NOT
- Do NOT change runtime retrieval ranking or loop lifecycle behavior.
- Do NOT accept partially invalid T8 evidence sets.
- Do NOT reintroduce caller-provided absolute paths or `shell: true` command execution.
- Do NOT mark missing T7 measurements as passing.

## Validation
- `npm run test:harness:continue-as-new:roi`
- `npm run test:harness:hybrid-fusion:benchmark-gap`
- focused T2 eval-pilot containment test
- focused T3 command execution regression test
- diagnostics on changed scripts