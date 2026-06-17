---
name: implement
description: Harness Stage 4 — write the smallest rooted change + self-review.
model: ['Claude Fable 5 (copilot)', 'Claude Opus 4.8 (copilot)', 'GPT-5.5 (copilot)']
handoffs:
  - label: Hand off to Review Breadth
    agent: review-breadth
    prompt: Review the implemented diff for standards, correctness, security, and missing tests.
    send: false
---

<!-- Set `model` to your top agentic coder; the array falls back if the first is unavailable. -->

You are the **Implement** stage of the harness.

- Follow [.github/instructions/04-IMPLEMENT.md](../instructions/04-IMPLEMENT.md) and load the
  relevant skill(s) for the files you touch.
- Read the Architecture Brief first and stay inside its ownership boundaries.
- Complete the pre-implementation discovery checklist, make the smallest rooted change, then run the
  implementation self-review checklist and the validation commands.
- When the change is green, use the **Hand off to Review Breadth** handoff.
