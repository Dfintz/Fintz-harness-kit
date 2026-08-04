---
artifact_family: architect
immutability: mutable
---

# Brief: openwebui-active-directory-groups-memory-acl-2026-08-04 - active
resource: scripts/harness/http-adapter.mjs,scripts/harness/mcp-auth-validator.mjs,scripts/harness/memory-access-control.mjs,.github/harness/memory/access-policy.json,.github/harness/TEAM-MEMORY-ACCESS-CONTROL.md,scripts/harness/test/mcp-memory-acl-e2e-test.mjs

Date: 2026-08-04
Task: implement access-controlled memory tooling for Open WebUI and Active Directory security group context.
Scope: security + integration

## Understand Snapshot
- HTTP adapter currently authenticates requests but dispatches tools directly to mcp-tools wrappers.
- Memory ACL enforcement exists in mcp-server paths, but HTTP adapter path does not apply equivalent filtering.
- Active Directory security groups are not yet normalized from request headers into caller teams in HTTP path.

## Architectural Gates (1-5)
1. Domain alignment: PASS. Change belongs to MCP HTTP integration and security boundary.
2. Generality: PASS. Header-to-caller normalization supports Open WebUI plus other gateways.
3. Ownership: PASS. HTTP adapter should own request-header interpretation and call-level context shaping.
4. Boundary integrity: PASS. Keep ACL evaluation in shared memory-access-control and enforce at adapter response boundary for memory tools.
4b. Isolation/safety: PASS. Denied memory entries must not leak entry names/content; use generic deny/not-found messaging.
5. Reuse: PASS. Reuse extractCallerIdentity + buildCallerAccessContext + evaluateMemoryAccess.

## Files To Modify
- scripts/harness/http-adapter.mjs
- scripts/harness/test/mpc-auth-test.mjs
- .github/harness/TEAM-MEMORY-ACCESS-CONTROL.md

## Files To Create
- scripts/harness/test/mcp-http-memory-acl-ad-groups-test.mjs
- .github/harness/memory/reviews/architect-challenge-verdict-2026-08-04-openwebui-ad-groups-memory-acl.md
- .github/harness/memory/reviews/review-breadth-findings-2026-08-04-openwebui-ad-groups-memory-acl.md
- .github/harness/memory/reviews/review-depth-findings-2026-08-04-openwebui-ad-groups-memory-acl.md
- .github/harness/memory/briefs/feedback-verdict-2026-08-04-openwebui-ad-groups-memory-acl.md

## Interface Decisions
- Add caller extraction in HTTP adapter from configurable headers:
  - HARNESS_CALLER_ID_HEADER
  - HARNESS_CALLER_ROLE_HEADER
  - HARNESS_CALLER_TEAMS_HEADER
- Default teams header should support AD group emission (x-ms-groups) and platform aliases.
- Apply memory ACL filtering in HTTP adapter for memory-list/search and deny guard for memory-read.
- Principal selector matching uses OR semantics across role/caller/team selectors so AD group membership alone can authorize when configured.

## Constraints
- Keep existing tool endpoint contracts stable.
- Preserve backward compatibility when policy disabled.
- Do not require Open WebUI-specific runtime changes to keep generic integration.

## Do-NOTs
- Do NOT weaken API-key auth requirements.
- Do NOT expose denied resource identifiers/content in error bodies.
- Do NOT force default policy mode to deny-all in this patch.

## Assumptions
- AD group context is forwarded as HTTP headers by upstream auth boundary.
- Operators can map custom header names via env vars if not using x-ms-groups.

## Definition Of Done
- HTTP adapter enforces memory ACL with caller teams from headers.
- Test proves AD group header grants/denies access as expected.
- Docs include Open WebUI + AD header integration guidance.
