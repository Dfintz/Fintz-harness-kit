---
summary: "Review depth - radar deep dive on Harness-R1, bholmesdev/skills, book-to-skill"
type: brief
status: implemented
source: review
created: 2026-08-09
updated: 2026-08-09
tags: [radar, review-depth, external-techniques]
artifact_family: review
immutability: mutable
---

# Review Depth: Radar Deep Dive — Harness-R1, bholmesdev/skills, book-to-skill

resource: .github/harness/memory/briefs/radar-external-repo-deep-dive-2026-08-09.md, .github/skills/ai-techniques-radar/SKILL.md, .github/harness/memory/radar/README.md

- **Date:** 2026-08-09
- **Run ID:** run-20260809130244-170154b8

## Gate verdicts

| Gate | Verdict | Evidence |
|---|---|---|
| Ownership | Pass | External-idea decisions belong in `radar/`; the routing record belongs in `briefs/`. Nothing was written to `lessons/`, which holds a different kind of memory. |
| Boundary | Pass | Additive files only. No script, instruction, skill, or config file was modified. |
| Reuse | Pass | Entries use the existing `_template.md` structure and the `technique-triage` decision vocabulary. No new format was invented. |
| Adoption gate | Pass | Each of the four `adopted` entries names a current harness problem, specific target files, and a bounded next step, and is routable through Understand → Architect. |
| SkillSpector gate | Pass (N/A recorded) | Both skill-derived entries state explicitly that no external skill file is vendored or executed, and that a scan becomes mandatory if one ever is. |
| Brief conformance | Pass | The eight entries and their statuses match the brief's decision table exactly. |

## Structural findings

**D1 — Duplicate-idea check against existing radar.** `harness-r1-matched-baseline-rerun-scoring`
was checked against `harness-evolver-meta-harness.md`, which is the nearest existing entry. They are
distinct: the existing entry concerns isolation and parallel proposers, the new one concerns
comparison validity. The new entry cross-references it, per architect-challenge condition C2.

**D2 — Rejections carry reasons, not just verdicts.** Both `rejected` entries state why in terms of
this repository's constraints (no fine-tunable target and target-coupling for one; existing
capability plus credential-handling posture for the other) rather than generic dismissal. This is
what stops a future radar pass from re-opening them.

**D3 — Splitting granularity is correct.** Harness-R1 was split into four entries rather than one
because the four ideas have genuinely different adoption paths — two adopted with different target
files, one parked pending data, one rejected outright. Collapsing them would have forced a single
status onto ideas with different verdicts.

**D4 — One residual weakness.** Three entries assert a verified gap based on a keyword search of a
single file. The searches were run and returned empty, but a keyword search is weaker evidence than
reading the whole surface. The Architect stage of each follow-up task must re-confirm the gap before
editing. Non-blocking; noted so it is not forgotten.

## Verdict

**PASS** — no structural defects. D4 is carried forward as a condition on the follow-up tasks.
