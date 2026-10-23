---
summary: Evaluate real host skill activation with hard-negative prompts separately from forced-loaded skill quality, without importing Anthropic's optimizer.
status: parked
source: https://github.com/anthropics/skills/tree/b9e19e6f44773509fbdd7001d77ff41a49a486c1/skills/skill-creator
author_project: Anthropic / skills
captured: 2026-10-23
tags: [external-skill, skill-routing, evaluation, hard-negatives, holdout]
---

# Host-Specific Skill Trigger Evaluation

## Technique Summary

Anthropic's skill-creator tests description-triggering with realistic positive queries and
near-miss negatives, repeats invocations, and compares candidate descriptions. This measures
whether a host chooses a skill, which is different from assessing output after a skill has
already been loaded. Keep those measurements separate.

## Source Evidence

- Inspected the pinned upstream skill on 2026-10-23. Its relevant history is March/April 2026; this capture is not an October launch claim.
- The documented optimizer uses about 20 positive/negative queries, a 60/40 split, three invocations per query, and up to five iterations. It chooses a description by repeatedly observed held-out scores. A local comparison should reserve a separate untouched final test set rather than label that selection set an unbiased final test.
- The upstream runner assumes Claude CLI behavior. That is not evidence of VS Code Copilot activation behavior. No upstream runner was executed and no local skill description was changed.

## Repository Relevance

[skill-routing-eval.mjs](../../../../scripts/harness/skill-routing-eval.mjs) checks mapped skill
files, eval-set shape, prompt counts, IDs, and stage sequences. That coverage check does not
observe an actual host activation decision. [skill-adapter-eval.mjs](../../../../scripts/harness/skill-adapter-eval.mjs)
owns a neighboring evaluation surface; extend existing owners only if a host-observable gap is
established, rather than adding another generic optimizer.

## Adoption Notes

- **Target files/domains:** Existing routing/adapter evaluation owners, eval sets, and skill metadata. Preserve optional and explicitly user-invoked skill boundaries.
- **SkillSpector gate:** Scanned the complete pinned skill-creator subtree with SkillSpector 2.12.0 at `d7338f58200a9ae2a24810cee08911ab68b107a7`, in static-only strict mode. Exit 1, nine findings, score 100, DO_NOT_INSTALL, 88.9% coverage, partial. Missing/generated-reference limitations remain recorded in the [raw scan bundle](../reviews/ai-radar-skillspector-2026-10-23.json). Findings are unadjudicated; no waiver was granted and no findings were suppressed.
- **Risks/constraints:** The scan does not authorize importing the skill or adapting its patterns. Host mechanics, activation observability, repeated-run cost, selection leakage, and false-positive triggering must be resolved. Do not adopt globally more aggressive descriptions or auto-enable user-only skills.
- **Smallest discriminating evaluation:** After the scan and design gates, compare one existing description with one alternative on realistic positives and adjacent-task negatives in the actual supported host. Predeclare precision, recall, invocation budget, and a separate final holdout. A forced-loaded run is not trigger evidence.
- **Next step:** Resolve static findings and incomplete inspection, then identify a reliable host activation trace and a specific misrouting case. Route any proposed comparison through Understand -> Architect before optimizer or metadata changes.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-23 | candidate | Captured hard-negative trigger evaluation and distinguished it from existing routing coverage checks. | GitHub Copilot |
| 2026-10-23 | parked | Nine unresolved findings and partial inspection block adoption; actual Copilot activation observability and an untouched final holdout also need design. | GitHub Copilot |
