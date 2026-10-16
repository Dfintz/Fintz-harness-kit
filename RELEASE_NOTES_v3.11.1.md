# Release Notes v3.11.1

Date: 2026-10-16

## Summary

v3.11.1 packages the CI isolation fix and catalog refresh committed after v3.11.0.
The prompt-pack trace-contract test now runs without a local knowledge graph or
profile-specific environment variables. Runtime routing and graph guardrails are unchanged.

## Fixes

- `trace-contract-prompt-pack-test.mjs` creates temporary fixture repositories and selects them
  explicitly with `--repo-root`. Its child processes no longer inherit `HARNESS_PROJECT_ROOT`
  or `UNDERSTAND_PLUGIN_ROOT`; `HARNESS_REPO_ROOT` selects the kit's stage contracts.
- A negative fixture verifies that degraded graph refresh readiness still blocks prompt-pack
  generation and writes no pack. The production graph preflight is not bypassed or weakened.
- Test artifacts stay in the fixture repositories, which are removed after the test.
- The generated catalog now reflects the 2026-10-02 model snapshot, 35 supported models, and
  the `windows-wsl2-gpu-16gb` hardware profile. It was regenerated from committed configuration,
  excluding unrelated local work.

## Validation

- The underlying fix passed the full `test:harness:core` suite in
  [GitHub Actions run 38925465394](https://github.com/Dfintz/Fintz-harness-kit/actions/runs/38925465394),
  including the prompt-pack trace-contract test and both agent-plugin checks.
- The release snapshot was checked in an isolated worktree with `npm run test:harness:adoption`
  and `npm run harness:health -- --fast`, including docs contracts and config self-tests.
  No repository knowledge graph or inherited harness root / plugin environment overrides
  were required.
- Package, lockfile, and catalog versions agree on `3.11.1`; the README links to these notes.

## Compatibility And Limits

- No runtime API, routing policy, guardrail, or dependency changes are introduced by this patch.
- The ensemble and dynamic-selection safeguards from [v3.11.0](RELEASE_NOTES_v3.11.0.md)
  remain in effect. No configuration migration is required.
- Unrelated local decision-model bakeoff and routing-config work are not part of this release.
