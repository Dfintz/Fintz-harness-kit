---
artifact_family: review
immutability: frozen
immutable_since: 2026-08-04
---

# Review Breadth Findings
resource: scripts/harness/http-adapter.mjs,scripts/harness/memory-access-control.mjs,scripts/harness/test/mcp-http-memory-acl-ad-groups-test.mjs,.github/harness/TEAM-MEMORY-ACCESS-CONTROL.md

## Verdict
PASS

## Findings Ledger
### Blocker
- None.

### Major
- None.

### Minor
- [Minor] Header-to-caller mapping is configurable via environment variables, so deployment docs must pin canonical values per environment to avoid drift.
  Confidence: High
  Evidence: HARNESS_CALLER_ID_HEADER/HARNESS_CALLER_ROLE_HEADER/HARNESS_CALLER_TEAMS_HEADER in scripts/harness/http-adapter.mjs.

## Coverage Notes
- Open WebUI-compatible HTTP integration path now enforces memory ACL for memory-list/search/read.
- AD/Entra group claims in headers are normalized into caller teams.
- Denied memory reads return a non-disclosing error shape.
- End-to-end test validates allow/deny and list filtering behavior.
