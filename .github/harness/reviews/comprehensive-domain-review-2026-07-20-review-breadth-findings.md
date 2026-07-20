# Review Breadth Findings: Comprehensive Domain Review

## Blocker

1. Artifact: frontend and apps/mobile domain surfaces
   Finding: No application source files are present in frontend/ or apps/mobile/ in this workspace.
   Evidence: file search returned no files for both frontend/**/* and apps/mobile/**/*.
   Impact: End-to-end domain review cannot validate UI/mobile correctness, security, or standards.
   Confidence: HIGH
   Recommended fix: confirm whether these domains are intentionally out of scope; if not, restore source trees before claiming full-app coverage.

## Major

1. Artifact: README documentation tables
   Finding: Markdown table style lint violations exist in core repository documentation.
   Evidence: diagnostics report MD060 issues in README table rows around capability matrix sections.
   Impact: Contract docs quality drift; contributor confusion and tooling noise.
   Confidence: HIGH
   Recommended fix: normalize markdown table formatting and enforce markdown lint in CI for docs surfaces.

2. Artifact: Graph refresh operations
   Finding: Graph is fresh but refresh-readiness is degraded due to missing understand-anything pluginRoot configuration.
   Evidence: harness:graph status reports degradation: graph.pluginRoot is required for refresh.
   Impact: Future graph refresh can fail, reducing reliability of Understand-stage evidence.
   Confidence: HIGH
   Recommended fix: configure graph.pluginRoot in harness config/environment and add a preflight check in operator workflow.

3. Artifact: backend source ownership boundary
   Finding: backend/src currently contains only migrations while operational logic is heavily represented in backend/dist.
   Evidence: backend/src directory listing only shows migrations; TwoFactorService source not found under backend/src/services/authentication.
   Impact: higher risk of editing compiled artifacts or drifting source-of-truth boundaries.
   Confidence: HIGH
   Recommended fix: restore canonical TypeScript service sources and regenerate dist in build pipeline.

## Minor

1. Artifact: review artifact markdown quality
   Finding: earlier same-day review artifacts include markdown style violations (MD022/MD032/MD041/MD047).
   Evidence: diagnostics list violations in prior comprehensive-review artifacts under .github/harness/reviews and memory/briefs.
   Impact: lowered maintainability of review records and noisy diagnostics.
   Confidence: HIGH
   Recommended fix: apply a markdown lint pass to review artifact templates and existing files.

2. Artifact: MCP impact graph coverage for docs/backend migration files
   Finding: impact/dependents outputs for some files show sparse linkage.
   Evidence: impact results for .github/harness/HARNESS.md and backend migration file reported limited or no dependents.
   Impact: graph-driven blast-radius confidence is lower for selected documentation and migration surfaces.
   Confidence: MEDIUM
   Recommended fix: enhance graph ingestion coverage for document-to-script and migration runtime relationships.
