# Release Notes v3.1.1

Date: 2026-08-03

## Summary

This release completes the second staged command-surface cleanup pass:

- Removes deprecated typo aliases `test:mpc:*`.
- Adds deterministic command-surface policy enforcement for exact duplicate script bodies.
- Wires the policy gate into validator-owned checks and CI example guidance.

## Breaking Change Window: `test:mpc:*` Removal

The following deprecated aliases are removed in v3.1.1 and now fail by design:

- `test:mpc:dispatch`
- `test:mpc:dispatch:command`
- `test:mpc:dispatch:rate-limit`
- `test:mpc:dispatch:auth`
- `test:mpc:dispatch:template`
- `test:mpc:dispatch:integration`

### Migration Matrix

| Removed alias | Canonical replacement |
| --- | --- |
| `test:mpc:dispatch` | `test:mcp:dispatch` |
| `test:mpc:dispatch:command` | `test:mcp:dispatch:command` |
| `test:mpc:dispatch:rate-limit` | `test:mcp:dispatch:rate-limit` |
| `test:mpc:dispatch:auth` | `test:mcp:dispatch:auth` |
| `test:mpc:dispatch:template` | `test:mcp:dispatch:template` |
| `test:mpc:dispatch:integration` | `test:mcp:dispatch:integration` |

## New Policy Gate: Duplicate Script Bodies

A new policy check fails when multiple scripts share the same exact command body.

- New command: `npm run harness:commands:check`
- Validator path: `node scripts/harness/validate-doc-contracts.mjs` now enforces duplicate-body policy directly.
- CI example path: `.github/workflows/harness-optional-security-gates.example.yml` now runs the policy step unconditionally.

## Rollback Trigger and Procedure

If downstream automation reports breakage from alias removal:

1. Reintroduce temporary `test:mpc:*` shim aliases in one hotfix commit.
2. Publish a patch note with migration reminder and sunset date.
3. Remove shims again in the next approved breaking window.
