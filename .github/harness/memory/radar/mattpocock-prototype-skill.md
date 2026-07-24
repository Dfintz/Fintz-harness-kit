---
summary: mattpocock/prototype — LOGIC branch: throwaway TUI to validate state models before committing to an Architecture Brief
status: adopted
source: https://github.com/mattpocock/skills/blob/main/skills/engineering/prototype/SKILL.md
author_project: mattpocock
captured: 2026-07-24
tags: [architect, prototype, design, skill]
---

# Prototype: Logic Branch for Architecture Validation

## Technique Summary

The mattpocock `prototype` skill has two branches: LOGIC (throwaway terminal TUI to validate state machines and data models) and UI (multiple UI variants on a single route). The LOGIC branch answers "does this state model handle the edge case where X then Y?" by building a tiny interactive terminal app that pushes the state machine through cases that are hard to reason about on paper. Rules: throwaway from day one, one command to run, pure logic module isolated from TUI, no tests/persistence/polish, capture validated decision and commit prototype to a throwaway branch.

## Repository Relevance

The harness's Architect stage uses the "simplicity gate" (what is the simplest thing that could work?) but has no mechanism to *validate* a design before writing the Brief. For uncertain state machine designs or data model decisions, building a 30-line TUI is cheaper than writing a wrong Brief. This fills the gap between "design on paper" and "commit to implementation." The LOGIC branch is kit-agnostic (pure terminal, any language).

## Adoption Notes

- **Target files/domains:**
  - New `.github/skills/prototype/SKILL.md` — LOGIC branch only at this stage
  - Optional: reference in `.github/instructions/03-ARCHITECT.md` Step 2 (map current shape) as an optional gate
- **Risks/constraints:** New skill file. UI branch excluded (framework-specific). SkillSpector scan: service is a documentation pattern, no executable code in the skill file itself — waiver not required.
- **Next step:** Implement stage — create the skill file.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from mattpocock/skills pass | radar-pass |
| 2026-07-24 | adopted | New skill, clear local application (Architect pre-decision gate), LOGIC branch is kit-agnostic, UI branch excluded as out-of-scope. | architect-pass |
