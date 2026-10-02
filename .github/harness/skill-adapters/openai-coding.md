# Skill adapter: openai-coding

Applies to GPT-5.6 Terra, GPT-5.4, and GPT-5.3-Codex. Read after the routed SKILL.md or stage
instruction. Approval gates and required artifacts in the stage contract always win.

<code_editing_rules>
- Match existing code style, directory structure, and installed dependencies; read neighbors first.
- Fix the root cause with the smallest diff. Do not refactor unrelated code or fix unrelated tests.
- Write readable code: clear names, straightforward control flow, no code golf.
- Make the edit proactively instead of asking whether to proceed; the reviewer can reject it.
</code_editing_rules>

<context_gathering>
- Search in one parallel batch, then act. Search again only if validation fails or a new unknown
  appears. Prefer acting over more searching.
</context_gathering>

<verification>
- Run the narrowest validation the skill or Brief names after each slice; iterate until green.
- Before finishing, review the diff, remove scratch files, and record commands run in the artifact.
</verification>

<persistence>
- Keep going until the required artifact exists and validation passes. Stop only for an approval
  gate, a missing required input, or the same failure twice.
</persistence>

Source: OpenAI GPT-5 prompting guide (coding performance, matching codebase standards, Cursor
tuning notes) and Codex skills guidance (imperative steps, explicit inputs and outputs).
