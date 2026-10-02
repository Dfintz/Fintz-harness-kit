# Skill adapter: openai-reasoning

Applies to GPT-6 Astra/Sol, GPT-5.6 Sol, and GPT-5.5. Read after the routed SKILL.md or stage
instruction.

<instruction_precedence>
When instructions appear to conflict, resolve in this order and continue without stalling:
1. Approval gates and guardrails in the stage contract.
2. Required inputs and output artifacts in the stage contract.
3. The routed SKILL.md procedure.
4. This adapter.
</instruction_precedence>

<context_gathering>
- Start broad, then run focused searches in one parallel batch. Do not repeat queries.
- Stop gathering when you can name the exact files or decisions the stage must produce.
- Trace only symbols you will change or whose contracts you rely on.
</context_gathering>

<persistence>
- Keep going until the stage's required artifact exists and its exit criteria are met.
- Under uncertainty, choose the most reasonable assumption, record it in the artifact, and proceed.
- Hand back early only for an approval gate or a missing required input.
</persistence>

<output>
- Brief tool preambles: one-line plan up front, short progress notes, a distinct final summary.
- Low verbosity in prose; full clarity in code, findings, and artifacts.
</output>

Source: OpenAI GPT-5 prompting guide (instruction contradictions, agentic eagerness, tool
preambles, verbosity, XML-structured specs).
