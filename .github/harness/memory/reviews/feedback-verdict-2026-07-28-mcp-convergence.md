# Feedback Verdict Record - 2026-07-28

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Schema and runtime disagree on command object format | Challenge upheld | `harness.config.json` object command (`test-filter`), old schema restriction, failing canonical dispatch tests pre-fix | HIGH | Updated `harness.config.schema.json` to support string or `{command, vars}`. |
| 2 | `mcp`/`mpc` naming drift causes poor command discoverability | Third option | Existing `mpc` tests pass, but command surface lacked canonical `mcp` scripts | HIGH | Added canonical `test:mcp:dispatch*` scripts and retained `test:mpc:*` aliases for compatibility. |
| 3 | Legacy `mpc-audit` should be removed immediately | Current decision holds (modified) | Potential unknown legacy consumers and no active imports | MEDIUM | Kept file as shim re-export to canonical `mcp-audit` instead of hard delete. |
| 4 | Command-dispatch test failures are only test drift | Challenge upheld (runtime bug also existed) | Empty command falsely treated as missing due falsy lookup in `mcp-tools.mjs` | HIGH | Fixed runtime lookup check to `commandEntry === undefined`; tests now pass. |

## Accepted changes
- Schema/runtime contract alignment for command definitions.
- Canonicalized test command namespace under `mcp` with compatibility aliases.
- Runtime dispatch bug fix for falsy empty command entries.
- Compatibility shim for `mpc-audit` to remove dual implementation risk.

## Rejected challenges
- Immediate deletion of all legacy `mpc` files was rejected due compatibility risk.

## Deferred points
- Refresh stale knowledge graph before next non-trivial stage cycle.
- Build memory-link index to restore full `harness:mcp:find` retrieval surface.
- Decide final disposition of `.new` legacy artifacts after explicit owner confirmation.

## Brief updates
- Architect Challenge mandatory fixes are now implemented and validated.
- No Do-NOT rule changes required.
- Assumptions on graph freshness remain active and explicitly tracked.

## Response notes
- Runtime and schema now agree on command shape.
- Command-dispatch tests are wired under canonical `mcp` names and pass end-to-end.
- Legacy compatibility remains available while convergence proceeds safely.
