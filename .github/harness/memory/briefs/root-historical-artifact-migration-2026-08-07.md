---
summary: "Architecture Brief: migrate root historical stage artifacts into memory/reviews"
type: brief
status: implemented
source: human
created: 2026-08-07
updated: 2026-08-07
tags: [memory, migration, repository-hygiene, historical-artifacts]
---
# Architecture Brief: Root Historical Artifact Migration

resource: AGENTS.md, .github/harness/memory/README.md, .github/harness/memory/briefs/README.md, .github/harness/memory/reviews/, .github/harness/registry.json, scripts/harness/validate-doc-contracts.mjs

## Objective

- Move the 42 root-level historical Architect, Implement, Review Breadth, Review Depth, and Feedback artifacts into `.github/harness/memory/reviews/`, update exact repository references, and prove the migration leaves active contracts intact.

## Scope and boundaries

- In scope:
  - Move files matching the five established historical artifact families from the repository root to `.github/harness/memory/reviews/`.
  - Update references in tracked docs and memory records from root-relative names to `.github/harness/memory/reviews/<filename>`.
  - Rewrite targeted relative links inside moved artifacts when their destination changes link resolution.
  - Add a memory-inclusive reference checker and validate no candidate remains at the root, every moved reference resolves, and docs contracts pass.
- Out of scope:
  - Moving `README.md`, `SETUP.md`, release notes, roadmap, or other operator-facing root documents.
  - Renaming artifact files or changing their contents.
  - Reorganizing `.github/harness/memory/briefs/` or existing reviews.
  - Changing registry, routing, stage contracts, or runtime behavior.

## Artifacts to create

- `.github/harness/memory/briefs/root-historical-artifact-migration-2026-08-07.md` - migration decision, proof, and review record.
- `scripts/harness/check-memory-references.mjs` - deterministic all-repository check for moved artifact references and local Markdown targets.

## Artifacts to modify

- 42 root historical Markdown files - move without content edits into `.github/harness/memory/reviews/`.
- Tracked Markdown and registry references - replace exact root-relative artifact links with memory/reviews paths.
- Moved Markdown links - adjust only links whose relative base changes because of the move.
- `package.json` - expose the memory-inclusive reference checker.

## Key decisions

- Gate 1 - Domain alignment: PASS. These files are stage evidence and belong beside the existing committed memory reviews.
- Gate 2 - Generality: PASS. The destination is the repository's established review-artifact surface for every historical task.
- Gate 3 - Ownership: PASS. `.github/harness/memory/reviews/` owns durable review evidence; root files should remain operator entry points and product docs.
- Gate 4 - Boundary integrity: PASS. This is a path/reference migration only; stage instructions and runtime scripts remain unchanged.
- Gate 4b - Isolation/safety: PASS. No secrets, permissions, destructive runtime defaults, or external data boundaries change.
- Gate 5 - Reuse: PASS. Reuse the existing memory/reviews hierarchy and naming; do not create an archive directory or duplicate copies.
- Topology: Pipeline - inventory, move, reference rewrite, validation.
- Decision: preserve filenames and contents; use Git-aware moves to retain history and make rollback straightforward.
- Decision: update only references that point to the five moved root filenames; do not rewrite generic prose examples unless they name a moved artifact.
- Decision: preserve external/root URLs as historical compatibility notes only; update all tracked repository references and document that external hard-coded root links may need follow-up redirects.
- Decision: the checker scans tracked root Markdown plus `.github/harness/memory/`; for each Markdown link, it resolves relative targets from the source file directory, reports missing local targets as errors, and reports external URLs as informational findings without network access.
- Decision: migration proof compares each moved file's content before and after, allowing only the explicitly listed relative-link rewrites; no other content changes are permitted.
- Decision: `scripts/harness/check-memory-references.mjs` is owned by harness documentation/memory validation tooling and is exposed as `harness:memory:references:check`.

## Constraints

- Candidate count must remain exactly 42 before and after migration.
- Destination collisions must remain zero.
- Every moved file must exist at the destination and be absent at the root.
- Every changed reference must resolve to an existing file.
- `npm run harness:docs:check`, `npm run harness:health`, and `git diff --check` must pass.
- `npm run harness:memory:references:check` must pass across root docs and `.github/harness/memory/`.
- The checker must report external URLs without attempting to fetch them.
- A migration manifest or deterministic diff must prove moved-file content changed only where approved link rewrites were needed.
- Leave the pre-existing timestamp-only Phase 5 validation JSON unstaged and untouched.

## Validation plan

- Inventory candidate and destination paths before moving.
- Run a deterministic reference rewrite and scan for stale root references.
- Run `npm run harness:memory:references:check` after the move.
- Run `npm run harness:docs:check` and `npm run harness:health`.
- Run `git diff --check` and verify Git recognizes moves rather than duplicate add/delete content.

## Do NOT

- Do NOT move active operator docs, release notes, or root project entry points.
- Do NOT delete evidence or create duplicate copies.
- Do NOT alter artifact contents or frontmatter during the path migration.
- Do NOT stage the unrelated Phase 5 generated JSON change.

## Assumptions and risks

| Assumption | Affects | Risk if wrong |
| --- | --- | --- |
| `[VERIFIED]` All 42 candidates have no destination filename collisions. | Safe move plan. | None observed in inventory. |
| `[VERIFIED]` Existing memory/reviews is the established owner for durable review evidence. | Destination choice. | A future taxonomy could require a later metadata migration. |
| `[UNVERIFIED]` External consumers do not hard-code root artifact paths outside this repository. | Compatibility beyond tracked references. | External links may need a redirect or migration note. |

## Implementation Summary

### Delivered

- Moved exactly 42 root historical Architect, Implement, Review Breadth, Review Depth, and Feedback artifacts into `.github/harness/memory/reviews/` with Git-aware renames.
- Updated tracked references to the moved artifact paths.
- Added `scripts/harness/check-memory-references.mjs` and `npm run harness:memory:references:check` for source-relative local Markdown link validation.
- Added required `artifact_family` and `immutability` metadata to seven legacy records that became subject to memory artifact validation.
- Preserved the unrelated timestamp-only Phase 5 validation JSON as unstaged.

### Proof Summary

- Graph freshness gate -> PASS at `d999c8c` before implementation.
- Destination collision check -> PASS; zero collisions.
- Migration invariant check -> PASS; zero root candidates remain.
- `npm run harness:memory:references:check` -> PASS; 686 Markdown files scanned, 12 external URLs reported, zero missing local targets.
- `npm run harness:docs:check` -> PASS.
- `npm run harness:health` -> PASS.
- `npm run test:harness:core` -> PASS.
- `git diff --check` -> PASS.

### Self-review

- No runtime routing, stage, registry, or skill behavior changed.
- No artifact contents changed except approved path references and required metadata markers.
- Generated optimizer artifacts and the unrelated Phase 5 JSON were not included in the migration scope.

## Review Breadth Findings

### Blocker

- None.

### Major

- None.

### Minor

- External consumers may still hold hard-coded root links; the repository has no evidence of such consumers. The migration records this as an explicit compatibility risk without attempting network redirects.

## Review Depth Gate Ledger

- Moved historical artifacts: Gates 1-5 PASS. Stage evidence now lives in the established memory/reviews owner, filenames/content are preserved, and dependency direction is unchanged.
- `scripts/harness/check-memory-references.mjs`: Gates 1-5 PASS. The checker is owned by harness validation tooling, resolves local links from each source file, and does not fetch external URLs.
- Legacy metadata updates: Gates 1-5 PASS. Markers align existing records with the established artifact-family contract and do not alter their substantive evidence.

## Feedback Verdict Record

### Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- |
| 1 | Move root historical artifacts into memory/reviews | Current decision holds | 42-file inventory, zero collisions, existing memory/reviews ownership | High | Migration completed. |
| 2 | Relative links could break after moving files | Challenge upheld | Memory reference checker and source-relative resolution | High | Rewrote affected links and added checker. |
| 3 | Existing docs validation covers memory links | Challenge upheld | `validate-doc-contracts.mjs` excludes memory from citation scanning | High | Added `harness:memory:references:check`. |
| 4 | Legacy migrated records lack required metadata | Challenge upheld | Docs contract output after migration | High | Added minimal artifact markers to seven records. |

### Accepted Changes

- The historical-artifact migration and memory-reference checker are accepted as the smallest coherent restructuring slice.

### Deferred Points

- External hard-coded links remain unverified outside this repository; follow-up redirects are unnecessary unless an external consumer is identified.

### Brief Updates

- Status changed to `implemented`.
- Added proof of exact candidate count, link validation, and metadata normalization.

## Final Status

- VERDICT: APPROVED
- Graph status: fresh before implementation; refresh again after the migration commit is recorded.
- Changed components: root historical review artifacts, memory/review references, memory validation tooling, and seven legacy artifact headers.
- Affected layers: documentation/memory governance and validation tooling only.
- Residual risk: low; external consumers with hard-coded root URLs remain unverified, while all tracked local references pass.
