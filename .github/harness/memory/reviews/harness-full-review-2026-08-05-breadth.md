---
artifact_family: review
immutability: mutable
---

# Review Breadth Findings: Harness Full Review - 2026-08-05

## Findings

No Blocker, Major, Minor, or Nit findings.

## FYI

| Artifact | Finding | Evidence | Impact | Confidence | Recommended action |
| --- | --- | --- | --- | --- | --- |
| `.github/harness/phase5/validation-results/` | Model-routing validation updates the date-stamped evidence file. | Scoped worktree check showed only the generated validation JSON plus this review's new artifacts. | Expected generated evidence, not runtime drift. | HIGH | Keep the path declared in review mutation ledgers. |
| `.github/harness/memory/briefs/` | The report counts 16 legacy Briefs with `unknown` status. | `npm run harness:report` reported `unknown=16`; docs contract validation passed. | Memory-hygiene visibility only; no runtime or report parsing failure. | HIGH | Address through the existing optional status-migration workflow when that maintenance work is prioritized. |

## Coverage note

- Reviewed routing, graph, report, MCP dispatch/HTTP/stdio/resource/ACL paths, model routing, operator documentation, and generated-artifact boundaries.
- Targeted source inspection confirmed path containment in `mcp-server`, guarded path joins in `prompt-router`, and frontmatter-aware Brief parsing in `harness-report`.

## Missing-context note

- Resolved on 2026-08-05: Docker provider parity now passes for `understand-anything`, `graphify`, and `both` after the parity runner suppressed Compose progress output.
- Resolved on 2026-08-05: Lurkr 0.4.0 is configured through the standard npm wrappers and required local/differential scans pass.

## Follow-up security findings

- Lurkr reported two high-severity `agent.dynamic_prompt_from_user_input` findings in `scripts/harness/dspy-optimize-ollama.py` at lines 127 and 235. They require a dedicated remediation review; this configuration follow-up does not change optimizer behavior.