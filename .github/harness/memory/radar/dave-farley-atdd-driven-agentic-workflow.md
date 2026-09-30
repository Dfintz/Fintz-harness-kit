---
summary: Use acceptance tests (ATDD/BDD) as the executable spec that drives and constrains an AI coding agent, instead of freeform prompting
status: adopted
source: https://www.youtube.com/watch?v=hlxeiSzde5A
author_project: Dave Farley — Modern Software Engineering (YouTube)
captured: 2026-09-29
tags: [atdd, bdd, agentic-coding, acceptance-testing, deterministic-validation, architect-stage]
---

# ATDD-Driven Agentic Workflow (Acceptance Tests as AI Prompts)

## Technique Summary

Video: "Automating Agentic AI Success Using This SECRET Workflow" (Dave Farley / Modern Software
Engineering, 16:49, ~16K views). Thesis per title/description: as AI agents take over
implementation detail, the developer's role shifts to being an "explorer of problems" — defining
precise, executable specifications rather than writing code by hand. The pinned comment ties this
directly to Dave Farley's ATDD course, describing the workflow as: (1) write acceptance tests that
act as precise AI prompts, (2) build a DSL-driven feedback loop that keeps the AI's code on track,
(3) replace prompt guesswork with executable specifications — positioned as "the missing layer
between vibe coding and software that actually works."

**Caveat:** captured from title, description, and pinned comment only — the automated fetch tools
in this environment could not retrieve the full transcript (YouTube blocked scripted content
fetch/transcript access). The technique summary above should be treated as directionally accurate
but not verified against the full video content.

## Repository Relevance

This harness already separates Architect (spec/brief) from Implement (execution) and uses
`deterministic-validation` to define objective exit criteria before work is considered done. The
ATDD framing adds a concrete idea worth checking against current practice: treating acceptance
tests/executable specs as the *primary interface* to the coding agent (a stronger, testable form of
an Architecture Brief), rather than a check that happens after implementation.

## Adoption Notes

- **Target files/domains:** `.github/skills/architect/`, `.github/skills/deterministic-validation/`,
  `.github/skills/prototype/` — specifically whether Architecture Briefs should mandate acceptance
  scenarios/executable specs as a required section before Implement starts.
- **Risks/constraints:** Requires the target project to have a testable acceptance-test harness
  (DSL/BDD framework) already, or the "prompt" benefit doesn't materialize. Risk of adding process
  overhead to trivial tasks — the harness already gates Architect stage to non-trivial work, so this
  should stay scoped there. Source could not be fully verified (see caveat above); treat as a lead,
  not a confirmed practice, until the transcript or a written source is reviewed.
- **Next step:** Shipped narrow slice done (see Brief below). The unverified, full-video-only
  mechanics (concrete DSL/feedback-loop details) remain un-adopted; re-open this entry if a
  transcript or written source surfaces and describes something beyond acceptance-first sequencing.
- **Shipped:** `.github/harness/memory/briefs/dave-farley-atdd-acceptance-first-architect-2026-09-29.md`
  — added advisory acceptance-first validation guidance to `03-ARCHITECT.md` Step 4 and the
  Validation plan output contract, plus a cross-reference from `deterministic-validation`. No new
  tooling; reuses the existing `acceptance-gate.mjs` scaffold/baseline/verify lifecycle.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-29 | candidate | Initial capture from title/description/pinned comment; full transcript unavailable via automated tools | Copilot |
| 2026-09-29 | adopted | Routed through Understand -> Architect -> Architect Challenge (APPROVED) -> Implement; shipped the narrow acceptance-first sequencing slice only | Copilot |
