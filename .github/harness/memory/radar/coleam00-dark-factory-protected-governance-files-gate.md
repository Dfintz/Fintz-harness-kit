---
summary: Code-enforced gate that auto-rejects any diff touching governance files (briefs/registry/config) before anything else is evaluated
status: adopted
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
| 2026-08-18 | adopted | Architected and shipped `scripts/harness/protected-path-guard.mjs` (`npm run harness:protected-paths:check` / `:self-test`), a warn-by-default path-diff gate with an opt-in strict mode (`--strict` or `HARNESS_ENABLE_PROTECTED_PATH_GATE=true`) and an audited `--allow "<reason>"` bypass writing to `.github/harness/runs/protected-path-overrides.jsonl`. Protected list is config-driven via `harness.config.json` `governance.protectedPaths`. Not wired into `harness:docs:check` or `test:harness:core` in this pass — that remains a separate, later opt-in decision. See `.github/harness/memory/briefs/radar-batch-governance-gate-and-token-hardening-2026-08-18.md`. | radar-batch-2026-08-18 |
| 2026-08-18 | adopted | Wayfinder T1 (Day-30): decided **stay-warn** rather than adopting `--strict`. Evidence cited: exactly one real-world data point exists so far (this repo's own `harness.config.json`/`package.json` edits during the gate's own implementation), which proved the warn path but not the protected-path list's false-positive rate against a wider variety of legitimate changes. Re-evaluate at the Day-60 checkpoint (`wayfinder-30-60-90-milestones-2026-08-18.md`). See `.github/harness/memory/briefs/wayfinder-day30-t1-t2-implementation-2026-08-18.md`. | wayfinder-day30-2026-08-18 |
