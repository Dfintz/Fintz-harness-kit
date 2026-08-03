## Review Depth Gate Ledger

### Gate ledger
- Artifact/path: `package.json` command-surface breaking-window cutover
  - Gates: G1 PASS, G2 PASS, G3 PASS, G4 PASS, G4b PASS, G5 PASS
  - Evidence: Removed only deprecated typo alias family; canonical ownership and behavior preserved.
- Artifact/path: `scripts/harness/check-script-alias-policy.mjs`
  - Gates: G1 PASS, G3 PASS, G4 PASS, G5 PASS
  - Evidence: Dedicated policy logic is narrow, deterministic, and owned by harness script layer.
- Artifact/path: `scripts/harness/validate-doc-contracts.mjs`
  - Gates: G3 PASS, G4 PASS, G5 PASS
  - Evidence: Validator-owned enforcement prevents bypass through direct invocation paths.
- Artifact/path: `.github/workflows/harness-optional-security-gates.example.yml`
  - Gates: G4 PASS, G4b PASS
  - Evidence: Added unconditional command-surface check step within workflow example.
- Artifact/path: `RELEASE_NOTES_v3.1.1.md` + `README.md`
  - Gates: G1 PASS, G4 PASS
  - Evidence: Breaking-window migration mapping and discoverability linkage documented.

### Structural findings ledger

#### Blocker
- None.

#### Major
- None.

#### Minor
- Artifact/path: CI coverage model
- Gate/depth check: G4 advisory
- Evidence: The only workflow in-repo is an example workflow, so adopters must still copy/enable it.
- Why current placement or structure is suboptimal: Enforcement guidance is strong, but not globally guaranteed across external adopters.
- Recommended fix: Document mandatory CI adoption step in SETUP follow-up.
- Confidence: MEDIUM

### Brief divergence
- None. Implementation conforms to revised approved brief.
