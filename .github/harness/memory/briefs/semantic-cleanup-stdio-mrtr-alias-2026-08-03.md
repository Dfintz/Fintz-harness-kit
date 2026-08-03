# Architecture Brief — Semantic Cleanup for stdio MRTR Command
resource: package.json,scripts/harness/test/mcp-stdio-slice-b-mrtr-sdk-client-test.mjs

## Scope
Introduce a semantic command name for the stdio MRTR test and preserve compatibility via alias chaining.

## Impacted Files
- package.json

## Decisions
- Add canonical semantic command: `test:mcp:stdio:mrtr`.
- Preserve old command `test:mcp:stdio:mrtr` as a compatibility alias that chains to canonical command.
- Keep all HTTP semantic naming and existing aggregate command behavior unchanged.
- Maintain command-surface policy compliance by avoiding exact duplicate script bodies.

## Constraints
- Non-breaking behavior for existing users invoking `test:mcp:stdio:mrtr`.
- No changes to test implementation file path or runtime semantics.
- Align with prior command-surface normalization pattern (canonical name + alias chain).

## Do-NOTs
- Do not remove `test:mcp:stdio:mrtr` in this pass.
- Do not add exact duplicate command bodies that fail `harness:commands:check`.
- Do not modify unrelated command namespaces.

## Assumptions
- The stdio test currently referred to as `slice-b` corresponds to MRTR SDK client coverage.
- Existing automation can continue using the old alias during transition.

## Gate Check (Architect)
- Gate 1 (Problem framing): PASS
- Gate 2 (Interface stability): PASS
- Gate 3 (Ownership boundaries): PASS
- Gate 4 (Safety/validation): PASS
- Gate 5 (Rollback clarity): PASS
