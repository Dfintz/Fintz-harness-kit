---
summary: "Architecture Brief: OKF Optional Metadata Completion - 2026-08-04"
type: brief
status: active
source: human
created: 2026-08-04
updated: 2026-08-04
tags: [memory, okf, metadata, migration]
---

# Architecture Brief: OKF Optional Metadata Completion - 2026-08-04

resource: .github/harness/memory/, scripts/harness/okf-phase0.mjs, scripts/harness/okf-migrate.mjs, scripts/harness/memory-curate.mjs

## Architecture Brief

### Objective

- Add optional OKF frontmatter and nonempty `type` metadata to the remaining memory documents so the phase-0 audit reports zero missing frontmatter and zero missing type fields.

### Scope and boundaries

- In scope: additive metadata only for memory Markdown documents that lack frontmatter or a `type` field.
- Out of scope: lifecycle status changes, summaries/tags already present, body rewrites, artifact-family/immutability changes, and files outside `.github/harness/memory/`.
- Primary boundary: extend the existing manifest-bound migration surface; phase-0 and curation remain read-only validators.

### Artifacts to modify

- `scripts/harness/okf-migrate.mjs` - add a manifest-only optional OKF metadata mode with folder-based types.
- Memory Markdown targets - add missing frontmatter fields only.

### Key decisions

- Gate 1: PASS. Metadata belongs in committed memory.
- Gate 2: PASS. Reuse the existing manifest/receipt migration rather than a bulk editor.
- Gate 3: PASS. The migrator writes; phase-0 reports and curation interpret.
- Gate 4: PASS. Folder-based type is metadata, not lifecycle or content semantics.
- Gate 4b: PASS. Manifest hashes, atomic rollback, and receipts remain mandatory.
- Gate 5: PASS. One migration contract serves both lifecycle and optional OKF metadata.
- Type mapping: `lessons -> lesson`, `briefs -> brief`, `reviews -> review`, `radar -> radar`, `curation -> curation`, `ontology -> ontology`, root memory files -> `memory`. `quarantine/` is excluded because it is explicitly untrusted autonomous output and must not be normalized automatically. Unknown nonempty directories are manifest rejects.

### Metadata decision matrix

| Current form | Operation | Fields inserted | Reject condition |
| --- | --- | --- | --- |
| No frontmatter | Prepend minimal OKF block | `type` only | Unknown folder type or unreadable file |
| Well-formed frontmatter, missing `type` | Insert field before closing delimiter | `type` only | Unknown folder type |
| Well-formed frontmatter, nonempty `type` | No-op | None | None |
| Unclosed/ambiguous frontmatter, YAML-invalid keys, duplicate `type`, or blank `type` | Reject | None | Manifest must not apply |

### Manifest contract

- Recursive manifest schema: `{ version: 2, scope: "memory-okf", entries: [{ path, sha256, proposedType, operation, outputSha256, action, reason }], candidateCount, rejectCount }`.
- Apply validates the approved source and `outputSha256` for every entry before writing; it must not regenerate an unchecked variant from code.
- All rejected paths are reported and any reject prevents writes.

### Constraints

- Preserve all existing frontmatter keys and document body bytes.
- Never overwrite an existing nonempty `type`.
- Apply only a zero-reject, hash-bound manifest; replay must be an idempotent no-op.
- Add only `type` even when frontmatter is absent; status, summary, tags, source, and timestamps remain absent unless already present.

### Validation plan

- `npm run harness:okf:phase0 -- --strict-okf` must prove zero missing, unclosed, duplicate, blank, or malformed type metadata for all eligible non-quarantine files.
- migration self-test and dry-run/apply/replay manifest checks
- `npm run harness:docs:check`

### Do NOT

- Do NOT infer lifecycle status from title, verdict, or stage.
- Do NOT modify any existing `status`, `summary`, `tags`, or body text.
- Do NOT apply when any manifest entry is rejected or its proposed-output hash does not match.

### Assumptions and risks

- Folder-based type labels are structural classifications for optional OKF conformance only.
- Malformed or duplicate frontmatter remains a zero-write rejection.
