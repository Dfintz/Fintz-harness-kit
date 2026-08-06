---
summary: "Architecture Brief - expand deterministic policy detector registry"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [policy-detectors, docs, scripts, severity, advisory]
---
## Architecture Brief
resource: scripts/harness/policy-detector-registry.mjs, scripts/harness/doc-verifier.mjs, scripts/harness/test/adoption-slices-test.mjs, scripts/harness/test/doc-verifier-no-ai-slop-test.mjs, package.json, harness.config.json

### Objective
- Expand the deterministic policy detector registry from three rules to five high-signal document rules with explicit metadata `{ id, severity, scope, advisory }`.
- Preserve warning-first behavior and make rule metadata and findings directly testable.

### Scope and boundaries
- In scope: add two conservative document-scope anti-pattern rules for destructive shell examples and convergence loops missing a positive `maxIterations`; expose metadata and findings through existing registry/verifier surfaces; add focused tests.
- In scope: keep current unsafe shell, unbounded-loop, and ambiguous-gate rules stable.
- Out of scope: repository-scope execution in `validate-doc-contracts.mjs`, automatic document rewriting, AI/LLM judgment, frontend-specific rules, and changing default hard-gate policy for advisory rules.
- Primary boundary: `policy-detector-registry.mjs` owns pure rule metadata/predicates; `doc-verifier.mjs` owns document execution/output; tests own fixtures.

### Artifacts to create
- None. Extend existing registry and adoption/doc verifier tests.

### Artifacts to modify
- `scripts/harness/policy-detector-registry.mjs` - add two rules, explicit metadata validation, and deterministic rule listing.
- `scripts/harness/test/adoption-slices-test.mjs` - assert five document rules and representative new findings.
- `scripts/harness/test/doc-verifier-no-ai-slop-test.mjs` - add end-to-end warning/error behavior assertions if needed without changing its runner contract.
- `harness.config.json` - no change expected; registry rules remain code-owned until measured configuration is justified.

### Key decisions
- Decision: new destructive-shell rule is `warn`, advisory `true`; it scans fenced code blocks only and reports `rm -rf`, `git reset --hard`, and `git clean -f/-d/-fd` command forms without failing verification.
- Decision: convergence-bound rule is `error`, advisory `false` only for a line-bounded structured block beginning with `kind: convergence`; within the next eight lines, `maxIterations` must be a positive integer. Missing, zero, negative, null, or non-numeric values report; ordinary prose and unrelated JSON are not matched.
- Decision: all registry entries must have non-empty id, supported severity (`warn`/`error`), supported scope (`document`/`repository`), boolean advisory metadata, and `advisory: true` requires `severity: warn`; invalid registry metadata throws during module initialization. `listPolicyRules` returns exactly `{ id, severity, scope, advisory, message }` in declaration order.
- Decision: repository-scope rules remain unsupported in this slice and `runPolicyDetectors` returns an empty set for that scope until an owner and fixtures exist.
- Decision: findings preserve `{ id, severity, scope, advisory, message }`; verifier maps them to existing finding fields and keeps advisory warnings non-blocking.

### Constraints
- Pure predicates only; no filesystem, subprocess, network, or model calls.
- Avoid broad regexes that flag normal prose; each new rule needs positive and negative fixtures.
- New command detection is limited to fenced code blocks; convergence detection is limited to the eight-line structured block window.
- Preserve existing verifier exit semantics and current three rule ids/messages.
- Do not silently promote warnings to errors or change `harness.config.json` defaults.
- Keep deterministic rule order as registry declaration order.

### Validation plan
- Run focused adoption and doc-verifier tests after implementation.
- Run `npm run test:harness:adoption`, `npm run test:harness:doc:quality`, `npm run test:harness:core`, `npm run harness:docs:check`, `npm run harness:commands:check`, and `git diff --check`.
- Inspect findings metadata and verify advisory rules leave verifier `ok=true` while error rules fail.
- Verify repository scope returns no findings and registry metadata listing is stable and exact.

### Do NOT
- Do not execute or rewrite shell examples.
- Do not scan repository files from the pure registry.
- Do not add repository rules without a repository-scope owner and fixtures.
- Do not use AI-generated detector decisions.

### Assumptions and risks
- `[UNVERIFIED]` The chosen destructive command patterns are high-signal enough for harness docs; false-positive fixtures are required before acceptance.
- Risk: detector growth becomes noisy. Mitigation: five-rule cap for this slice, advisory defaults for new style/safety examples, and explicit positive/negative tests.
- Understand status: graph fresh and ready; current owners are registry, doc-verifier, and existing direct Node tests; residual risk medium until rule metadata and false-positive tests pass.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: specified fenced-code command matching, eight-line convergence grammar, advisory/severity invariant, invalid metadata behavior, exact listing keys, and repository-scope no-op tests.
