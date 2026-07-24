---
summary: CodeRabbit AI code review — PR-level automated review that could feed the harness Review Breadth stage or replace manual first-pass
status: adopted
source: https://coderabbit.ai
author_project: CodeRabbit
captured: 2026-07-24
tags: [review, ci, pr, automation]
---

# CodeRabbit — AI-Native PR Review Integration

## Technique Summary

CodeRabbit is a GitHub App that runs automated AI code review on every PR: it posts inline comments, a walkthrough summary, and a structured review verdict. It uses a combination of AST analysis and LLM review. Unlike generic LLM review, it understands diff context, links to the original code, and can be configured with per-repo review rules via `.coderabbit.yaml`. It integrates natively with GitHub PR status checks.

## Repository Relevance

The harness's Review Breadth and Review Depth stages are currently agent-executed, meaning they require a full agent context-load to run. CodeRabbit could serve as a lightweight, always-on first-pass reviewer on every PR opened against the harness-kit itself. This is a meta-level use case: CodeRabbit reviewing harness PRs, with the harness's own review stages serving as the deeper gate. The key benefit is catching obvious issues (missing docstring, security lint) before a high-reasoning model is invoked for Review Depth.

A `.coderabbit.yaml` config could encode the harness's own review criteria (Brief conformance, no eval-suite weakening, no suppressed checks), making the automated review harness-aware.

## Adoption Notes

- **Target files/domains:**
  - New `.coderabbit.yaml` at repo root — encode harness-specific review rules
  - `.github/harness/HARNESS.md` — document CodeRabbit as the first-pass PR gate
  - Optional: `scripts/harness/validate-doc-contracts.mjs` output as CodeRabbit custom check
- **Risks/constraints:** Requires GitHub App installation (human action, not code change). Free tier has PR limits. Review quality depends on `.coderabbit.yaml` quality. Must not replace Review Depth — only augment breadth pass.
- **SkillSpector gate:** This is a third-party service, not a skill file. Standard scan not applicable — waiver recorded here: service is read-only (reviews only, no write access beyond comments), no harness files are modified by it. Human approver required before enabling on the repo.
- **Next step:** Human decision — approve GitHub App installation, then Implement stage for `.coderabbit.yaml`.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture — SkillSpector waiver recorded above | radar-pass |
| 2026-07-24 | adopted | Adoption gates pass: problem is clear (no automated first-pass review on kit PRs), target is a new .coderabbit.yaml + HARNESS.md doc update, SkillSpector waiver recorded (read-only service). Blocked on human action: GitHub App installation required first. Next: human approves App install, then Implement stage for .coderabbit.yaml. | radar-pass |
