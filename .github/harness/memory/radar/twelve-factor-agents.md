---
summary: 12 Factor Agents — HumanLayer's operating principles for production agents (explicit prompts, state ownership, clean pause-resume, bounded context)
status: parked
source: https://www.humanlayer.dev/blog/12-factor-agents
author_project: HumanLayer
captured: 2026-07-24
tags: [agent-design, production, state-management, context, pause-resume]
---

# 12 Factor Agents

## Technique Summary

HumanLayer's "12 Factor Agents" adapts the 12-Factor App methodology for production AI agents. Key principles relevant to harness design:
- **Explicit prompts** — prompts are stored in source control, not generated dynamically from logic
- **State ownership** — agent state lives in the harness, not inside the model's context
- **Clean pause-resume behavior** — agents can stop and restart without losing progress
- **Bounded context** — each agent invocation is given exactly the context it needs, no more
- **Separating concerns** — planning, execution, and verification are distinct phases

## Repository Relevance

Several of these principles are already in the harness-kit (loop journal for resume, Architecture Brief for state, explicit loop JSON for prompt structure). The principles that are NOT yet explicit in the harness docs:
- **State ownership**: the harness already owns state via journals, but it's not documented as a design principle
- **Explicit prompts in source control**: loop JSON fixPrompts are in source control, but this principle isn't stated
- These could enrich the HARNESS.md "Operating Protocol" section

## Adoption Notes

- **Target files/domains:** `.github/harness/HARNESS.md` — could add 1-2 principles to Operating Protocol
- **Risks/constraints:** Need to read the full article before adopting specific wording. The article is a blog post, not a spec.
- **Next step:** Read the full 12 Factor Agents article, compare each factor against the current harness Operating Protocol, adopt only factors that fill genuine gaps (not just rename what already exists).

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from walkinglabs/awesome-harness-engineering | radar-pass |
| 2026-07-24 | parked | Several factors already covered by the harness. Need to read the full article to identify specific gaps. Park until article is read and compared factor-by-factor. | radar-pass |
