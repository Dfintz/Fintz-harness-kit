---
stage: implement
date: 2026-08-07
status: completed
brief: .github/harness/memory/briefs/sandcastle-structured-output-slice-2026-08-07.md
---
# Implementation Notes - Sandcastle structured output slice

## Scope

Implemented the first Sandcastle cherry-pick slice as a small harness-native structured output helper and deterministic test suite. No Sandcastle dependency, sandbox provider, GitHub workflow automation, or caller integration was added.

## Pre-implementation checklist

- [x] Confirmed router selected the full non-trivial stage sequence.
- [x] Confirmed graph freshness and provider readiness.
- [x] Confirmed prior Sandcastle comparative Brief selected structured artifact extraction as the first follow-up slice.
- [x] Confirmed no existing `scripts/harness` structured-output utility covered the proposed behavior.

## Changes made

- `scripts/harness/structured-output.mjs` - added `StructuredOutputError`, last-tag extraction, fence unwrap, string extraction, JSON extraction, validator hook, and generic dispatcher.
- `scripts/harness/test/structured-output-test.mjs` - added deterministic coverage for last-match-wins, missing tags, fenced JSON, invalid JSON, validation failure, string mode, and unsupported type.
- `package.json` - added `test:harness:structured-output` and included it in `test:harness:core`.

## Evidence captured

- `node scripts/harness/prompt-router.mjs route --task "start the process of cherry pick" --json`
- `node scripts/harness/prompt-router.mjs handoff --task "start the process of cherry pick"`
- `npm run harness:graph -- status`
- `npm run harness:docs:check` after Brief creation: OK
- Architect Challenge: `VERDICT: APPROVED`
- `npm run test:harness:structured-output`: PASS
- `npm run test:harness:core`: PASS
- `get_errors` on touched code/package files: no errors found

## Self-review checklist

- [x] Implementation follows the Brief's no-dependency and no-runtime-integration constraints.
- [x] Parser failure modes are explicit and test-covered.
- [x] Structured output remains orthogonal to completion signals.
- [x] The new test is wired into the aggregate core validation path.
- [x] No unrelated user changes were reverted.