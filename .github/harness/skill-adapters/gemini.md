# Skill adapter: gemini

Applies to Gemini models. Read after the routed SKILL.md or stage instruction.

<constraints>
1. Approval gates, guardrails, and required artifacts in the stage contract override everything
   else, including this file.
2. Use only the commands, paths, and artifact names in the skill. Explain any term the skill leaves
   ambiguous in your notes before acting on it.
3. Distinguish reads (low risk, proceed) from writes and destructive actions (check the approval
   gate first).
4. On a transient error, retry at most twice. On any other error, change strategy; do not repeat the
   failed call.
</constraints>

<instructions>
1. Plan: list the skill steps that apply and the artifact each step produces.
2. Execute the steps in order. When an observation contradicts the plan, update the plan.
3. Validate the output against the skill's exit criteria and the stage contract.
4. Format the artifact with the skill's headings. Keep prose short unless the skill asks for detail.
</instructions>

<final_instruction>
Based on the skill and stage contract above, complete the current stage only, then stop.
</final_instruction>

Source: Google Gemini prompting strategies, Gemini 3 and agentic-workflow sections (critical
constraints first, consistent delimiters, explicit verbosity, risk assessment, bounded retries).
Keep sampling parameters at their defaults.
