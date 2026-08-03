---
summary: "P1-2 Prompt-Router Path Hardening Implementation - 2026-07-27"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [prompt, router]
---
# P1-2 Prompt-Router Path Hardening Implementation - 2026-07-27
resource: .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-brief-2026-07-27.md, scripts/harness/prompt-router.mjs, architect-challenge-verdict.md

## Implementation Summary

### Context sufficiency check
- Scope: software (router filesystem hardening in next-actions support path).
- Primary deliverable: hardened path wrappers and manifest path-field validation in scripts/harness/prompt-router.mjs.
- Inputs used: current brief, architect challenge verdict (APPROVED), prompt-router current source, static diagnostics, router command behavior outputs.
- Missing context: none blocking.

### Delivered
- Hardened path-segment validation:
  - `ensureSafeSegment` now rejects `.` and `..` explicitly.
- Added safe-root/canonicalization guards:
  - `normalizePathForCompare`, `isPathInside`, `assertContainedPath`, and updated `safeJoinUnder` enforce root containment and canonical-path checks for existing paths.
- Replaced unconstrained next-actions file operations with validated wrappers:
  - prompt pack directory listing and selection,
  - pack slug resolution,
  - manifest read path,
  - pending-stage output-file checks,
  - latest brief discovery paths.
- Added manifest contract enforcement for path fields:
  - `validateManifestPathFields` now validates and root-checks `files.nextSteps`, `files.stagePrompts[*].promptFile`, and `files.stagePrompts[*].outputFile` before stage resolution.

### Contract adherence
- Brief scope followed: only prompt-router next-actions path-hardening helpers were modified.
- No route/model/stage-selection logic was changed.
- Deterministic fail behavior was preserved and used for invalid selectors/manifest fields.

### Proof summary
- Behavior smoke tests:
  - `node scripts/harness/prompt-router.mjs next-actions --task "ship auth audit" --json` passed.
  - `node scripts/harness/prompt-router.mjs route --task "fix auth middleware race" --json` passed.
- Negative selector tests (required):
  - `node scripts/harness/prompt-router.mjs next-actions --pack ".."` failed non-zero with invalid slug.
  - `node scripts/harness/prompt-router.mjs next-actions --pack "../../escape"` failed non-zero with invalid slug.
- Tampered-manifest containment tests (required):
  - output file tamper `../escape.md` failed non-zero.
  - prompt file tamper `../../pwn.md` failed non-zero.
  - next-steps tamper `../../outside.md` failed non-zero.
  - manifest restore validated normal `next-actions --pack p1-2-tamper-test --json` output.
- Static-analysis re-check:
  - `get_errors` on `scripts/harness/prompt-router.mjs` returned no errors.
- Docs contract check:
  - `npm run harness:docs:check` returned OK.

### Change summary
CHANGES MADE:
- scripts/harness/prompt-router.mjs: path hardening wrappers and manifest path-field validation for next-actions support flow.
- .github/harness/memory/briefs/p1-2-prompt-router-path-hardening-brief-2026-07-27.md: revised validation criteria from architect challenge.

THINGS I DIDN'T TOUCH (intentionally):
- scripts/harness/prompt-router.mjs routing/profile decision logic.
- scripts/harness/mcp-tools.mjs import behavior and MCP routing surfaces.
- Any graph/parity scripts from prior backlog items.

POTENTIAL CONCERNS:
- Snyk code scan could not run on this file path because folder trust was not granted (`snyk_trust` not executed in this pass).

### Assumptions or deviations
- [UNVERIFIED] Existing prompt-pack file naming remains segment-safe (now enforced at runtime).
- No deviations from brief scope.
