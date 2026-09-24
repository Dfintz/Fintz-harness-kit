---
summary: "sruja" (sruja-ai/sruja) — a CLI coding agent whose core design rule is "the actor never grades itself": every edit is checked by an independent deterministic grader (drift, lint, verify-task, intent) before shipping, in a closed comprehend->plan->execute->critique->replan loop.
status: parked
source: https://github.com/sruja-ai/sruja
author_project: sruja-ai/sruja
captured: 2026-09-23
tags: [deterministic-validation, independence-line, harness, grading]
---

# sruja: actor-never-grades-itself closed-loop grading

## Technique Summary

`sruja` is a Rust CLI autonomous coding agent that enforces a strict separation between the
agent that edits code (the "actor") and the component that judges the edit (an "independent
deterministic grader"). Its grader checks four named categories — drift (does the change match
repo topology/architecture), lint, verify-task (does it satisfy the task), and intent (does it
match what was asked) — and the agent only proceeds through a fixed
comprehend -> plan -> execute -> critique -> replan loop when the grader, not the actor, signs off.

## Repository Relevance

This is independent, real-world corroboration of two ideas already in this radar/skill set: the
`coleam00-dark-factory-validation-independence-line` entry's "independence line" (validation must
sit outside the agent's own optimization loop) and this repo's `deterministic-validation` skill's
"no progress without proof." `sruja`'s four named grader categories (drift/lint/verify-task/intent)
are a concretely different, useful taxonomy from what this repo's gate scripts currently name
explicitly, and its "actor never grades itself" framing is a crisper one-line summary of the same
constraint this repo already enforces less explicitly.

## Adoption Notes

- **Target files/domains:** `.github/skills/deterministic-validation/SKILL.md` (optional: adopt the
  drift/lint/verify-task/intent category naming, and the "actor never grades itself" framing, as
  vocabulary — not new tooling).
- **Risks/constraints:** none for a vocabulary/framing borrow; this repo's actual gate scripts
  already implement something like this informally, so this is a naming/clarity improvement, not
  new functionality.
- **Next step:** if `deterministic-validation/SKILL.md` is next revised, consider borrowing the
  "actor never grades itself" one-line framing and the four-category grader taxonomy as a
  documentation clarity improvement. Not urgent enough to justify its own task today.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | parked | Useful vocabulary/framing corroboration for existing adopted independence-line idea; no new tooling gap identified | copilot |
