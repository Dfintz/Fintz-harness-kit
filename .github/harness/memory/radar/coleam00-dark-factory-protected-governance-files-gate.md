---
summary: Code-enforced gate that auto-rejects any diff touching governance files (briefs/registry/config) before anything else is evaluated
status: candidate
source: https://github.com/coleam00/skills/tree/main/.claude/skills/build-dark-factory
author_project: coleam00/skills
captured: 2026-08-16
tags: [governance, protected-files, gate, ci]
---

# Protected Governance Files: Code-Enforced Pre-Merge Gate

## Technique Summary

`build-dark-factory` puts its three governance files (`MISSION.md`, `FACTORY_RULES.md`,
`CLAUDE.md`/`AGENTS.md`) on a protected list enforced in code: a PR that touches them is
auto-rejected before anything else is evaluated, because "the agent cannot amend the rules it is
judged by."

## Repository Relevance

This harness has an analogous governance surface — `.github/harness/registry.json`,
`harness.config.json`, `.github/harness/memory/briefs/`, and the stage-instruction files — protected
today by convention, code review, and the Feedback-stage human gate, but not by a standalone,
code-enforced check that rejects a diff touching those paths before review starts.
`scripts/harness/git-guard.mjs` classifies dangerous *commands* (force-push, hard reset), not
protected *paths* touched by a diff, so this is a genuinely different gate, not a duplicate.

## Adoption Notes

- **Target files/domains:** a new small script (e.g. `scripts/harness/protected-path-guard.mjs`) or
  an addition to `git-guard.mjs`'s sibling tooling; wiring point could be a pre-commit hook, a CI
  check, or an addition to `npm run harness:docs:check`.
- **Risks/constraints:** needs an explicit decision on (a) which paths are protected, (b) whether the
  gate blocks or only warns, and (c) how a legitimate, human-approved governance change is supposed
  to land if the gate blocks unconditionally. This is exactly the kind of design question that
  belongs in Architect, not decided implicitly here.
- **Next step:** run this idea through Understand → Architect as its own task before any code is
  written. Do not mark `adopted` until the protected-path list and enforcement point are decided.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-16 | candidate | Real gap identified; needs its own Architect pass before a bounded next step exists. | radar-pass |
