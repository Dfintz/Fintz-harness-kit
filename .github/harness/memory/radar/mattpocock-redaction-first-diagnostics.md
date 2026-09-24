---
summary: Diagnostic workflows redact secrets before showing commands, outputs, or captured artifacts and keep credentials in environment variables.
status: parked
source: https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md
author_project: mattpocock/skills
captured: 2026-09-24
tags: [debugging, secrets, redaction, skills, security]
---

# Redaction-First Diagnostic Evidence

## Technique Summary

The current `diagnosing-bugs` skill makes redaction the first step whenever a debugging loop displays
commands, outputs, or captured artifacts. Credentials stay in environment variables, examples use a
literal `<REDACTED>` marker, and only signal-carrying lines are quoted into durable evidence.

## Repository Relevance

Harness debugging and review guidance asks for concrete command output and artifacts, but the checked
skill surfaces do not state a redaction-first evidence rule. The practice would strengthen
`doubt-driven-development` and observability workflows without changing runtime code.

## Adoption Notes

- **Target files/domains:** `.github/skills/doubt-driven-development/SKILL.md` and
  `.github/skills/observability-and-instrumentation/SKILL.md`.
- **Risks/constraints:** This entry is centered on an external skill-file pattern. No SkillSpector
  result or named human waiver is captured, so the radar adoption gate forbids promotion today.
- **Next step:** Follow the SkillSpector gate in `.github/skills/ai-techniques-radar/SKILL.md`: scan
  the exact upstream `diagnosing-bugs` skill with `skillspector scan <path> --no-llm`, or capture a
  waiver with written rationale, a named human approver, and a retroactive scan target date within
  14 days. Then route a doc-only feature task if the evidence is acceptable.
- **Related:** `mattpocock-diagnose-feedback-loop.md` predates the current captured scan-or-waiver
  rule and is not precedent for bypassing it.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-09-24 | candidate | Captured from the mattpocock/skills 1.2.3 changelog and current skill source. | radar-pass |
| 2026-09-24 | parked | Concrete local gap, but the mandatory SkillSpector result or named waiver is absent. | radar-triage |
