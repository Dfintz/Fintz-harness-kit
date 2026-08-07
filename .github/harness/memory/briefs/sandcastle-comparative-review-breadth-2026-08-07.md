---
summary: "Review breadth - Sandcastle comparative review"
type: brief
status: implemented
source: review
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, review-breadth, structured-output, workflows]
artifact_family: review
immutability: mutable
---

# Review Breadth Findings - Sandcastle comparative review

resource: .github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md, implementation-notes-sandcastle-comparative-review-2026-08-07.md, scripts/harness/prompt-router.mjs, scripts/harness/council-review.mjs, .github/harness/loops/review-fix.json, external sandcastle commit e99f832f26dc9d245c019a9ddd19fa5dee792427

## Findings

### Blocker

- None.

### Major

- None.

### Minor

- None.

### FYI

- Artifact: `.github/harness/memory/briefs/sandcastle-comparative-review-2026-08-07.md`
  Finding: The best Sandcastle cherry-pick is the structured-output/review-validation pattern, not the full sandbox runtime.
  Evidence: Sandcastle's `Output.object` and workflow validation helpers are small and orthogonal to its provider abstraction; this harness already owns prompt routing, loops, graph, memory, MCP, and council review.
  Impact: Future work should start with a small utility and tests instead of adding a broad dependency or runtime surface.
  Confidence: HIGH.
  Recommended fix: Use the Brief's first two follow-up slices as the implementation backlog.

- Artifact: Sandcastle `.github/workflows/agent-review.yml` and `.github/workflows/agent-implement.yml`
  Finding: Label-triggered GitHub workflows are useful but should not be copied directly.
  Evidence: The workflows mutate branches, labels, PR reviews, and comments; `agent-review.yml` runs on `pull_request_target`.
  Impact: A direct copy could widen repository write authority without a harness-owned threat model.
  Confidence: HIGH.
  Recommended fix: Treat workflow automation as a separate approved design with least-privilege permissions and dry-run proof.

## Coverage note

- Reviewed requirement coverage, external Sandcastle architecture, local harness ownership boundaries, security implications of GitHub workflows, and proof quality for this no-code assessment.
- Did not run Sandcastle's tests or execute its workflows; the task was comparative review, not external package validation.

## Missing-context note

- No local requirement currently demands isolated sandbox execution, so provider/runtime adoption remains intentionally deferred.