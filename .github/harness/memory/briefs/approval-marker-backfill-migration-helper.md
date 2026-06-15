# Brief: Approval marker backfill migration helper - active

Date: 2026-06-15

## Scope

Add a small CLI migration helper that backfills explicit approval markers into historical run journals that predate the approval field, defaulting to `not-required` for normalization.

## Impacted files

- scripts/harness/migrate-approval-markers.mjs (new)
- package.json
- README.md
- .github/harness/registry.json

## Architectural gate verdicts

1. Domain/module alignment: PASS

- This is a harness runtime/data-maintenance concern and belongs in `scripts/harness/`.

1. Generality test: PASS

- The migration logic is generic for all legacy run journals and reusable for operational maintenance.

1. Data ownership verification: PASS

- Journals in `.github/harness/runs/` are owned by harness runtime; helper mutates only those files.

1. Layer boundary audit: PASS

- No UI or API coupling; pure filesystem migration utility.

1. Reuse potential: PASS

- A dedicated backfill command avoids repeated ad hoc scripting and ensures deterministic normalization.

## Decisions

- Create `scripts/harness/migrate-approval-markers.mjs` with options:
  - `--dry-run` (report only)
  - `--force` (rewrite even when approval marker exists)

- Apply only to valid loop journals (`loop` string + `iterations` array).

- Backfilled default marker:
  - `approval.required = false`
  - `approval.status = not-required`

- Preserve existing approval marker unless `--force` is used.
- Output a concise summary with scanned/updated/skipped/invalid counts.

## Constraints

- Do not modify eval journals or unrelated JSON payloads.
- Keep migration idempotent by default.
- Avoid destructive behavior and avoid touching non-JSON files.

## Do-NOTs

- Do not infer approval from terminal state.
- Do not infer approval from brief status.
- Do not overwrite explicit approval metadata unless explicitly requested.

## Assumptions

- Legacy datasets may have mixed journal ages.
- Operators may run migration repeatedly as new historical files are added.

## Validation plan

- Run in `--dry-run` and verify expected counts.
- Run without `--dry-run` and confirm backfilled journals now include `approval` marker.
- Re-run to verify idempotency (updates should drop to zero).
