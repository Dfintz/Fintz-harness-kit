---
name: wait-what
description: Optional user-invoked re-pitch guidance for unclear responses. Use only when the user asks to re-explain or simplify a previous answer.
---

# Skill: wait-what (Pilot)

Use this only when the user explicitly asks for a clearer re-pitch of the previous answer.

## Intent
- Reframe one prior response in simpler wording without dropping technical correctness.
- Keep it brief and practical.

## Rules
- User-invoked only.
- Never auto-invoke.
- Do not change stage contracts, findings requirements, or safety constraints.
- Preserve required evidence and file references when re-pitching technical content.

## Output shape
1. One-sentence context reset.
2. Plain-language explanation.
3. Immediate next action if applicable.
