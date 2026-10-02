# Skill adapter: claude-compact

Applies to Claude Haiku models, including the universal fallback. Read after the routed SKILL.md or
stage instruction. The stage contract, approval gates, and required artifacts always win over this
file.

## How to execute the skill

1. Read the routed SKILL.md and the stage instruction it links to. Read each linked file fully.
2. Write the procedure as a numbered checklist before acting. Execute one item at a time.
3. Use the exact commands and file names the skill gives. Do not substitute or add flags.
4. After each item, check the result against the skill's stated output. If it fails, fix and retry
   that item; do not move on.
5. Produce the required artifact using the skill's template or section headings verbatim.
6. Before finishing, list each required output and confirm it exists.

## When to stop and ask

- The skill or stage needs an approval (permissions, guardrails, destructive defaults).
- A required input artifact is missing or empty.
- The same step fails twice with the same error.

Source: Anthropic Agent Skills best practices ("Haiku: does the Skill provide enough guidance?";
low-freedom instructions for fragile sequences).
