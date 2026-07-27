# Run Contract

resource: scripts/harness/record-run.mjs, scripts/harness/harness-report.mjs

This file defines the minimal unattended-run artifact contract for status and provenance fields.

## Purpose

Normalize run status semantics and persist deterministic commit anchors so operators can audit what a run produced.

## Journal fields

- `terminalState`: `converged | exhausted | stuck | blocked`
- `runStatus`: `draft | ready-for-dev | in-progress | in-review | done | blocked`
- `baselineRevision`: commit SHA or `NO_VCS`
- `finalRevision`: commit SHA or `NO_VCS`
- `provenance`: object mirror of revision fields
  - `provenance.baselineRevision`
  - `provenance.finalRevision`

## Backward compatibility

Older journals without `runStatus` and provenance fields remain valid.

Reader fallback rules:

1. `runStatus` fallback from `terminalState`:
   - `converged -> done`
   - `blocked -> blocked`
   - `exhausted | stuck -> in-review`
   - otherwise `unknown`
2. `baselineRevision` fallback:
   - `baselineRevision`
   - `provenance.baselineRevision`
   - `baseline.commit`
   - `NO_VCS`
3. `finalRevision` fallback:
   - `finalRevision`
   - `provenance.finalRevision`
   - `baselineRevision`

## Writer defaults

When recording a run:

- `runStatus` defaults from `terminalState` using the mapping above unless explicitly provided.
- `baselineRevision` defaults to current `HEAD` if available, else `NO_VCS`.
- `finalRevision` defaults to `baselineRevision` unless explicitly provided.