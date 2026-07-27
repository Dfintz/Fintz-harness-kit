# CodeRabbit Gap Implementation Brief - 2026-07-26
resource: .github/harness/memory/radar/coderabbit-pr-review.md, .github/harness/HARNESS.md, .github/instructions/05-REVIEW-BREADTH.md

## Gap statement

Adopted entry remains not integrated because repository prerequisite is unresolved: GitHub App installation and root-level .coderabbit.yaml are missing.

## Scope

- In scope:
  - Define minimal post-approval implementation path and acceptance checks.
- Out of scope:
  - Installing GitHub App (human/admin action).
  - Claiming integration before prerequisite is satisfied.

## Implementation steps (after human approval)

1. Install CodeRabbit GitHub App on the repository.
2. Add .coderabbit.yaml with harness review expectations (brief conformance, no guardrail weakening).
3. Add HARNESS.md note: CodeRabbit is optional first-pass, never a replacement for Review Depth.
4. Validate PR workflow by opening a draft PR and confirming CodeRabbit comments/checks appear.

## Acceptance criteria

- .coderabbit.yaml exists at repo root with harness-aware review policy.
- HARNESS guidance includes first-pass role boundary.
- One PR evidence capture confirms scanner output in CI/PR context.

## Risk and guardrails

- Keep human review gates unchanged.
- Do not make CodeRabbit required for local development flow.
