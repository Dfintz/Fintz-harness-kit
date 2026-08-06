# RepoGraph Integration Opportunities - Active

Date: 2026-08-06
Source reviewed: https://github.com/ozyyshr/RepoGraph
Scope: identify transferable skills and harness capabilities for Fintz-harness-kit.

## Executive summary

RepoGraph contributes strong practical patterns in repository-level symbol-graph extraction and graph-grounded context assembly for bug localization and repair. This harness already exceeds RepoGraph in governance, stage orchestration, telemetry, and provider abstraction, but can still absorb five high-value ideas:

1. Symbol-centric retrieval action for agent loops.
2. Def/ref neighborhood packaging for repair prompts.
3. Lightweight graph artifact cache contract for repeated runs.
4. Retrieval quality benchmark scenario tuned for graph hops.
5. Safer multi-language extraction plugin boundary.

## Findings from RepoGraph (with adoption impact)

### High value ideas to adopt

1. Action-level repository graph lookup
- Pattern: search_repo style command that accepts one symbol and returns predecessor/successor def-ref context.
- Benefit here: fast, deterministic seed context for Implement and Review stages before broader retrieval.
- Candidate local surfaces:
  - scripts/harness/mcp-server.mjs
  - scripts/harness/mcp-tools.mjs
  - scripts/harness/graph.mjs
  - scripts/harness/harness-mcp-tasks.mjs

2. Structured dependency context blocks for patch generation
- Pattern: generate compact sections like Dependencies for <symbol> with location and code slices.
- Benefit here: improves first-pass patch quality and reduces token scatter in review-fix loops.
- Candidate local surfaces:
  - scripts/harness/grade-trace.mjs
  - scripts/harness/prompt-middleware.mjs
  - scripts/harness/run-loop.mjs

3. Persisted graph artifacts for reruns
- Pattern: write graph.pkl + tags json artifacts and reuse across tasks.
- Benefit here: better repeatability and lower cold-start cost for repeated local repair loops.
- Candidate local surfaces:
  - scripts/harness/graph-provider.mjs
  - scripts/harness/refresh-graph.mjs
  - .github/harness/runs/

4. Neighborhood traversal presets
- Pattern: one-hop, two-hop, bfs, dfs helper semantics for retrieval control.
- Benefit here: deterministic retrieval depth controls for task profile tuning.
- Candidate local surfaces:
  - scripts/harness/graph.mjs (neighbors/path already present; add named presets)
  - .github/skills/understand-process/SKILL.md
  - .github/skills/retrieval-quality-ops/SKILL.md

5. File-structure-aware function boundary recovery
- Pattern: map references back to containing function/method blocks via precomputed file structure.
- Benefit here: cleaner context slices for edits and reviewer evidence.
- Candidate local surfaces:
  - scripts/harness/graph-resources.mjs
  - scripts/harness/vector-search.mjs

### Risks to avoid carrying over

1. Dynamic execution during indexing
- RepoGraph uses exec/eval-like import introspection in graph extraction paths.
- Risk: unsafe and non-deterministic on untrusted repositories.
- Harness policy: keep extraction parse-only, no runtime execution of repository code.

2. Name-only node identity collisions
- RepoGraph commonly keys nodes by symbol name; same-name symbols in different files can collide.
- Risk: wrong edges and misleading context.
- Harness policy: keep canonical node ids as type:path:symbol.

3. Broad exception swallowing in core extraction loops
- Pattern seen in multiple extraction paths with catch-all fallback.
- Risk: silent data quality degradation.
- Harness policy: structured error events and explicit degraded mode telemetry.

4. Python-centric assumptions
- RepoGraph logic heavily optimizes .py extraction and python AST fallbacks.
- Risk: under-serving mixed-language repos.
- Harness policy: provider abstraction with language-agnostic graph readers and typed fallbacks.

## What already exists in this harness (do not duplicate)

1. Graph provider abstraction and degraded/fallback telemetry
- scripts/harness/graph-provider.mjs

2. Graph query CLI with neighbors, dependents, path, hubs, layers, annotate, brief-check
- scripts/harness/graph.mjs

3. Vector retrieval pipeline over memory and graph nodes
- scripts/harness/vector-search.mjs

4. Stage-machine and review gates (Understand -> Feedback)
- .github/harness/HARNESS.md
- skills/harness/SKILL.md

## Proposed incorporation backlog

### Phase A (quick wins, low risk)

1. Add graph symbol lookup command
- New CLI command: graph symbol <name> --hops 1 --json.
- Output: canonical symbol hits + def/ref neighborhood + confidence labels.

2. Add retrieval preset profiles
- New preset flags in graph/vector commands:
  - retrieve=repair-localization
  - retrieve=review-risk
  - retrieve=architect-blast-radius

3. Add skill update for graph-grounded retrieval
- Extend .github/skills/understand-process/SKILL.md with symbol-neighborhood workflow.

### Phase B (medium effort)

1. Add context-pack builder for patch loops
- Build deterministic context bundle sections for target symbols and adjacent callers/callees.

2. Add benchmark scenario in retrieval-quality-ops
- Compare vector-only vs symbol-neighborhood assisted retrieval on 5-10 tasks.
- Metrics: recall@k, token cost, first-pass patch acceptance, review-fix loop count.

### Phase C (advanced)

1. Add optional graph artifact caching contract
- Store run-scoped graph snapshots and tag maps under .github/harness/runs/graph-cache/.
- Include hash keys for commit + provider + config.

2. Add extraction hardening checks
- Explicit parser error-rate threshold gate before allowing non-trivial route/handoff.

## Success criteria

1. Median first-pass patch acceptance improves on repair-localization benchmark set.
2. Review-fix loop iterations decrease for symbol-heavy defects.
3. Retrieval token cost stays within +10% while recall@5 improves >= 15%.
4. No regression in preflight safety or degraded-state observability.

## Recommendation

Proceed with Phase A immediately. Phase B should be gated by the existing retrieval-quality-ops evaluation pattern. Phase C only after A/B evidence shows durable quality gain.

## Implementation update - 2026-08-06

- Action-level symbol lookup, MCP exposure, retrieval presets, and the higher-level `harness-mcp-tasks.mjs symbol` wrapper are implemented.
- Dependency context packs now include bounded source slices from canonical graph `filePath` and `lineRange` metadata when the path is repository-contained.
- Convergence-loop journals record graph context provenance, and `grade-trace` reports that provenance without changing trajectory scores.
- Provider loading now persists versioned JSON graph artifacts under `.github/harness/runs/graph-cache/`, keyed by provider, Git commit, harness config hash, and source graph fingerprint; cache hit/path metadata is exposed by graph status.
- Neighbor queries now support explicit deterministic `bfs` and `dfs` traversal, with the three retrieval presets defining traversal, depth, and result bounds.
- Function-boundary recovery is now shared by graph context packs, graph MCP resources, and vector graph documents/results; it returns safe bounded source content when `filePath` and `lineRange` are valid.
- Boundary recovery uses Babel AST ranges for JavaScript/TypeScript files when provider metadata is missing, optional Python AST recovery via trusted `HARNESS_PYTHON_COMMAND`, then bounded brace/indentation fallback for other supported source shapes; context packs enforce a 24,000-character aggregate limit.
- Neighborhood output now adds explicit `relationKind` labels (`definition`, `reference`, `related`) while preserving original graph relation names; fallback boundaries record their strategy.
- Focused regression coverage now exercises presets, fallback boundaries, cache reuse, MCP boundaries, context-pack limits, and vector boundary persistence.
