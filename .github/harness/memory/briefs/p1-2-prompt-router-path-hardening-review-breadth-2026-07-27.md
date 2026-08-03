---
summary: "P1-2 Prompt-Router Path Hardening Review Breadth - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [prompt, router]
---
# P1-2 Prompt-Router Path Hardening Review Breadth - 2026-07-27
resource: .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-implementation-2026-07-27.md, scripts/harness/prompt-router.mjs, .github/harness/runs/prompt-packs/p1-2-tamper-test/manifest.json

## Findings Ledger

### Major
- None.

### Minor
- None.

### Nit
- None.

### FYI
- Artifact: scripts/harness/prompt-router.mjs
- Finding: Snyk SAST command did not execute because the folder is not trusted for Snyk scans in this environment.
- Evidence: `mcp_snyk_mcp_serv_snyk_code_scan` returned `folder ... is not trusted. Please run 'snyk_trust' first`.
- Impact: No additional Snyk vulnerability signal was produced for this pass.
- Confidence: HIGH
- Recommended fix: Run `snyk_trust` only with explicit user instruction, then rerun Snyk code scan.

## Coverage Note
- Reviewed changed path-hardening helpers, manifest path-field validation flow, behavior smoke tests, adversarial selector tests, tampered-manifest tests, docs contract check, and static diagnostics.
- Did not re-review unrelated router commands or prior backlog changes outside next-actions file IO support paths.

## Missing-Context Note
- Graph refresh remained degraded due missing understand-anything plugin root; this affects graph freshness confidence only, not the deterministic command-level proofs executed in this pass.
