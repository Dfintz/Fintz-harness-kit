---
summary: Draw an "independence line" above validation steps, assert ran-count not just pass-count, and mutation-test the harness's own gate scripts
status: adopted
source: https://github.com/coleam00/skills/tree/main/.claude/skills/build-dark-factory
author_project: coleam00/skills
captured: 2026-08-16
tags: [validation, deterministic-validation, mutation-testing, self-audit]
---

# Validation Harness: Independence Line + Empty-Is-Not-Pass + Self-Mutation Audit

## Technique Summary

`build-dark-factory`'s validation-harness component names three ideas worth separating from its
autonomy premise: (1) draw an **independence line** after integration tests — everything below the
line is inside the coding agent's own optimization loop, so more of those tests alone is not proof
of correctness; (2) **empty is not pass** — a gate must assert *how many checks ran*, not just how
many failed, because a skipped/empty check silently returns "no failures" and that is not success;
(3) the validation harness's own scripts need a **self-mutation audit** — reintroduce a known-fixed
defect into a throwaway copy and require the test suite to go red, because a check that stays green
with the defect restored is decoration, not a gate.

## Repository Relevance

`deterministic-validation` (this repo's own skill) already states "no progress without proof" and
gives a verification gate function, but it does not yet name the independence-line distinction
(agent-optimized checks vs. independent checks) or require an explicit ran-count assertion, and this
repo's own gate scripts (`acceptance-gate.mjs`, `command-validation.mjs`, doc-check scripts) have no
documented self-mutation audit analogous to `scripts/_test_factory_doctor.py --mutate` in the source
skill. This is a direct, low-risk strengthening of a skill we already maintain.

## Adoption Notes

- **Target files/domains:** `.github/skills/deterministic-validation/SKILL.md` (add a subsection);
  optionally `scripts/harness/acceptance-gate.mjs` and other gate scripts later, if a concrete
  ran-count or mutation-audit gap is found in them.
- **Risks/constraints:** none for the doc-only addition. A future mutation-audit script for our own
  gate scripts would need its own Understand/Architect pass (it is new tooling, not documentation).
- **Next step:** land the doc-only subsection in this same pass (see the
  `coleam00-skills-radar-deep-dive-2026-08-16` brief's Implement stage). Treat a self-mutation audit
  script for `acceptance-gate.mjs`/`command-validation.mjs` as a separate, later task if pursued.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-16 | adopted | Concrete, bounded, doc-only next step identified; lands in this same pass. | radar-pass |
