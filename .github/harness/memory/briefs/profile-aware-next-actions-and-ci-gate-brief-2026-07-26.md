---
summary: "Profile-Aware Next-Actions and CI Gate Brief - 2026-07-26"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [profile, aware, next, actions]
---
# Profile-Aware Next-Actions and CI Gate Brief - 2026-07-26
resource: scripts/harness/prompt-router.mjs, scripts/harness/validate-doc-contracts.mjs, scripts/harness/lurkr-check.mjs, package.json, .github/workflows/harness-optional-security-gates.example.yml, SETUP.md

## Task

1) Implement next-action resolver as a formal profile-aware subcommand with explicit prompt-pack selection flags.
2) Add a CI example workflow file that runs changed-surface warnings and Lurkr required mode behind an environment toggle.

## Understand summary

- Graph freshness is stale and refresh-ready is degraded due to missing pluginRoot.
- Confidence for graph-wide dependency inference is reduced; implementation is file-backed.
- Impacted components:
  - scripts/harness/prompt-router.mjs (new next-actions flags and selection semantics)
  - .github/workflows/* (new example workflow)
  - docs/scripts surfaces for usage (SETUP.md, package.json only if needed)

## Architectural gates

1. Problem clarity: PASS
- Requirement is precise: make next-actions formal + profile-aware + explicit pack-selection flags; add CI example with env toggle.

2. Ownership/boundary fit: PASS
- Router behavior belongs in prompt-router.
- CI example belongs in .github/workflows.
- No changes needed to run-loop core or registry contracts.

3. Reuse-first: PASS
- Reuse existing planTask(profile-aware routing), prompt-pack manifest schema, safeJoinUnder helper.
- Reuse existing docs-check and lurkr-check scripts in workflow.

4. Safety/operations: PASS
- Keep prompt-pack selectors constrained to safe segments under prompt-packs directory.
- Keep workflow optional-by-design via explicit env toggle.
- Do not require lurkr by default in local flow.

5. Proof plan: PASS
- Validate next-actions with:
  - explicit --pack selection
  - explicit --profile selection
  - fallback mode
- Validate workflow syntax by file creation and docs check command compatibility.
- Run docs checks after edits.

## Design decisions

- Extend parseArgs with explicit flags:
  - --pack <slug>
  - --pack-latest
- Make next-actions profile-aware by filtering selected prompt-pack manifest against requested profile where present.
- Keep current command name next-actions as the formal subcommand; no rename churn.
- Add a new example workflow file rather than a mandatory workflow.

## Deterministic behavior contract

### Next-actions selector precedence and errors

1. Selection precedence:
- `--pack <slug>`
- `--pack-latest`
- task-match selection
- fallback (latest brief/route)

2. Invalid combinations:
- `--pack` + `--pack-latest` => fail non-zero with actionable message.

3. `--pack` mismatch:
- If selected pack does not exist, fail non-zero with actionable message.

### Profile matching rule

- When `--profile` is supplied for `next-actions`, selected pack manifest `profile` must exactly match.
- If no profile-matching pack is found under current selector mode, fail closed with actionable message.
- Do not silently downgrade to non-profile selection.

### CI toggle and changed-surface base rule

- Optional CI gates run only when `HARNESS_ENABLE_OPTIONAL_SECURITY_GATES == 'true'`.
- Changed-surface warnings must pass an explicit base via `--changed-surface-base`.
- When toggle is not exactly `'true'`, skip both optional steps.

## Planned file changes

- scripts/harness/prompt-router.mjs
  - parse new flags
  - add explicit prompt-pack resolver
  - add profile-aware filtering in pack selection
  - plumb flags through printNextActions
- .github/workflows/harness-optional-security-gates.example.yml
  - include env toggle HARNESS_ENABLE_OPTIONAL_SECURITY_GATES
  - run docs changed-surface warnings and lurkr required only when toggle true
- SETUP.md
  - mention example workflow and env toggle usage

## Constraints

- Backward compatible output format for route/handoff commands.
- Next-actions without new flags must continue to work.
- Keep optional security gates disabled by default in workflow example.

## Do-NOTs

- Do not make Lurkr required in default local commands.
- Do not modify stage routing policy semantics.
- Do not add unrestricted filesystem selector flags for prompt packs.

## Assumptions

- Prompt-pack directory names are stable slugs and safe to select by single segment.
- Existing scripts remain executable without additional package dependencies.
