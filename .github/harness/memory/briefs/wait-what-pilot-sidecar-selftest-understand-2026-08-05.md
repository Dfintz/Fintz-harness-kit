## Understand Notes - Wait-What Pilot + Sidecar Self-Test (2026-08-05)

resource: scripts/harness/validate-doc-contracts.mjs, scripts/harness/test/, .github/skills/, .github/harness/HARNESS.md, .github/harness/registry.json, package.json

### Graph status
- Fresh (graph commit matches HEAD)
- Provider: understand-anything (query and refresh ready)

### Changed components
- Pilot behavior skill surface in .github/skills/wait-what/
- Sidecar validation test surface in scripts/harness/test/
- Registry and harness docs surfaces

### Affected components
- scripts/harness/validate-doc-contracts.mjs (sidecar-only checker path)
- package.json command surfaces
- sidecar contract schema and all .github skill sidecars

### Affected layers
- Core layer (contracts, docs, test harness, metadata)

### Risk
- Low: pilot skill is user-invoked only, and validator test runs in isolated temporary fixture directory with cleanup.
