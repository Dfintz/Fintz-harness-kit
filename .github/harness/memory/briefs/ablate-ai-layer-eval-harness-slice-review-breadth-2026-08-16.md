---
summary: "Review breadth - ablate-ai-layer eval harness slice implementation"
type: brief
status: implemented
source: review
created: 2026-08-16
updated: 2026-08-16
tags: [eval, ablation, review-breadth]
artifact_family: review
immutability: mutable
---

# Review Breadth: ablate-ai-layer-eval-harness-slice-2026-08-16 (Implement)

## Findings

| Severity | Finding | Evidence | Confidence |
|---|---|---|---|
| Info | `--relevant-tasks` is enforced as a hard-required flag (script exits 2 without it), matching the Brief's applicability-gate decision exactly. | `ablate-artifact.mjs` `main()`: fails before any agent invocation if the flag is missing/empty. | HIGH |
| Info | `run-eval.mjs --self-test` and `ablate-artifact.mjs --self-test` both pass after the `lib/tasks.mjs` extraction. | Terminal runs in this session, both exit 0. | HIGH |
| Info | Full end-to-end smoke run (`--target ... --relevant-tasks build-fix --agent "node --version"`) produced a well-formed journal with `recommendation`, per-task `without`/`withArtifact` scores, and a `dangerous` scan result. | Terminal output captured during Implement. | HIGH |
| Minor | Analyzer flags "potential file inclusion" on path-join operations in `lib/tasks.mjs`, `run-eval.mjs`, and `ablate-artifact.mjs`. | `get_errors` output. | HIGH (as a finding), but see Impact |
| Minor | Analyzer flags "prefer top-level await" in both CLI entrypoints' `main().catch(...)` pattern. | `get_errors` output. | HIGH |
| Info | `--target` path is checked for repo-root containment before being read (new code in `runAblation`), which is a real improvement over `run-eval.mjs`'s fixed-path assumption since `--target` is the one genuinely user-controlled path in this feature. | `ablate-artifact.mjs` `runAblation`: `withinRepo` check before `readFileSync`. | HIGH |

## Impact of the Minor findings

Both are pre-existing patterns already present in `run-eval.mjs` before this change (confirmed by
reading the file's own analyzer output before the refactor) and recorded in repo memory as an
"analyzer-modeling gap" for path operations over fixed, repo-internal directories — not a regression
introduced by this Brief. Not blocking.

## Coverage Note

This pass reviewed the diff to `run-eval.mjs`, the new `lib/tasks.mjs` and `ablate-artifact.mjs`, and
the doc/attribution updates, against the Brief's Files/Constraints/Do-NOT sections. It did not
attempt a real ablation run against a live coding agent (no agent CLI available in this environment)
— the smoke test used a no-op stub agent to prove plumbing only, not to produce a real keep/trim
judgment about any actual skill file.

## Verdict

No blocking or high-severity findings. Proceed to Review Depth.
