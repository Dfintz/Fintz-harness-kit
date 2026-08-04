---
summary: "Architecture Brief: Brief Status Metadata Migration - 2026-08-04"
type: brief
status: implemented
source: human
created: 2026-08-04
updated: 2026-08-04
tags: [memory, briefs, migration, metadata]
---

# Architecture Brief: Brief Status Metadata Migration - 2026-08-04

resource: .github/harness/memory/briefs/, scripts/harness/okf-migrate.mjs, scripts/harness/memory-curate.mjs, scripts/harness/harness-report.mjs, .github/harness/memory/reviews/harness-full-review-2026-08-04-breadth.md

## Architecture Brief

### Objective

- Assign valid lifecycle status metadata to all 46 status-less Brief-directory files so the report has no `unknown` Brief status caused by absent metadata.

### Scope and boundaries

- In scope: additive frontmatter migration for Brief files and a reusable dry-run/apply migration path with deterministic verification.
- Out of scope: changing Brief body content, changing challenge verdicts, deduplicating Briefs, or migrating lesson metadata.
- Primary boundary: `okf-migrate.mjs` owns controlled metadata materialization; `memory-curate` and `harness-report` remain read-only consumers.

### Artifacts to create

- `.github/harness/memory/briefs/brief-status-metadata-migration-2026-08-04.md` - decision record for this migration.

### Artifacts to modify

- `scripts/harness/okf-migrate.mjs` - recognize Briefs with incomplete frontmatter and add only missing OKF fields, including valid status.
- `package.json` - remove the unrestricted migration apply alias; retain a dry-run alias only.
- `.github/harness/memory/briefs/*.md` - add frontmatter to 11 files without it and add missing `status: active` metadata to the remaining unresolved Briefs.

### Key decisions

- Gate 1 (domain alignment): PASS. Brief metadata belongs in the committed Brief memory surface.
- Gate 2 (generality): PASS. Extend the existing generic OKF migration path instead of introducing a one-off bulk editor.
- Gate 3 (ownership): PASS. The migrator owns materialization; curation and reporting only interpret metadata.
- Gate 4 (boundary integrity): PASS. Migration changes only YAML frontmatter and does not reinterpret body-level `verdict` fields.
- Gate 4b (isolation and safety): PASS. Run dry-run first; reject malformed frontmatter; write only exact Brief-directory targets.
- Gate 5 (reuse): PASS. Reuse `okf-migrate` and curation/report validation instead of a new migration framework.
- Decision: add `status: active` when a Brief lacks a valid lifecycle status. Challenge verdicts such as `REVISE` are decision outputs, not lifecycle states, and must remain unchanged.
- Human disposition approved 2026-08-04: assign `implemented` to all 46 report-unknown Briefs, including the 11 legacy non-lifecycle `status` values. This migration supersedes the default `active` disposition for this inventory only.

### Frontmatter decision matrix

| Current form | Migration action | Safety condition |
| --- | --- | --- |
| No frontmatter | Add complete OKF frontmatter with the approved lifecycle status. | Preserve the original body exactly. |
| Well-formed frontmatter missing `status` | Add only `status` after the opening delimiter. | Preserve all existing keys and body exactly. |
| Well-formed frontmatter with invalid `status` | Reject by default; replace only with `--replace-invalid-status` after explicit approved disposition. | The manifest records the replacement reason. |
| Duplicate `status` keys | Reject and report; do not change it automatically. | Requires manual resolution. |
| Unclosed or malformed frontmatter | Reject and fail the migration gate. | Never rewrite ambiguous metadata. |

### Disposition inventory

- The migrator must emit one record per target with: filename, existing metadata form, proposed lifecycle status, reason, SHA-256 content hash, and action (`migrate` or `reject`).
- Dry-run manifest schema: `{ version: 1, scope: "briefs", entries: [{ path, sha256, metadataForm, proposedStatus, reason, action }], rejectCount }`.
- The manifest must be saved under `.github/harness/runs/` with its SHA-256 digest printed to the operator; the explicit approval record is the manifest path plus that digest passed to `--apply-manifest`.
- Applying a manifest is allowed only when every candidate has an explicitly approved lifecycle disposition and its current content hash still matches the dry-run manifest.
- Apply is atomic at the migration boundary: before writing any target, reject the entire run when `rejectCount > 0`, an entry is not `migrate`, a status is unapproved, a target is missing, or any hash differs. No partial migration is allowed.
- Apply commit protocol: load all original bytes in memory, generate all proposed bytes and body-suffix hashes, then write targets. If any target write or receipt write fails, restore every already-written target from its original bytes, remove any partial receipt, and exit nonzero. Receipt creation occurs only after all target writes succeed.
- The approved manifest is immutable. Successful application writes a separate receipt at `<manifest-path>.receipt.json` with `{ version: 1, manifestSha256, entries: [{ path, postMigrationSha256 }] }`; the receipt digest is printed but does not alter the approved manifest digest.
- Reloading the same manifest is an idempotent no-op only when its matching receipt has the approved manifest digest and every target matches its recorded post-migration hash with the approved valid status; any other hash mismatch rejects the run.

### Constraints

- Preserve all existing frontmatter keys and body bytes outside additive missing-field insertion.
- Never overwrite an existing valid `status` value.
- Use the migration dry-run output as the exact apply target list.
- The second dry run after apply must return zero candidates and zero rejects.
- Apply must verify non-target text byte identity by comparing each target's original body suffix hash to the written body suffix hash.
- Self-tests must induce a target-write failure and a receipt-write failure and prove every target's original bytes are restored with no receipt left behind.
- Verify report `unknown=0` after application.

### Validation plan

- `node scripts/harness/okf-migrate.mjs --scope briefs --json`
- `node scripts/harness/okf-migrate.mjs --apply-manifest <manifest-path> --manifest-sha256 <digest> --json`
- `npm run harness:memory:curate -- --json --status-mode compat`
- `npm run harness:report -- --no-html`
- `npm run harness:docs:check`

### Do NOT

- Do NOT derive lifecycle status from a `verdict` field.
- Do NOT apply a default disposition until the 46-file inventory is explicitly approved.
- Do NOT support `--apply`; `--apply-manifest` with an approved digest is the only write mode.
- Do NOT update timestamps, summaries, tags, or content that is already present.
- Do NOT touch user or concurrent Brief changes outside missing metadata fields.

### Assumptions and risks

- [UNVERIFIED] All 46 unresolved Briefs are historical artifacts that should remain discoverable as active until a human supersedes or implements them.
- Risk: A malformed frontmatter block could not be safely patched. Such a file must be reported and skipped, not rewritten.

### Feedback outcome

- Human disposition selected `implemented` for all 46 report-unknown Briefs.
- Two hash-bound manifests applied atomically: 46 lifecycle statuses, then 18 required artifact-family/immutability markers.
- Both manifests replay as receipt-backed no-ops; report and curation confirm zero unknown Brief statuses.
