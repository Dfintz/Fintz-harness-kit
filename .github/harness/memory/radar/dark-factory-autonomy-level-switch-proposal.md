---
summary: Proposal to resolve the "Dark Factory" tension (autonomy vs. human-review gate) with a config-gated, off-by-default autonomy-level switch, instead of leaving it as an all-or-nothing rejected whole-skill idea.
status: parked
source: internal-synthesis (derived from coleam00/skills build-dark-factory entries already in this radar)
author_project: harness-kit (self)
captured: 2026-09-23
tags: [autonomy, dispatcher, governance, dark-factory, harness]
---

# Dark Factory Switch: config-gated autonomy-level opt-in

## Technique Summary

`coleam00-dark-factory-overview` (rejected, whole-skill) names a five-level autonomy dial
(0 = manual through 5 = factory writes its own issues) and treats level 3+ (auto-merge on green
gates) as its target — which this harness rejected wholesale because it conflicts with the
default human-review-gate stance. Three of its sub-ideas were still adopted or parked on their
own merits: the protected-governance-files gate (adopted, warn-by-default via
`protected-path-guard.mjs`), the validation-independence-line + self-mutation-audit strengthening
(adopted, doc-only), and the dispatcher priority-order rule (parked, no dispatcher exists yet).
This entry proposes making the *level* itself a first-class, explicit, config-driven switch —
defaulting to the harness's current level (effectively level 1-2: bounded loops with a human
Feedback gate) — so that a specific, narrow, already-adopted-guardrail-backed slice of higher
autonomy (e.g., unattended `harness-evolve` runs, or auto-triage without auto-merge) could be
opted into deliberately and audibly, without re-litigating the whole rejected premise every time.

## Repository Relevance

The repo already has the individual guardrails a higher-autonomy mode would need
(`protected-path-guard.mjs`, deterministic-validation's independence-line addition, bounded loop
JSON contracts, `git-guard.mjs`) but no single, named, config-surfaced "autonomy level" that ties
them together as prerequisites for unlocking more autonomous behavior. Today the choice is
implicitly binary per script/loop rather than an explicit, inspectable dial. Naming it explicitly
would let a future decision ("should `harness-evolve` run merges unattended overnight in this one
repo") be a config toggle with named prerequisites, rather than a bespoke one-off exception.

## Adoption Notes

- **Target files/domains:** `harness.config.json` (new `governance.autonomyLevel` field, default
  `0`/current behavior), `.github/harness/HARNESS.md` (document the level meanings and required
  guardrails per level), `scripts/harness/harness-evolve.mjs` (first candidate consumer, gated
  behind an explicit opt-in level rather than always running at current behavior).
- **Risks/constraints:** this is exactly the kind of decision the repo's own operational-safety
  rules require a human to gate — do not implement any level above current default without an
  explicit user request and an Architect pass; risk of the switch becoming an unused, decorative
  config knob if no consumer script ever reads it; must not weaken `protected-path-guard.mjs`'s
  default warn/strict behavior as a side effect of adding levels.
- **Next step:** do not implement. If/when the user wants to pursue this, route through
  Understand -> Architect as its own task, scoped to exactly one consumer (`harness-evolve.mjs`
  unattended-merge is the most concrete candidate) rather than building a generic N-level dial
  up front.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | candidate | Synthesized from existing rejected/adopted/parked dark-factory entries at user's request; explicitly not implemented, needs Architect pass if pursued | copilot |
| 2026-09-23 | parked | Triage pass: no current repo problem forces this — `harness-evolve.mjs` does not run unattended merges today, so there is nothing for a level switch to gate yet. Matches sibling `coleam00-dark-factory-dispatcher-priority-order` (also parked on the same precondition). Re-surface only on explicit user request to pursue unattended `harness-evolve` merges, then route through Understand -> Architect. | technique-triage |
