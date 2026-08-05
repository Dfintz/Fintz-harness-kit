---
summary: Anti-slop documentation linting to reduce generic AI-authored prose and improve clarity.
status: adopted
source: https://github.com/petergyang/no-ai-slop
author_project: petergyang/no-ai-slop
captured: 2026-08-05
tags: [documentation, quality, teach-agent]
---

# No AI Slop Doc Quality Linting

## Technique Summary

No-ai-slop style guidance identifies generic, low-signal writing patterns and promotes clearer human-readable output. In harness-kit, this can be encoded into deterministic doc verification checks.

## Repository Relevance

The repository includes doc workflow and verifier surfaces that can absorb writing quality checks with minimal architecture impact.

## Adoption Notes

- **Target files/domains:** scripts/harness/doc-verifier.mjs, .github/skills/teach-agent/SKILL.md, .github/instructions/04-IMPLEMENT.md
- **Risks/constraints:** false positives on intentionally concise technical text
- **Next step:** implement Ticket T6 as warning-first checks, then tighten based on observed precision

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | adopted | Adopted with warning-first rollout and precision review before hard-fail gating | copilot |
