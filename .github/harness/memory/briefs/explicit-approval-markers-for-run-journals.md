# Brief: Explicit approval markers for run journals - active

Date: 2026-06-15

## Scope

Make pending approvals strict by deriving them only from explicit approval markers embedded in run journals, not inferred from active briefs and blocked/stuck states.

## Impacted files

- scripts/harness/run-loop.mjs
- scripts/harness/record-run.mjs
- scripts/harness/harness-report.mjs
- README.md

## Architectural gate verdicts

1. Domain/module alignment: PASS

- All changes stay in the harness reporting/runtime domain and operate on harness run journals.

2. Generality test: PASS

- Approval metadata is a reusable run-journal concern and belongs at journal write/read boundaries.

3. Data ownership verification: PASS

- Journal ownership remains with writers (`run-loop.mjs`, `record-run.mjs`), dashboard only reads.

4. Layer boundary audit: PASS

- Writers only serialize metadata; report only aggregates/presents; no cross-layer leakage.

5. Reuse potential: PASS

- A shared approval shape prevents future ad-hoc pending logic and keeps dashboard behavior deterministic.

## Decisions

- Introduce an explicit `approval` object at run-journal root:
  - `approval.required: boolean`
  - `approval.status: pending | approved | rejected | not-required`
  - `approval.note?: string`
  - `approval.requestedAt?: ISO timestamp`
  - `approval.decidedAt?: ISO timestamp`
- `run-loop.mjs` always writes explicit non-pending default marker (`required=false`, `status=not-required`).
- `record-run.mjs` accepts approval CLI controls and writes explicit approval marker to every recorded workflow journal.
- `harness-report.mjs` pending-approval section is sourced strictly from journals where `approval.required === true` and `approval.status === pending`.
- Keep backwards compatibility by treating journals without `approval` as `not-required` (not pending).

## Constraints

- Keep current run-loop behavior and exit codes unchanged.
- No destructive migration of existing journal files.
- Preserve existing dashboard sections and only change pending-approval derivation.

## Do-NOTs

- Do not infer pending approvals from brief status.
- Do not infer pending approvals from terminal states (`blocked`, `stuck`, `exhausted`).
- Do not make approval mandatory for all runs.

## Assumptions

- Approval is an operator workflow signal, not an automatic terminal-state proxy.
- Current users can supply approval context when recording workflow runs.

## Validation plan

- Generate one journal with explicit pending approval and confirm dashboard counts it.
- Generate/inspect non-approval journal and confirm it is excluded from pending queue.
- Run `node scripts/harness/harness-report.mjs --no-html` and HTML generation path.
