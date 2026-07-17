# Compact Handoff Specification

Purpose: define a deterministic, compact handoff format so another agent can resume work without
re-deriving context.

## Required sections

Handoff markdown must include exactly these section headings:

1. `## Task Snapshot`
2. `## Current State`
3. `## Next Steps`
4. `## Suggested Skills`
5. `## References`
6. `## Safety Check`

## Compactness rules

- Default maximum lines: `220`
- Default maximum bytes: `12000`
- `## Next Steps` must include at least one bullet.
- `## Suggested Skills` must include at least one bullet.
- `## References` must include at least one bullet with either:
  - a repository-relative path (for example `.github/harness/HARNESS.md`), or
  - an absolute URL (`https://...`).

## Safety rules

- `## Safety Check` must explicitly mention secret handling (for example `No secrets included`).
- Handoff must not contain obvious secret tokens (AWS key, GitHub token, private key marker).

## Checker

Run:

`node scripts/harness/handoff-evidence.mjs check-spec --file <repo-relative-or-absolute-path>`

Optional flags:

- `--max-lines <n>`
- `--max-bytes <n>`
- `--json`
