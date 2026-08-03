# Architecture Brief — Stdio Slice Naming Follow-up Pass
resource: package.json,.github/harness/memory/briefs/semantic-cleanup-stdio-mrtr-alias-2026-08-03.md

## Scope
Run a follow-up pass to unify any remaining slice-style stdio command names beyond the already migrated MRTR command.

## Impacted Files
- package.json (inspection target)

## Decisions
- Keep `test:mcp:stdio:mrtr` as the canonical semantic stdio MRTR command.
- Keep `test:mcp:stdio:mrtr` as a compatibility alias to avoid breaking downstream automation.
- Do not introduce further renames because no additional slice-style stdio command names remain.

## Constraints
- Preserve backward compatibility for existing users and CI scripts.
- Preserve command-surface policy compliance.

## Do-NOTs
- Do not remove compatibility alias in this follow-up pass.
- Do not touch unrelated command namespaces.

## Assumptions
- The user requested command-name unification, not historical memory-artifact text cleanup.

## Gate Check (Architect)
- Gate 1 (Problem framing): PASS
- Gate 2 (Interface stability): PASS
- Gate 3 (Ownership boundaries): PASS
- Gate 4 (Safety/validation): PASS
- Gate 5 (Rollback clarity): PASS
