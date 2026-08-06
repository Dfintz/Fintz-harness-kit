---
summary: "Architecture Brief - provider drift analyzer warning cleanup"
type: brief
status: active
source: architecture
created: 2026-08-06
updated: 2026-08-06
tags: [provider-drift, diagnostics, quality, safety]
---
## Architecture Brief
resource: scripts/harness/provider-drift-report.mjs, scripts/harness/test/adoption-slices-test.mjs, .github/harness/memory/briefs/provider-drift-closure-2026-08-06.md

### Objective
- Remove actionable analyzer warnings from the provider drift report and adoption fixture without changing behavior or weakening the user-supplied root safety boundary.
- Leave no avoidable file-inclusion risk: matching files must also be real-path-contained under the supplied root before hashing.

### Scope and boundaries
- In scope: replace implicit lexical sorts with explicit deterministic comparators, split nested CLI rendering into named formatting functions, reduce report helper complexity where practical, use a raw test literal for the POSIX quoting assertion, and guard matching file reads with real-path containment.
- Out of scope: changing root inputs, adding repo-only path allowlists, suppressing diagnostics, altering report semantics, or changing unrelated package/user edits.
- Primary boundary: provider-drift-report remains a read-only CLI over explicitly supplied roots; diagnostics cleanup must not remove the `COMPARED_PATH` filter or missing-root behavior.

### Artifacts to create
- None. Modify the two diagnostic-bearing files only.

### Artifacts to modify
- `scripts/harness/provider-drift-report.mjs` - add explicit comparator, named text/JSON renderers, and small helpers for report formatting.
- `scripts/harness/test/adoption-slices-test.mjs` - replace only the test string literal with a raw template literal; preserve assertions.

### Key decisions
- Decision: use a stable lexical comparator `(left, right) => left.localeCompare(right)` for path/key ordering.
- Decision: resolve the supplied root with `realpathSync` and skip matching files whose real path is outside that root, preventing symlink escapes while accepting external provider roots.
- Decision: render JSON and text through separate named functions, preserving exact output and exit codes.
- Decision: do not use `NOSONAR`, broad catch-all suppression, or a repository-only manifest allowlist that would reject valid external provider roots.

### Constraints
- Preserve `compareProviderTrees` output fields and all CLI exit semantics.
- Preserve exact compared path shapes and SHA-256 values.
- Never hash a matching file whose real path escapes the supplied root; skipped escapes must not become provider drift findings.
- Run focused adoption tests immediately after editing.
- Do not modify package.json or package-lock.json.

### Validation plan
- Run `node scripts/harness/test/adoption-slices-test.mjs` after the edit.
- Run `npm run test:harness:core`, `npm run harness:docs:check`, `npm run harness:commands:check`, `npm run harness:graph -- status`, and `git diff --check`.
- Recheck diagnostics; any remaining warnings must be documented with evidence after real-path containment is in place.

### Do NOT
- Do not weaken path filtering or accept arbitrary file shapes.
- Do not suppress analyzer rules.
- Do not change the report's JSON/text output or exit behavior.
- Do not touch unrelated user edits.

### Assumptions and risks
- `[UNVERIFIED]` Windows may refuse symlink fixture creation without developer mode; the test should attempt the guard and skip only that fixture when the platform denies creation.
- Risk: formatting refactor could alter human output. Mitigation: focused CLI fixture tests assert exit behavior and JSON payload; run full core suite.
- Understand status: graph fresh and ready; direct scope limited to provider-drift-report and its adoption fixture.

### Architect challenge resolution
- Challenge verdict: `REVISE`.
- Resolved: add real-path containment for matching files, preserve external roots, skip escaping symlinks, and require output/exit regression proof before closure.
