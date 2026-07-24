---
summary: oh-my-openagent /init-deep — auto-generates hierarchical AGENTS.md files at project root, directory, and component level for context-efficient agent navigation
status: adopted
source: https://github.com/code-yeongyu/oh-my-openagent
author_project: code-yeongyu (Sisyphus Labs)
captured: 2026-07-24
tags: [agents-md, setup-harness-bootstrap, context-engineering, hierarchical]
---

# /init-deep: Hierarchical AGENTS.md Generation

## Technique Summary

oh-my-openagent's `/init-deep` command auto-generates nested AGENTS.md files throughout a project:

```
project/
├── AGENTS.md              ← project-wide context
├── src/
│   ├── AGENTS.md          ← src-specific context
│   └── components/
│       └── AGENTS.md      ← component-specific context
```

Agents auto-read the AGENTS.md closest to the files they're working on. This dramatically reduces context bloat — a component-level agent only loads component-specific context, not the entire project context. Zero manual management.

## Repository Relevance

The harness-kit has a single root `AGENTS.md` that points to HARNESS.md. For adopters of the kit who work on large projects, this single-file approach means every agent invocation loads the full harness context regardless of what the agent is actually working on. The hierarchical pattern would:
1. Allow the root AGENTS.md to point to HARNESS.md (existing)
2. Per-module AGENTS.md files contain domain-specific constraints (e.g., "this module owns database schemas")
3. Per-component AGENTS.md files contain component-specific rules

For the harness-kit itself, this applies to the `setup-harness-bootstrap` skill — it should advise adopters to create hierarchical AGENTS.md files when setting up the harness in large projects.

## Adoption Notes

- **Target files/domains:**
  - `.github/skills/setup-harness-bootstrap/SKILL.md` — add guidance on hierarchical AGENTS.md creation as an optional setup step for large projects
  - `.github/harness/HARNESS.md` — note that root AGENTS.md can be supplemented with directory-level AGENTS.md files
- **Risks/constraints:** Additive guidance only. Not all projects need this — only relevant for large multi-module codebases.
- **Next step:** Implement stage — add one paragraph to `setup-harness-bootstrap` skill about hierarchical AGENTS.md.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from oh-my-openagent assessment | radar-pass |
| 2026-07-24 | adopted | Clear gap in setup-harness-bootstrap guidance for large projects. Additive documentation change. | radar-pass |
