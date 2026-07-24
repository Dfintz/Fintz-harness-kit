---
summary: superpowers "your human partner" language — deliberate terminology choice that shapes agent behavior differently from "the user"
status: parked
source: https://github.com/obra/superpowers/blob/main/CLAUDE.md
author_project: obra (Jesse Vincent, Prime Radiant)
captured: 2026-07-24
tags: [agent-behavior, terminology, human-in-the-loop]
---

# Superpowers: "Your Human Partner" Terminology

## Technique Summary

Superpowers deliberately uses "your human partner" instead of "the user" throughout all skill content. This is not stylistic — the CLAUDE.md explicitly states this is intentional and that PRs changing "human partner" to "user" will be rejected without evidence. The theory is that "partner" shapes agent behavior differently: it implies the human has domain knowledge to defer to, a reputation at stake, and is collaborating rather than commanding. This affects how agents handle uncertainty, disagreements, and when to escalate.

## Repository Relevance

The harness-kit uses "the user" throughout HARNESS.md, loop definitions, and skills. Changing this systemically would be a broad sweep. However, the concept is worth noting — particularly for the loop `fixPrompt` and guardrails where agent posture toward the human matters.

## Adoption Notes

- **Target files/domains:** Potentially HARNESS.md, loop guardrails, stage instructions
- **Risks/constraints:** Would be a very broad change affecting dozens of files. Benefit is theoretical without harness-specific eval evidence. superpowers itself has 11 platform integrations and real-world usage to back this up; the harness-kit doesn't.
- **Next step:** Park until eval evidence exists. If adding a new loop or skill, prefer "human partner" in that new content to test the concept locally first.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from superpowers cherry-pick pass | radar-pass |
| 2026-07-24 | parked | Broad change with uncertain benefit without local eval evidence. Adopt incrementally in new content only. | architect-pass |
