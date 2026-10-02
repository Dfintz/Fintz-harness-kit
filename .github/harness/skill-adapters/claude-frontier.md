# Skill adapter: claude-frontier

Applies to Claude Opus models. Read after the routed SKILL.md or stage instruction. The stage
contract, approval gates, and required artifacts always win over this file.

## How to execute the skill

- Treat the skill as high-freedom guidance. Choose the approach the evidence supports; do not
  re-explain concepts the skill already assumes.
- Keep outputs lean. Skip restating the skill, the task, or prior stage outputs; cite file paths.
- Read referenced files completely when they govern a decision. Do not preview with partial reads.
- Use the skill's checklist only when it is a workflow with ordered gates; otherwise reason freely.
- Stop when the stage's required artifact exists and its exit criteria are met. Do not expand
  scope into the next stage.

## Watch for

- Over-engineering and scope creep on long-horizon tasks. Prefer the smallest rooted change.
- Over-explaining in review output. Findings first, evidence second, prose last.

Source: Anthropic Agent Skills best practices (conciseness, degrees of freedom, test across
Haiku/Sonnet/Opus).
