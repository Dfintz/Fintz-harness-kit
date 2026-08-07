---
stage: feedback
date: 2026-08-07
status: completed
brief: .github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md
artifact_family: review
immutability: mutable
---
# Feedback Verdict Record - Sandcastle comparative review

resource: .github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md, .github/harness/memory/briefs/sandcastle-comparative-review-breadth-2026-08-07.md, .github/harness/memory/briefs/sandcastle-comparative-review-depth-2026-08-07.md, .github/harness/memory/reviews/implementation-notes-sandcastle-comparative-review-2026-08-07.md

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Should we integrate Sandcastle wholesale? | Current decision holds: no | Sandcastle provider/worktree runtime is broader than current harness ownership; local surfaces already own loops, graph, memory, MCP, and prompt packs | HIGH | Do not add dependency or sandbox runtime in this pass |
| 2 | Is there anything worth cherry-picking? | Challenge upheld: yes | Structured output, schema validation, extraction retry, diff-line filtering, and workflow templates are small reusable ideas | HIGH | Prioritize structured artifact extraction and review filtering slices |
| 3 | Should label-triggered implement/review workflows be copied? | Third option | The workflow shape is useful, but write permissions and `pull_request_target` make direct copy unsafe | HIGH | Design a separate least-privilege workflow pilot before implementation |
| 4 | Should worktree locking be adopted now? | Current decision holds: defer | Worktree locks solve concurrent managed-worktree access; this harness does not currently own that runtime | MEDIUM | Revisit only if managed worktrees/concurrent sandbox execution are added |

## Accepted changes

- Persist the comparative Architecture Brief and stage review artifacts.
- Treat structured artifact extraction and diff-aware review validation as the top two follow-up candidates.

## Rejected challenges

- Rejected wholesale Sandcastle adoption for now because it would change the harness from an operating contract/tooling kit into a sandbox execution runtime.
- Rejected direct GitHub workflow copying without a separate security and permissions design.

## Deferred points

- Whether to integrate real sandbox providers remains deferred until a concrete user story requires isolated parallel agent execution.
- Whether to ship mutating GitHub Actions remains deferred until a threat model and approval boundary exist.

## Brief updates

- No settled decisions changed after review.
- Constraints remain: no Sandcastle dependency, no runtime sandbox adoption, no mutating GitHub workflows without a separate design.

## Response notes

- Recommended near-term integration: build a harness-native structured artifact extraction utility with tests, then add diff-aware review-output validation.
- Recommended non-adoption: keep Sandcastle's full sandbox runtime and label-mutating workflows as reference material until there is an explicit runtime/permissions requirement.