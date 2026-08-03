## Review Breadth Findings Ledger

### Blocker
- None.

### Major
- None.

### Minor
- Artifact: `scripts/harness/harness-mcp-tasks.mjs`
- Finding: Multi-file impact mode returns a different top-level envelope than single-file mode by design; this is acceptable but should remain explicitly documented in user-facing help and examples.
- Evidence: Single-file run returns `filePath/depth/dependents/neighbors`; multi-file run returns `files/depth/results`.
- Impact: Future drift risk if docs are changed without command contract checks.
- Confidence: HIGH
- Recommended fix: Keep current docs sync discipline (`harness:docs:check`) and add a focused contract test in the MCP gap matrix suite if future changes touch this surface.

### Nit
- Artifact: `.github/harness/WORKFLOW.md`
- Finding: Compatibility notes are now accurate, but the section could include one example invocation of `harness:run` to make alias behavior obvious.
- Evidence: Alias list exists; no direct example in the same section.
- Impact: Small operator usability gap.
- Confidence: MEDIUM
- Recommended fix: Optional follow-up docs polish.

### Coverage note
- Inspected modified command surfaces (`package.json`, MCP task runner, MCP integration docs, registry contract, command index).
- Ran deterministic checks for docs integrity and runtime invocation forms.

### Missing-context note
- No missing context blocked this pass.
