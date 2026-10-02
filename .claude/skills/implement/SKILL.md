---
name: implement
description: Runs the harness Implement stage, delivering the change an Architecture Brief describes with proof and self-review artifacts. Use when a Brief is settled, or for hotfixes and narrow bug fixes via the surgical variant.
---

# /implement

This is the Claude adapter for the harness **Implement** stage.

The canonical contracts live in:

- [`04-IMPLEMENT.md`](../../../.github/instructions/04-IMPLEMENT.md)
- [`04.5-SURGICAL-IMPLEMENT.md`](../../../.github/instructions/04.5-SURGICAL-IMPLEMENT.md)

Use the surgical variant when the task is a hotfix, narrow bug fix, backport, or other minimal-diff
change where blast radius matters more than cleanup.

## Required inputs

- task packet
- `architecture-brief.md` for non-trivial work
- touched artifacts and relevant domain skills
- the narrowest validation route that proves the change

## Required outputs

- `implementation-notes.md`
- artifact kind: **implementation-summary**
- if surgical: include the blast-radius note required by `04.5-SURGICAL-IMPLEMENT.md`

## Procedure

1. Run the context sufficiency check and Brief confirmation first.
2. Reuse existing patterns before inventing new ones.
3. Implement in small verifiable slices.
4. **Produce implementation deliverables with proof validation**: Prefer shipped proof surfaces when
   available (`graph`, MCP wrappers, `report`, `grade`, `otel`, tests, lint, build, dry-runs).
   Implementation is not complete until proof exists.
5. **Record artifacts**: proof summary, self-review summary, and implementation notes — not just narrative.

---

## Model routing

After this skill, load the adapter for the model executing it: `skillRouting.implement` in
`npm run harness:route -- --task "<task>" --json`. Adapters live in `.github/harness/skill-adapters/`.

---

## Handoff contract

- Downstream consumers: Review Breadth, Review Depth, Feedback
- Hand off the implemented change plus `implementation-notes.md`, not just "code is done."

## Approval contract

Stop and get explicit human approval before widening `allowed-tools`, removing an approval step,
weakening a guardrail, or changing a destructive workflow default.

