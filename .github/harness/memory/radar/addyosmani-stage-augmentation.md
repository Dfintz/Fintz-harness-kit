---
summary: Addyosmani engineering patterns — proven change-shaping, review sizing, and security heuristics already adopted by sc-fleet-manager but missing from the harness-kit stage instructions
status: rejected
source: https://addyosmani.com/blog/
author_project: Addy Osmani (Google Chrome)
captured: 2026-07-24
tags: [stage-instructions, review, security, implement]
---

# Addyosmani Engineering Patterns — Stage Instruction Augmentation

## Technique Summary

Addy Osmani's public engineering posts document concrete, battle-tested practices for code review sizing (~100 lines good, ~300 OK, ~1000 too large), incremental implementation (risk-first slicing, rollback-friendly change shapes), and security heuristics (STRIDE for new trust boundaries, LLM output as untrusted input per OWASP LLM05). These are not novel research — they are practitioner patterns with broad adoption signals.

## Repository Relevance

The sc-fleet-manager project absorbed these patterns in PR #1146 (v1.1.0 sync, July 20 2026) into its stage instruction files (`03-ARCHITECT.md`, `04-IMPLEMENT.md`, `05-REVIEW-BREADTH.md`). The harness-kit's copies of these same files do not yet have these additions. This is a direct, confirmed gap — the downstream project is ahead of the kit on this content.

Specific deltas confirmed from the PR diff:
- `03-ARCHITECT.md`: Step 6 "Sequence by risk and simplicity" (risk-first slicing + simplicity gate)
- `04-IMPLEMENT.md`: Rule 6 rollback-friendly change shapes; structured Change Summary output contract
- `05-REVIEW-BREADTH.md`: Change sizing heuristics; STRIDE quick lens; OWASP LLM05 lane

## Adoption Notes

- **Target files/domains:**
  - `.github/instructions/03-ARCHITECT.md`
  - `.github/instructions/04-IMPLEMENT.md`
  - `.github/instructions/05-REVIEW-BREADTH.md`
- **Risks/constraints:** These are additive augmentations — no existing content is removed. Low risk. The exact text used in sc-fleet-manager is available for reference.
- **Next step:** Implement stage — apply the same additive augmentations to the three instruction files, validate with `npm run harness:docs:check`.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture — confirmed delta vs sc-fleet-manager v1.1.0 | radar-pass |
| 2026-07-24 | adopted | All adoption gates pass: concrete problem (kit lags fleet by 3 instruction augmentations), target files named, additive-only change, routes through Implement only (no Architect needed for additive text). Next: apply augmentations to 03/04/05-*.md and validate with harness:docs:check. | radar-pass |
| 2026-07-24 | rejected | On inspection all three files (03-ARCHITECT.md, 04-IMPLEMENT.md, 05-REVIEW-BREADTH.md) already contain the addyosmani augmentations. The kit was already in sync with sc-fleet-manager. No action needed. | implement-pass |
