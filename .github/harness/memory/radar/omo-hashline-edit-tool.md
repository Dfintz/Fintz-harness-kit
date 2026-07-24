---
summary: oh-my-openagent Hashline — hash-anchored line identifiers eliminate stale-line edit failures; every read line gets a content hash, every edit validates against it
status: adopted
source: https://github.com/code-yeongyu/oh-my-openagent
author_project: code-yeongyu (Sisyphus Labs)
captured: 2026-07-24
tags: [edit-tool, reliability, harness-problem, stale-lines]
---

# Hashline: Hash-Anchored Edit Tool

## Technique Summary

From oh-my-openagent's "Hashline" feature, inspired by [oh-my-pi](https://github.com/can1357/oh-my-pi) and [The Harness Problem](https://blog.can.ac/2026/02/12/the-harness-problem/) (Can Bölük, 2026):

Every line the agent reads comes back tagged with a content hash:
```
11#VK| function hello() {
22#XJ|   return "world";
33#MB| }
```
The agent edits by referencing these tags. If the file changed since the last read, the hash won't match and the edit is rejected before any corruption. Reported improvement: **6.7% → 68.3%** success rate on Grok Code Fast 1 just from changing the edit tool.

The root problem: tools like `replace_string_in_file` require the agent to reproduce exact content it already saw. When the agent can't (whitespace, encoding, intervening edits), the tool fails. Hash anchoring replaces fragile string matching with stable content identifiers.

## Repository Relevance

The harness-kit uses `replace_string_in_file` extensively. When a string changes between read and edit (another tool edited the file, auto-formatting ran, etc.), the replacement fails and the agent must re-read the file and retry. This is a known failure mode in every harness session. The Hashline pattern would make `replace_string_in_file` failures explicit at edit time rather than requiring the agent to discover them through failure.

The harness-kit doesn't control its own edit tools (they are VS Code / MCP tools), but:
1. The pattern is worth documenting as a principle for agents — "always re-read a file before editing if another edit has occurred since the last read"
2. If the harness ever implements its own MCP edit tool, Hashline is the pattern to adopt

## Adoption Notes

- **Target files/domains:**
  - `.github/instructions/04-IMPLEMENT.md` — add "re-read before edit" principle: if a file was read more than a few tool calls ago, re-read it before editing to avoid stale-string failures
  - `.github/harness/MCP-INTEGRATION.md` — note Hashline as the future standard for custom edit tools
  - Longer-term: if the MCP server gains a custom edit tool, implement Hashline
- **Risks/constraints:** The harness doesn't control VS Code's edit tools; the immediate adoption is documentation only. A full Hashline implementation would require a custom MCP edit tool.
- **Next step:** Implement stage — add one rule to 04-IMPLEMENT.md: "Before editing a file, verify it hasn't changed since the last read; if in doubt, re-read first."

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-24 | candidate | Initial capture from oh-my-openagent assessment | radar-pass |
| 2026-07-24 | adopted | The principle (re-read before edit, hash-validate) fills a confirmed gap — stale-string edit failures are common in harness sessions. Immediate action: documentation in 04-IMPLEMENT.md. Future action: custom MCP edit tool with hash anchoring. | radar-pass |
