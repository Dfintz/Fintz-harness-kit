---
summary: "Architecture Brief - closure review for deterministic policy detector registry"
type: brief
status: active
source: implementation
created: 2026-08-06
updated: 2026-08-06
tags: [harness, adoption, policy-detector, closure, review, 2026]
---
# Architecture Brief - closure review for deterministic policy detector registry
resource: scripts/harness/policy-detector-registry.mjs, scripts/harness/doc-verifier.mjs, scripts/harness/test/adoption-slices-test.mjs, .github/harness/memory/briefs/impeccable-adoption-review-2026-08-06.md

## Task
Determine whether any required work remains for the adoption slice "Deterministic policy detector registry for harness docs/scripts".

## Context Sufficiency Check

### Available artifacts
- Registry implementation with metadata and deterministic execution order.
- Verifier integration that emits detector findings into document quality results.
- Adoption tests that assert rule count, rule semantics, scope behavior, and verifier impact.
- Prior adoption brief defining first-slice success criteria.

### Missing artifacts
- Long-horizon precision/recall telemetry for detector noise rates in real operator docs.

Proceeding is safe because closure status for this slice can be decided from deterministic code and test contracts.

## Understand Output
- Graph provider status: ready (understand-anything).
- Graph freshness: fresh at HEAD with cache hit.
- Changed components for this slice: policy detector registry, doc verifier, adoption tests.
- Affected layers: harness validation surface, docs-quality findings path, adoption regression tests.
- Dependency evidence: `doc-verifier` imports and executes registry; adoption tests exercise registry and verifier behavior.

## Architectural Gates

### Gate 1 - Domain alignment
Pass. The slice scope is exactly harness docs/scripts quality policy detection.

### Gate 2 - Generality
Pass. Rules are metadata-driven and scoped; no product-specific coupling introduced.

### Gate 3 - Ownership
Pass. Ownership remains in `scripts/harness/` validation utilities and tests.

### Gate 4 - Boundary integrity
Pass. Registry performs pure text analysis and returns findings; verifier owns presentation and pass/fail semantics.

### Gate 4b - Isolation/safety
Pass. No command execution; detector checks are static and bounded.

### Gate 5 - Reuse
Pass. Registry API is reused by verifier and tests; no duplicate rule logic in consumers.

## Decision
No mandatory implementation work remains for this slice if closure criteria are:
1. Deterministic registry exists with explicit metadata contracts.
2. Verifier consumes registry findings with severity/advisory semantics.
3. Regression tests validate positive/negative behavior and scope handling.

## Optional follow-ups (non-blocking)
1. Reduce regex complexity in detector predicates if diagnostics policy later requires warning-free analyzer output.
2. Add repository-scope rules when there is a concrete policy need beyond document text checks.
3. Capture precision metrics from real docs corpus before promoting additional strict rules.

## Constraints and Do-NOTs
- Do not widen scope by adding speculative low-signal rules just to increase rule count.
- Do not change detector behavior from deterministic order to opportunistic/non-deterministic scans.
- Do not move severity policy ownership away from rule metadata + verifier integration.

## Validation Plan
- Run adoption regression suite.
- Run harness core suite.
- Run docs and commands consistency checks.
- Check diagnostics for detector and verifier surfaces to ensure no new blocker-level issues from this slice.

## Assumptions
- Existing residual diagnostics outside this slice are accepted unless they become blocker policy.
- Closure question targets required scope completion, not optional hardening backlog.