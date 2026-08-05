---
summary: Differential security scanning workflow to compare findings before and after changes.
status: adopted
source: https://github.com/openai/codex-security
author_project: openai/codex-security
captured: 2026-08-05
tags: [security, scanning, quality-gates]
---

# OpenAI Codex Security Differential Scanning

## Technique Summary

Codex Security patterns emphasize repeatable scans and differential reporting to surface security drift across revisions. For harness-kit, this maps to optional pre/post scan evidence in review workflows.

## Repository Relevance

This extends existing lightweight security posture with clearer evidence tracking and avoids unverifiable claims in safety-sensitive changes.

## Adoption Notes

- **Target files/domains:** scripts/harness/lurkr-check.mjs, .github/instructions/05-REVIEW-BREADTH.md, SETUP.md
- **Risks/constraints:** scanner noise and added triage workload
- **Next step:** implement Ticket T4 as optional pipeline with explicit false-positive handling guidance

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-08-05 | candidate | Initial capture | copilot |
| 2026-08-05 | adopted | Adopted as optional-by-default security evidence workflow with bounded rollout | copilot |
