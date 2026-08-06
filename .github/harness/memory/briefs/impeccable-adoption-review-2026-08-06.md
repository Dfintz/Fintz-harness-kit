---
summary: "Architecture Brief - adoption review of pbakaus/impeccable patterns"
type: brief
status: active
source: research
created: 2026-08-06
updated: 2026-08-06
tags: [research, external-harness, skills, hooks, testing, adoption, 2026]
---
# Architecture Brief - adoption review of pbakaus/impeccable patterns

resource: https://github.com/pbakaus/impeccable, README, skill payloads, CLI install/update surface, detector and hook scripts, behavior tests

**Date:** 2026-08-06  
**Status:** APPROVED

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| `pbakaus/impeccable` README | command model, install/update flow, hook behavior, detector capabilities | external reference |
| `cli/bin/commands/skills.mjs` | provider detection, install/update/link orchestration, hook and agent artifact handling | external runtime |
| `tests/skill-behavior/scenarios.test.mjs` | trace-based skill routing behavior checks | external testing |
| `tests/skill-behavior/workflow-contract.test.mjs` | attended-turn workflow contract assertions | external testing |
| `.agents/skills/impeccable/scripts/hook-lib.mjs` | resilient hook runtime, cache and dedupe patterns | external hook runtime |
| `.agents/skills/impeccable/scripts/detector/*` | rule-registry style deterministic detector | external quality surface |
| `.github/harness/HARNESS.md` | stage machine and routing contract in this repo | local harness contract |
| `scripts/harness/prompt-router.mjs` | profile routing and handoff generation in this repo | local runtime |
| `scripts/harness/record-run.mjs` | structured run evidence output in this repo | local observability |

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| Full execution telemetry from impeccable hooks and install flows | Runtime frequency and failure rates under real multi-user usage |
| Benchmarks comparing detector scope vs cost in non-frontend repos | Whether the same detector architecture pays off for general harness policy checks |

Proceeding is safe because this task is comparative architecture learning, not a claim of binary compatibility.

## Key transferables

1. Provider-aware packaging as a first-class build product.
2. Hook lifecycle hardening (merge, dedupe, safe guard wrappers, cross-platform command handling).
3. Trace-driven skill behavior tests that assert sequence/contract, not wording.
4. Registry-driven deterministic rule engines with severity and scope partitioning.
5. Explicit state-aware routing with aliases and deprecation-safe command mapping.
6. Install/update safety ergonomics (idempotence, drift detection, stale copy migration).

## Architectural Gates

### Gate 1 - Domain alignment

Pass. These ideas directly target harness orchestration, skill lifecycle, and review reliability.

### Gate 2 - Generality

Pass with constraint. Adopt framework-level mechanisms, not frontend-style opinions or design-specific rules.

### Gate 3 - Ownership

Pass. Proposed work maps to existing local owners: router, loops, docs-check, tests, and run evidence surfaces.

### Gate 4 - Boundary integrity

Pass with guardrail. Keep provider-specific install logic in dedicated scripts; do not leak provider branching into core stage contracts.

### Gate 4b - Isolation/safety

Pass with caution. Hook auto-injection and command rewrite must never widen trust boundaries or execute untrusted strings.

### Gate 5 - Reuse

Pass. Local surfaces already exist for extension: `prompt-router.mjs`, `record-run.mjs`, `validate-doc-contracts.mjs`, and loop specs.

## Prioritized adoption backlog

1. **Trace-contract tests for skills and route behavior** (difficulty: medium)
   - Problem solved: catches behavior drift in instructions/routing that unit tests miss.
   - Local fit: add provider-agnostic trace harness tests under `scripts/harness/test/` and wire into `test:harness:core`.
   - First slice: one scenario suite that asserts non-trivial route enters stage sequence and does not skip required context checks.

2. **Hook manifest merge/dedupe library** (difficulty: medium)
   - Problem solved: avoid duplicate hook entries, stale local/shared manifest conflicts, and malformed manifest takeover.
   - Local fit: shared helper for any existing/future hook writers and policy tooling.
   - First slice: implement pure merge+strip functions with self-tests.

3. **Provider install/update drift checker for skills/agents sidecars** (difficulty: medium)
   - Problem solved: stale copied skills and partial updates across providers.
   - Local fit: extend docs/contract checks and sidecar validation with hash/shape checks.
   - First slice: report-only command that compares installed provider trees vs local canonical source.

4. **Deterministic policy detector registry for harness docs/scripts** (difficulty: medium-high)
   - Problem solved: explicit, fast checks for anti-patterns in harness surfaces.
   - Local fit: extend `doc-verifier` with rule metadata (`id`, `severity`, `scope`, `advisory`).
   - First slice: start with 5-8 high-signal rules (unsafe command examples, missing bounded-loop fields, ambiguous gate status strings).

5. **State-aware command menu/routing explanation artifact** (difficulty: low-medium)
   - Problem solved: operator clarity on why route/profile was chosen.
   - Local fit: enrich `prompt-router` output with concise state factors.
   - First slice: emit a machine-readable route rationale block (conditions matched + exclusions).

6. **Shortcut pinning for frequent harness commands** (difficulty: low)
   - Problem solved: reduces command friction while preserving one canonical implementation.
   - Local fit: optional wrappers generated from existing scripts.
   - First slice: generator that creates small aliases for `harness:route`, `harness:feature`, and `harness:review` with clear provenance comments.

7. **Append-only session event journal + bounded cache pruning policy** (difficulty: medium)
   - Problem solved: resilient session continuity with bounded state growth.
   - Local fit: unify run/session traces for dashboard and postmortems.
   - First slice: add run journal pruning policy by age/count with deterministic retention rules.

8. **Cross-provider hook command guard strategy** (difficulty: medium)
   - Problem solved: missing script path and shell incompatibility failures in hooks.
   - Local fit: reusable guard command builders per platform (POSIX/cmd/powershell-safe forms).
   - First slice: standalone utility with tests for command rendering and path quoting behavior.

## What NOT to copy

- Frontend style rules, anti-pattern lexicon, and visual critique heuristics.
- Product-specific command taxonomy depth unless your harness explicitly becomes domain-specific.
- Any installer behavior that silently rewrites user-global state without explicit consent.

## Suggested near-term execution order

1. Trace-contract tests (high confidence, immediate reliability gain).
2. Hook manifest merge/dedupe + guard utility (safety).
3. Drift checker for provider trees (maintainability).
4. Detector registry bootstrap (quality surface).

## Risks and mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Provider complexity creep | install/update logic can become brittle | isolate provider rules in data maps plus tested pure helpers |
| False confidence from trace tests | tests may assert incidental sequences | focus assertions on contract-critical ordering only |
| Detector overreach | noisy findings reduce trust | start advisory-first and promote rules after measured precision |
| Hook command portability bugs | breaks automation on one OS | add platform-specific rendering tests and simulated shell checks |

## External evidence pointers

- `pbakaus/impeccable` `cli/bin/commands/skills.mjs`
- `pbakaus/impeccable` `tests/skill-behavior/scenarios.test.mjs`
- `pbakaus/impeccable` `tests/skill-behavior/workflow-contract.test.mjs`
- `pbakaus/impeccable` `.agents/skills/impeccable/scripts/hook-lib.mjs`
- `pbakaus/impeccable` `.agents/skills/impeccable/scripts/detector/registry/antipatterns.mjs`

## Understand status

- Graph status: not required for this external-repo comparison pass
- Tools used: external repo fetch, code search, local harness contract and script inventory
- Residual risk: medium; recommendations are architecture-level and should be validated by a focused pilot slice before broad rollout