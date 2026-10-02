# Skill adapter: claude-balanced

Applies to Claude Sonnet models. Read after the routed SKILL.md or stage instruction. The stage
contract, approval gates, and required artifacts always win over this file.

## How to execute the skill

- Follow the skill's procedure in order. Use judgment inside each step, not across steps.
- When the skill has a workflow or checklist, copy it into your working notes and check items off.
- Prefer the skill's default tool or command over alternatives; switch only when it fails.
- Run the validation the skill names after each meaningful change; fix and re-run until it passes.
- Stop when the stage's required artifact exists and its exit criteria are met.

## Watch for

- Skipping a validation step because the change "looks right". Run it.
- Drifting terminology. Reuse the skill's exact artifact names and stage names.

Source: Anthropic Agent Skills best practices (workflows, checklists, feedback loops).
