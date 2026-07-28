---
status: active
date: 2026-07-28
stage: Architect
brief_type: Release-Preparation
ownership: harness-team
---

# Architecture Brief: Docs/Setup Usability Refresh + Release Above v2.4.0
resource: README.md,SETUP.md,package.json,RELEASE_NOTES_v2.3.0.md,scripts/create-release.mjs,scripts/create-release.ps1,.github/harness/memory/briefs/docs-setup-usability-and-release-v2-5-0-2026-07-28.md

active

## Objective
- Make documentation and setup materially easier for first-time operators.
- Prepare and cut a release above `v2.4.0` with internal versioning updated.
- Complete commit, push, and tag steps in this run if remote/auth allows.

## Context Sufficiency Check

### Inventory
- Routing produced full 7-stage non-trivial flow including `architect-challenge`.
- Graph freshness gate is fresh; provider is available.
- Existing repo state already includes in-flight harness changes from prior work.
- Current package version is `2.3.5`; existing git tag set already includes `v2.4.0`.

### Scope
- In scope:
  - README + SETUP usability refresh (clear start paths, concise onboarding steps, practical release flow).
  - Internal version bump to a release above `2.4.0`.
  - Release notes artifact for new version.
  - Git commit, push, and annotated tag creation.
- Out of scope:
  - Rewriting architecture contracts beyond usability/clarity.
  - Runtime behavior changes unrelated to docs/setup/release prep.

### Missing Context
- Blocking context identified and resolved in-plan:
  - Dirty workspace requires explicit scope-safe commit strategy (commit all intended in-flight surfaces together; do not reset/revert unrelated work).
  - Push/auth availability must be preflight-verified before promising remote publication.
  - Version coherence must be enforced across package version, tag, release notes, and release scripts.

## Gate Decisions

### Gate 1: Domain / Module Alignment
- Changes remain in docs/release metadata and repo packaging surfaces.

### Gate 2: Generality
- Keep guidance project-agnostic and operator-first.

### Gate 3: Ownership
- `README.md`, `SETUP.md`, and release metadata are the right ownership surfaces for this task.

### Gate 4: Boundary Integrity
- Do not alter loop semantics or safety contracts while improving docs usability.
- Any release-script updates must remain backward-compatible and non-destructive.

### Gate 4b: Isolation / Safety
- No tenancy/auth policy changes.
- Git operations are additive only (`commit`, `push`, `tag`) with no history rewrites.

### Gate 5: Reuse
- Reuse existing harness commands and current workflow terms; avoid inventing parallel command names.

## Planned Change Set

### Modify
- `README.md`
- `SETUP.md`
- `package.json`
- `scripts/create-release.mjs`
- `scripts/create-release.ps1`

### Create
- `RELEASE_NOTES_v2.5.0.md`
- Review artifacts for breadth/depth/feedback in `.github/harness/memory/reviews/`

### Explicitly Not Doing
- No refactor of core runtime scripts beyond release helper parameterization.
- No deletion or rollback of unrelated in-flight changes.

## Constraints
- Keep docs concise and highly actionable.
- Preserve existing style and command validity.
- Version must be strictly greater than `2.4.0`.
- Enforce version coherence across these surfaces: `package.json`, release notes filename/title, git tag, and release helper script defaults.
- Guard tag creation/push with local+remote collision checks.

## Do-NOTs
- Do NOT use destructive git commands.
- Do NOT claim push/tag success without command evidence.
- Do NOT rewrite historical review findings outside this task scope.

## Assumptions
- [UNVERIFIED -> VERIFY IN IMPLEMENT] Target release version selected as `2.5.0` is acceptable for this release.
- [UNVERIFIED -> VERIFY IN IMPLEMENT] Remote push permissions and auth are available in this environment.

## Release Safety Preflight
- Confirm release version is unused locally and on origin before tagging.
- Confirm `git status --short` is reviewed and commit scope is intentional.
- Confirm `git remote -v` and push auth viability before attempting push.
- If remote publish fails after local commit/tag, stop and report exact partial state (committed only / tag local only / push failed), without destructive rollback.

## Validation Plan
- `npm run harness:docs:check`
- `npm run harness:health -- --fast`
- `git status --short`
- `git tag --list "v2.5.0"`
- `git ls-remote --tags origin "refs/tags/v2.5.0"`
- `git commit ...`
- `git push origin main`
- `git tag -a v2.5.0 -m "v2.5.0"`
- `git push origin v2.5.0`
