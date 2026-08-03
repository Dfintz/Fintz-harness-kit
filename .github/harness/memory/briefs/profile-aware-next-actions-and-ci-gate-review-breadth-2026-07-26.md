---
summary: "Review Breadth Findings - Profile-Aware Next-Actions and CI Gate - 2026-07-26"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [profile, aware, next, actions]
---
# Review Breadth Findings - Profile-Aware Next-Actions and CI Gate - 2026-07-26
resource: scripts/harness/prompt-router.mjs, .github/workflows/harness-optional-security-gates.example.yml, SETUP.md

## Findings ledger

### Blocker

- None.

### Major

- None.

### Minor

- None.

### Nit

- None.

### FYI

- Artifact: workflow syntax validation
- Finding: local environment does not provide a YAML parser command (ConvertFrom-Yaml and js-yaml unavailable), so structural validation relied on file review plus command compatibility checks only.
- Evidence: local command attempts during this run.
- Impact: low residual risk of YAML formatting issue remains until checked by GitHub Actions parser.
- Confidence: MEDIUM
- Recommended fix: trigger workflow in a test branch or validate with actionlint in CI image.

## Coverage note

- Covered router flag behavior (`--pack`, `--pack-latest`, `--profile`) including conflict and missing-pack errors.
- Covered docs-check default and changed-surface modes with explicit base ref.
- Covered CI example toggle semantics and optional step wiring.

## Missing-context note

- Graph freshness remained stale; file-backed inspection used for impact and ownership analysis.
