---
artifact_family: review
immutability: mutable
---

# Team Memory Access Control
resource: .github/harness/memory/access-policy.json,scripts/harness/mcp-server.mjs,scripts/harness/memory-access-control.mjs,scripts/harness/mcp-auth-validator.mjs

This harness supports centralized team memory with policy-based access control for memory tools and memory resources.

## Objective
- Keep `.github/harness/memory/` as a shared memory source.
- Enforce domain access boundaries (example: non-HR users cannot read HR-tagged memory).
- Apply checks at the MCP server boundary, not inside individual clients.

## Enforcement Points
- MCP tools:
  - `memory-list`
  - `memory-search`
  - `memory-read`
- MCP Resources API:
  - `ListResources` filters memory resources by caller access.
  - `ReadResource` denies reads for unauthorized memory resources.

## Policy File
- File: `.github/harness/memory/access-policy.json`
- Keys:
  - `enabled`: enable/disable ACL enforcement.
  - `defaultAllow`: default decision when no zone matches.
  - `rolloutProfile`: optional profile selector (`permissive` or `deny-first`).
  - `rolloutProfiles`: optional profile map that can override `defaultAllow`.
  - `zones[]`: ordered matching rules.
  - `starterTags`: starter tag catalog for team memory classification.

### Rollout profiles
Use the optional profile selector to switch behavior with one flag change:

- Permissive rollout: `"rolloutProfile": "permissive"` (effective `defaultAllow: true`)
- Strict rollout: `"rolloutProfile": "deny-first"` (effective `defaultAllow: false`)

If `rolloutProfile` is omitted or invalid, the top-level `defaultAllow` value is used.

### Zone Model
A zone evaluates in order:
1. `match` determines whether a memory entry belongs to the zone.
2. `deny` (optional) blocks matching principals.
3. `allow` (optional) allows matching principals; non-matching principals are denied.
4. `defaultAllow` (optional) fallback when no allow/deny applies.

### Match Selectors
- `match.pathPrefixes`: workspace-relative path prefixes.
- `match.scopes`: memory scope names (for example `lessons`, `briefs`, `reviews`).
- `match.tags`: tags parsed from markdown frontmatter (`tags`).

## Caller Context
The server reads caller identity from MCP request context (`request.params.context.caller`):
- `id` or `userId`
- `role`
- `teams` (array) or `team` (comma-separated string)

For HTTP adapter deployments, caller context can also come from headers:
- `HARNESS_CALLER_ID_HEADER` (default `x-harness-caller-id`)
- `HARNESS_CALLER_ROLE_HEADER` (default `x-harness-caller-role`)
- `HARNESS_CALLER_TEAMS_HEADER` (default `x-ms-groups`)

The teams header supports comma- or semicolon-separated values, aligning with AD/Entra group forwarding.

## HR Isolation Example
- Add `hr` tag in frontmatter of sensitive memory documents.
- Configure `hr-memory` zone in `.github/harness/memory/access-policy.json`.
- Set caller `teams: ["hr"]` or role `hr`/`admin` for authorized principals.
- Non-HR principals will not see or read matching entries.

## Starter domain templates

The policy ships starter zone templates and tags for:

- `hr`
- `finance`
- `legal`
- `security`
- `it`
- `sales`
- `management`

Each template follows the same pattern:

- `match.tags`: `["<domain>"]`
- `allow.roles`: `["<domain>", "admin"]`
- `allow.teams`: `["<domain>"]`
- `defaultAllow`: `false`

## Verification command

Run the mocked-caller ACL end-to-end test:

```bash
npm run test:mcp:memory:acl
```

Run the HTTP adapter Active Directory groups integration test:

```bash
npm run test:mcp:http:memory-acl-ad-groups
```

## Open WebUI + AD groups implementation notes
- Keep Open WebUI behind an auth boundary that emits user/group headers.
- Forward group claims to the adapter teams header (default `x-ms-groups`).
- Set policy `enabled: true` in `.github/harness/memory/access-policy.json` after validating allow/deny behavior.

## Backward Compatibility
- If policy file is absent or `enabled: false`, behavior remains unchanged.
- Existing MCP clients do not need contract changes.
