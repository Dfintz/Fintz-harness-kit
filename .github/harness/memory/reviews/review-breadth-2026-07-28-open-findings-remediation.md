# Review Breadth Findings - Open Findings Remediation (2026-07-28)

## Context Sufficiency
- Scope: graph freshness, memory-link runtime wiring, legacy empty artifact cleanup.
- Evidence: command outputs from graph status/provider, memory-link status/build, mcp find before/after, reference sweep, docs contract check.

## Findings Ledger

### Blocker
- None.

### Major
- None.

### Minor
1. Artifact: command usage consistency in notes
   Finding: command syntax in current remediation artifacts is now normalized to `npm run harness:graph status`.
   Evidence: normalization patch applied to active remediation brief/review set; no remaining mixed form in scoped artifacts.
   Impact: closed minor reproducibility ambiguity in current runbook artifacts.
   Confidence: HIGH
   Recommended fix: keep using the normalized form in future remediation artifacts.

## Coverage Note
- Inspected: remediation code path in `harness-mcp-tasks.mjs`, memory-link operational state, graph freshness state, legacy `.new` script files, docs contract checks.
- Not inspected: unrelated MCP runtime behaviors outside this remediation.
