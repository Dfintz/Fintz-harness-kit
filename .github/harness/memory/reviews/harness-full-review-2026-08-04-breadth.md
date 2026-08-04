# Review Breadth Findings: Harness Full Review - 2026-08-04

## Coverage

- Reviewed routing, graph, stage contracts, report and acceptance command behavior, MCP authentication, dispatch, transport, tasks, subscriptions, OAuth, ACL, and resource test surfaces.
- Executed the proof recorded in `harness-full-review-2026-08-04-implementation.md`; no runtime code was changed.

## Blocker

- None.

## Major

### B1 - Brief status reporting ignores supported frontmatter

- Artifact: `scripts/harness/harness-report.mjs`
- Finding: `loadBriefs()` reads only the first line and recognizes only a legacy title suffix, so frontmatter-backed Briefs report as `unknown` and render the YAML delimiter as their summary.
- Evidence: `npm run harness:report` reports `Briefs: 235 (unknown=234 active=1)` and recent lesson summaries as `---`; the parser checks `firstLine()` for `- active|implemented|superseded`, while the memory protocol supports `status:` frontmatter.
- Impact: Operators cannot reliably identify active, implemented, or superseded Briefs in the primary report, undermining the harness memory workflow.
- Confidence: HIGH
- Recommended fix: Parse YAML frontmatter `status` and `summary` first, retaining the title-suffix fallback for legacy files; add tests for both formats.

### B2 - Resource integration and latency tests no longer exercise the MCP server protocol

- Artifact: `scripts/harness/test/mcp-resources-integration-test.mjs`, `scripts/harness/test/mcp-resources-latency.mjs`
- Finding: Both tests fork `mcp-server.mjs` and write raw JSON-RPC without MCP initialization, although the server now uses the SDK `StdioServerTransport`. The integration test receives no output for `resources/list`; the latency test fails on iteration one.
- Evidence: `mcp-resources-integration-test.mjs` failed with `No output from server`; `test:mcp:resources:latency` failed before measuring latency. The SDK-client MRTR test succeeds through `StdioClientTransport`, and `mcp-server.mjs` registers `ListResourcesRequestSchema` and `ReadResourceRequestSchema` handlers.
- Impact: The repository has no passing end-to-end resource list/read or latency proof at the real client boundary; its declared resource validation signal is misleading.
- Confidence: HIGH
- Recommended fix: Replace raw child-process I/O with an SDK-client test that initializes MCP, lists and reads memory/graph resources, and measures the intended list/read and streaming time-to-first-chunk behavior.

### B3 - MCP integration test contradicts the current role-validation contract

- Artifact: `scripts/harness/test/mpc-integration-test.mjs`
- Finding: Test 5 expects `superadmin` to be invalid, but `extractCallerIdentity()` intentionally accepts any non-empty string role. The standalone auth suite explicitly accepts representative non-empty roles and passes.
- Evidence: `npm run test:mcp:dispatch:integration` fails `T5: Invalid role caught`; `mcp-auth-validator.mjs` rejects only empty/non-string roles; `mpc-auth-test.mjs` documents accepted non-empty roles.
- Impact: The aggregate dispatch integration suite is red even though its component contract passes, masking genuine integration regressions.
- Confidence: HIGH
- Recommended fix: Align Test 5 with the Phase 2a logging-only contract, or introduce and document an explicit allowlist if arbitrary roles should be rejected.

### B4 - Command-dispatch test leaks a fixture when an assertion fails

- Artifact: `scripts/harness/test/mcp-command-dispatch-test.mjs`
- Finding: Each case writes `.harness-test-config.json` and removes it only after assertions; the outer catch exits without `finally` cleanup.
- Evidence: `createTestConfig()` writes the shared fixture, while cleanup follows individual assertions; no final cleanup guard exists. The test was not run in this review for that reason.
- Impact: A failing test can leave untracked configuration that changes later command-dispatch behavior or pollutes a contributor's worktree.
- Confidence: HIGH
- Recommended fix: Wrap the suite or each case in `try/finally`, clear `HARNESS_CONFIG_PATH`, and remove the fixture unconditionally.

## Minor

### B5 - Default acceptance package script performs no acceptance verification

- Artifact: `package.json`, `scripts/harness/acceptance-gate.mjs`
- Finding: `npm run harness:acceptance` invokes the gate with no mode or spec, prints usage, and exits successfully.
- Evidence: The command output was usage only; `main()` dispatches only `scaffold`, `verify`, or `baseline` and otherwise calls `usage()`.
- Impact: A caller can mistake a zero exit for an acceptance result, particularly because the package script's name reads as an executable gate.
- Confidence: HIGH
- Recommended fix: Remove the ambiguous alias, require an explicit `--file`, or make the no-argument invocation exit nonzero with a remediation message.

## Missing-context note

- The review did not run external model providers or user-configured Lurkr scanning. Those dependencies are outside the checked-in deterministic contract.
