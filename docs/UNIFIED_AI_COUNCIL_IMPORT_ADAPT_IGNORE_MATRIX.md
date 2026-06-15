# Unified AI Council Import-Adapt-Ignore Matrix

This matrix maps Unified-AI-Council architecture ideas to harness-kit implementation choices.

| Unified AI Council area | Harness-kit target | Action | Notes |
| --- | --- | --- | --- |
| Multi-agent parallel responders | scripts/harness/council-review.mjs | Adapt | Added council-style parallel responders for codex/claude/gemini with mode profiles plan/code/review/refactor. |
| Consensus synthesis | scripts/harness/council-review.mjs | Adapt | Added `nano` heuristic synthesis and optional `ollama` synthesis fallback via existing llm-provider. |
| Command allowlist validation | scripts/harness/command-validation.mjs + runner hooks | Import/Adapt | Implemented executable allowlist + shell metachar rejection and wired into run-loop/run-experiment/plan-review. |
| Project memory JSONL | scripts/harness/workspace-memory.mjs | Adapt | Added local `.unified-ai-council/workspace-memory.jsonl` helper (append/list/reset) for transient context. |
| VS Code webview + command palette UI | (none yet) | Defer | Script-first UX retained; no webview bundle added in this slice. |
| WSL execution adapter | (none yet) | Defer | Keep native shell execution; add adapter only if cross-shell drift persists. |
| Replace stage machine with chat panel | .github/harness/HARNESS.md workflow | Ignore | Explicitly avoided. Harness stage machine remains authoritative. |

## Why this split

- Preserve harness-first deterministic workflow and bounded loop controls.
- Add high-leverage reusable capabilities first (security + synthesis + transient memory).
- Keep UI/platform-specific concerns optional so the kit stays project-agnostic.
