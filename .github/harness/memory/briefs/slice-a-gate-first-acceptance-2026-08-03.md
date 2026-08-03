---
summary: "Architecture Brief — Slice A gate-first acceptance workflow"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [slice-a, acceptance, validator, 2026]
---
# Architecture Brief — Slice A gate-first acceptance workflow

resource: .github/harness/memory/briefs/external-harness-source-audit-2026-08-03.md, .github/harness/memory/briefs/external-harness-live-execution-audit-2026-08-03.md, .github/harness/loops/feature-cycle.json, .github/instructions/04-IMPLEMENT.md, .github/skills/deterministic-validation/SKILL.md, package.json, scripts/harness/run-loop.mjs, scripts/harness/test/mcp-gap-execution-matrix-test.mjs

**Date:** 2026-08-03  
**Status:** APPROVED

## Context Sufficiency Check

### Artifact inventory

| Artifact | What it contains | Owning surface |
| --- | --- | --- |
| Source-audit brief | Approved Slice A shape and constraints | Harness memory |
| Live-execution audit brief | Runtime evidence from fusion and SSSF | Harness memory |
| `feature-cycle.json` | Outer feature workflow contract | Loop protocol |
| `04-IMPLEMENT.md` | Implementation-stage contract | Stage instruction |
| `deterministic-validation` skill | Proof selection and completion contract | Skill surface |
| `run-loop.mjs` | Existing convergence loop runner style | Runtime scripting pattern |
| `package.json` | User-facing command registration | CLI surface |
| Existing test script style | Minimal deterministic script tests | Test surface |

**Scope:** workflow / documentation / scripting  
**Primary boundary:** add a reusable acceptance-gate contract and runner without adopting external runtime-specific orchestration

### Missing context

| Missing artifact | Needed to answer |
| --- | --- |
| A pre-existing acceptance-gate helper in this repo | Whether Slice A can extend an existing runtime instead of adding a new one |

Current repo search found no first-class acceptance-gate command or contract surface, so proceeding with a new additive helper is justified.

## Current Shape

- The repo already has strong proof guidance, but it lacks a concrete acceptance-gate artifact/runner when no narrow test exists.
- The repo already has loop and workflow docs that can reference a new helper without changing core orchestration semantics.
- The repo does not need fusion-harness session persistence, Pi UI, or typed envelope parity to gain the practical value of gate-first validation.

## Architectural Gates

### Gate 1 — Domain / module alignment

Pass. The new behavior belongs in harness validation and workflow surfaces, not graph, memory, or MCP surfaces.

### Gate 2 — Generality

Pass. A generic acceptance-gate spec plus verifier command is reusable across many feature tasks and remains project-agnostic.

### Gate 3 — Ownership

Pass. Ownership splits cleanly:

- runtime helper -> `scripts/harness/acceptance-gate.mjs`
- operator command -> `package.json`
- workflow instruction updates -> `04-IMPLEMENT.md`, `deterministic-validation` skill, optional loop guidance in `feature-cycle.json`
- deterministic proof -> dedicated test script under `scripts/harness/test/`

### Gate 4 — Boundary integrity

Pass with constraint. The helper verifies an acceptance artifact and baseline behavior; it does not spawn builders, own implementation, or perform gate repair orchestration.

### Gate 4b — Isolation / safety boundary

Pass with guardrails. The helper may execute operator-authored commands, so it must use existing command-safety validation and must not write to arbitrary repo paths beyond explicit scaffold targets.

### Gate 5 — Reuse

Pass. This is a new primitive that other loops and stages can reference; it should not be buried inside a one-off workflow note.

## Key Decisions

1. **Add a machine-runnable acceptance-gate helper script.**
   It will support at least: scaffold a spec, verify a spec, and perform a baseline check that expects the spec to fail before implementation unless explicitly marked already-done.

2. **Use a JSON contract, not typed agent envelopes.**
   The helper should operate on a simple file-based acceptance spec that code can validate without requiring a full typed response pipeline from agents.

3. **Use tokenized proof commands, not shell strings.**
  Acceptance specs will encode executable checks as `argv` arrays executed with `shell: false`, repo-root cwd, and the current harness-safe executable allowlist for v1. Widening that execution contract is a separate future brief, not an implementation-time choice.

4. **Keep Slice A additive and advisory at workflow level.**
   Update docs and loop guidance so the acceptance gate is used when no existing narrow proof exists, but do not make it mandatory for every task.

5. **Treat Windows Pi subprocess discovery as adjacent validation work, not part of Slice A runtime.**
   Record the focused compatibility pass in this run's artifacts, but do not entangle acceptance-gate implementation with external Pi runtime fixes.

6. **Use a stronger-model fusion TUI audit as supporting evidence only.**
   It can pressure-test the gate-authoring concept, but it is not part of the shipped harness feature.

## Artifacts To Create

- `scripts/harness/acceptance-gate.mjs`
  - Responsibility: scaffold, verify, and baseline-check acceptance-gate specs.
- `scripts/harness/command-validation.mjs`
  - Responsibility: extend current command-safety validation for tokenized proof-command argv handling if needed by the helper.
- `scripts/harness/test/acceptance-gate-test.mjs`
  - Responsibility: deterministic tests for scaffold/verify/baseline behavior.
- `.github/harness/memory/briefs/slice-a-gate-first-acceptance-2026-08-03.md`
  - Responsibility: persist architectural decisions for this slice.

## Artifacts To Modify

- `package.json`
  - Add user-facing command(s) for the acceptance-gate helper and test.
- `.github/instructions/04-IMPLEMENT.md`
  - Document when to use an acceptance gate before implementation.
- `.github/skills/deterministic-validation/SKILL.md`
  - Add the acceptance-gate helper as a preferred proof path when no narrow existing test exists.
- `.github/harness/loops/feature-cycle.json`
  - Reference the acceptance-gate step in the outer workflow guidance without making it universal.

## Artifacts Explicitly Not Being Created

- No fusion-harness-style builder/validator subprocess orchestrator in this slice.
- No SSSF-style typed envelope runtime.
- No Windows Pi compatibility patch to external repos.

## Constraints

- Keep the helper project-agnostic.
- Reuse existing `command-validation` logic for any command execution.
- Execute proof commands with `shell: false` from argv arrays only.
- Limit v1 proof executables to the current harness-safe allowlist unless a later brief expands it deliberately.
- Make the acceptance spec readable and hand-editable by operators.
- Keep baseline checks explicit: red is expected before implementation unless the operator marks the task already done.
- Validation output must be concise and deterministic.

## Do-NOTs

- Do NOT make the helper mutate feature code or run implementation work.
- Do NOT accept raw shell strings for executable proof checks in v1.
- Do NOT adopt external session-persistence or TUI assumptions.
- Do NOT require agents to emit typed JSON just to use this feature.
- Do NOT silently treat a green baseline as success; it must surface as already-done or weak-gate suspicion.
- Do NOT widen tool permissions or remove existing review gates.

## Assumptions

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| A small JSON-based acceptance spec is sufficient for first adoption | helper scope | later tasks may need richer artifact types or metadata |
| Existing command-validation rules can be reused or minimally extended for argv-based proof checks | helper execution | overly strict validation could block legitimate local checks; overly loose validation would widen execution unsafely |
| Feature-cycle guidance can mention the helper without causing mandatory-process confusion | docs usability | operators may over-apply it unless wording stays narrow |

## Definition Of Done

- Acceptance-gate helper script exists and supports scaffold + verify + baseline-check flows.
- A deterministic test script proves the helper behavior.
- `package.json` exposes the helper and its test.
- Implement-stage and deterministic-validation guidance mention the helper appropriately.
- Feature-cycle loop guidance references the helper as an optional pre-implementation proof path.

## Architect Challenge

VERDICT: APPROVED
