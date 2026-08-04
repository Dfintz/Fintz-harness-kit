# Release Notes v3.2.0

Date: 2026-08-04

## Summary

v3.2.0 strengthens the harness MCP and memory-governance surfaces while keeping local operational data out of the public repository.

## Highlights

- Adds memory ACL policy support for caller roles and AD/Entra group mappings.
- Protects memory tool results and resource listings with the same access policy.
- Prevents HTTP request-body caller data from overriding the configured upstream caller context.
- Adds Teams agent support for interactive approval workflows.
- Adds OKF-compatible memory metadata migration, reporting, and validation improvements.

## Public Repository Hygiene

- Harness run journals, feature handoffs, approval logs, generated reports, and migration receipts are now ignored.
- The runs directory retains only `.gitkeep` and `run-contract.md` as its public contract.

## Validation

- `npm run test:mcp:dispatch`
- `npm run test:mcp:http:memory-acl-ad-groups`
- `node scripts/harness/test/mcp-resources-integration-test.mjs`
- `npm run harness:docs:check`