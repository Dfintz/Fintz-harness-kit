---
summary: mattpocock/codebase-design DESIGN-IT-TWICE — parallel sub-agents design the same interface radically differently, compare on depth/locality/seam placement
status: adopted
source: https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md
author_project: mattpocock
captured: 2026-07-24
tags: [architect, codebase-design, interface-design, parallel-agents]
---

# DESIGN-IT-TWICE: Parallel Interface Exploration

## Technique Summary

From codebase-design's DESIGN-IT-TWICE procedure: "spin up parallel sub-agents to design the interface several radically different ways, then compare on depth, locality, and seam placement." The point is that the first interface design is almost never the best — making two radically different designs forces explicit comparison rather than incremental refinement of the first idea.

## Repository Relevance

The harness's Architect stage Gate 5 (Reuse) asks "is this the first occurrence of the pattern?" but doesn't address how to pick the right interface when two approaches are plausible. Adding DESIGN-IT-TWICE as an optional procedure under Gate 5 gives agents a concrete mechanism to escape first-idea anchoring on uncertain design decisions.

## Adoption Notes

- **Target files/domains:**
  - `.github/instructions/03-ARCHITECT.md` Gate 5 — add optional DESIGN-IT-TWICE procedure
- **Risks/constraints:** "Optional procedure" framing prevents over-application. Additive text.
- **Next step:** Implement stage — add optional procedure block under Gate 5.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from mattpocock/skills pass | radar-pass |
| 2026-07-24 | adopted | Fills confirmed gap in Architect stage. Additive. Maps cleanly to Gate 5. | architect-pass |
