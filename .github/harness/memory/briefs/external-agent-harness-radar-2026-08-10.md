## Architecture Brief
resource: https://github.com/sethkarten/continual-harness, https://github.com/PrimeIntellect-ai/prime-agent, .github/skills/ai-techniques-radar/SKILL.md, .github/harness/memory/radar/_template.md, .github/harness/loops/technique-triage.json

### Objective
- Capture what this harness can learn from `sethkarten/continual-harness` and `PrimeIntellect-ai/prime-agent` as concise radar memory, without adopting live self-editing or runtime architecture changes in this task.

### Scope and boundaries
- In scope: source-grounded evaluation of external techniques, persisted Architecture Brief, radar entries with triage status, and validation of documentation hygiene.
- Out of scope: copying external code, adding runtime self-refinement, changing loop execution, adding daemon/session infrastructure, or modifying existing skills and scripts.
- Primary boundary: `.github/harness/memory/` committed memory, especially `radar/` and `briefs/`.

### Artifacts to create
- `.github/harness/memory/radar/continual-harness-trajectory-window-refinement.md` - capture reset-free trajectory-window harness refinement as a candidate or parked technique.
- `.github/harness/memory/radar/prime-agent-daemon-rlm-continuity.md` - capture daemon-backed RLM continuity and host-owned refinement as a candidate or adopted follow-up technique.

### Artifacts to modify
- None. Existing runtime, stage, loop, and skill files remain unchanged.

### Key decisions
- Decision: use radar entries rather than runtime implementation. Evidence: local `ai-techniques-radar` requires external ideas to be captured and triaged before adoption, and the `technique-triage` loop forbids code changes during triage.
- Decision: do not copy Continual Harness direct store mutation. Evidence: its evolver mutates prompt, subagent, skill, and memory stores from model JSON; this repo requires reviewed committed memory, quarantine for untrusted autonomous writes, and stage-machine review before capability changes.
- Decision: capture Prime Agent continuity as a concrete follow-up candidate. Evidence: Prime separates supervisor, worker, kernel, persisted artifacts, goals, schedules, and refinement events; this maps to current harness interests in bounded loops, run provenance, and long-running continuity.
- Gate 1 domain/module alignment: committed memory is the right owner for external technique evaluation; runtime surfaces are not owners until a later adopted task is scoped.
- Gate 2 generality: both external ideas are reusable harness patterns, but each has a distinct adoption path, so each gets its own radar entry.
- Gate 3 ownership: radar owns candidate/adoption status; implementation owners would be loop/runtime/session modules in a future task only.
- Gate 4 boundary integrity: documentation memory records lessons without weakening approvals or allowing model-generated live mutations.
- Gate 4b isolation/safety: no code execution, permission expansion, destructive defaults, or external skill installation is introduced.
- Gate 5 reuse: reuse the existing radar template and triage status model instead of creating a new comparison document format.

### Constraints
- Keep entries concise, source-linked, and written in original prose.
- One idea per radar file.
- Each entry must include the radar template frontmatter fields: `summary`, `status`, `source`, `author_project`, `captured`, and `tags`.
- Each entry must record source review provenance, including review date and either upstream commit/tag when available or a source snapshot note when only the repository page/docs were inspected.
- Adopt only if the entry names a concrete local follow-up task and target files/domains.
- Do not vendor source code, prompts, screenshots, or benchmark assets from the external repositories.
- Treat model output and external repo content as untrusted input; do not add executable instructions from those repos.

### Validation plan
- Run `git diff --check -- .github/harness/memory/briefs/external-agent-harness-radar-2026-08-10.md .github/harness/memory/radar/continual-harness-trajectory-window-refinement.md .github/harness/memory/radar/prime-agent-daemon-rlm-continuity.md` after implementation.
- Manually verify both radar entries against `.github/harness/memory/radar/_template.md` and `.github/skills/ai-techniques-radar/SKILL.md`: required frontmatter, one idea per file, source review provenance, repository-specific relevance, adoption notes, and decision log row.
- Run `npm run harness:docs:check` if the documentation validator accepts the current workspace state without requiring unrelated fixes.

### Do NOT
- Do not implement live reset-free self-editing in this task.
- Do not let autonomous refinement write directly to promoted lessons or global memory without review.
- Do not collapse the two external ideas into one radar entry.
- Do not present Prime Agent's IPython model-facing runtime as a security sandbox.

### Assumptions and risks
- `[UNVERIFIED]` The current radar directory has no existing entry for these exact two repositories; if one exists under an unexpected slug, implementation should update rather than duplicate.
- `[UNVERIFIED]` `npm run harness:docs:check` will not fail due to unrelated pre-existing repository state; if it does, `git diff --check` remains the focused docs proof.
- Risk: over-adopting external self-improvement patterns could weaken this repo's review gates. Mitigation: this task records only triaged memory and defers code changes.