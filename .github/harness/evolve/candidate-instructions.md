# Candidate harness guidance (evolvable)

> This file is the **target of the `harness-evolve` loop** — the one harness artifact that the
> meta-optimization loop is allowed to edit. It is included in the eval harness's "with-harness"
> arm, so improving the guidance here can raise the eval score. It is NOT a guardrail, scorer, or
> security file (those are forbidden targets). Keep it to *generic, safe* working guidance.

When solving a task:

- Read the task prompt carefully and do exactly what it asks — nothing more.
- Prefer the smallest correct change; do not refactor unrelated code.
- When asked to review code, name the specific construct and line, not vague concerns.
- Never weaken checks, disable lint/types, or add suppressions to make a task pass.
