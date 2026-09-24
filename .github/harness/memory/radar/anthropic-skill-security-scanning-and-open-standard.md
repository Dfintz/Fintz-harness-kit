---
summary: Anthropic shipped built-in "Skill and plugin security scanning" (Aug 2026, Enterprise beta) that auto-scans third-party skills/plugins for malicious content on upload/edit, alongside the cross-platform "Agent Skills" open standard (agentskills.io) — both validate and sharpen this repo's own SkillSpector gate.
status: parked
source: https://support.claude.com/en/articles/12138966-release-notes
author_project: Anthropic (Claude)
captured: 2026-09-23
tags: [skills, guardrails, harness, security]
---

# Anthropic — Skill/plugin security scanning + the Agent Skills open standard

## Technique Summary

Per Anthropic's official release notes: (1) August 6, 2026 — Enterprise plans can turn on
automatic scanning of third-party skills and plugins for malicious content whenever someone
uploads or edits one; (2) December 18, 2025 — Anthropic published "Agent Skills" as an open
standard (agentskills.io) so a skill package works across AI platforms, plus org-wide skill
management/discovery for Team/Enterprise; (3) September 10, 2026 — "Smart reports" (Enterprise
beta) analyze how a team actually uses Claude and surface "which repeated patterns are worth
packaging as shared skills." Together these show a market-level move toward treating skill
files as a distribution/security surface with its own scanning, standardization, and
usage-mining pipeline — not just prompt text.

## Repository Relevance

This repo already anticipates the security half of this trend: the `ai-techniques-radar` skill
has a "SkillSpector Gate" requiring a scan or a time-boxed waiver before any external skill-file
entry is marked `adopted`, and Claude's own scanning feature is independent validation that this
gate targets a real, vendor-recognized risk (malicious skill/plugin content), not a
theoretical one. The open-standard angle (agentskills.io) and the "mine usage into shared
skills" angle (smart reports) are both directly relevant to how this repo's own skills are
authored, discovered, and kept from drifting into one-off duplicates — comparable in spirit to
`teach-agent`'s "curate lessons into skills" workflow and the radar's own triage cadence.

## Adoption Notes

- **Target files/domains:** `.github/skills/ai-techniques-radar/SKILL.md` (SkillSpector Gate
  wording), `.github/skills/teach-agent/SKILL.md` (skill authoring/promotion), any future
  skill-format compatibility check against the `agentskills.io` open standard.
- **Risks/constraints:** Anthropic's scanning and "smart reports" are enterprise-plan,
  hosted-product features, not something to reimplement locally; the relevant, portable idea is
  the *practice* (scan before trust, standardize the package shape, mine usage into candidate
  skills), not the product. `agentskills.io` compatibility is a compatibility question, not an
  adoption decision, until a concrete cross-platform skill-sharing need exists.
- **Next step:** Park. Cite this entry the next time `SkillSpector Gate` wording in
  `ai-techniques-radar/SKILL.md` is revisited, and reference it if a "which of our skills/lessons
  are redundant" audit is ever run (natural fit for `teach-agent`).

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-09-23 | candidate | Initial capture; verified via official Claude release notes | copilot |
| 2026-09-23 | parked | Triage pass: validates the existing SkillSpector Gate concept but names no immediate local change — the gate wording is not currently under revision and no cross-platform skill-sharing need exists yet. Re-surface when `ai-techniques-radar/SKILL.md` SkillSpector wording is next revisited or a redundant-skills audit runs. | technique-triage |
