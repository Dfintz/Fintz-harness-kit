---
name: deterministic-validation
description: Define and enforce objective exit criteria, proof selection, and completion checks. Use when proving a change is done and during loop convergence checks.
---

# Skill: Deterministic Validation

> Use when: A task spans multiple phases, uses subagents or mixed model roles, or could drift if the
> model's self-report is trusted without proof.

Derived from recent radar research and aligned to this repo's harness stage machine.

---

## Objective

Advance work only when objective checks pass. Planning, implementation, and review may be model-led,
but completion is earned by evidence from the environment.

---

## Principles

- **No progress without proof**: a phase is incomplete until its exit check passes.
- **Prefer cheap checks first**: use the narrowest test, lint, typecheck, or file existence check
  that can falsify success.
- **Do not trust self-report**: trust command exit codes, diagnostics, and produced artifacts.
- **Re-plan on failure**: when a check fails, repair locally or return to planning; do not continue
  downstream as if the phase succeeded.

---

## Process

### Step 1 — Define the phase and its exit proof

Before starting a phase, write one sentence for each:

- Phase goal
- Expected artifact or state change
- Deterministic check that proves completion

Examples of valid proof:

- `get_errors` returns no errors for touched files
- A focused test file passes
- A build or lint command exits `0`
- A required file or report exists at the expected path

### Step 2 — Run the phase with scoped checks

Use the harness stage machine normally, but attach a concrete check to each phase:

| Phase      | Typical proof                                     |
| ---------- | ------------------------------------------------- |
| Understand | Relevant files and memory located                 |
| Architect  | Brief persisted with target files and constraints |
| Implement  | Narrow test, lint, or diagnostics pass            |
| Review     | Findings resolved or explicitly accepted by user  |
| Feedback   | Decision recorded in memory, radar, or brief      |

### Step 3 — Stop on failed proof

If the check fails:

1. Repair the same slice if the failure is local and obvious.
2. Re-run the same check.
3. If the failure changes your understanding of the task, step back one phase.

Do not allow downstream phases to consume unverified upstream output.

### Step 4 — Record the proof

For non-trivial work, record the winning check in the brief, run journal, or final summary:

- command or tool used
- result
- what it proved

This creates an audit trail for why the phase was considered complete.

---

## This Repo's Preferred Proof Sources

| Scope              | Preferred proof source                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| Single file change | `get_errors` on touched files                                                          |
| Behavior slice     | Focused Jest or Playwright test                                                        |
| Harness task       | `npm run harness:report`, `npm run harness:grade`, focused loop/report artifact checks |
| Skill docs         | Markdown diagnostics + SkillSpector static scan                                        |
| Multi-file change  | Narrow build/lint/typecheck for touched workspace                                      |

For loop/report/telemetry work specifically:

- use `harness:report` to prove the output appears in the aggregated dashboard path
- use `harness:grade` to prove experiment scoring still works when evaluation surfaces are touched
- use `harness:otel` when the slice changes trace export expectations

---

## Anti-Rationalization Table

| Excuse                               | Counter                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| "The model says it fixed it."        | That is not evidence. Run the check.                                            |
| "I'll validate after the next edit." | No. Validate after each substantive slice or drift compounds.                   |
| "A broad test is good enough."       | Use the cheapest falsifiable check first; broad tests come after.               |
| "The failure is probably unrelated." | If the chosen proof fails, the phase is not complete. Investigate or step back. |

---

## Verification

Deterministic validation is in place when:

- [ ] Every non-trivial phase has an explicit exit check
- [ ] No phase is marked complete on model self-report alone
- [ ] Failed checks trigger local repair or a one-phase rollback
- [ ] Final summary names the proof that justified completion
- [ ] Harness-output changes are verified through the report/grade/otel path when relevant

## Usage Scenarios

### Scenario 1: How do I prove that my code changes are complete?

**What this demonstrates:** Shows objective proof methods and phase exit criteria

### Scenario 2: Tests fail but I think implementation is correct. What now?

**What this demonstrates:** Demonstrates re-plan on failure: identify root cause, never skip checks
