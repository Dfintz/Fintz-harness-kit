---
summary: Trace untrusted GitHub event content into AI workflow prompts and privileged execution, rather than treating risky permissions alone as an exploit.
status: parked
source: https://github.com/trailofbits/skills/tree/196a9073ab10d35bacf111f945e02c00b2c6883a/plugins/agentic-actions-auditor
author_project: Trail of Bits / skills
captured: 2026-10-23
tags: [external-skill, github-actions, prompt-injection, security-review, dataflow]
---

# Agentic Actions Dataflow Audit

## Technique Summary

The upstream auditor traces attacker-controlled event content through workflow variables,
outputs, files, and prompts into AI actions and execution privileges. It distinguishes a
demonstrated source-to-sink path from suspicious configuration. Unresolved reusable workflows
or action internals remain coverage gaps rather than clean results.

## Source Evidence

- Inspected the pinned upstream coordinator on 2026-10-23. It describes static read-only review, known AI action families, and bounded composite/reusable-workflow resolution. No upstream workflow or target action was executed.
- The source repository declares CC-BY-SA-4.0; assess attribution and share-alike obligations before any redistribution. This entry is an original summary, not an imported skill.
- A targeted search of this repository's workflow YAML found no references to the recognized Claude, Gemini, Codex, or actions/ai-inference action families. That search does not prove arbitrary wrappers contain no AI invocation and does not replace an audit.

## Repository Relevance

This could complement [breadth review](../../../instructions/05-REVIEW-BREADTH.md) and the
existing [security evidence gate](../../../../scripts/harness/security-review-gate.mjs) if a
real agentic CI workflow is introduced. No specific current vulnerable workflow has been
identified, so wholesale installation would solve an unproved local problem.

## Adoption Notes

- **Target files/domains:** Existing workflow YAML, breadth review, and security evidence reporting. Keep source-only analysis separate from running a workflow or fetching private action dependencies.
- **SkillSpector gate:** Scanned the complete pinned plugin with SkillSpector 2.12.0 at `d7338f58200a9ae2a24810cee08911ab68b107a7`, using strict static-only flags. Exit 1, ten findings, score 93, DO_NOT_INSTALL, 88.2% coverage, partial. Two files hit obfuscated-text/static-parser limits. See the [raw scan bundle](../reviews/ai-radar-skillspector-2026-10-23.json); findings remain unadjudicated, with no suppression or waiver.
- **Risks/constraints:** Security examples can trigger static patterns, but that possibility does not clear the findings or parser gaps. Preserve unresolved dependency depth and distinguish dangerous permissions from a proven injection path. Do not weaken human review or existing scans.
- **Smallest discriminating evaluation:** Once scan and design gates are satisfied and a real AI workflow exists, compare a source-only audit against a positive fixture and a negative control. Require a reviewable event-to-prompt-to-privilege path, or an explicit unresolved boundary, for every conclusion.
- **Next step:** Park until there is a concrete agentic workflow to audit. Resolve the pinned plugin's scan findings and inspection gaps before considering any skill or pattern adaptation through Understand -> Architect.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-23 | candidate | Captured source-to-sink AI workflow auditing and checked recognized action references locally. | GitHub Copilot |
| 2026-10-23 | parked | No concrete local agentic workflow case identified; ten unresolved scan findings and partial coverage independently block adoption. | GitHub Copilot |
