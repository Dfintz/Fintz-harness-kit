---
name: architect
description: Run the Architect stage. Use when a non-trivial task needs a settled Architecture Brief before implementation.
---

# /architect

This is the Claude adapter for the harness **Architect** stage.

The canonical contract lives in [`03-ARCHITECT.md`](../../../.github/instructions/03-ARCHITECT.md).
Follow that file as the source of truth; this skill exists so Claude surfaces use the same contract
and artifact handoff.

## Required inputs

- task packet from Understand
- repository standards and relevant domain skills
- prior memory and graph context
- any existing brief for the area

## Required output

- `architecture-brief.md`
- artifact kind: **architecture-brief**

## Procedure

1. Run the context sufficiency check from `03-ARCHITECT.md` before planning.
2. Map the current owner, neighboring artifacts, reuse patterns, and validation surfaces.
3. Run gates 1-5, and gate 4b whenever safety, permissions, tenancy, secrets, or destructive actions
   are involved.
4. Produce an **Architecture Brief** with scope, artifacts, decisions, constraints, validation plan,
   and assumptions.
5. Persist the Brief to `.github/harness/memory/briefs/` when implementation will proceed.

## Handoff contract

- Downstream consumers: Implement, Review Breadth, Review Depth, Feedback
- Do not hand off a vague plan. Hand off a settled Brief artifact.

## Approval contract

Do not auto-approve any architecture that widens tool permissions, weakens guardrails, or changes a
destructive default without explicit human approval.
