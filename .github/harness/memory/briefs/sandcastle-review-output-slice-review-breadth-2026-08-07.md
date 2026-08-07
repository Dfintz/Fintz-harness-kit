---
summary: "Review breadth - Sandcastle review output slice"
type: brief
status: implemented
source: review
created: 2026-08-07
updated: 2026-08-07
tags: [sandcastle, review-output, review-breadth]
artifact_family: review
immutability: mutable
---

# Review Breadth Findings - Sandcastle review output slice

resource: .github/harness/memory/briefs/sandcastle-review-output-slice-2026-08-07.md, scripts/harness/review-output.mjs, scripts/harness/test/review-output-test.mjs, package.json, .github/harness/memory/reviews/implementation-notes-sandcastle-review-output-slice-2026-08-07.md

## Findings

### Blocker

- None.

### Major

- None.

### Minor

- None.

### FYI

- Artifact: `scripts/harness/review-output.mjs`
  Finding: The utility validates right-side hunk line numbers but does not model GitHub's full review-comment position API.
  Evidence: The Brief explicitly scopes this slice to pre-API local filtering; no GitHub calls or PR posting paths were added.
  Impact: Future PR automation will still need an adapter test against GitHub's accepted comment payload shape.
  Confidence: HIGH.
  Recommended fix: Add GitHub adapter validation only in a separately approved workflow/PR automation slice.

- Artifact: `package.json`
  Finding: The original Snyk socket-hang note is resolved; the remaining IaC result is a scanner mismatch, not a package defect.
  Evidence: Snyk auth status now reports user `Dfintz`; the exact VS Code Snyk IaC command now returns `Could not find any valid IaC files` for `package.json`; the correct Snyk SCA scan reports `issueCount: 0`; `npm ls hono` resolves `hono@4.12.34`.
  Impact: Package-manifest security evidence is clean for this slice. A stale Problems entry may persist until the Snyk extension cache/language server refreshes, but the underlying CLI/auth/dependency state is fixed.
  Confidence: HIGH.
  Recommended fix: Use Snyk SCA for `package.json`; do not treat `snyk iac test package.json` as a valid package-manifest check.

## Coverage note

- Reviewed requirement coverage, test proof, package script wiring, invalid-input behavior, and the no-GitHub-API safety boundary.
- This pass did not evaluate real PR comment posting because the Brief explicitly deferred it.

## Missing-context note

- No real GitHub PR adapter exists in this slice; API-specific payload acceptance remains future work.