# Skill adapter: openai-fast

Applies to fast, low-cost OpenAI models (GPT-6 Luna, GPT-5.6 Luna, mini and nano variants). Read
after the routed SKILL.md or stage instruction. Approval gates and required artifacts in the stage
contract always win.

<planning>
Before the first tool call, write a short plan: the sub-requests in the task, the skill steps that
cover each one, and the artifact you will produce. Refer back to it as you go.
</planning>

<tool_use>
- Use the exact commands and file paths in the skill. Do not invent flags or paths.
- Before each tool call, state in one line what it is for. After it, note the result.
</tool_use>

<persistence>
- Complete every sub-request in the plan before ending the turn. Do not stop after a partial result.
- On a transient error, retry once. On any other error, change the approach; do not repeat it.
- Stop and hand back for an approval gate, a missing required input, or the same failure twice.
</persistence>

<final_answer>
Start with two or three bullets summarizing what you did and why, then the artifact or result.
</final_answer>

Source: OpenAI GPT-5 prompting guide, "Minimal reasoning" (prompted planning, descriptive
preambles, persistence reminders, disambiguated tool instructions).
