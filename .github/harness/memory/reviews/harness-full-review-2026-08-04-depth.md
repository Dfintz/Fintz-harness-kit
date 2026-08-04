# Review Depth: Harness Full Review - 2026-08-04

## Gate ledger

| Artifact or path | Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 4b | Gate 5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `harness-report.mjs` Brief inventory | PASS | FAIL | FAIL | FAIL | N/A | FAIL | Report owns the operator view, but it reimplements legacy status parsing instead of consuming the supported memory metadata format. |
| MCP resource validation path | PASS | PASS | PASS | FAIL | PASS | FAIL | `mcp-server.mjs` owns SDK transport; resource tests bypass it through raw stdio rather than reusing an initialized SDK-client seam. |
| MCP integration role assertion | PASS | PASS | PASS | FAIL | PASS | PASS | The integration test owns integration proof, but its role assertion diverges from the validator contract it composes. |
| command-dispatch fixture lifecycle | PASS | N/A | PASS | FAIL | FAIL | N/A | A failing test may leave configuration that affects later command dispatch, crossing the test-to-runtime safety boundary. |
| Review stage artifacts | PASS | PASS | PASS | PASS | PASS | PASS | The review uses existing Brief and memory/review artifact surfaces without adding a parallel workflow. |

## Structural findings

### Major

#### D1 - Report parsing duplicates an obsolete memory-status contract

- Artifact or path: `.github/harness/memory/README.md` -> `scripts/harness/harness-report.mjs`
- Gate / depth check failed: Gates 2, 3, 4, and 5.
- Evidence: The memory protocol allows `status:` frontmatter; `loadBriefs()` only inspects `firstLine()` for a title suffix. The report consequently labels 234 Briefs unknown.
- Why the structure is wrong: The reporting boundary owns presentation, not a divergent serialization rule. A local legacy parser makes the report incompatible with the persisted memory format and duplicates metadata interpretation.
- Recommended fix: Introduce or reuse a single frontmatter-aware Brief metadata reader shared by report and memory tooling, with a legacy-title fallback at the boundary.
- Confidence: HIGH

#### D2 - Resource tests are coupled to a superseded raw-stdio seam

- Artifact or path: `scripts/harness/test/mcp-resources-integration-test.mjs` and `mcp-resources-latency.mjs` -> `mcp-server.mjs`
- Gate / depth check failed: Gates 4 and 5.
- Evidence: The server uses MCP SDK `StdioServerTransport`; the passing stdio suite uses `StdioClientTransport`; failing resource tests bypass initialization and communicate directly with child stdio.
- Why the structure is wrong: Tests should observe the public MCP client seam. The raw transport harness has become a second, incompatible protocol implementation and cannot validate resource behavior or latency.
- Recommended fix: Extract a reusable SDK client-test helper and migrate resource list/read, streaming, and latency suites to it.
- Confidence: HIGH

#### D3 - Command-dispatch tests do not contain their mutable fixture lifecycle

- Artifact or path: `scripts/harness/test/mcp-command-dispatch-test.mjs`
- Gate / depth check failed: Gates 4 and 4b.
- Evidence: The test writes `.harness-test-config.json`; cleanup is after assertions and is absent from a suite-level `finally`.
- Why the structure is wrong: A test-owned fixture can escape into a runtime configuration boundary on an assertion failure, leaving state outside the test's lifecycle.
- Recommended fix: Centralize fixture creation/removal in a `try/finally` harness and clear `HARNESS_CONFIG_PATH` in the same cleanup path.
- Confidence: HIGH

## Brief divergence

- No runtime remediation was applied because the approved Brief explicitly constrained this run to review evidence and durable stage artifacts. The Major findings should route a subsequent task through Implement and a fresh depth review.
