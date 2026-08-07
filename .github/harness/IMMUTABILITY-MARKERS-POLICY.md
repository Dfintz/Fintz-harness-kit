# Immutability Markers Policy

resource: scripts/harness/validate-doc-contracts.mjs,.github/harness/memory/reviews/architect-challenge-verdict.md,.github/agents/architect-challenge.agent.md,scripts/harness/new-brief.mjs

This policy standardizes immutable/frozen marker usage for architect, review, and challenge
artifact families.

## Required Frontmatter Keys

Every artifact in scope must declare:

- `artifact_family`: `architect` | `review` | `challenge`
- `immutability`: `mutable` | `frozen` | `append-only`

Conditional requirement:

- If `immutability: frozen`, include `immutable_since: YYYY-MM-DD`.

## Family Detection Rules

- `challenge`: filenames containing `architect-challenge` or beginning with `architect-challenge-verdict`.
- `review`: filenames containing `review-breadth`, `review-depth`, `feedback-verdict`, or beginning with `REVIEW-stage`.
- `architect`: filenames containing `architecture-brief`.

## Enforcement Scope

- Enforced by `scripts/harness/validate-doc-contracts.mjs`.
- Enforcement is applied to changed markdown files in the current diff.
- Legacy untouched files are not hard-failed by this policy.

## Marker Examples

```yaml
---
artifact_family: challenge
immutability: frozen
immutable_since: 2026-08-04
---
```

```yaml
---
artifact_family: architect
immutability: mutable
---
```

## Operational Guidance

1. Use `mutable` while the artifact is still under active revision.
2. Set `frozen` when the artifact becomes a reference baseline.
3. Use `append-only` for logs/audit streams that only accept additive updates.