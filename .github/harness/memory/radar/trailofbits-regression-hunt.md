---
summary: Trail of Bits regression-hunt separates discovery, reproduction, replay, and adjudication; evaluate its evidence contract without installing the plugin.
status: parked
source: https://github.com/trailofbits/skills/tree/196a9073ab10d35bacf111f945e02c00b2c6883a/plugins/regression-hunt
author_project: Trail of Bits / skills
captured: 2026-10-23
tags: [external-skill, regression-testing, review, evidence, provenance]
---

# Trail of Bits Regression Hunt

## Technique Summary

The upstream plugin assigns regression discovery, reproduction, independent replay, adjudication,
and reporting to distinct roles. It freezes revision-specific inputs, records assignment and
attempt provenance, and rejects completion messages as substitutes for accepted evidence.
Unreproduced or incompletely verified candidates remain unresolved, not evidence of a clean review.

## Source Evidence

- Inspected the pinned [coordinator skill](https://github.com/trailofbits/skills/blob/196a9073ab10d35bacf111f945e02c00b2c6883a/plugins/regression-hunt/skills/regression-hunt/SKILL.md) and upstream marketplace README on 2026-10-23. Companion skills, the registry implementation, and execution isolation have not yet been fully inspected.
- The marketplace lists regression-hunt and patching-bugs as recent additions. This capture date is not a release date; no local effectiveness measurement has been made.
- The repository declares CC-BY-SA-4.0. This entry is an original summary, not a vendored skill; review attribution and share-alike obligations before redistributing upstream material.

## Repository Relevance

The harness already requires red-before-green proof, cross-model review, bounded loops, and
unresolved findings. The potentially new contribution is a revision-bound replay contract:
record which original and changed sources were tested, keep producer and verifier evidence
distinct, and invalidate downstream conclusions when an input revision changes.

Existing owners are [deterministic validation](../../../skills/deterministic-validation/SKILL.md),
[breadth review](../../../instructions/05-REVIEW-BREADTH.md), and
[depth review](../../../instructions/06-REVIEW-DEPTH.md). Extend those owners if a gap is proved;
do not add a second stage machine or assume separate agent names prove model independence.

## Adoption Notes

- **Target files/domains:** The validation and review owners linked above, existing run journals, and the proof/artifact contracts under `scripts/harness/`.
- **Risks/constraints:** Replaying target revisions can execute untrusted code. Require explicit execution limits and an enforced sandbox before experiments; a Git worktree alone is not isolation. Preserve the user's dirty worktree and existing human approval gates.
- **SkillSpector gate:** Scanned the complete pinned plugin with SkillSpector 2.12.0 at `d7338f58200a9ae2a24810cee08911ab68b107a7`, using `--no-llm --fail-on-findings --fail-on-incomplete --min-coverage 100`. The scan inspected 28/28 components (100%, complete), exited 1, and reported 19 unresolved medium-severity findings: six Agent Snooping, twelve Dangerous Code Execution, and one Tool Misuse. The scanner recommendation is CAUTION, not clearance. See the [raw scan bundle](../reviews/ai-radar-skillspector-2026-10-23.json). No findings were suppressed, no waiver was granted, and no target code was executed.
- **Smallest discriminating evaluation:** After the scan and design gates, compare the current review evidence with revision-bound replay on one known regression and one unchanged-behavior control. A missing baseline, unavailable replay, changed input, or absent verifier must remain incomplete rather than become a confirmed defect or clean verdict.
- **Next step:** Adjudicate the scanner findings against the pinned companion evidence schema and registry, and establish execution isolation before routing any bounded comparison through Understand -> Architect. No installation, target-code execution, or workflow modification is part of radar triage. The scan alone does not establish safety or review independence.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-23 | candidate | Captured the pinned coordinator and identified a possible revision-bound replay improvement; scan and companion inspection remain outstanding. | GitHub Copilot |
| 2026-10-23 | parked | Complete static scan obtained, but 19 findings remain unadjudicated and companion/isolation review is incomplete. Next: resolve those gates before a known-regression/control comparison. | GitHub Copilot |
