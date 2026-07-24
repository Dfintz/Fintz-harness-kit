---
summary: superpowers session-start hook — inject bootstrap skill content into every session via a platform-specific hook at startup
status: parked
source: https://github.com/obra/superpowers/blob/main/hooks/session-start
author_project: obra (Jesse Vincent, Prime Radiant)
captured: 2026-07-24
tags: [hooks, session-start, skill-auto-trigger, mcp]
---

# Superpowers: Session-Start Hook for Skill Auto-Injection

## Technique Summary

Superpowers injects its `using-superpowers` bootstrap skill into every agent session via a `SessionStart` hook. The hook reads the skill file, escapes it for JSON embedding, and outputs it as `additionalContext` in the format expected by the current platform (Claude Code, Cursor, Copilot CLI each have different JSON shapes). This means the agent always loads the "intro to skills" content at session start without the user having to remember to load it. The hook is a shell script that detects the platform from environment variables.

## Repository Relevance

The harness-kit's HARNESS.md instructs agents to "read this file first" but relies on the agent tool loading it from context. A session-start hook that auto-injects `HARNESS.md` or a condensed `using-harness` skill would eliminate the "agent didn't read HARNESS.md" failure mode. The harness-kit already uses VS Code's `.vscode/mcp.json` for the MCP server — the hook would be a parallel mechanism for the agent context, not the tool surface.

## Adoption Notes

- **Target files/domains:**
  - New `hooks/session-start` shell script
  - New `hooks/hooks.json` (Claude Code hook registration)
  - New condensed `skills/using-harness/SKILL.md` as the injected bootstrap
- **Risks/constraints:** Hook infrastructure is platform-specific (Claude Code, Cursor, Copilot CLI each differ). VS Code agent context injection is different from Claude Code hooks. Requires testing on at least one platform. superpowers maintains compatibility shims for all 11 platforms — the harness-kit would need to maintain fewer but still requires per-platform testing.
- **Next step:** Architect stage — design the minimal bootstrap content and identify which platforms to support first. Claude Code hook format is well-documented and is the most likely first target.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from superpowers cherry-pick pass | radar-pass |
| 2026-07-24 | parked | High-value but requires significant platform-specific work. The MCP server already covers the tool surface; this covers the context injection surface. Revisit when Claude Code hook usage in the harness is better understood. | architect-pass |
