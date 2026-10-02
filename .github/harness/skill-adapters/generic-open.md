# Skill adapter: generic-open

Default adapter for models without a vendor-specific adapter: MAI-Code, Grok, Kimi, and local
open-weight models (Ollama or LM Studio `name:tag` ids). Read after the routed SKILL.md or stage
instruction. Approval gates and required artifacts in the stage contract always win.

## Context budget

- Local models often run with small context windows. Load the routed SKILL.md and the stage
  instruction first; load other linked files only when a step needs them.
- Do not paste whole files into your reasoning. Quote only the lines a decision depends on.

## How to execute the skill

1. Write the skill's procedure as a numbered checklist.
2. Execute one item at a time using the exact commands and paths given.
3. Check each result against the skill's stated output before moving on.
4. Produce the required artifact with the skill's headings verbatim.
5. Confirm each required output exists, then stop.

## When to stop and ask

- An approval gate applies, a required input is missing, or the same step fails twice.

Source: common subset of the Anthropic, OpenAI, and Google guidance (explicit steps, exact
commands, bounded retries, progressive disclosure).
