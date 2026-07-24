---
summary: mattpocock/diagnose — add "build red-capable feedback loop FIRST" as a missing invariant in the diagnose loop and doubt-driven-development skill
status: adopted
source: https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md
author_project: mattpocock
captured: 2026-07-24
tags: [diagnose, loop, debugging, doubt-driven]
---

# Diagnosing-Bugs: Feedback-Loop-First Invariant

## Technique Summary

The mattpocock `diagnosing-bugs` skill opens with a single non-negotiable rule: "build a tight red-capable feedback loop FIRST. No hypothesis before you have a command that can go red on this specific bug." The 6-phase protocol (loop → reproduce/minimize → hypothesize → instrument → fix → cleanup) exists to enforce this discipline. The critical insight is that jumping straight to hypothesis is the failure mode — the skill explicitly says "if you catch yourself reading code to build a theory before this command exists, STOP."

## Repository Relevance

The harness `diagnose` loop (`loops/diagnose.json`) is a workflow kind with a `fixPrompt` that doesn't enforce the feedback-loop-first discipline. An agent can follow it and still jump straight to reading code and guessing. The `doubt-driven-development` skill also lacks this rule. Adding the feedback-loop-first guardrail to both surfaces directly improves how agents use the diagnose loop.

## Adoption Notes

- **Target files/domains:**
  - `.github/harness/loops/diagnose.json` — add guardrail: "No hypothesis before a red-capable command exists"
  - `.github/skills/doubt-driven-development/SKILL.md` — add feedback-loop-first procedure
- **Risks/constraints:** Additive text only. No code changes.
- **Next step:** Implement stage — add one guardrail line to diagnose.json fixPrompt, add one procedure block to doubt-driven-development skill.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from mattpocock/skills pass | radar-pass |
| 2026-07-24 | adopted | Fills a confirmed gap in diagnose loop. Additive. Provenance clear. | architect-pass |
