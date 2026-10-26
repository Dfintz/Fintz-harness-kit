---
summary: Reject wholesale Harness2 runtime adoption because its broad editable surface and execution defaults conflict with the kit's protected governance boundaries.
status: rejected
source: https://github.com/google-research/harness2/tree/1cfe254e8d25b15f37048c3730134686abe60335
author_project: google-research/harness2
captured: 2026-10-24
tags: [runtime, safety, scope, licensing]
---

# Harness2 Wholesale Runtime Import

## Technique Summary

Harness2 is a research execution framework with eight editable harness component categories,
parallel/sequential refinement, benchmark adapters, selection, reflection, and reporting. The
complete runtime is not a drop-in improvement to this project's agent-agnostic operating contract.
Specific research mechanisms are assessed in separate entries rather than importing the framework.

## Evidence

- Revision-pinned [README](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/README.md)
  lists system prompts, guardrails, memory, tool guidance, subagents, skills, scripts, and plugins
  as editable categories. It calls for Linux/Python 3.12 and additional benchmark dependencies.
- [EXPERIMENTS.md](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/docs/EXPERIMENTS.md)
  explicitly states that executor networking is unrestricted and Codex's sandbox is disabled.
  It documents a validation rollout retrieving its public JobBench rubric and recommends external
  network restrictions. This does not prove every reported result is contaminated, but means
  unisolated runs are not persuasive evidence of general improvement here.
- [recursion.py](https://github.com/google-research/harness2/blob/1cfe254e8d25b15f37048c3730134686abe60335/harness2/core/recursion.py)
  validates proposal structure and falls back on invalid edits; those checks are not equivalent
  to our protected-governance policy or independent deterministic release acceptance.
- The top-level project is Apache-2.0; third-party runners and datasets retain separate terms.
  No source code, prompts, skill files, dependencies, or benchmark data were copied or installed.

## Repository Relevance

`scripts/harness/evolve-guard.mjs` and the
[self-improving brief](../briefs/self-improving-harness.md) prohibit evolving verifiers,
guardrails, and security files. Existing loops, routing, journals, and quarantined memory already
own the corresponding local responsibilities. Replacing them would expand scope and duplicate
ownership while weakening established approval boundaries.

## Adoption Notes

- **Target files/domains:** none for import; retain current runtime and governance owners.
- **Risks/constraints:** do not copy sandbox-disable or unrestricted-network defaults, expose
  provider credentials to untrusted probes, auto-promote reflected lessons, or permit generated
  skills/plugins/scripts to execute merely because a structural validator accepted them.
- **Next step:** reject wholesale import. Pursue only the separate
  [resume-identity](google-harness2-experiment-resume-identity.md) and
  [contrastive-composition](google-harness2-contrastive-composition.md) follow-ups through normal
  stages; keep the [experience-library](google-harness2-prefix-only-experience-library.md) parked.
  Any literal source cherry-pick needs a separate license/provenance and security review.
- **Security scan scope:** no external skill adoption and no first-party code generated;
  SkillSpector and Snyk Code are not applicable to these Markdown research records.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-24 | candidate | Assessed the full runtime against the kit's existing ownership and safety contracts. | copilot-radar |
| 2026-10-24 | rejected | Reject framework/defaults import, not the research itself. Retain bounded, independently evaluated idea-level adaptations only. | copilot-radar |
