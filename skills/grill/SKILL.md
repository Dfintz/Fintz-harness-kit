---
name: grill
description: >-
  Alignment-first interrogation that closes the gap between what a human wants and what the agent
  builds, BEFORE planning or code. The agent relentlessly interviews the user one question at a time
  until every branch of the decision tree is resolved, challenges the plan against the project's
  shared language (CONTEXT.md) and prior decisions (ADRs), and records new terminology and hard
  decisions inline. Pairs with the harness stage machine (grill → Architect Brief → plan-review →
  Implement). USE WHEN the user asks to grill me, interrogate the plan, align before building, pin
  down requirements, resolve ambiguity, build a shared language / glossary, write or update an ADR,
  or says "I'm not sure exactly what I want yet."
---

# Grill — Alignment Before Implementation

The most common failure in AI-assisted work is **misalignment**: the agent builds something that
technically runs but isn't what the user meant. The fix is to surface the disagreement *before* a
plan is locked or code is written — by interviewing the user until the ambiguity is gone, in the
language of the project.

This skill is the front-end of the harness workflow. It feeds the
[Architect stage](../../.github/instructions/03-ARCHITECT.md): grilling produces the requirements and
decisions an Architecture Brief needs, and the resulting plan is then hardened by the
[`plan-review`](../../.github/harness/loops/plan-review.json) cross-model loop before Implement.

> Adapted from Matt Pocock's `grill-me` / `grill-with-docs` skills (MIT). See
> [`CREDITS.md`](../../CREDITS.md).

## When this skill applies

- The request is ambiguous, large, or underspecified ("build me a …", "improve the …").
- You're about to write an Architecture Brief or a `PLAN.md` and want it grounded in real intent.
- The codebase has jargon the agent keeps getting subtly wrong (build a shared language).
- A non-obvious decision is being made that a future session will need the *why* for (write an ADR).

Trivial, unambiguous one-file changes don't need a grilling — go straight to Implement.

## The grilling procedure

1. **One question at a time.** Ask a single, specific question, wait for the answer, then ask the
   next informed by it. Never dump a numbered list of ten questions — that offloads synthesis back
   onto the user and defeats the purpose.
2. **Walk the decision tree, depth-first.** Each answer opens or closes branches. Resolve a branch
   fully before moving to a sibling. Track which branches are still open.
3. **Challenge, don't transcribe.** When an answer conflicts with the existing domain model
   (`CONTEXT.md`), a prior decision (an ADR), or itself, surface the conflict and ask which wins —
   don't silently encode the contradiction.
4. **Prefer concrete over abstract.** Replace "should be fast" with "p95 under 200ms for the list
   endpoint"; replace "handle errors" with the specific failure modes and their expected behaviour.
5. **Name the cost of each choice.** When the user picks an option, state the trade-off you're
   accepting so it's a deliberate decision, not an accident.
6. **Stop when the tree is resolved.** When no open branch would change the design, summarize the
   locked requirements and decisions. Don't pad with confirmatory questions whose answer can't move
   the build.

## Outputs (record as you go)

- **Requirements** — the resolved decision tree, concrete and testable. This is the raw material for
  the Architecture Brief / `PLAN.md`.
- **`CONTEXT.md` (shared language)** — when a term is ambiguous or project-specific, add it to the
  project's `CONTEXT.md` glossary so the agent (and future sessions) name things consistently. A
  shared language makes the codebase easier to navigate and cuts token spend on re-explaining jargon.
  Template: [`templates/CONTEXT.template.md`](../../.github/harness/templates/CONTEXT.template.md).
- **ADRs (decision records)** — when a hard-to-explain or contested decision is made, capture it as a
  short Architecture Decision Record (context → decision → consequences) under `docs/adr/`. Template:
  [`templates/adr.template.md`](../../.github/harness/templates/adr.template.md).

## How it composes with the harness

```
grill (align on WHAT, build shared language, record decisions)
  → Architect Brief / PLAN.md (the plan)
  → plan-review loop (a rival-provider model hardens the plan, read-only, bounded)
  → Implement → Review → Feedback
```

Grilling resolves the gap between the **user and the agent**; the `plan-review` loop resolves the gap
between the **agent and the quality of its own plan** (a second model catches what the first can't see
in itself). Use both before writing code on anything non-trivial.

## Guardrails

- One question at a time — never batch the interview into a wall of questions.
- Do not start implementing mid-grill; alignment first, code after the tree is resolved.
- Record decisions where the *next* session will find them (`CONTEXT.md`, `docs/adr/`), not only in
  the chat transcript that will be compacted away.
- A grilling session is not a rubber stamp — if an answer reveals the plan is wrong, change the plan.
