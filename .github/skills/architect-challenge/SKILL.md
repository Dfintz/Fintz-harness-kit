---
name: architect-challenge
description: Review and challenge an Architecture Brief before implementation. Returns APPROVED, REVISE, or BLOCKED verdict.
---

# /architect-challenge

Independently challenge a proposed Architecture Brief and return a clear verdict.

Use this skill to pressure-test an `architecture-brief.md` before implementation proceeds.

## Objective

Return a concise verdict with reasoning:

- `APPROVED` — Brief is sound, safe, and ready for implementation
- `REVISE` — Brief needs specific changes before approval
- `BLOCKED` — Brief has critical issues blocking implementation

## Required inputs

- `architecture-brief.md` (proposed brief to challenge)
- relevant supporting files cited by the brief
- any known constraints or approval boundaries
- stage context (what changed, why)

## Required output

- `.github/harness/memory/reviews/architect-challenge-verdict.md` with:
  - verdict (one of APPROVED, REVISE, BLOCKED)
  - evidence (reasoning for the verdict)
  - required revision or unblock step (smallest next action)

## Procedure

1. **Check ownership & boundaries**: Re-verify owner assignments, boundary specifications, and artifact flow.
2. **Verify reuse assumptions**: Confirm proposed reuse is correct and safe.
3. **Identify unsafe assumptions**: Look for missing context, unclear tenancy, or unvalidated dependencies.
4. **Scan capability-expanding changes**: Flag any decisions that widen tool permissions or weaken guardrails — these need explicit human approval.
5. **Return verdict** with evidence and smallest required next step.

## Verdicts

| Verdict | Meaning | Next Step |
|---------|---------|-----------|
| `APPROVED` | Brief is sound and ready | Proceed to Implement |
| `REVISE` | Specific issues to fix | Return to Architect with feedback |
| `BLOCKED` | Critical blocker | Address blocker, then return to Architect |

## Handoff contract

- Upstream: Architect (input brief)
- Downstream: Implement (if APPROVED), Architect (if REVISE/BLOCKED)
- Do not proceed to implementation without APPROVED verdict
