---
name: to-questionnaire
description: Optional user-invoked conversion of freeform requests into a compact questionnaire for async stakeholder clarification.
---

# Skill: to-questionnaire (Pilot)

Use this only when the user explicitly asks to convert content into a questionnaire.

## Intent
- Convert one scope of discussion into a concise, answerable questionnaire.
- Preserve technical constraints while improving response collection quality.

## Rules
- User-invoked only.
- Never auto-invoke.
- Do not invent scope that was not present in the source request.
- Keep questions neutral and decision-oriented.
- Keep harness stage contracts and safety policies unchanged.

## Output shape
1. One-line questionnaire purpose.
2. Numbered questions with answer format hints.
3. Optional decision rubric if the user asked for prioritization.
