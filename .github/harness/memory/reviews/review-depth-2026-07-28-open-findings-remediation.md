# Review Depth Findings - Open Findings Remediation (2026-07-28)

## Gate Ledger

| Artifact / Path | Gates Run | Verdict | Evidence |
| --- | --- | --- | --- |
| `scripts/harness/harness-mcp-tasks.mjs` (`find` path) | G1, G3, G4, G5 | PASS | Auto-heal logic for missing memory-link index added without broadening MCP tool registry or changing dispatch policy. |
| `scripts/harness/mpc-*.mjs.new` deletion | G1, G3, G4b, G5 | PASS | Files were empty and unreferenced in runtime/package surfaces before deletion; cleanup removed confusion without behavior change. |
| Operational graph and index surfaces | G4, G5 | PASS | Graph now fresh; memory-link index exists and `mcp find` reports `memoryLink.ok=true`. |

## Structural Findings Ledger

### Blocker
- None.

### Major
- None.

### Minor
1. Artifact/path: remediation documentation consistency
   Gate/depth check: Gate 4 now passes after normalization in scoped remediation artifacts.
   Evidence: command examples use one canonical form (`npm run harness:graph status`) in the active remediation brief/review set.
   Why structure is improved: operator runbooks are deterministic in command examples for this remediation record.
   Recommended fix: retain the canonical form in future updates.
   Confidence: HIGH

## Brief Divergence
- No divergence. Implemented changes match the approved revised brief.
