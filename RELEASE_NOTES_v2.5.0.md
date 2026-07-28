# v2.5.0 - Docs & Setup Usability Refresh

**Status**: GA (2026-07-28)
**Type**: Minor (documentation + release readiness)

---

## Summary

This release focuses on making the harness easier to adopt, easier to validate, and easier to release safely.

## What changed

- README install examples now use concrete repository targets.
- README now includes a fastest-path first-run checklist.
- SETUP now includes a quick onboarding checklist for operators.
- SETUP now includes a maintainer release checklist.
- Internal version surfaces updated to 2.5.0 (`package.json`, `package-lock.json`).
- Release helper scripts updated for v2.5.0 defaults and env override support.

## Validation

| Check | Result |
|---|---|
| `npm run harness:docs:check` | PASS |
| `npm run harness:health -- --fast` | PASS |
| Tag target above `v2.4.0` | PASS |

## Affected files

- `README.md`
- `SETUP.md`
- `package.json`
- `package-lock.json`
- `scripts/create-release.mjs`
- `scripts/create-release.ps1`

## Upgrade notes

- No breaking runtime behavior changes.
- Release helpers now default to `v2.5.0` but can be overridden with:
  - `HARNESS_RELEASE_TAG`
  - `HARNESS_RELEASE_TITLE`

## Next steps

1. Use the new README checklist for first-run onboarding.
2. Use the SETUP maintainer checklist before the next release tag.
3. Keep version/tag/release-note surfaces synchronized for every cut.
