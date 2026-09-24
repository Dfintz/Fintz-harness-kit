# Architecture Brief: Graph Structured Absence Adoption
resource: .github/harness/memory/radar/repo-graph-structured-absence.md, .github/skills/eval-first-tuning/SKILL.md, scripts/harness/graph.mjs, scripts/harness/test/repograph-retrieval-test.mjs, scripts/harness/graph-resources.mjs, scripts/harness/mcp-tools.mjs, scripts/harness/run-loop.mjs
Status: active

## Architecture Brief

### Objective

- Add a provider-neutral, machine-readable `absence` object to valid empty graph-query JSON responses, preserving all existing fields and exit codes.

### Scope and boundaries

- In scope: `symbol`, `context-pack`, `neighbors`, `dependents`, and existing-node `path` queries whose valid result is empty, with command-specific absence semantics.
- In scope: a deterministic five-case regression test, real MCP-server no-path assertion, agent-facing absence documentation, and package command.
- Out of scope: changing invalid-node stderr/exit behavior, provider extraction, graph schemas, MCP protocol envelopes, ranking, traversal, or text-mode output.
- Primary boundary: `scripts/harness/graph.mjs` owns graph query response semantics; tests own the frozen baseline and contract assertions.
- Understand status: graph is fresh at HEAD `b01ec72`, cache hit, 3,108 nodes and 4,402 edges.

### Artifacts to create

- `scripts/harness/test/graph-structured-absence-test.mjs` - create a self-contained temporary repository and six-node graph fixture, then verify five additive absence cases, context-budget behavior, invalid-node compatibility, and MCP wrapper envelopes.
- `.github/harness/memory/briefs/graph-structured-absence-adoption-eval-2026-09-24.md` - record baseline, variant results, and adoption decision.
- `.github/harness/memory/briefs/graph-query-module-extraction-trigger-2026-09-24.md` - track the next-query-feature or second-consumer reassessment trigger without extracting prematurely.

### Artifacts to modify

- `scripts/harness/graph.mjs` - add one pure absence builder and attach it only to valid empty JSON payloads.
- `scripts/harness/test/mcp-stdio-test-client.mjs` - accept optional test-scoped cwd/environment overrides for the real-server fixture.
- `.github/skills/understand-process/SKILL.md` - document absence reasons, searched scope, fallback behavior, and deletion-safety denial.
- `package.json` - expose the focused deterministic test command; core aggregate inclusion remains conditional on the measured whole-test gate and is not part of the final state.
- `.github/harness/memory/radar/repo-graph-structured-absence.md` - append shipped evidence after implementation and review succeed.

### Key decisions

- Decision: preserve the current top-level payloads. `absence` is additive and appears only when the result is empty; non-empty responses remain byte-shape compatible apart from normal JSON formatting.
- Decision: use one shared shape: `reason`, `evidence`, `searched`, `limitations`, and `suggestedFallback`, while giving `reason` and `searched` command-specific meanings.
- Decision: `evidence: "FACT"` is always scoped by `searched`; it means only that the selected snapshot and named query rule/filter produced the stated empty result. It never proves source-code absence or deletion safety.
- Decision: command predicates are explicit:
	- `symbol`: `no_symbol_match`; case-insensitive name or id-suffix matching for non-file nodes, plus exact id matching, produced zero nodes.
	- `context-pack`: `no_symbol_match` when matching produced zero nodes; `context_budget_exhausted` when nodes matched but no section fit the fixed character budget.
	- `neighbors`: `no_edges_after_filters`; no edge survived the named node/depth/type/traversal query.
	- `dependents`: `no_import_dependents`; no incoming `imports` edge exists for the resolved node in the snapshot.
	- `path`: `no_directed_path`; directed BFS could not reach the resolved destination from the resolved source.
- Decision: `searched` contains bounded counts and command-relevant inputs, not raw graph data. Each payload includes `snapshotNodeCount` and `snapshotEdgeCount` plus its query/filter fields.
- Decision: provider-neutral limitations state that dynamic, generated, reflective, or otherwise unextracted relationships may be absent.
- Decision: preserve `path` exit 1 for no path and preserve invalid-node stderr/exit 1 with no JSON normalization in this slice. Run-loop continues to consume context-pack `content` only; metadata consumption is out of scope.
- Decision: the focused test exercises `mcp-tools.mjs` envelopes: empty symbol remains `ok: true` with `data.absence`; no-path remains `ok: false`, exit 1, with parsed `data.absence` retained.
- Decision: add the focused test to `test:harness:core` only if it is self-contained, performs no network/model call, does not read the workspace graph, and completes in under two seconds locally.
- Decision: document `no_symbol_match`, `context_budget_exhausted`, `no_edges_after_filters`, `no_import_dependents`, and `no_directed_path` in `understand-process`; agents must interpret `FACT` through `searched`, check freshness separately, and follow the fallback.
- Decision: preserve MCP `isError: true`, wrapper `ok: false`, and exit 1 for no directed path; assert equivalent absence data in real-server structured and text responses.
- Decision: keep query semantics in `graph.mjs`. Reassess a `graph-query.mjs` extraction when the next query feature lands or a second in-process consumer needs query execution; do not extract automatically.
- Gate 1, domain alignment: PASS. Query response semantics belong in the graph CLI.
- Gate 2, generality: PASS. The shared absence builder applies to all graph query types without provider-specific branching.
- Gate 3, ownership: PASS. Runtime semantics stay in `graph.mjs`; tests and evidence remain separate.
- Gate 4, boundary integrity: PASS. MCP wrappers and loop callers receive the additive CLI payload without new policy logic.
- Gate 4b, isolation and safety: PASS. The contract explicitly prevents treating graph absence as deletion proof.
- Gate 5, reuse: PASS. One helper prevents five near-duplicate miss payloads.

### Constraints

- Preserve every existing JSON key and current exit code.
- Do not add `absence` to non-empty results.
- Do not claim a safety improvement or encode provider-specific blind spots as universal facts.
- Do not normalize MCP failures to success based on `evidence: FACT`; existing CLI and MCP envelopes remain unchanged.
- Keep the test deterministic with a fixed six-node fixture under a temporary `HARNESS_REPO_ROOT`; baseline and variant use the identical serialized graph.
- Use the same graph snapshot for baseline and variant comparison.

### Validation plan

- Frozen fixture: six named nodes with one isolated node, one import edge, three non-import edges, and disconnected reachability. The test copies and overrides workspace configuration, then writes its own graph snapshot under a temporary repository root.
- Baseline five cases: missing symbol, missing context pack, isolated-node neighbors, import-leaf dependents, and no directed path. Baseline captured before implementation: all five preserve their domain payload but expose zero structured reason/evidence/scope/limitation/fallback fields.
- Predeclared quality metric: `machineActionabilityPasses`, one pass per empty response containing all five required fields with the correct command-specific reason and searched scope. Baseline is `0/5`; variant must be `5/5`.
- Predeclared compatibility metric: original top-level JSON projection, stdout/stderr behavior, and exit code. Variant must preserve `100%` of original keys/values and all six exit behaviors (five empty cases plus invalid node).
- Predeclared cost metric: serialized `absence` overhead. No empty response may add more than 1,024 UTF-8 bytes; the implementation may not add process, network, or model calls.
- Rejection gate: reject the variant if any quality case fails, any compatibility assertion changes, any payload exceeds the overhead bound, or the focused fixture test is not deterministic across two consecutive runs.
- Compatibility case: invalid node still exits 1 and writes the existing stderr message.
- Variant gate: all five empty payloads contain the full absence shape; context-pack budget exhaustion has a distinct reason; all original keys/values remain; non-empty symbol output has no `absence`; invalid-node behavior is unchanged.
- MCP gate: `mcp-tools.mjs` retains `data.absence` for empty-success and no-path-error envelopes without changing `ok` or `exitCode`.
- MCP protocol gate: real `mcp-server.mjs` preserves `isError: true`, wrapper status, and equivalent `no_directed_path` absence in `structuredContent.data` and parsed text `result.data`.
- Run the focused test twice, existing RepoGraph retrieval suite, graph fallback suite, MCP resources integration test, conditionally `npm run test:harness:core`, and `npm run harness:docs:check`.
- Run Snyk Code on every applicable final changed first-party JavaScript file; remediate and rescan any finding. Shipment requires a successful scan or a documented authorized human security-scan exception.
- Run Review Breadth and Review Depth against this Brief before updating the radar decision log.

### Do NOT

- Do not change provider loaders or graph generation.
- Do not convert invalid arguments or missing node IDs into successful results.
- Do not add prose-only warnings without a structured field.
- Do not copy upstream implementation code or overstate its benchmark.
- Do not update the radar entry to shipped until the full review and Feedback stages approve.
- Do not treat functional or architectural approval as shipment authorization while the security scan is blocked.
- Do not add provider/commit provenance in this slice; snapshot counts are descriptive scope, not freshness proof.

### Assumptions and risks

- `[UNVERIFIED]` Existing external consumers ignore unknown JSON fields as expected for an additive contract; focused local CLI/MCP callers and tests will be checked, but third-party scripts are not enumerable.
- Dynamic or generated relationships remain graph blind spots; the contract makes that uncertainty visible but does not improve extraction.
- Fixture configuration is copied and overridden from workspace configuration; graph and source fixtures are temporary. Local context-pack consumers include run-loop and prompt-middleware.
- Security gate, 2026-09-24: PASS. After authentication, Snyk Code reported zero issues for all three final changed JavaScript files: `scripts/harness/graph.mjs`, `scripts/harness/test/graph-structured-absence-test.mjs`, and `scripts/harness/test/mcp-stdio-test-client.mjs`. The focused test was rescanned after trusted-path refactoring and remained clean.