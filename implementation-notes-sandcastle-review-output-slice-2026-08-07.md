---
stage: implement
date: 2026-08-07
status: completed
brief: .github/harness/memory/briefs/sandcastle-review-output-slice-2026-08-07.md
---
# Implementation Notes - Sandcastle review output slice

## Scope

Implemented the second Sandcastle cherry-pick slice as a pure local review-output validation and diff-filtering helper. No GitHub API calls, workflow labels, PR mutation, or sandbox behavior were added.

## Pre-implementation checklist

- [x] Confirmed router selected the full non-trivial stage sequence.
- [x] Confirmed graph freshness and provider readiness.
- [x] Confirmed the prior comparative Brief listed review-output validation and diff filtering as the next follow-up slice.
- [x] Confirmed no existing `scripts/harness` utility already validates review inline comments or replies against diff/thread evidence.

## Changes made

- `scripts/harness/review-output.mjs` - added `ReviewOutputError`, review output parsing, inline comment parsing, thread reply parsing, unified diff line extraction, inline comment filtering, reply filtering, and combined validation.
- `scripts/harness/test/review-output-test.mjs` - added deterministic coverage for diff line parsing, lineRange fallback, invalid shape rejection, comment filtering, reply filtering, and combined validation.
- `package.json` - added `test:harness:review-output` and included it in `test:harness:core`.

## Evidence captured

- `node scripts/harness/prompt-router.mjs route --task "continue" --json`
- `node scripts/harness/prompt-router.mjs handoff --task "continue"`
- `npm run harness:graph -- status`
- `npm run harness:docs:check` after Brief creation: OK
- Architect Challenge: `VERDICT: APPROVED`
- `npm run test:harness:review-output`: PASS
- `npm run test:harness:core`: PASS
- `get_errors` on `scripts/harness/review-output.mjs` and `scripts/harness/test/review-output-test.mjs`: no errors found
- Snyk auth restored via MCP; exact VS Code Snyk IaC command no longer socket-hangs and reports `Could not find any valid IaC files` for `package.json`, which is expected because `package.json` is not an IaC file
- Correct Snyk SCA scan for `package.json`: PASS with `issueCount: 0` after refreshing local `node_modules` from the lockfile
- `npm ls hono`: resolves `hono@4.12.34`

## Self-review checklist

- [x] Implementation follows the Brief's no-GitHub-API and no-dependency constraints.
- [x] Invalid inline comments and replies are rejected with reasons rather than silently dropped.
- [x] The helper validates already-parsed values and does not depend on the structured-output helper.
- [x] The new test is wired into the aggregate core validation path.
- [x] No unrelated user changes were reverted.